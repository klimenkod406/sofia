//! Analysis engine for text processing

use crate::ai::llama_cpp::LlamaCppEngine;
use crate::ai::models::ModelManager;
use crate::db::models::AIModel;
use anyhow::Result;
use std::sync::Arc;

pub struct AnalysisEngine {
    models: Arc<ModelManager>,
    llama: Option<LlamaCppEngine>,
}

impl AnalysisEngine {
    pub fn new(models: Arc<ModelManager>) -> Result<Self> {
        // Initialize llama.cpp engine for local LLMs
        let llama = LlamaCppEngine::new().ok();

        Ok(Self { models, llama })
    }

    pub async fn analyze(
        &self,
        text: &str,
        analysis_type: crate::services::ai::AnalysisType,
        model_id: Option<&str>,
    ) -> Result<crate::services::ai::AnalysisResult> {
        // Get model to use
        let model = if let Some(id) = model_id {
            self.models.get_model(id).await?
        } else {
            self.models.get_default_analysis_model().await?
        };

        let prompt = self.build_prompt(text, &analysis_type);

        // Try local model first
        if let Some(llama) = &self.llama {
            if model.source == "local" {
                return llama.generate(&prompt, &model).await;
            }
        }

        // Fallback to API
        if model.source == "api" {
            return self.analyze_api(text, &analysis_type, &model).await;
        }

        Err(anyhow::anyhow!("No analysis engine available"))
    }

    pub async fn chat(
        &self,
        messages: Vec<crate::services::ai::ChatMessage>,
        model_id: Option<&str>,
        options: crate::services::ai::ChatOptions,
    ) -> Result<crate::services::ai::ChatCompletion> {
        let model = if let Some(id) = model_id {
            self.models.get_model(id).await?
        } else {
            self.models.get_default_chat_model().await?
        };

        // Try local model first
        if let Some(llama) = &self.llama {
            if model.source == "local" {
                return llama.chat(messages, &model, options).await;
            }
        }

        // Fallback to API
        if model.source == "api" {
            return self.chat_api(messages, &model, options).await;
        }

        Err(anyhow::anyhow!("No chat engine available"))
    }

    fn build_prompt(
        &self,
        text: &str,
        analysis_type: &crate::services::ai::AnalysisType,
    ) -> String {
        match analysis_type {
            crate::services::ai::AnalysisType::Summarize => {
                format!(
                    "Summarize the following text concisely, preserving key points:\n\n{}\n\nSummary:",
                    text
                )
            }
            crate::services::ai::AnalysisType::Correct => {
                format!(
                    "Correct any grammar, spelling, or punctuation errors in the following text. Return only the corrected text:\n\n{}",
                    text
                )
            }
            crate::services::ai::AnalysisType::Improve => {
                format!(
                    "Improve the clarity, flow, and readability of the following text while preserving its meaning:\n\n{}\n\nImproved version:",
                    text
                )
            }
            crate::services::ai::AnalysisType::Translate { target_language } => {
                format!(
                    "Translate the following text to {}:\n\n{}",
                    target_language, text
                )
            }
            crate::services::ai::AnalysisType::ExtractKeyPoints => {
                format!(
                    "Extract the key points from the following text as a bullet list:\n\n{}\n\nKey points:",
                    text
                )
            }
            crate::services::ai::AnalysisType::ExtractActionItems => {
                format!(
                    "Extract action items and tasks from the following text as a checklist:\n\n{}\n\nAction items:",
                    text
                )
            }
            crate::services::ai::AnalysisType::AnalyzeSentiment => {
                format!(
                    "Analyze the sentiment and emotional tone of the following text:\n\n{}\n\nAnalysis:",
                    text
                )
            }
            crate::services::ai::AnalysisType::GenerateTags => {
                format!(
                    "Generate 5-10 relevant tags for the following text, separated by commas:\n\n{}\n\nTags:",
                    text
                )
            }
            crate::services::ai::AnalysisType::Custom { prompt } => {
                format!("{}\n\nText:\n{}", prompt, text)
            }
        }
    }

    async fn analyze_api(
        &self,
        text: &str,
        analysis_type: &crate::services::ai::AnalysisType,
        model: &AIModel,
    ) -> Result<crate::services::ai::AnalysisResult> {
        let prompt = self.build_prompt(text, analysis_type);
        let api_endpoint = model
            .api_endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1");
        let api_key = self.models.get_decrypted_api_key(&model.id).await?;

        let client = reqwest::Client::new();

        #[derive(serde::Serialize)]
        struct ChatRequest {
            model: String,
            messages: Vec<ChatMessage>,
            temperature: f32,
            max_tokens: i32,
        }

        #[derive(serde::Serialize)]
        struct ChatMessage {
            role: String,
            content: String,
        }

        let request = ChatRequest {
            model: model
                .model_id
                .clone()
                .unwrap_or_else(|| "gpt-4o-mini".to_string()),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are a helpful assistant for text analysis.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 2048,
        };

        let response = client
            .post(format!("{}/chat/completions", api_endpoint))
            .bearer_auth(api_key)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error = response.text().await?;
            return Err(anyhow::anyhow!("API analysis failed: {}", error));
        }

        #[derive(serde::Deserialize)]
        struct ChatResponse {
            choices: Vec<ChatChoice>,
            usage: Option<Usage>,
        }

        #[derive(serde::Deserialize)]
        struct ChatChoice {
            message: ChatMessageResponse,
        }

        #[derive(serde::Deserialize)]
        struct ChatMessageResponse {
            content: String,
        }

        #[derive(serde::Deserialize)]
        struct Usage {
            total_tokens: i32,
        }

        let api_response: ChatResponse = response.json().await?;
        let result = api_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(crate::services::ai::AnalysisResult {
            result,
            metadata: serde_json::json!({
                "model": model.id,
                "tokens_used": api_response.usage.map(|u| u.total_tokens).unwrap_or(0),
            }),
        })
    }

    async fn chat_api(
        &self,
        messages: Vec<crate::services::ai::ChatMessage>,
        model: &AIModel,
        options: crate::services::ai::ChatOptions,
    ) -> Result<crate::services::ai::ChatCompletion> {
        let api_endpoint = model
            .api_endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1");
        let api_key = self.models.get_decrypted_api_key(&model.id).await?;

        let client = reqwest::Client::new();

        #[derive(serde::Serialize)]
        struct ChatRequest {
            model: String,
            messages: Vec<ApiMessage>,
            temperature: f32,
            max_tokens: i32,
            top_p: f32,
            stream: bool,
        }

        #[derive(serde::Serialize)]
        struct ApiMessage {
            role: String,
            content: String,
        }

        let request = ChatRequest {
            model: model
                .model_id
                .clone()
                .unwrap_or_else(|| "gpt-4o-mini".to_string()),
            messages: messages
                .into_iter()
                .map(|m| ApiMessage {
                    role: m.role,
                    content: m.content,
                })
                .collect(),
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            top_p: options.top_p,
            stream: options.stream,
        };

        let response = client
            .post(format!("{}/chat/completions", api_endpoint))
            .bearer_auth(api_key)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error = response.text().await?;
            return Err(anyhow::anyhow!("API chat failed: {}", error));
        }

        #[derive(serde::Deserialize)]
        struct ChatResponse {
            choices: Vec<ChatChoice>,
            usage: Option<Usage>,
            model: String,
        }

        #[derive(serde::Deserialize)]
        struct ChatChoice {
            message: ChatMessageResponse,
        }

        #[derive(serde::Deserialize)]
        struct ChatMessageResponse {
            content: String,
        }

        #[derive(serde::Deserialize)]
        struct Usage {
            total_tokens: i32,
        }

        let api_response: ChatResponse = response.json().await?;
        let choice = api_response
            .choices
            .first()
            .ok_or_else(|| anyhow::anyhow!("No response from API"))?;

        Ok(crate::services::ai::ChatCompletion {
            message: crate::services::ai::ChatMessage {
                role: "assistant".to_string(),
                content: choice.message.content.clone(),
            },
            tokens_used: api_response.usage.map(|u| u.total_tokens).unwrap_or(0),
            model: api_response.model,
        })
    }
}
