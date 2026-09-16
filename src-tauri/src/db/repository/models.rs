//! AI Models repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct ModelsRepository {
    db: Sql,
}

impl ModelsRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut model: AIModel) -> Result<AIModel> {
        model.id = Uuid::new_v4().to_string();
        
        self.db.execute_with_params(
            r#"
            INSERT INTO ai_models (id, name, model_type, source, model_id, api_endpoint,
                                  api_key_encrypted, local_path, huggingface_repo,
                                  huggingface_revision, tokenizer_path, config_path,
                                  size_bytes, quantization, languages, capabilities,
                                  config, min_ram_gb, recommended_ram_gb,
                                  supports_gpu, supports_cpu, max_context_length,
                                  sample_rate, chunk_duration_seconds, overlap_duration_seconds,
                                  is_active, is_downloaded, download_progress,
                                  last_used_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            vec![
                Value::Text(model.id.clone()),
                Value::Text(model.name.clone()),
                Value::Text(model.model_type.clone()),
                Value::Text(model.source.clone()),
                Value::Text(model.model_id.clone().unwrap_or_default()),
                Value::Text(model.api_endpoint.clone().unwrap_or_default()),
                Value::Text(model.api_key_encrypted.clone().unwrap_or_default()),
                Value::Text(model.local_path.clone().unwrap_or_default()),
                Value::Text(model.huggingface_repo.clone().unwrap_or_default()),
                Value::Text(model.huggingface_revision.clone().unwrap_or_default()),
                Value::Text(model.tokenizer_path.clone().unwrap_or_default()),
                Value::Text(model.config_path.clone().unwrap_or_default()),
                Value::Integer(model.size_bytes),
                Value::Text(model.quantization.clone().unwrap_or_default()),
                Value::Text(model.languages.clone()),
                Value::Text(model.capabilities.clone()),
                Value::Text(model.config.clone()),
                Value::Integer(model.min_ram_gb as i64),
                Value::Integer(model.recommended_ram_gb as i64),
                Value::Integer(if model.supports_gpu { 1 } else { 0 }),
                Value::Integer(if model.supports_cpu { 1 } else { 0 }),
                Value::Integer(model.max_context_length as i64),
                Value::Integer(model.sample_rate as i64),
                Value::Real(model.chunk_duration_seconds as f64),
                Value::Real(model.overlap_duration_seconds as f64),
                Value::Integer(if model.is_active { 1 } else { 0 }),
                Value::Integer(if model.is_downloaded { 1 } else { 0 }),
                Value::Real(model.download_progress as f64),
                Value::Text(model.last_used_at.map(|d| d.to_rfc3339()).unwrap_or_default()),
                Value::Text(model.created_at.to_rfc3339()),
                Value::Text(model.updated_at.to_rfc3339()),
            ],
        ).await?;

        Ok(model)
    }

    pub async fn get(&self, id: &str) -> Result<Option<AIModel>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM ai_models WHERE id = ?",
            vec![Value::Text(id.to_string())],
        ).await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_model(row)))
    }

    pub async fn update(&self, model: &AIModel) -> Result<()> {
        self.db.execute_with_params(
            r#"
            UPDATE ai_models SET
                name = ?, model_type = ?, source = ?, model_id = ?, api_endpoint = ?,
                api_key_encrypted = ?, local_path = ?, huggingface_repo = ?,
                huggingface_revision = ?, tokenizer_path = ?, config_path = ?,
                size_bytes = ?, quantization = ?, languages = ?, capabilities = ?,
                config = ?, min_ram_gb = ?, recommended_ram_gb = ?,
                supports_gpu = ?, supports_cpu = ?, max_context_length = ?,
                sample_rate = ?, chunk_duration_seconds = ?, overlap_duration_seconds = ?,
                is_active = ?, is_downloaded = ?, download_progress = ?,
                last_used_at = ?, updated_at = ?
            WHERE id = ?
            "#,
            vec![
                Value::Text(model.name.clone()),
                Value::Text(model.model_type.clone()),
                Value::Text(model.source.clone()),
                Value::Text(model.model_id.clone().unwrap_or_default()),
                Value::Text(model.api_endpoint.clone().unwrap_or_default()),
                Value::Text(model.api_key_encrypted.clone().unwrap_or_default()),
                Value::Text(model.local_path.clone().unwrap_or_default()),
                Value::Text(model.huggingface_repo.clone().unwrap_or_default()),
                Value::Text(model.huggingface_revision.clone().unwrap_or_default()),
                Value::Text(model.tokenizer_path.clone().unwrap_or_default()),
                Value::Text(model.config_path.clone().unwrap_or_default()),
                Value::Integer(model.size_bytes),
                Value::Text(model.quantization.clone().unwrap_or_default()),
                Value::Text(model.languages.clone()),
                Value::Text(model.capabilities.clone()),
                Value::Text(model.config.clone()),
                Value::Integer(model.min_ram_gb as i64),
                Value::Integer(model.recommended_ram_gb as i64),
                Value::Integer(if model.supports_gpu { 1 } else { 0 }),
                Value::Integer(if model.supports_cpu { 1 } else { 0 }),
                Value::Integer(model.max_context_length as i64),
                Value::Integer(model.sample_rate as i64),
                Value::Real(model.chunk_duration_seconds as f64),
                Value::Real(model.overlap_duration_seconds as f64),
                Value::Integer(if model.is_active { 1 } else { 0 }),
                Value::Integer(if model.is_downloaded { 1 } else { 0 }),
                Value::Real(model.download_progress as f64),
                Value::Text(model.last_used_at.map(|d| d.to_rfc3339()).unwrap_or_default()),
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(model.id.clone()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db.execute_with_params(
            "DELETE FROM ai_models WHERE id = ?",
            vec![Value::Text(id.to_string())],
        ).await?;
        Ok(())
    }

    pub async fn list(&self, model_type: Option<&str>, source: Option<&str>, active_only: bool) -> Result<Vec<AIModel>> {
        let mut query = String::from("SELECT * FROM ai_models WHERE 1=1");
        let mut params = Vec::new();

        if let Some(model_type) = model_type {
            query.push_str(" AND model_type = ?");
            params.push(Value::Text(model_type.to_string()));
        }

        if let Some(source) = source {
            query.push_str(" AND source = ?");
            params.push(Value::Text(source.to_string()));
        }

        if active_only {
            query.push_str(" AND is_active = TRUE");
        }

        query.push_str(" ORDER BY model_type, name");

        let rows = self.db.select_with_params(&query, params).await?;
        Ok(rows.into_iter().filter_map(|row| self.row_to_model(row)).collect())
    }

    pub async fn get_by_type(&self, model_type: &str) -> Result<Vec<AIModel>> {
        self.list(Some(model_type), None, true).await
    }

    pub async fn get_default_transcription(&self) -> Result<Option<AIModel>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM ai_models WHERE model_type = 'transcription' AND is_active = TRUE ORDER BY is_downloaded DESC, created_at ASC LIMIT 1",
            vec![],
        ).await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_model(row)))
    }

    pub async fn get_default_analysis(&self) -> Result<Option<AIModel>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM ai_models WHERE model_type = 'analysis' AND is_active = TRUE ORDER BY is_downloaded DESC, created_at ASC LIMIT 1",
            vec![],
        ).await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_model(row)))
    }

    pub async fn get_default_chat(&self) -> Result<Option<AIModel>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM ai_models WHERE model_type = 'chat' AND is_active = TRUE ORDER BY is_downloaded DESC, created_at ASC LIMIT 1",
            vec![],
        ).await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_model(row)))
    }

    pub async fn set_download_progress(&self, id: &str, progress: f32) -> Result<()> {
        self.db.execute_with_params(
            "UPDATE ai_models SET download_progress = ?, updated_at = ? WHERE id = ?",
            vec![
                Value::Real(progress as f64),
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(id.to_string()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn mark_downloaded(&self, id: &str, local_path: &str) -> Result<()> {
        self.db.execute_with_params(
            "UPDATE ai_models SET is_downloaded = TRUE, download_progress = 1.0, local_path = ?, updated_at = ? WHERE id = ?",
            vec![
                Value::Text(local_path.to_string()),
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(id.to_string()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn update_last_used(&self, id: &str) -> Result<()> {
        self.db.execute_with_params(
            "UPDATE ai_models SET last_used_at = ?, updated_at = ? WHERE id = ?",
            vec![
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(id.to_string()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn get_model_info(&self, id: &str) -> Result<Option<ModelInfo>> {
        let model = self.get(id).await?;
        if model.is_none() {
            return Ok(None);
        }
        let model = model.unwrap();

        // Check if model files exist
        let files_exist = if let Some(path) = &model.local_path {
            std::path::Path::new(path).exists()
        } else {
            false
        };

        let estimated_load_time_ms = self.estimate_load_time(&model);
        Ok(Some(ModelInfo {
            model,
            files_exist,
            estimated_load_time_ms,
        }))
    }

    fn estimate_load_time(&self, model: &AIModel) -> u64 {
        // Rough estimation based on model size and quantization
        let base_time = (model.size_bytes as f64 / 1_000_000_000.0 * 1000.0) as u64; // ~1s per GB
        let quantization_factor = match model.quantization.as_deref() {
            Some("Q4_K_M") | Some("Q4_0") => 1.0,
            Some("Q5_K_M") | Some("Q5_0") => 1.2,
            Some("Q8_0") => 1.5,
            Some("f16") | Some("f32") => 2.0,
            _ => 1.0,
        };
        (base_time as f64 * quantization_factor) as u64
    }

    fn row_to_model(&self, row: serde_json::Value) -> Option<AIModel> {
        Some(AIModel {
            id: row.get("id")?.as_str()?.to_string(),
            name: row.get("name")?.as_str()?.to_string(),
            model_type: row.get("model_type")?.as_str()?.to_string(),
            source: row.get("source")?.as_str()?.to_string(),
            model_id: row.get("model_id").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            api_endpoint: row.get("api_endpoint").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            api_key_encrypted: row.get("api_key_encrypted").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            local_path: row.get("local_path").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            huggingface_repo: row.get("huggingface_repo").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            huggingface_revision: row.get("huggingface_revision").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            tokenizer_path: row.get("tokenizer_path").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            config_path: row.get("config_path").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            size_bytes: row.get("size_bytes")?.as_i64()?,
            quantization: row.get("quantization").and_then(|v| v.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty()),
            languages: row.get("languages")?.as_str()?.to_string(),
            capabilities: row.get("capabilities")?.as_str()?.to_string(),
            config: row.get("config")?.as_str()?.to_string(),
            min_ram_gb: row.get("min_ram_gb")?.as_i64()? as i32,
            recommended_ram_gb: row.get("recommended_ram_gb")?.as_i64()? as i32,
            supports_gpu: row.get("supports_gpu")?.as_i64()? != 0,
            supports_cpu: row.get("supports_cpu")?.as_i64()? != 0,
            max_context_length: row.get("max_context_length")?.as_i64()? as i32,
            sample_rate: row.get("sample_rate")?.as_i64()? as i32,
            chunk_duration_seconds: row.get("chunk_duration_seconds")?.as_f64()? as f32,
            overlap_duration_seconds: row.get("overlap_duration_seconds")?.as_f64()? as f32,
            is_active: row.get("is_active")?.as_i64()? != 0,
            is_downloaded: row.get("is_downloaded")?.as_i64()? != 0,
            download_progress: row.get("download_progress")?.as_f64()? as f32,
            last_used_at: row.get("last_used_at").and_then(|v| v.as_str()).and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|d| d.with_timezone(&Utc)),
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?).ok()?.with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")?.as_str()?).ok()?.with_timezone(&Utc),
        })
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModelInfo {
    pub model: AIModel,
    pub files_exist: bool,
    pub estimated_load_time_ms: u64,
}