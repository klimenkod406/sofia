//! Model manager for downloading and managing AI models

use crate::db::models::AIModel;
use crate::db::repository::ModelsRepository;
use anyhow::Result;
use reqwest::Client;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ModelManager {
    models_repo: ModelsRepository,
    models_dir: PathBuf,
    download_states: Arc<RwLock<HashMap<String, DownloadState>>>,
    client: Client,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadState {
    pub model_id: String,
    pub progress: f32,
    pub status: DownloadStatus,
    pub error: Option<String>,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Verifying,
    Completed,
    Failed,
    Cancelled,
}

impl ModelManager {
    pub fn new(models_repo: ModelsRepository) -> Result<Self> {
        let models_dir = directories::BaseDirs::new()
            .map(|b| b.data_dir().join("sofia").join("models"))
            .unwrap_or_else(|| PathBuf::from(".").join("sofia-models"));

        std::fs::create_dir_all(&models_dir)?;

        Ok(Self {
            models_repo,
            models_dir,
            download_states: Arc::new(RwLock::new(HashMap::new())),
            client: Client::new(),
        })
    }

    pub fn get_models_dir(&self) -> &Path {
        &self.models_dir
    }

    pub fn get_model_path(&self, filename: &str) -> PathBuf {
        self.models_dir.join(filename)
    }

    pub async fn get_model(&self, id: &str) -> Result<AIModel> {
        self.models_repo
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Model not found: {}", id))
    }

    pub async fn get_default_transcription_model(&self) -> Result<AIModel> {
        self.models_repo
            .get_default_transcription()
            .await?
            .ok_or_else(|| anyhow::anyhow!("No default transcription model"))
    }

    pub async fn get_default_analysis_model(&self) -> Result<AIModel> {
        self.models_repo
            .get_default_analysis()
            .await?
            .ok_or_else(|| anyhow::anyhow!("No default analysis model"))
    }

    pub async fn get_default_chat_model(&self) -> Result<AIModel> {
        self.models_repo
            .get_default_chat()
            .await?
            .ok_or_else(|| anyhow::anyhow!("No default chat model"))
    }

    pub async fn download_model(
        &self,
        model_id: &str,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<()> {
        let model = self.get_model(model_id).await?;

        if model.is_downloaded {
            return Ok(());
        }

        // Never start a second download for the same model (the frontend can
        // re-issue install while a background download is still running).
        {
            let states = self.download_states.read().await;
            if let Some(s) = states.get(model_id) {
                if matches!(
                    s.status,
                    DownloadStatus::Pending | DownloadStatus::Downloading
                ) {
                    return Ok(());
                }
            }
        }

        // Initialize download state
        {
            let mut states = self.download_states.write().await;
            states.insert(
                model_id.to_string(),
                DownloadState {
                    model_id: model_id.to_string(),
                    progress: 0.0,
                    status: DownloadStatus::Downloading,
                    error: None,
                    bytes_downloaded: 0,
                    total_bytes: model.size_bytes as u64,
                },
            );
        }

        // Update database progress
        self.models_repo
            .set_download_progress(model_id, 0.0)
            .await?;

        let result = match model.source.as_str() {
            "local" => self.download_local_model(&model, progress_callback).await,
            "huggingface" => {
                self.download_huggingface_model(&model, progress_callback)
                    .await
            }
            _ => Err(anyhow::anyhow!(
                "Unsupported model source: {}",
                model.source
            )),
        };

        // Update final state
        {
            let mut states = self.download_states.write().await;
            if let Some(state) = states.get_mut(model_id) {
                match &result {
                    Ok(_) => {
                        state.status = DownloadStatus::Completed;
                        state.progress = 1.0;
                        state.bytes_downloaded = state.total_bytes;
                    }
                    Err(e) => {
                        state.status = DownloadStatus::Failed;
                        state.error = Some(e.to_string());
                    }
                }
            }
        }

        if let Ok(local_path) = &result {
            self.models_repo
                .mark_downloaded(model_id, &local_path.to_string_lossy())
                .await?;
        } else if let Err(_e) = &result {
            self.models_repo.update(&model).await?;
        }

        result.map(|_| ())
    }

    async fn download_local_model(
        &self,
        model: &AIModel,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<PathBuf> {
        // For local models (FunASR, etc.), use Python to download
        if model.model_type == "transcription"
            && model.model_id.as_deref().unwrap_or("").contains("funasr")
        {
            return self.download_funasr_model(model, progress_callback).await;
        }

        // For GGUF models, download from HuggingFace
        self.download_gguf_model(model, progress_callback).await
    }

    async fn download_funasr_model(
        &self,
        model: &AIModel,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<PathBuf> {
        // Use modelscope or huggingface_hub to download FunASR models
        let model_id = model
            .model_id
            .as_deref()
            .unwrap_or("iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch");
        let local_dir = self
            .models_dir
            .join("funasr")
            .join(model_id.replace('/', "_"));

        std::fs::create_dir_all(&local_dir)?;

        // Report progress
        self.models_repo
            .set_download_progress(&model.id, 0.1)
            .await?;
        if let Some(cb) = &progress_callback {
            cb(0.1);
        }

        // Use Python to download via modelscope
        let python = crate::ai::funasr::FunASRTranscriber::find_python()?;
        let output = tokio::process::Command::new(&python)
            .arg("-m")
            .arg("modelscope.cli")
            .arg("download")
            .arg("--model")
            .arg(model_id)
            .arg("--local_dir")
            .arg(&local_dir)
            .output()
            .await?;

        if let Some(cb) = &progress_callback {
            cb(0.5);
        }
        self.models_repo
            .set_download_progress(&model.id, 0.5)
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("FunASR model download failed: {}", stderr));
        }

        if let Some(cb) = &progress_callback {
            cb(1.0);
        }

        Ok(local_dir)
    }

    async fn download_gguf_model(
        &self,
        model: &AIModel,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<PathBuf> {
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;

        let repo = model
            .huggingface_repo
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("HuggingFace repo not specified"))?;

        let filename = model
            .model_id
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("Model filename not specified"))?;

        let local_path = self.models_dir.join("gguf").join(filename);
        std::fs::create_dir_all(local_path.parent().unwrap())?;

        // Download with progress using reqwest, streaming straight to disk so a
        // multi-GB model is never buffered in RAM.
        let url = format!("https://huggingface.co/{}/resolve/main/{}", repo, filename);

        let response = self.client.get(&url).send().await?;
        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Download failed: HTTP {} for {}",
                response.status(),
                url
            ));
        }

        let total_size = response
            .content_length()
            .unwrap_or(model.size_bytes as u64)
            .max(1);
        let mut file = tokio::fs::File::create(&local_path).await?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_pct: i32 = -1;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| anyhow::anyhow!("Download stream error: {e}"))?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            // Report progress at every whole percent: DB row is polled by the
            // frontend, the callback covers the in-process callers.
            let pct = (downloaded as f64 / total_size as f64 * 100.0) as i32;
            if pct != last_pct {
                last_pct = pct;
                let progress = (downloaded as f32 / total_size as f32).min(1.0);
                if let Some(cb) = &progress_callback {
                    cb(progress);
                }
                self.models_repo
                    .set_download_progress(&model.id, progress)
                    .await?;
            }
        }
        file.flush().await?;

        self.models_repo
            .set_download_progress(&model.id, 1.0)
            .await?;
        if let Some(cb) = &progress_callback {
            cb(1.0);
        }

        // A whisper model is only useful with the CLI that runs it. Fetch the
        // bundled binary (first install only) so dictation works out of the box.
        self.ensure_whisper_cli().await?;

        Ok(local_path)
    }

    /// Ensure the bundled whisper.cpp CLI is present, downloading the official
    /// Windows build from GitHub releases on first use. Returns the CLI path.
    ///
    /// The app downloads ggml-*.bin weights, which whisper.cpp v1.6+ can no
    /// longer read, so the pinned v1.5.4 build is used — it reads `.bin` and
    /// supports `-l auto` language detection.
    pub async fn ensure_whisper_cli(&self) -> Result<PathBuf> {
        let bin_dir = self.models_dir.join("bin");
        let cli_path = bin_dir.join("whisper-cli.exe");

        if cli_path.exists() {
            return Ok(cli_path);
        }
        if !cfg!(windows) {
            return Err(anyhow::anyhow!(
                "whisper.cpp CLI is only bundled on Windows — install whisper-cli on PATH"
            ));
        }

        std::fs::create_dir_all(&bin_dir)?;

        let url =
            "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip";
        let response = self.client.get(url).send().await?;
        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to download whisper.cpp CLI: HTTP {}",
                response.status()
            ));
        }
        let bytes = response.bytes().await?;

        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes))
            .map_err(|e| anyhow::anyhow!("Invalid whisper.cpp CLI archive: {e}"))?;

        // `main.exe` is the CLI (renamed for clarity); `whisper.dll` is its
        // runtime and must sit next to it.
        for (entry_name, target_name) in [
            ("main.exe", "whisper-cli.exe"),
            ("whisper.dll", "whisper.dll"),
        ] {
            // Read the entry fully before the await — ZipFile isn't Send.
            let buf = {
                let mut entry = archive
                    .by_name(entry_name)
                    .map_err(|e| anyhow::anyhow!("CLI archive missing {entry_name}: {e}"))?;
                let mut buf = Vec::new();
                std::io::Read::read_to_end(&mut entry, &mut buf)?;
                buf
            };
            tokio::fs::write(bin_dir.join(target_name), buf).await?;
        }

        Ok(cli_path)
    }

    async fn download_huggingface_model(
        &self,
        model: &AIModel,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<PathBuf> {
        // Similar to GGUF but for other HF model formats
        self.download_gguf_model(model, progress_callback).await
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<()> {
        let model = self.get_model(model_id).await?;

        if let Some(local_path) = &model.local_path {
            let path = Path::new(local_path);
            if path.exists() {
                tokio::fs::remove_dir_all(path).await?;
            }
        }

        // Reset downloaded status in database
        let mut model = model;
        model.is_downloaded = false;
        model.local_path = None;
        model.download_progress = 0.0;
        self.models_repo.update(&model).await?;

        // Clear download state
        let mut states = self.download_states.write().await;
        states.remove(model_id);

        Ok(())
    }

    pub async fn set_api_key(&self, model_id: &str, api_key: &str) -> Result<()> {
        let mut model = self.get_model(model_id).await?;

        // Encrypt API key (in production, use proper encryption)
        let encrypted = encrypt_api_key(api_key)?;
        model.api_key_encrypted = Some(encrypted);

        self.models_repo.update(&model).await?;
        Ok(())
    }

    pub async fn get_decrypted_api_key(&self, model_id: &str) -> Result<String> {
        let model = self.get_model(model_id).await?;
        let encrypted = model
            .api_key_encrypted
            .ok_or_else(|| anyhow::anyhow!("No API key set for model"))?;

        decrypt_api_key(&encrypted)
    }

    pub async fn test_connection(&self, model_id: &str) -> Result<bool> {
        let model = self.get_model(model_id).await?;

        if model.source != "api" {
            return Ok(true); // Local models don't need connection test
        }

        let api_key = self.get_decrypted_api_key(model_id).await?;
        let api_endpoint = model
            .api_endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1");

        let client = Client::new();
        let response = client
            .get(format!("{}/models", api_endpoint))
            .bearer_auth(api_key)
            .send()
            .await?;

        Ok(response.status().is_success())
    }

    pub async fn get_download_state(&self, model_id: &str) -> Option<DownloadState> {
        let states = self.download_states.read().await;
        states.get(model_id).cloned()
    }

    pub async fn list_downloading(&self) -> Vec<DownloadState> {
        let states = self.download_states.read().await;
        states.values().cloned().collect()
    }
}

fn encrypt_api_key(key: &str) -> Result<String> {
    // In production, use proper encryption (e.g., AES-256 with key from OS keychain)
    // For now, simple base64 encoding (NOT SECURE - placeholder only)
    use base64::Engine as _;
    Ok(base64::engine::general_purpose::STANDARD.encode(key))
}

fn decrypt_api_key(encrypted: &str) -> Result<String> {
    use base64::Engine as _;
    let decoded = base64::engine::general_purpose::STANDARD.decode(encrypted)?;
    Ok(String::from_utf8(decoded)?)
}
