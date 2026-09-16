//! Calendar service

use crate::db::models::*;
use crate::db::repository::{EventsRepository, EventFilter, Pagination};
use crate::db::Database;
use anyhow::Result;
use chrono::{DateTime, Utc, NaiveDate, Duration};
use std::sync::Arc;

pub struct CalendarService {
    repo: EventsRepository,
}

impl CalendarService {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            repo: db.events(),
        }
    }

    pub async fn create_event(&self, mut event: Event) -> Result<Event> {
        self.repo.create(event).await
    }

    pub async fn get_event(&self, id: &str) -> Result<Option<Event>> {
        self.repo.get(id).await
    }

    pub async fn get_event_with_reminder(&self, id: &str) -> Result<Option<EventWithReminder>> {
        self.repo.get_with_reminder(id).await
    }

    pub async fn update_event(&self, event: &Event) -> Result<()> {
        self.repo.update(event).await
    }

    pub async fn delete_event(&self, id: &str) -> Result<()> {
        self.repo.delete(id).await
    }

    pub async fn list_events(&self, filter: EventFilter, pagination: Pagination) -> Result<Vec<Event>> {
        self.repo.list(filter, pagination).await
    }

    pub async fn get_events_for_date(&self, date: NaiveDate) -> Result<Vec<Event>> {
        self.repo.get_for_date(date).await
    }

    pub async fn get_events_for_range(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> Result<Vec<Event>> {
        self.repo.get_for_date_range(start, end).await
    }

    pub async fn get_upcoming_events(&self, limit: i32, days: i32) -> Result<Vec<Event>> {
        self.repo.get_upcoming(limit, days).await
    }

    pub async fn get_today_events(&self) -> Result<Vec<Event>> {
        self.repo.get_today().await
    }

    pub async fn get_week_events(&self) -> Result<Vec<Event>> {
        self.repo.get_this_week().await
    }

    pub async fn get_month_events(&self) -> Result<Vec<Event>> {
        self.repo.get_this_month().await
    }

    pub async fn search_events(&self, query: &str, limit: i32) -> Result<Vec<Event>> {
        self.repo.search(query, limit).await
    }

    pub async fn set_reminder(&self, event_id: &str, minutes_before: i32) -> Result<()> {
        self.repo.set_reminder(event_id, minutes_before).await
    }

    pub async fn complete_event(&self, id: &str) -> Result<()> {
        if let Some(mut event) = self.repo.get(id).await? {
            event.is_completed = true;
            event.updated_at = Utc::now();
            self.repo.update(&event).await
        } else {
            Ok(())
        }
    }

    pub async fn get_events_by_calendar(&self, calendar_id: &str) -> Result<Vec<Event>> {
        let filter = EventFilter {
            calendar_id: Some(calendar_id.to_string()),
            ..Default::default()
        };
        self.repo.list(filter, Pagination::default()).await
    }

    pub async fn get_calendar_colors(&self) -> Result<Vec<String>> {
        // Return unique colors used in events
        let events = self.repo.list(EventFilter::default(), Pagination::default()).await?;
        let mut colors: Vec<String> = events.iter().map(|e| e.color.clone()).collect();
        colors.sort();
        colors.dedup();
        Ok(colors)
    }
}