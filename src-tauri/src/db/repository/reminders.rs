//! Reminders repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

pub struct RemindersRepository {
    db: Sql,
}

impl RemindersRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut reminder: Reminder) -> Result<Reminder> {
        reminder.id = Uuid::new_v4().to_string();

        self.db
            .execute_with_params(
                r#"
            INSERT INTO reminders (id, target_type, target_id, title, message, trigger_at,
                                  is_sent, is_dismissed, repeat_rule, sound, vibration,
                                  priority, snooze_minutes, max_snooze_count, snooze_count,
                                  action_url, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
                vec![
                    Value::Text(reminder.id.clone()),
                    Value::Text(reminder.target_type.clone()),
                    Value::Text(reminder.target_id.clone()),
                    Value::Text(reminder.title.clone()),
                    Value::Text(reminder.message.clone()),
                    Value::Text(reminder.trigger_at.to_rfc3339()),
                    Value::Integer(if reminder.is_sent { 1 } else { 0 }),
                    Value::Integer(if reminder.is_dismissed { 1 } else { 0 }),
                    Value::Text(reminder.repeat_rule.clone().unwrap_or_default()),
                    Value::Text(reminder.sound.clone()),
                    Value::Integer(if reminder.vibration { 1 } else { 0 }),
                    Value::Integer(reminder.priority as i64),
                    Value::Integer(reminder.snooze_minutes as i64),
                    Value::Integer(reminder.max_snooze_count as i64),
                    Value::Integer(reminder.snooze_count as i64),
                    Value::Text(reminder.action_url.clone().unwrap_or_default()),
                    Value::Text(reminder.metadata.clone()),
                    Value::Text(reminder.created_at.to_rfc3339()),
                ],
            )
            .await?;

        Ok(reminder)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Reminder>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM reminders WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_reminder(row)))
    }

    pub async fn get_pending(&self, before: DateTime<Utc>) -> Result<Vec<Reminder>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM reminders WHERE is_sent = FALSE AND is_dismissed = FALSE AND trigger_at <= ? ORDER BY trigger_at ASC",
            vec![Value::Text(before.to_rfc3339())],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_reminder(row))
            .collect())
    }

    pub async fn get_for_target(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<Vec<Reminder>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM reminders WHERE target_type = ? AND target_id = ? ORDER BY trigger_at ASC",
            vec![Value::Text(target_type.to_string()), Value::Text(target_id.to_string())],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_reminder(row))
            .collect())
    }

    pub async fn update(&self, reminder: &Reminder) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE reminders SET
                target_type = ?, target_id = ?, title = ?, message = ?, trigger_at = ?,
                is_sent = ?, is_dismissed = ?, repeat_rule = ?, sound = ?, vibration = ?,
                priority = ?, snooze_minutes = ?, max_snooze_count = ?, snooze_count = ?,
                action_url = ?, metadata = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(reminder.target_type.clone()),
                    Value::Text(reminder.target_id.clone()),
                    Value::Text(reminder.title.clone()),
                    Value::Text(reminder.message.clone()),
                    Value::Text(reminder.trigger_at.to_rfc3339()),
                    Value::Integer(if reminder.is_sent { 1 } else { 0 }),
                    Value::Integer(if reminder.is_dismissed { 1 } else { 0 }),
                    Value::Text(reminder.repeat_rule.clone().unwrap_or_default()),
                    Value::Text(reminder.sound.clone()),
                    Value::Integer(if reminder.vibration { 1 } else { 0 }),
                    Value::Integer(reminder.priority as i64),
                    Value::Integer(reminder.snooze_minutes as i64),
                    Value::Integer(reminder.max_snooze_count as i64),
                    Value::Integer(reminder.snooze_count as i64),
                    Value::Text(reminder.action_url.clone().unwrap_or_default()),
                    Value::Text(reminder.metadata.clone()),
                    Value::Text(reminder.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn mark_sent(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE reminders SET is_sent = TRUE WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn dismiss(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE reminders SET is_dismissed = TRUE WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn snooze(&self, id: &str, minutes: i32) -> Result<()> {
        let reminder = self
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Reminder not found"))?;

        if reminder.snooze_count >= reminder.max_snooze_count {
            return Err(anyhow::anyhow!("Max snooze count reached"));
        }

        let new_trigger = reminder.trigger_at + Duration::minutes(minutes as i64);
        let new_count = reminder.snooze_count + 1;

        self.db.execute_with_params(
            "UPDATE reminders SET trigger_at = ?, snooze_count = ?, is_sent = FALSE WHERE id = ?",
            vec![
                Value::Text(new_trigger.to_rfc3339()),
                Value::Integer(new_count as i64),
                Value::Text(id.to_string()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM reminders WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn delete_for_target(&self, target_type: &str, target_id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM reminders WHERE target_type = ? AND target_id = ?",
                vec![
                    Value::Text(target_type.to_string()),
                    Value::Text(target_id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    fn row_to_reminder(&self, row: serde_json::Value) -> Option<Reminder> {
        Some(Reminder {
            id: row.get("id")?.as_str()?.to_string(),
            target_type: row.get("target_type")?.as_str()?.to_string(),
            target_id: row.get("target_id")?.as_str()?.to_string(),
            title: row.get("title")?.as_str()?.to_string(),
            message: row.get("message")?.as_str()?.to_string(),
            trigger_at: DateTime::parse_from_rfc3339(row.get("trigger_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            is_sent: row.get("is_sent")?.as_i64()? != 0,
            is_dismissed: row.get("is_dismissed")?.as_i64()? != 0,
            repeat_rule: row
                .get("repeat_rule")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            sound: row.get("sound")?.as_str()?.to_string(),
            vibration: row.get("vibration")?.as_i64()? != 0,
            priority: row.get("priority")?.as_i64()? as i32,
            snooze_minutes: row.get("snooze_minutes")?.as_i64()? as i32,
            max_snooze_count: row.get("max_snooze_count")?.as_i64()? as i32,
            snooze_count: row.get("snooze_count")?.as_i64()? as i32,
            action_url: row
                .get("action_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            metadata: row.get("metadata")?.as_str()?.to_string(),
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }
}
