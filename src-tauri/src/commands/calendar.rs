//! Calendar commands

use crate::services::AppState;
use crate::db::repository::{EventFilter, Pagination};
use tauri::{State, command};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub all_day: Option<bool>,
    pub location: Option<String>,
    pub color: Option<String>,
    pub calendar_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub reminder_minutes: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateEventRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub all_day: Option<bool>,
    pub location: Option<String>,
    pub color: Option<String>,
    pub calendar_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub reminder_minutes: Option<i32>,
    pub is_completed: Option<bool>,
}

#[derive(Deserialize)]
pub struct ListEventsRequest {
    pub calendar_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub is_completed: Option<bool>,
    pub page: Option<i32>,
    pub per_page: Option<i32>,
}

#[derive(Deserialize)]
pub struct SetReminderRequest {
    pub event_id: String,
    pub minutes_before: i32,
}

#[derive(Deserialize)]
pub struct EventsFilterArgs {
    pub calendar_id: Option<String>,
}

#[derive(Deserialize)]
pub struct PaginationArgs {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
}

#[command]
pub async fn get_events(
    state: State<'_, AppState>,
    filter: Option<EventsFilterArgs>,
    pagination: Option<PaginationArgs>,
) -> Result<Vec<crate::db::models::Event>, String> {
    let filter = EventFilter {
        calendar_id: filter.and_then(|f| f.calendar_id),
        date_from: None,
        date_to: None,
        is_completed: None,
    };

    let pagination = pagination.map(|p| Pagination::new(p.page.unwrap_or(1), p.per_page.unwrap_or(50)))
        .unwrap_or_else(|| Pagination::new(1, 500));

    state.calendar.list_events(filter, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_event(
    state: State<'_, AppState>,
    request: CreateEventRequest,
) -> Result<crate::db::models::Event, String> {
    let event = crate::db::models::Event {
        id: String::new(),
        title: request.title,
        description: request.description.unwrap_or_default(),
        start_time: DateTime::parse_from_rfc3339(&request.start_time).map_err(|e| e.to_string())?.with_timezone(&Utc),
        end_time: DateTime::parse_from_rfc3339(&request.end_time).map_err(|e| e.to_string())?.with_timezone(&Utc),
        all_day: request.all_day.unwrap_or(false),
        location: request.location.unwrap_or_default(),
        color: request.color.unwrap_or_else(|| "#00BFA6".to_string()),
        calendar_id: request.calendar_id.unwrap_or_else(|| "default".to_string()),
        recurrence_rule: request.recurrence_rule,
        recurrence_exception: None,
        reminder_minutes: request.reminder_minutes.unwrap_or(15),
        is_completed: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    state.calendar.create_event(event)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn update_event(
    state: State<'_, AppState>,
    request: UpdateEventRequest,
) -> Result<(), String> {
    if let Some(mut event) = state.calendar.get_event(&request.id).await.map_err(|e| e.to_string())? {
        if let Some(title) = request.title {
            event.title = title;
        }
        if let Some(description) = request.description {
            event.description = description;
        }
        if let Some(start_time) = request.start_time {
            event.start_time = DateTime::parse_from_rfc3339(&start_time).map_err(|e| e.to_string())?.with_timezone(&Utc);
        }
        if let Some(end_time) = request.end_time {
            event.end_time = DateTime::parse_from_rfc3339(&end_time).map_err(|e| e.to_string())?.with_timezone(&Utc);
        }
        if let Some(all_day) = request.all_day {
            event.all_day = all_day;
        }
        if let Some(location) = request.location {
            event.location = location;
        }
        if let Some(color) = request.color {
            event.color = color;
        }
        if let Some(calendar_id) = request.calendar_id {
            event.calendar_id = calendar_id;
        }
        if let Some(recurrence_rule) = request.recurrence_rule {
            event.recurrence_rule = Some(recurrence_rule);
        }
        if let Some(reminder_minutes) = request.reminder_minutes {
            event.reminder_minutes = reminder_minutes;
        }
        if let Some(is_completed) = request.is_completed {
            event.is_completed = is_completed;
        }
        event.updated_at = Utc::now();
        state.calendar.update_event(&event).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn delete_event(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.calendar.delete_event(&id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_events_for_date(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<crate::db::models::Event>, String> {
    let date = NaiveDate::parse_from_str(&date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    state.calendar.get_events_for_date(date)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_upcoming_events(
    state: State<'_, AppState>,
    limit: Option<i32>,
    days: Option<i32>,
) -> Result<Vec<crate::db::models::Event>, String> {
    state.calendar.get_upcoming_events(limit.unwrap_or(10), days.unwrap_or(7))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_today_events(
    state: State<'_, AppState>,
) -> Result<Vec<crate::db::models::Event>, String> {
    state.calendar.get_today_events()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_week_events(
    state: State<'_, AppState>,
) -> Result<Vec<crate::db::models::Event>, String> {
    state.calendar.get_week_events()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_month_events(
    state: State<'_, AppState>,
) -> Result<Vec<crate::db::models::Event>, String> {
    state.calendar.get_month_events()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn set_reminder(
    state: State<'_, AppState>,
    request: SetReminderRequest,
) -> Result<(), String> {
    state.calendar.set_reminder(&request.event_id, request.minutes_before)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn complete_event(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.calendar.complete_event(&id)
        .await
        .map_err(|e| e.to_string())
}