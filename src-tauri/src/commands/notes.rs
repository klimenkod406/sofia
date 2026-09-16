//! Notes commands

use crate::services::AppState;
use crate::db::repository::{NoteFilter, Pagination};
use crate::services::notes::{ExportFormat, ImportFormat};
use tauri::{State, command};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateNoteRequest {
    pub folder_id: Option<String>,
    pub title: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateNoteRequest {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
    pub content_md: Option<String>,
    pub content_html: Option<String>,
    pub cover_image: Option<String>,
    pub cover_color: Option<String>,
    pub template_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_favorite: Option<bool>,
}

#[derive(Deserialize)]
pub struct ListNotesRequest {
    pub folder_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_deleted: Option<bool>,
    pub is_favorite: Option<bool>,
    pub search_query: Option<String>,
    pub tag_ids: Option<Vec<String>>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<i32>,
    pub per_page: Option<i32>,
}

#[derive(Deserialize)]
pub struct MoveNoteRequest {
    pub note_id: String,
    pub folder_id: Option<String>,
}

#[derive(Deserialize)]
pub struct TagNoteRequest {
    pub note_id: String,
    pub tag_id: String,
}

#[derive(Deserialize)]
pub struct ExportNoteRequest {
    pub note_id: String,
    pub format: ExportFormat,
}

#[derive(Deserialize)]
pub struct ImportNoteRequest {
    pub folder_id: Option<String>,
    pub content: String,
    pub format: ImportFormat,
}

#[command]
pub async fn create_note(
    state: State<'_, AppState>,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<crate::db::models::Note, String> {
    state.notes.create_note(folder_id, title)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<crate::db::models::Note>, String> {
    state.notes.get_note(&id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn update_note(
    state: State<'_, AppState>,
    request: UpdateNoteRequest,
) -> Result<(), String> {
    if let Some(mut note) = state.notes.get_note(&request.id).await.map_err(|e| e.to_string())? {
        if let Some(folder_id) = request.folder_id {
            note.folder_id = Some(folder_id);
        }
        if let Some(title) = request.title {
            note.title = title;
        }
        if let Some(content) = request.content {
            note.content = content;
        }
        if let Some(content_md) = request.content_md {
            note.content_md = content_md;
        }
        if let Some(content_html) = request.content_html {
            note.content_html = content_html;
        }
        if let Some(cover_image) = request.cover_image {
            note.cover_image = Some(cover_image);
        }
        if let Some(cover_color) = request.cover_color {
            note.cover_color = Some(cover_color);
        }
        if let Some(template_id) = request.template_id {
            note.template_id = Some(template_id);
        }
        if let Some(is_pinned) = request.is_pinned {
            note.is_pinned = is_pinned;
        }
        if let Some(is_archived) = request.is_archived {
            note.is_archived = is_archived;
        }
        if let Some(is_favorite) = request.is_favorite {
            note.is_favorite = is_favorite;
        }
        note.update_counts();
        state.notes.update_note(&note).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn delete_note(
    state: State<'_, AppState>,
    id: String,
    permanent: Option<bool>,
) -> Result<(), String> {
    state.notes.delete_note(&id, permanent.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn list_notes(
    state: State<'_, AppState>,
    filter: ListNotesRequest,
) -> Result<Vec<crate::db::models::Note>, String> {
    let pagination = Pagination::new(filter.page.unwrap_or(1), filter.per_page.unwrap_or(50));

    let note_filter = NoteFilter {
        folder_id: filter.folder_id,
        is_pinned: filter.is_pinned,
        is_archived: filter.is_archived,
        is_deleted: filter.is_deleted,
        is_favorite: filter.is_favorite,
        search_query: filter.search_query,
        tag_ids: filter.tag_ids.unwrap_or_default(),
        date_from: filter.date_from.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok()).map(|d| d.with_timezone(&chrono::Utc)),
        date_to: filter.date_to.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok()).map(|d| d.with_timezone(&chrono::Utc)),
        sort_by: filter.sort_by.unwrap_or_else(|| "updated_at".to_string()),
        sort_order: filter.sort_order.unwrap_or_else(|| "DESC".to_string()),
    };

    state.notes.list_notes(note_filter, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_notes(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<crate::db::models::Note>, String> {
    state.notes.search_notes(&query, limit.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn export_note(
    state: State<'_, AppState>,
    request: ExportNoteRequest,
) -> Result<String, String> {
    state.notes.export_note(&request.note_id, request.format)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn import_note(
    state: State<'_, AppState>,
    request: ImportNoteRequest,
) -> Result<crate::db::models::Note, String> {
    state.notes.import_note(request.folder_id, &request.content, request.format)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_note_tree(
    state: State<'_, AppState>,
    folder_id: Option<String>,
) -> Result<Vec<crate::db::models::FolderTree>, String> {
    state.notes.get_note_tree(folder_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn move_note(
    state: State<'_, AppState>,
    note_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    state.notes.move_note(&note_id, folder_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn duplicate_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<crate::db::models::Note, String> {
    state.notes.duplicate_note(&id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn pin_note(
    state: State<'_, AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    state.notes.pin_note(&id, pinned)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn archive_note(
    state: State<'_, AppState>,
    id: String,
    archived: bool,
) -> Result<(), String> {
    state.notes.archive_note(&id, archived)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn favorite_note(
    state: State<'_, AppState>,
    id: String,
    favorite: bool,
) -> Result<(), String> {
    state.notes.favorite_note(&id, favorite)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn add_tag_to_note(
    state: State<'_, AppState>,
    note_id: String,
    tag_id: String,
) -> Result<(), String> {
    state.notes.add_tag(&note_id, &tag_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn remove_tag_from_note(
    state: State<'_, AppState>,
    note_id: String,
    tag_id: String,
) -> Result<(), String> {
    state.notes.remove_tag(&note_id, &tag_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_recent_notes(
    state: State<'_, AppState>,
    limit: Option<i32>,
) -> Result<Vec<crate::db::models::Note>, String> {
    state.notes.get_recent_notes(limit.unwrap_or(10))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_pinned_notes(
    state: State<'_, AppState>,
) -> Result<Vec<crate::db::models::Note>, String> {
    state.notes.get_pinned_notes()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_archived_notes(
    state: State<'_, AppState>,
    page: Option<i32>,
    per_page: Option<i32>,
) -> Result<Vec<crate::db::models::Note>, String> {
    let pagination = Pagination::new(page.unwrap_or(1), per_page.unwrap_or(50));
    state.notes.get_archived_notes(pagination)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_note_statistics(
    state: State<'_, AppState>,
) -> Result<crate::db::models::Statistics, String> {
    state.notes.get_statistics()
        .await
        .map_err(|e| e.to_string())
}