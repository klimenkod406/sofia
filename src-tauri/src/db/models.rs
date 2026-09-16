//! Database models for Σόφια

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;

/// Folder for organizing notes
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: String,
    pub icon: String,
    pub sort_order: i32,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Note structure
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: String,
    pub content_md: String,
    pub content_html: String,
    pub excerpt: String,
    pub word_count: i32,
    pub char_count: i32,
    pub reading_time: i32,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub is_favorite: bool,
    pub cover_image: Option<String>,
    pub cover_color: Option<String>,
    pub template_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub last_edited_at: DateTime<Utc>,
}

/// Note version for history
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NoteVersion {
    pub id: String,
    pub note_id: String,
    pub title: String,
    pub content: String,
    pub content_md: String,
    pub version: i32,
    pub change_type: String,
    pub created_at: DateTime<Utc>,
}

/// Calendar event
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub description: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: bool,
    pub location: String,
    pub color: String,
    pub calendar_id: String,
    pub recurrence_rule: Option<String>,
    pub recurrence_exception: Option<String>,
    pub reminder_minutes: i32,
    pub is_completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Reminder
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Reminder {
    pub id: String,
    pub target_type: String, // 'event' or 'note'
    pub target_id: String,
    pub title: String,
    pub message: String,
    pub trigger_at: DateTime<Utc>,
    pub is_sent: bool,
    pub is_dismissed: bool,
    pub repeat_rule: Option<String>,
    pub sound: String,
    pub vibration: bool,
    pub priority: i32,
    pub snooze_minutes: i32,
    pub max_snooze_count: i32,
    pub snooze_count: i32,
    pub action_url: Option<String>,
    pub metadata: String,
    pub created_at: DateTime<Utc>,
}

/// Settings entry
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub type_: String,
    pub description: String,
    pub updated_at: DateTime<Utc>,
}

/// Tag for notes
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub description: String,
    pub is_system: bool,
    pub parent_id: Option<String>,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
}

/// AI Model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AIModel {
    pub id: String,
    pub name: String,
    pub model_type: String, // transcription, analysis, chat, embedding
    pub source: String,     // local, api, huggingface
    pub model_id: Option<String>,
    pub api_endpoint: Option<String>,
    pub api_key_encrypted: Option<String>,
    pub local_path: Option<String>,
    pub huggingface_repo: Option<String>,
    pub huggingface_revision: Option<String>,
    pub tokenizer_path: Option<String>,
    pub config_path: Option<String>,
    pub size_bytes: i64,
    pub quantization: Option<String>,
    pub languages: String, // JSON array
    pub capabilities: String, // JSON array
    pub config: String,    // JSON object
    pub min_ram_gb: i32,
    pub recommended_ram_gb: i32,
    pub supports_gpu: bool,
    pub supports_cpu: bool,
    pub max_context_length: i32,
    pub sample_rate: i32,
    pub chunk_duration_seconds: f32,
    pub overlap_duration_seconds: f32,
    pub is_active: bool,
    pub is_downloaded: bool,
    pub download_progress: f32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// AI Chat session
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AIChat {
    pub id: String,
    pub note_id: Option<String>,
    pub title: String,
    pub model_id: Option<String>,
    pub system_prompt: String,
    pub temperature: f32,
    pub max_tokens: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// AI Chat message
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AIMessage {
    pub id: String,
    pub chat_id: String,
    pub role: String, // system, user, assistant, tool
    pub content: String,
    pub tool_calls: Option<String>,
    pub tool_call_id: Option<String>,
    pub tokens_used: i32,
    pub created_at: DateTime<Utc>,
}

/// Transcription job
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TranscriptionJob {
    pub id: String,
    pub audio_path: String,
    pub model_id: Option<String>,
    pub language: String,
    pub status: String, // pending, processing, completed, failed, cancelled
    pub progress: f32,
    pub result_text: String,
    pub result_segments: String, // JSON array
    pub error_message: Option<String>,
    pub duration_seconds: f32,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// File attachment
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Attachment {
    pub id: String,
    pub note_id: Option<String>,
    pub file_name: String,
    pub file_path: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration_seconds: Option<f32>,
    pub thumbnail_path: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// UI Preference
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UIPreference {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub type_: String, // 'note', 'event', 'folder'
    pub title: String,
    pub excerpt: String,
    pub highlight: String,
    pub score: f32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Note with relations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteWithRelations {
    #[serde(flatten)]
    pub note: Note,
    pub folder: Option<Folder>,
    pub tags: Vec<Tag>,
    pub attachments: Vec<Attachment>,
}

/// Event with reminder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventWithReminder {
    #[serde(flatten)]
    pub event: Event,
    pub reminder: Option<Reminder>,
}

/// Folder with children
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderTree {
    #[serde(flatten)]
    pub folder: Folder,
    pub children: Vec<FolderTree>,
    pub note_count: i32,
}

/// Statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statistics {
    pub total_notes: i64,
    pub total_folders: i64,
    pub total_words: i64,
    pub total_characters: i64,
    pub total_events: i64,
    pub total_tags: i64,
    pub notes_this_week: i64,
    pub notes_this_month: i64,
    pub average_note_length: f32,
    pub most_used_tags: Vec<(String, i64)>,
    pub notes_by_folder: HashMap<String, i64>,
}

/// Backup metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub note_count: i64,
    pub folder_count: i64,
    pub event_count: i64,
    pub tag_count: i64,
    pub size_bytes: i64,
}

/// Export format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "format")]
pub enum ExportFormat {
    Markdown,
    HTML,
    PDF,
    JSON,
    PlainText,
}

/// Import result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub imported_count: i32,
    pub failed_count: i32,
    pub errors: Vec<String>,
    pub notes: Vec<Note>,
}

impl Default for Folder {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "New Folder".to_string(),
            parent_id: None,
            color: "#00BFA6".to_string(),
            icon: "folder".to_string(),
            sort_order: 0,
            is_system: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

impl Default for Note {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            folder_id: None,
            title: "Untitled".to_string(),
            content: String::new(),
            content_md: String::new(),
            content_html: String::new(),
            excerpt: String::new(),
            word_count: 0,
            char_count: 0,
            reading_time: 0,
            is_pinned: false,
            is_archived: false,
            is_deleted: false,
            is_favorite: false,
            cover_image: None,
            cover_color: None,
            template_id: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            last_edited_at: now,
        }
    }
}

impl Note {
    pub fn update_counts(&mut self) {
        self.char_count = self.content.chars().count() as i32;
        self.word_count = self.content.split_whitespace().count() as i32;
        self.reading_time = ((self.word_count as f32) / 200.0).ceil() as i32; // 200 words per minute
        self.excerpt = self.content.chars().take(200).collect::<String>();
        self.last_edited_at = Utc::now();
        self.updated_at = Utc::now();
    }
}