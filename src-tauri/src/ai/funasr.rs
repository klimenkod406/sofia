//! FunASR integration for Chinese/English transcription

use anyhow::Result;
use std::path::Path;
use tokio::process::Command;
use crate::ai::transcription::{TranscriptionJob, TranscriptionResult, TranscriptionSegment};

pub struct FunASRTranscriber {
    model_dir: String,
    python_executable: String,
    script_path: String,
}

impl FunASRTranscriber {
    pub fn new(model_dir: &str) -> Result<Self> {
        // Find Python executable
        let python_executable = Self::find_python()?;
        
        // Check if FunASR script exists
        let script_path = Self::find_funasr_script()?;
        
        Ok(Self {
            model_dir: model_dir.to_string(),
            python_executable,
            script_path,
        })
    }

    pub(crate) fn find_python() -> Result<String> {
        // Try common Python commands
        for cmd in ["python3", "python", "py"] {
            if let Ok(output) = std::process::Command::new(cmd).arg("--version").output() {
                if output.status.success() {
                    return Ok(cmd.to_string());
                }
            }
        }
        Err(anyhow::anyhow!("Python not found. Please install Python 3.8+"))
    }

    fn find_funasr_script() -> Result<String> {
        // In production, this would be bundled with the app
        // For now, assume it's in the resources directory
        let possible_paths = [
            "resources/funasr/transcribe.py",
            "../resources/funasr/transcribe.py",
            "../../resources/funasr/transcribe.py",
        ];

        for path in possible_paths {
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }

        // Return default path - will be created at runtime
        Ok("resources/funasr/transcribe.py".to_string())
    }

    pub async fn transcribe(&self, job: &TranscriptionJob) -> Result<TranscriptionResult> {
        let audio_path = &job.audio_path;
        let language = &job.language;
        let model_id = job.model_id.as_deref().unwrap_or("iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch");

        // Build command
        let mut cmd = Command::new(&self.python_executable);
        cmd.arg(&self.script_path)
            .arg("--audio").arg(audio_path)
            .arg("--model").arg(model_id)
            .arg("--model_dir").arg(&self.model_dir)
            .arg("--language").arg(language)
            .arg("--output_format").arg("json");

        // Add VAD and punctuation models if available
        let vad_model = format!("{}/speech_fsmn_vad_zh-cn-16k-common-pytorch", self.model_dir);
        let punc_model = format!("{}/punc_ct-transformer_zh-cn-common-vocab272727-pytorch", self.model_dir);
        
        if Path::new(&vad_model).exists() {
            cmd.arg("--vad_model").arg(&vad_model);
        }
        if Path::new(&punc_model).exists() {
            cmd.arg("--punc_model").arg(&punc_model);
        }

        // Execute
        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("FunASR transcription failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.parse_output(&stdout)
    }

    pub async fn transcribe_stream(&self, job: &TranscriptionJob, sender: tokio::sync::mpsc::Sender<TranscriptionSegment>) -> Result<()> {
        let audio_path = &job.audio_path;
        let language = &job.language;
        let model_id = job.model_id.as_deref().unwrap_or("iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch");

        let mut cmd = Command::new(&self.python_executable);
        cmd.arg(&self.script_path)
            .arg("--audio").arg(audio_path)
            .arg("--model").arg(model_id)
            .arg("--model_dir").arg(&self.model_dir)
            .arg("--language").arg(language)
            .arg("--stream").arg("true")
            .arg("--output_format").arg("jsonl");

        let mut child = cmd.spawn()?;

        // Read stdout line by line
        use tokio::io::{AsyncBufReadExt, BufReader};
        let stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("Failed to capture stdout"))?;
        let mut reader = BufReader::new(stdout).lines();

        while let Some(line) = reader.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(segment) = serde_json::from_str::<TranscriptionSegment>(&line) {
                if sender.send(segment).await.is_err() {
                    break; // Receiver dropped
                }
            }
        }

        child.wait().await?;
        Ok(())
    }

    fn parse_output(&self, output: &str) -> Result<TranscriptionResult> {
        // Parse FunASR JSON output
        #[derive(serde::Deserialize)]
        struct FunASROutput {
            text: String,
            segments: Vec<FunASRSegment>,
        }

        #[derive(serde::Deserialize)]
        struct FunASRSegment {
            start: f32,
            end: f32,
            text: String,
            speaker: Option<String>,
            confidence: Option<f32>,
        }

        let parsed: FunASROutput = serde_json::from_str(output)
            .map_err(|e| anyhow::anyhow!("Failed to parse FunASR output: {}", e))?;

        let segments: Vec<TranscriptionSegment> = parsed.segments.into_iter().map(|s| TranscriptionSegment {
            start: s.start,
            end: s.end,
            text: s.text,
            speaker: s.speaker,
            confidence: s.confidence.unwrap_or(1.0),
        }).collect();

        let duration = segments.last().map(|s| s.end).unwrap_or(0.0);

        Ok(TranscriptionResult {
            text: parsed.text,
            segments,
            duration,
            language: "auto".to_string(), // Would be detected
        })
    }

    pub async fn download_models(&self, model_id: &str) -> Result<()> {
        // Download FunASR models using ModelScope or HuggingFace
        let mut cmd = Command::new(&self.python_executable);
        cmd.arg("-m").arg("modelscope.cli")
            .arg("download")
            .arg("--model").arg(model_id)
            .arg("--local_dir").arg(&self.model_dir);

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Model download failed: {}", stderr));
        }

        Ok(())
    }
}

// Fallback implementation using whisper.cpp for when FunASR is not available
pub struct WhisperCppTranscriber {
    model_path: String,
    whisper_cli: String,
}

impl WhisperCppTranscriber {
    pub fn new(model_path: &str) -> Result<Self> {
        // Find whisper-cli binary
        let whisper_cli = Self::find_whisper_cli()?;
        
        Ok(Self {
            model_path: model_path.to_string(),
            whisper_cli,
        })
    }

    fn find_whisper_cli() -> Result<String> {
        for cmd in ["whisper-cli", "whisper", "main"] {
            if let Ok(output) = std::process::Command::new(cmd).arg("--help").output() {
                if output.status.success() {
                    return Ok(cmd.to_string());
                }
            }
        }
        Err(anyhow::anyhow!("whisper.cpp not found. Please install whisper.cpp"))
    }

    pub async fn transcribe(&self, audio_path: &str, language: &str) -> Result<TranscriptionResult> {
        let mut cmd = Command::new(&self.whisper_cli);
        cmd.arg("-m").arg(&self.model_path)
            .arg("-f").arg(audio_path)
            .arg("-oj")  // JSON output
            .arg("-l").arg(language);

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("whisper.cpp transcription failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.parse_whisper_output(&stdout)
    }

    fn parse_whisper_output(&self, output: &str) -> Result<TranscriptionResult> {
        #[derive(serde::Deserialize)]
        struct WhisperOutput {
            text: String,
            segments: Vec<WhisperSegment>,
        }

        #[derive(serde::Deserialize)]
        struct WhisperSegment {
            start: f32,
            end: f32,
            text: String,
        }

        let parsed: WhisperOutput = serde_json::from_str(output)
            .map_err(|e| anyhow::anyhow!("Failed to parse whisper output: {}", e))?;

        let segments: Vec<TranscriptionSegment> = parsed.segments.into_iter().map(|s| TranscriptionSegment {
            start: s.start,
            end: s.end,
            text: s.text,
            speaker: None,
            confidence: 1.0,
        }).collect();

        let duration = segments.last().map(|s| s.end).unwrap_or(0.0);

        Ok(TranscriptionResult {
            text: parsed.text,
            segments,
            duration,
            language: "auto".to_string(),
        })
    }
}