//! Attachments repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct AttachmentsRepository {
    db: Sql,
}

impl AttachmentsRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut attachment: Attachment) -> Result<Attachment> {
        attachment.id = Uuid::new_v4().to_string();

        self.db
            .execute_with_params(
                r#"
            INSERT INTO attachments (id, note_id, file_name, file_path, mime_type,
                                    size_bytes, width, height, duration_seconds,
                                    thumbnail_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
                vec![
                    Value::Text(attachment.id.clone()),
                    Value::Text(attachment.note_id.clone().unwrap_or_default()),
                    Value::Text(attachment.file_name.clone()),
                    Value::Text(attachment.file_path.clone()),
                    Value::Text(attachment.mime_type.clone()),
                    Value::Integer(attachment.size_bytes),
                    Value::Integer(attachment.width.unwrap_or(0) as i64),
                    Value::Integer(attachment.height.unwrap_or(0) as i64),
                    Value::Real(attachment.duration_seconds.unwrap_or(0.0) as f64),
                    Value::Text(attachment.thumbnail_path.clone().unwrap_or_default()),
                    Value::Text(attachment.created_at.to_rfc3339()),
                ],
            )
            .await?;

        Ok(attachment)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Attachment>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM attachments WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_attachment(row)))
    }

    pub async fn get_for_note(&self, note_id: &str) -> Result<Vec<Attachment>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at DESC",
                vec![Value::Text(note_id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_attachment(row))
            .collect())
    }

    pub async fn update(&self, attachment: &Attachment) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE attachments SET
                note_id = ?, file_name = ?, file_path = ?, mime_type = ?,
                size_bytes = ?, width = ?, height = ?, duration_seconds = ?,
                thumbnail_path = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(attachment.note_id.clone().unwrap_or_default()),
                    Value::Text(attachment.file_name.clone()),
                    Value::Text(attachment.file_path.clone()),
                    Value::Text(attachment.mime_type.clone()),
                    Value::Integer(attachment.size_bytes),
                    Value::Integer(attachment.width.unwrap_or(0) as i64),
                    Value::Integer(attachment.height.unwrap_or(0) as i64),
                    Value::Real(attachment.duration_seconds.unwrap_or(0.0) as f64),
                    Value::Text(attachment.thumbnail_path.clone().unwrap_or_default()),
                    Value::Text(attachment.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM attachments WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn delete_for_note(&self, note_id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM attachments WHERE note_id = ?",
                vec![Value::Text(note_id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn get_by_mime_type(&self, mime_type: &str) -> Result<Vec<Attachment>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM attachments WHERE mime_type LIKE ? ORDER BY created_at DESC",
                vec![Value::Text(format!("{}%", mime_type))],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_attachment(row))
            .collect())
    }

    pub async fn get_images_for_note(&self, note_id: &str) -> Result<Vec<Attachment>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM attachments WHERE note_id = ? AND mime_type LIKE 'image/%' ORDER BY created_at DESC",
            vec![Value::Text(note_id.to_string())],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_attachment(row))
            .collect())
    }

    pub async fn get_audio_for_note(&self, note_id: &str) -> Result<Vec<Attachment>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM attachments WHERE note_id = ? AND mime_type LIKE 'audio/%' ORDER BY created_at DESC",
            vec![Value::Text(note_id.to_string())],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_attachment(row))
            .collect())
    }

    fn row_to_attachment(&self, row: serde_json::Value) -> Option<Attachment> {
        Some(Attachment {
            id: row.get("id")?.as_str()?.to_string(),
            note_id: row
                .get("note_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            file_name: row.get("file_name")?.as_str()?.to_string(),
            file_path: row.get("file_path")?.as_str()?.to_string(),
            mime_type: row.get("mime_type")?.as_str()?.to_string(),
            size_bytes: row.get("size_bytes")?.as_i64()?,
            width: row.get("width").and_then(|v| v.as_i64()).map(|v| v as i32),
            height: row.get("height").and_then(|v| v.as_i64()).map(|v| v as i32),
            duration_seconds: row
                .get("duration_seconds")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            thumbnail_path: row
                .get("thumbnail_path")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }
}
