//! Notes service

use crate::db::models::*;
use crate::db::repository::{NotesRepository, NoteFilter, Pagination};
use crate::db::Database;
use anyhow::Result;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

pub struct NotesService {
    repo: NotesRepository,
}

impl NotesService {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            repo: db.notes(),
        }
    }

    pub async fn create_note(&self, folder_id: Option<String>, title: Option<String>) -> Result<Note> {
        let mut note = Note::default();
        note.folder_id = folder_id;
        note.title = title.unwrap_or_else(|| "Untitled".to_string());
        self.repo.create(note).await
    }

    pub async fn get_note(&self, id: &str) -> Result<Option<Note>> {
        self.repo.get(id).await
    }

    pub async fn get_note_with_relations(&self, id: &str) -> Result<Option<NoteWithRelations>> {
        self.repo.get_with_relations(id).await
    }

    pub async fn update_note(&self, note: &Note) -> Result<()> {
        self.repo.update(note).await
    }

    pub async fn update_content(&self, id: &str, content: &str, content_md: &str, content_html: &str) -> Result<()> {
        if let Some(mut note) = self.repo.get(id).await? {
            note.content = content.to_string();
            note.content_md = content_md.to_string();
            note.content_html = content_html.to_string();
            note.update_counts();
            self.repo.update(&note).await?;
        }
        Ok(())
    }

    pub async fn delete_note(&self, id: &str, permanent: bool) -> Result<()> {
        self.repo.delete(id, permanent).await
    }

    pub async fn list_notes(&self, filter: NoteFilter, pagination: Pagination) -> Result<Vec<Note>> {
        self.repo.list(filter, pagination).await
    }

    pub async fn count_notes(&self, filter: NoteFilter) -> Result<i64> {
        self.repo.count(filter).await
    }

    pub async fn search_notes(&self, query: &str, limit: i32) -> Result<Vec<Note>> {
        let results = self.repo.search(query, limit).await?;
        let mut notes = Vec::new();
        for result in results {
            if let Some(note) = self.repo.get(&result.id).await? {
                notes.push(note);
            }
        }
        Ok(notes)
    }

    pub async fn export_note(&self, id: &str, format: ExportFormat) -> Result<String> {
        let model_format = match format {
            ExportFormat::Markdown => crate::db::models::ExportFormat::Markdown,
            ExportFormat::HTML => crate::db::models::ExportFormat::HTML,
            ExportFormat::PDF => crate::db::models::ExportFormat::PDF,
            ExportFormat::JSON => crate::db::models::ExportFormat::JSON,
            ExportFormat::PlainText => crate::db::models::ExportFormat::PlainText,
        };
        self.repo.export_note(id, model_format).await
    }

    pub async fn import_note(&self, folder_id: Option<String>, content: &str, format: ImportFormat) -> Result<Note> {
        let (title, content_md, content_html) = match format {
            ImportFormat::Markdown => {
                let title = extract_title_from_md(content).unwrap_or_else(|| "Imported Note".to_string());
                (title, content.to_string(), markdown_to_html(content))
            }
            ImportFormat::HTML => {
                let title = extract_title_from_html(content).unwrap_or_else(|| "Imported Note".to_string());
                (title, html_to_markdown(content), content.to_string())
            }
            ImportFormat::PlainText => {
                let title = content.lines().next().unwrap_or("Imported Note").to_string();
                (title, content.to_string(), text_to_html(content))
            }
            ImportFormat::JSON => {
                let imported: Note = serde_json::from_str(content)?;
                (imported.title, imported.content_md, imported.content_html)
            }
        };

        let mut note = Note::default();
        note.folder_id = folder_id;
        note.title = title;
        note.content = content_md.clone();
        note.content_md = content_md;
        note.content_html = content_html;
        note.update_counts();
        self.repo.create(note).await
    }

    pub async fn get_note_tree(&self, folder_id: Option<&str>) -> Result<Vec<FolderTree>> {
        self.repo.get_note_tree(folder_id).await
    }

    pub async fn move_note(&self, note_id: &str, folder_id: Option<&str>) -> Result<()> {
        self.repo.move_to_folder(note_id, folder_id).await
    }

    pub async fn duplicate_note(&self, id: &str) -> Result<Note> {
        self.repo.duplicate(id).await
    }

    pub async fn pin_note(&self, id: &str, pinned: bool) -> Result<()> {
        self.repo.pin(id, pinned).await
    }

    pub async fn archive_note(&self, id: &str, archived: bool) -> Result<()> {
        self.repo.archive(id, archived).await
    }

    pub async fn favorite_note(&self, id: &str, favorite: bool) -> Result<()> {
        self.repo.favorite(id, favorite).await
    }

    pub async fn add_tag(&self, note_id: &str, tag_id: &str) -> Result<()> {
        self.repo.add_tag(note_id, tag_id).await
    }

    pub async fn remove_tag(&self, note_id: &str, tag_id: &str) -> Result<()> {
        self.repo.remove_tag(note_id, tag_id).await
    }

    pub async fn get_recent_notes(&self, limit: i32) -> Result<Vec<Note>> {
        self.repo.get_recent(limit).await
    }

    pub async fn get_pinned_notes(&self) -> Result<Vec<Note>> {
        self.repo.get_pinned().await
    }

    pub async fn get_archived_notes(&self, pagination: Pagination) -> Result<Vec<Note>> {
        self.repo.get_archived(pagination).await
    }

    pub async fn get_statistics(&self) -> Result<Statistics> {
        // This would aggregate data from multiple repositories
        // Simplified for now
        Ok(Statistics {
            total_notes: 0,
            total_folders: 0,
            total_words: 0,
            total_characters: 0,
            total_events: 0,
            total_tags: 0,
            notes_this_week: 0,
            notes_this_month: 0,
            average_note_length: 0.0,
            most_used_tags: Vec::new(),
            notes_by_folder: std::collections::HashMap::new(),
        })
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "format")]
pub enum ExportFormat {
    Markdown,
    HTML,
    PDF,
    JSON,
    PlainText,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "format")]
pub enum ImportFormat {
    Markdown,
    HTML,
    PlainText,
    JSON,
}

fn extract_title_from_md(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            return Some(trimmed.trim_start_matches('#').trim().to_string());
        }
    }
    None
}

fn extract_title_from_html(content: &str) -> Option<String> {
    // Simple extraction - in production use a proper HTML parser
    if let Some(start) = content.find("<h1") {
        if let Some(end) = content[start..].find("</h1>") {
            let inner = &content[start..start+end];
            if let Some(gt) = inner.find('>') {
                return Some(inner[gt+1..].trim().to_string());
            }
        }
    }
    None
}

fn markdown_to_html(md: &str) -> String {
    // In production, use a proper markdown parser like pulldown-cmark
    // This is a simplified version
    md.replace('\n', "<br>")
}

fn html_to_markdown(html: &str) -> String {
    // In production, use a proper HTML to markdown converter
    html.replace("<br>", "\n").replace("<p>", "").replace("</p>", "\n")
}

fn text_to_html(text: &str) -> String {
    text.replace('\n', "<br>")
}