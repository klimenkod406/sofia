//! llama.cpp integration for local LLM inference

use crate::db::models::AIModel;
use anyhow::Result;
use std::path::Path;
use tokio::process::Command;

pub struct LlamaCppEngine {
    llama_cli: String,
    default_params: LlamaParams,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LlamaParams {
    pub n_ctx: i32,
    pub n_gpu_layers: i32,
    pub n_threads: i32,
    pub batch_size: i32,
    pub temp: f32,
    pub top_p: f32,
    pub top_k: i32,
    pub repeat_penalty: f32,
    pub seed: i32,
}

impl Default for LlamaParams {
    fn default() -> Self {
        Self {
            n_ctx: 4096,
            n_gpu_layers: -1, // Auto
            n_threads: 4,
            batch_size: 512,
            temp: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            seed: -1,
        }
    }
}

impl LlamaCppEngine {
    pub fn new() -> Result<Self> {
        let llama_cli = Self::find_llama_cli()?;

        Ok(Self {
            llama_cli,
            default_params: LlamaParams::default(),
        })
    }

    fn find_llama_cli() -> Result<String> {
        for cmd in ["llama-cli", "llama-server", "main"] {
            if let Ok(output) = std::process::Command::new(cmd).arg("--help").output() {
                if output.status.success() {
                    return Ok(cmd.to_string());
                }
            }
        }
        Err(anyhow::anyhow!(
            "llama.cpp not found. Please install llama.cpp"
        ))
    }

    pub async fn generate(
        &self,
        prompt: &str,
        model: &AIModel,
    ) -> Result<crate::services::ai::AnalysisResult> {
        let model_path = model
            .local_path
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("Model path not set"))?;

        if !Path::new(model_path).exists() {
            return Err(anyhow::anyhow!("Model file not found: {}", model_path));
        }

        let config: serde_json::Value = serde_json::from_str(&model.config)?;
        let params = self.merge_params(&config);

        let mut cmd = Command::new(&self.llama_cli);
        cmd.arg("-m")
            .arg(model_path)
            .arg("-p")
            .arg(prompt)
            .arg("-n")
            .arg(params.n_ctx.to_string())
            .arg("--temp")
            .arg(params.temp.to_string())
            .arg("--top-p")
            .arg(params.top_p.to_string())
            .arg("--top-k")
            .arg(params.top_k.to_string())
            .arg("--repeat-penalty")
            .arg(params.repeat_penalty.to_string())
            .arg("-t")
            .arg(params.n_threads.to_string())
            .arg("--batch-size")
            .arg(params.batch_size.to_string());

        if params.n_gpu_layers >= 0 {
            cmd.arg("--n-gpu-layers")
                .arg(params.n_gpu_layers.to_string());
        }

        if params.seed >= 0 {
            cmd.arg("--seed").arg(params.seed.to_string());
        }

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("llama.cpp generation failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let result = self.extract_generation(&stdout, prompt);

        Ok(crate::services::ai::AnalysisResult {
            result,
            metadata: serde_json::json!({
                "model": model.id,
                "params": params,
            }),
        })
    }

    pub async fn chat(
        &self,
        messages: Vec<crate::services::ai::ChatMessage>,
        model: &AIModel,
        options: crate::services::ai::ChatOptions,
    ) -> Result<crate::services::ai::ChatCompletion> {
        let model_path = model
            .local_path
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("Model path not set"))?;

        if !Path::new(model_path).exists() {
            return Err(anyhow::anyhow!("Model file not found: {}", model_path));
        }

        // Build conversation prompt
        let prompt = self.build_chat_prompt(&messages);

        let config: serde_json::Value = serde_json::from_str(&model.config)?;
        let params = self.merge_params(&config);
        let max_tokens = options.max_tokens;
        let params = params.with_overrides(options);

        let mut cmd = Command::new(&self.llama_cli);
        cmd.arg("-m")
            .arg(model_path)
            .arg("-p")
            .arg(prompt.clone())
            .arg("-n")
            .arg(max_tokens.to_string())
            .arg("--temp")
            .arg(params.temp.to_string())
            .arg("--top-p")
            .arg(params.top_p.to_string())
            .arg("--top-k")
            .arg(params.top_k.to_string())
            .arg("--repeat-penalty")
            .arg(params.repeat_penalty.to_string())
            .arg("-t")
            .arg(params.n_threads.to_string())
            .arg("--batch-size")
            .arg(params.batch_size.to_string());

        if params.n_gpu_layers >= 0 {
            cmd.arg("--n-gpu-layers")
                .arg(params.n_gpu_layers.to_string());
        }

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("llama.cpp chat failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let response = self.extract_generation(&stdout, &prompt);

        Ok(crate::services::ai::ChatCompletion {
            message: crate::services::ai::ChatMessage {
                role: "assistant".to_string(),
                content: response,
            },
            tokens_used: 0, // Would need to count tokens
            model: model.id.clone(),
        })
    }

    fn merge_params(&self, config: &serde_json::Value) -> LlamaParams {
        let mut params = self.default_params.clone();

        if let Some(n_ctx) = config.get("context_length").and_then(|v| v.as_i64()) {
            params.n_ctx = n_ctx as i32;
        }
        if let Some(n_gpu_layers) = config.get("n_gpu_layers").and_then(|v| v.as_i64()) {
            params.n_gpu_layers = n_gpu_layers as i32;
        }
        if let Some(n_threads) = config.get("n_threads").and_then(|v| v.as_i64()) {
            params.n_threads = n_threads as i32;
        }
        if let Some(batch_size) = config.get("batch_size").and_then(|v| v.as_i64()) {
            params.batch_size = batch_size as i32;
        }

        params
    }

    fn build_chat_prompt(&self, messages: &[crate::services::ai::ChatMessage]) -> String {
        let mut prompt = String::new();

        for msg in messages {
            match msg.role.as_str() {
                "system" => prompt.push_str(&format!("<|system|>\n{}\n", msg.content)),
                "user" => prompt.push_str(&format!("<|user|>\n{}\n", msg.content)),
                "assistant" => prompt.push_str(&format!("<|assistant|>\n{}\n", msg.content)),
                _ => prompt.push_str(&format!("<|user|>\n{}\n", msg.content)),
            }
        }

        prompt.push_str("<|assistant|>\n");
        prompt
    }

    fn extract_generation(&self, output: &str, prompt: &str) -> String {
        // Remove the prompt from output
        if let Some(idx) = output.find(prompt) {
            let after_prompt = &output[idx + prompt.len()..];
            // Find the actual response (after any special tokens)
            if let Some(start) = after_prompt.find("<|assistant|>") {
                return after_prompt[start + 11..].trim().to_string();
            }
            return after_prompt.trim().to_string();
        }
        output.trim().to_string()
    }
}

impl LlamaParams {
    fn with_overrides(mut self, options: crate::services::ai::ChatOptions) -> Self {
        self.temp = options.temperature;
        self.n_ctx = options.max_tokens;
        self.top_p = options.top_p;
        self
    }
}
