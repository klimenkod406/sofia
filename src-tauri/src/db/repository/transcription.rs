//! Transcription repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct TranscriptionRepository {
    db: Sql,
}

impl TranscriptionRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create_job(&self, mut job: TranscriptionJob) -> Result<TranscriptionJob> {
        job.id = Uuid::new_v4().to_string();

        self.db
            .execute_with_params(
                r#"
            INSERT INTO transcription_jobs (id, audio_path, model_id, language, status,
                                           progress, result_text, result_segments,
                                           error_message, duration_seconds, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
                vec![
                    Value::Text(job.id.clone()),
                    Value::Text(job.audio_path.clone()),
                    Value::Text(job.model_id.clone().unwrap_or_default()),
                    Value::Text(job.language.clone()),
                    Value::Text(job.status.clone()),
                    Value::Real(job.progress as f64),
                    Value::Text(job.result_text.clone()),
                    Value::Text(job.result_segments.clone()),
                    Value::Text(job.error_message.clone().unwrap_or_default()),
                    Value::Real(job.duration_seconds as f64),
                    Value::Text(job.created_at.to_rfc3339()),
                ],
            )
            .await?;

        Ok(job)
    }

    pub async fn get_job(&self, id: &str) -> Result<Option<TranscriptionJob>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM transcription_jobs WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_job(row)))
    }

    pub async fn update_job(&self, job: &TranscriptionJob) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE transcription_jobs SET
                audio_path = ?, model_id = ?, language = ?, status = ?,
                progress = ?, result_text = ?, result_segments = ?,
                error_message = ?, duration_seconds = ?, completed_at = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(job.audio_path.clone()),
                    Value::Text(job.model_id.clone().unwrap_or_default()),
                    Value::Text(job.language.clone()),
                    Value::Text(job.status.clone()),
                    Value::Real(job.progress as f64),
                    Value::Text(job.result_text.clone()),
                    Value::Text(job.result_segments.clone()),
                    Value::Text(job.error_message.clone().unwrap_or_default()),
                    Value::Real(job.duration_seconds as f64),
                    Value::Text(job.completed_at.map(|d| d.to_rfc3339()).unwrap_or_default()),
                    Value::Text(job.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn update_progress(&self, id: &str, progress: f32, status: &str) -> Result<()> {
        self.db.execute_with_params(
            "UPDATE transcription_jobs SET progress = ?, status = ?, updated_at = ? WHERE id = ?",
            vec![
                Value::Real(progress as f64),
                Value::Text(status.to_string()),
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(id.to_string()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn complete_job(
        &self,
        id: &str,
        result_text: &str,
        segments: &str,
        duration: f32,
    ) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE transcription_jobs SET
                status = 'completed',
                progress = 1.0,
                result_text = ?,
                result_segments = ?,
                duration_seconds = ?,
                completed_at = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(result_text.to_string()),
                    Value::Text(segments.to_string()),
                    Value::Real(duration as f64),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn fail_job(&self, id: &str, error: &str) -> Result<()> {
        self.db.execute_with_params(
            "UPDATE transcription_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
            vec![
                Value::Text(error.to_string()),
                Value::Text(Utc::now().to_rfc3339()),
                Value::Text(id.to_string()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn cancel_job(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE transcription_jobs SET status = 'cancelled', updated_at = ? WHERE id = ?",
                vec![
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn list_jobs(
        &self,
        status: Option<&str>,
        limit: i32,
    ) -> Result<Vec<TranscriptionJob>> {
        let mut query = String::from("SELECT * FROM transcription_jobs WHERE 1=1");
        let mut params = Vec::new();

        if let Some(status) = status {
            query.push_str(" AND status = ?");
            params.push(Value::Text(status.to_string()));
        }

        query.push_str(" ORDER BY created_at DESC LIMIT ?");
        params.push(Value::Integer(limit as i64));

        let rows = self.db.select_with_params(&query, params).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_job(row))
            .collect())
    }

    pub async fn get_pending_jobs(&self) -> Result<Vec<TranscriptionJob>> {
        self.list_jobs(Some("pending"), 50).await
    }

    pub async fn get_processing_jobs(&self) -> Result<Vec<TranscriptionJob>> {
        self.list_jobs(Some("processing"), 50).await
    }

    pub async fn delete_job(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM transcription_jobs WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn cleanup_old_jobs(&self, older_than_days: i32) -> Result<u64> {
        let cutoff = Utc::now() - chrono::Duration::days(older_than_days as i64);
        let result = self.db.execute_with_params(
            "DELETE FROM transcription_jobs WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled')",
            vec![Value::Text(cutoff.to_rfc3339())],
        ).await?;
        Ok(result)
    }

    fn row_to_job(&self, row: serde_json::Value) -> Option<TranscriptionJob> {
        Some(TranscriptionJob {
            id: row.get("id")?.as_str()?.to_string(),
            audio_path: row.get("audio_path")?.as_str()?.to_string(),
            model_id: row
                .get("model_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            language: row.get("language")?.as_str()?.to_string(),
            status: row.get("status")?.as_str()?.to_string(),
            progress: row.get("progress")?.as_f64()? as f32,
            result_text: row.get("result_text")?.as_str()?.to_string(),
            result_segments: row.get("result_segments")?.as_str()?.to_string(),
            error_message: row
                .get("error_message")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            duration_seconds: row.get("duration_seconds")?.as_f64()? as f32,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            completed_at: row
                .get("completed_at")
                .and_then(|v| v.as_str())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|d| d.with_timezone(&Utc)),
        })
    }
}
