//! AI Chat repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct AIChatRepository {
    db: Sql,
}

impl AIChatRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    // Chat sessions
    pub async fn create_chat(&self, mut chat: AIChat) -> Result<AIChat> {
        chat.id = Uuid::new_v4().to_string();

        self.db.execute_with_params(
            r#"
            INSERT INTO ai_chats (id, note_id, title, model_id, system_prompt, temperature, max_tokens, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            vec![
                Value::Text(chat.id.clone()),
                Value::Text(chat.note_id.clone().unwrap_or_default()),
                Value::Text(chat.title.clone()),
                Value::Text(chat.model_id.clone().unwrap_or_default()),
                Value::Text(chat.system_prompt.clone()),
                Value::Real(chat.temperature as f64),
                Value::Integer(chat.max_tokens as i64),
                Value::Text(chat.created_at.to_rfc3339()),
                Value::Text(chat.updated_at.to_rfc3339()),
            ],
        ).await?;

        Ok(chat)
    }

    pub async fn get_chat(&self, id: &str) -> Result<Option<AIChat>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM ai_chats WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_chat(row)))
    }

    pub async fn get_chats_for_note(&self, note_id: &str) -> Result<Vec<AIChat>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM ai_chats WHERE note_id = ? ORDER BY updated_at DESC",
                vec![Value::Text(note_id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_chat(row))
            .collect())
    }

    pub async fn get_recent_chats(&self, limit: i32) -> Result<Vec<AIChat>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM ai_chats ORDER BY updated_at DESC LIMIT ?",
                vec![Value::Integer(limit as i64)],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_chat(row))
            .collect())
    }

    pub async fn update_chat(&self, chat: &AIChat) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE ai_chats SET
                note_id = ?, title = ?, model_id = ?, system_prompt = ?,
                temperature = ?, max_tokens = ?, updated_at = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(chat.note_id.clone().unwrap_or_default()),
                    Value::Text(chat.title.clone()),
                    Value::Text(chat.model_id.clone().unwrap_or_default()),
                    Value::Text(chat.system_prompt.clone()),
                    Value::Real(chat.temperature as f64),
                    Value::Integer(chat.max_tokens as i64),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(chat.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn delete_chat(&self, id: &str) -> Result<()> {
        // Messages will be cascade deleted
        self.db
            .execute_with_params(
                "DELETE FROM ai_chats WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    // Messages
    pub async fn add_message(&self, mut message: AIMessage) -> Result<AIMessage> {
        message.id = Uuid::new_v4().to_string();

        self.db.execute_with_params(
            r#"
            INSERT INTO ai_messages (id, chat_id, role, content, tool_calls, tool_call_id, tokens_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            vec![
                Value::Text(message.id.clone()),
                Value::Text(message.chat_id.clone()),
                Value::Text(message.role.clone()),
                Value::Text(message.content.clone()),
                Value::Text(message.tool_calls.clone().unwrap_or_default()),
                Value::Text(message.tool_call_id.clone().unwrap_or_default()),
                Value::Integer(message.tokens_used as i64),
                Value::Text(message.created_at.to_rfc3339()),
            ],
        ).await?;

        // Update chat's updated_at
        self.db
            .execute_with_params(
                "UPDATE ai_chats SET updated_at = ? WHERE id = ?",
                vec![
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(message.chat_id.clone()),
                ],
            )
            .await?;

        Ok(message)
    }

    pub async fn get_messages(
        &self,
        chat_id: &str,
        limit: Option<i32>,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<AIMessage>> {
        let mut query = String::from("SELECT * FROM ai_messages WHERE chat_id = ?");
        let mut params = vec![Value::Text(chat_id.to_string())];

        if let Some(before) = before {
            query.push_str(" AND created_at < ?");
            params.push(Value::Text(before.to_rfc3339()));
        }

        query.push_str(" ORDER BY created_at ASC");

        if let Some(limit) = limit {
            query.push_str(" LIMIT ?");
            params.push(Value::Integer(limit as i64));
        }

        let rows = self.db.select_with_params(&query, params).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_message(row))
            .collect())
    }

    pub async fn get_recent_messages(&self, chat_id: &str, count: i32) -> Result<Vec<AIMessage>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM ai_messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?",
                vec![
                    Value::Text(chat_id.to_string()),
                    Value::Integer(count as i64),
                ],
            )
            .await?;

        let mut messages: Vec<AIMessage> = rows
            .into_iter()
            .filter_map(|row| self.row_to_message(row))
            .collect();
        messages.reverse(); // Reverse to get chronological order
        Ok(messages)
    }

    pub async fn delete_message(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM ai_messages WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn clear_chat_messages(&self, chat_id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM ai_messages WHERE chat_id = ?",
                vec![Value::Text(chat_id.to_string())],
            )
            .await?;
        Ok(())
    }

    fn row_to_chat(&self, row: serde_json::Value) -> Option<AIChat> {
        Some(AIChat {
            id: row.get("id")?.as_str()?.to_string(),
            note_id: row
                .get("note_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            title: row.get("title")?.as_str()?.to_string(),
            model_id: row
                .get("model_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            system_prompt: row.get("system_prompt")?.as_str()?.to_string(),
            temperature: row.get("temperature")?.as_f64()? as f32,
            max_tokens: row.get("max_tokens")?.as_i64()? as i32,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }

    fn row_to_message(&self, row: serde_json::Value) -> Option<AIMessage> {
        Some(AIMessage {
            id: row.get("id")?.as_str()?.to_string(),
            chat_id: row.get("chat_id")?.as_str()?.to_string(),
            role: row.get("role")?.as_str()?.to_string(),
            content: row.get("content")?.as_str()?.to_string(),
            tool_calls: row
                .get("tool_calls")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            tool_call_id: row
                .get("tool_call_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            tokens_used: row.get("tokens_used")?.as_i64()? as i32,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }
}
