//! Events repository

use crate::db::models::*;
use crate::db::repository::Pagination;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::Datelike;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use uuid::Uuid;

pub struct EventsRepository {
    db: Sql,
}

impl EventsRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut event: Event) -> Result<Event> {
        event.id = Uuid::new_v4().to_string();

        self.db
            .execute_with_params(
                r#"
            INSERT INTO events (id, title, description, start_time, end_time, all_day, location,
                               color, calendar_id, recurrence_rule, recurrence_exception,
                               reminder_minutes, is_completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
                vec![
                    Value::Text(event.id.clone()),
                    Value::Text(event.title.clone()),
                    Value::Text(event.description.clone()),
                    Value::Text(event.start_time.to_rfc3339()),
                    Value::Text(event.end_time.to_rfc3339()),
                    Value::Integer(if event.all_day { 1 } else { 0 }),
                    Value::Text(event.location.clone()),
                    Value::Text(event.color.clone()),
                    Value::Text(event.calendar_id.clone()),
                    Value::Text(event.recurrence_rule.clone().unwrap_or_default()),
                    Value::Text(event.recurrence_exception.clone().unwrap_or_default()),
                    Value::Integer(event.reminder_minutes as i64),
                    Value::Integer(if event.is_completed { 1 } else { 0 }),
                    Value::Text(event.created_at.to_rfc3339()),
                    Value::Text(event.updated_at.to_rfc3339()),
                ],
            )
            .await?;

        Ok(event)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Event>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM events WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_event(row)))
    }

    pub async fn get_with_reminder(&self, id: &str) -> Result<Option<EventWithReminder>> {
        let event = self.get(id).await?;
        if event.is_none() {
            return Ok(None);
        }
        let event = event.unwrap();

        let reminder = self.get_reminder_for_event(&event.id).await?;

        Ok(Some(EventWithReminder { event, reminder }))
    }

    pub async fn update(&self, event: &Event) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE events SET
                title = ?, description = ?, start_time = ?, end_time = ?, all_day = ?,
                location = ?, color = ?, calendar_id = ?, recurrence_rule = ?,
                recurrence_exception = ?, reminder_minutes = ?, is_completed = ?,
                updated_at = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(event.title.clone()),
                    Value::Text(event.description.clone()),
                    Value::Text(event.start_time.to_rfc3339()),
                    Value::Text(event.end_time.to_rfc3339()),
                    Value::Integer(if event.all_day { 1 } else { 0 }),
                    Value::Text(event.location.clone()),
                    Value::Text(event.color.clone()),
                    Value::Text(event.calendar_id.clone()),
                    Value::Text(event.recurrence_rule.clone().unwrap_or_default()),
                    Value::Text(event.recurrence_exception.clone().unwrap_or_default()),
                    Value::Integer(event.reminder_minutes as i64),
                    Value::Integer(if event.is_completed { 1 } else { 0 }),
                    Value::Text(event.updated_at.to_rfc3339()),
                    Value::Text(event.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        // Also delete associated reminders
        self.db
            .execute_with_params(
                "DELETE FROM reminders WHERE target_type = 'event' AND target_id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        self.db
            .execute_with_params(
                "DELETE FROM events WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn list(&self, filter: EventFilter, pagination: Pagination) -> Result<Vec<Event>> {
        let mut query = String::from("SELECT * FROM events WHERE 1=1");
        let mut params = Vec::new();

        if let Some(calendar_id) = &filter.calendar_id {
            query.push_str(" AND calendar_id = ?");
            params.push(Value::Text(calendar_id.clone()));
        }

        if let Some(date_from) = filter.date_from {
            query.push_str(" AND end_time >= ?");
            params.push(Value::Text(date_from.to_rfc3339()));
        }

        if let Some(date_to) = filter.date_to {
            query.push_str(" AND start_time <= ?");
            params.push(Value::Text(date_to.to_rfc3339()));
        }

        if let Some(is_completed) = filter.is_completed {
            query.push_str(" AND is_completed = ?");
            params.push(Value::Integer(if is_completed { 1 } else { 0 }));
        }

        query.push_str(" ORDER BY start_time ASC");
        query.push_str(" LIMIT ? OFFSET ?");
        params.push(Value::Integer(pagination.per_page as i64));
        params.push(Value::Integer(pagination.offset as i64));

        let rows = self.db.select_with_params(&query, params).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_event(row))
            .collect())
    }

    pub async fn get_for_date(&self, date: NaiveDate) -> Result<Vec<Event>> {
        let start = date.and_hms_opt(0, 0, 0).unwrap().and_utc();
        let end = date.and_hms_opt(23, 59, 59).unwrap().and_utc();

        let rows = self.db.select_with_params(
            "SELECT * FROM events WHERE start_time <= ? AND end_time >= ? ORDER BY start_time ASC",
            vec![Value::Text(end.to_rfc3339()), Value::Text(start.to_rfc3339())],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_event(row))
            .collect())
    }

    pub async fn get_for_date_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<Event>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM events WHERE start_time <= ? AND end_time >= ? ORDER BY start_time ASC",
            vec![Value::Text(end.to_rfc3339()), Value::Text(start.to_rfc3339())],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_event(row))
            .collect())
    }

    pub async fn get_upcoming(&self, limit: i32, days: i32) -> Result<Vec<Event>> {
        let now = Utc::now();
        let future = now + Duration::days(days as i64);

        let rows = self.db.select_with_params(
            "SELECT * FROM events WHERE start_time >= ? AND start_time <= ? AND is_completed = FALSE ORDER BY start_time ASC LIMIT ?",
            vec![
                Value::Text(now.to_rfc3339()),
                Value::Text(future.to_rfc3339()),
                Value::Integer(limit as i64),
            ],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_event(row))
            .collect())
    }

    pub async fn get_today(&self) -> Result<Vec<Event>> {
        let today = Utc::now().date_naive();
        self.get_for_date(today).await
    }

    pub async fn get_this_week(&self) -> Result<Vec<Event>> {
        let now = Utc::now();
        let start_of_week = now - Duration::days(now.weekday().num_days_from_monday() as i64);
        let end_of_week = start_of_week + Duration::days(6);

        self.get_for_date_range(start_of_week, end_of_week).await
    }

    pub async fn get_this_month(&self) -> Result<Vec<Event>> {
        let now = Utc::now();
        let start_of_month = now
            .date_naive()
            .with_day(1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let end_of_month = (start_of_month + Duration::days(32))
            .date_naive()
            .with_day(1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            - Duration::seconds(1);

        self.get_for_date_range(start_of_month, end_of_month).await
    }

    pub async fn search(&self, query: &str, limit: i32) -> Result<Vec<Event>> {
        let search_term = format!("%{}%", query);
        let rows = self.db.select_with_params(
            "SELECT * FROM events WHERE (title LIKE ? OR description LIKE ? OR location LIKE ?) ORDER BY start_time DESC LIMIT ?",
            vec![
                Value::Text(search_term.clone()),
                Value::Text(search_term.clone()),
                Value::Text(search_term),
                Value::Integer(limit as i64),
            ],
        ).await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_event(row))
            .collect())
    }

    pub async fn set_reminder(&self, event_id: &str, minutes_before: i32) -> Result<()> {
        let event = self
            .get(event_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Event not found"))?;

        let reminder_time = event.start_time - Duration::minutes(minutes_before as i64);

        let reminder = Reminder {
            id: Uuid::new_v4().to_string(),
            target_type: "event".to_string(),
            target_id: event_id.to_string(),
            title: format!("Reminder: {}", event.title),
            message: event.description.clone(),
            trigger_at: reminder_time,
            is_sent: false,
            is_dismissed: false,
            repeat_rule: None,
            sound: "default".to_string(),
            vibration: true,
            priority: 0,
            snooze_minutes: 5,
            max_snooze_count: 3,
            snooze_count: 0,
            action_url: None,
            metadata: "{}".to_string(),
            created_at: Utc::now(),
        };

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

        // Update event's reminder_minutes
        self.db
            .execute_with_params(
                "UPDATE events SET reminder_minutes = ?, updated_at = ? WHERE id = ?",
                vec![
                    Value::Integer(minutes_before as i64),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(event_id.to_string()),
                ],
            )
            .await?;

        Ok(())
    }

    async fn get_reminder_for_event(&self, event_id: &str) -> Result<Option<Reminder>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM reminders WHERE target_type = 'event' AND target_id = ? ORDER BY trigger_at ASC LIMIT 1",
            vec![Value::Text(event_id.to_string())],
        ).await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_reminder(row)))
    }

    fn row_to_event(&self, row: serde_json::Value) -> Option<Event> {
        Some(Event {
            id: row.get("id")?.as_str()?.to_string(),
            title: row.get("title")?.as_str()?.to_string(),
            description: row.get("description")?.as_str()?.to_string(),
            start_time: DateTime::parse_from_rfc3339(row.get("start_time")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            end_time: DateTime::parse_from_rfc3339(row.get("end_time")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            all_day: row.get("all_day")?.as_i64()? != 0,
            location: row.get("location")?.as_str()?.to_string(),
            color: row.get("color")?.as_str()?.to_string(),
            calendar_id: row.get("calendar_id")?.as_str()?.to_string(),
            recurrence_rule: row
                .get("recurrence_rule")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            recurrence_exception: row
                .get("recurrence_exception")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            reminder_minutes: row.get("reminder_minutes")?.as_i64()? as i32,
            is_completed: row.get("is_completed")?.as_i64()? != 0,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
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

#[derive(Debug, Clone, Default)]
pub struct EventFilter {
    pub calendar_id: Option<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub is_completed: Option<bool>,
}
