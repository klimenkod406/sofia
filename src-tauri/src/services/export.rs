//! Export service

use crate::db::models::*;
use crate::services::notes::NotesService;
use super::notes::{ExportFormat, ImportFormat};
use anyhow::Result;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;

pub struct ExportService {
    notes_service: Arc<NotesService>,
}

impl ExportService {
    pub fn new(db: Arc<crate::db::Database>) -> Self {
        Self {
            notes_service: Arc::new(NotesService::new(db)),
        }
    }

    pub fn set_notes_service(&mut self, service: Arc<NotesService>) {
        self.notes_service = service;
    }

    pub async fn export_note(&self, note_id: &str, format: ExportFormat, output_path: &PathBuf) -> Result<()> {
        let content = self.notes_service.export_note(note_id, format.clone()).await?;
        
        let extension = match format {
            ExportFormat::Markdown => "md",
            ExportFormat::HTML => "html",
            ExportFormat::PDF => "pdf",
            ExportFormat::JSON => "json",
            ExportFormat::PlainText => "txt",
        };

        let final_path = if output_path.extension().is_some() {
            output_path.to_path_buf()
        } else {
            output_path.with_extension(extension)
        };

        if let Some(parent) = final_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::write(&final_path, content).await?;
        Ok(())
    }

    pub async fn export_notes(&self, note_ids: &[String], format: ExportFormat, output_dir: &PathBuf) -> Result<Vec<PathBuf>> {
        let mut exported = Vec::new();
        
        for note_id in note_ids {
            let note = self.notes_service.get_note(note_id).await?;
            if let Some(note) = note {
                let safe_title = sanitize_filename(&note.title);
                let extension = match format {
                    ExportFormat::Markdown => "md",
                    ExportFormat::HTML => "html",
                    ExportFormat::PDF => "pdf",
                    ExportFormat::JSON => "json",
                    ExportFormat::PlainText => "txt",
                };
                let file_name = format!("{}.{}", safe_title, extension);
                let output_path = output_dir.join(file_name);
                
                self.export_note(note_id, format.clone(), &output_path).await?;
                exported.push(output_path);
            }
        }

        Ok(exported)
    }

    pub async fn export_folder(&self, folder_id: &str, format: ExportFormat, output_dir: &PathBuf, recursive: bool) -> Result<Vec<PathBuf>> {
        // Get all notes in folder (and subfolders if recursive)
        let filter = crate::db::repository::NoteFilter {
            folder_id: Some(folder_id.to_string()),
            is_deleted: Some(false),
            ..Default::default()
        };
        
        let notes = self.notes_service.list_notes(filter, crate::db::repository::Pagination::default()).await?;
        let note_ids: Vec<String> = notes.iter().map(|n| n.id.clone()).collect();
        
        self.export_notes(&note_ids, format, output_dir).await
    }

    pub async fn export_all(&self, format: ExportFormat, output_dir: &PathBuf) -> Result<Vec<PathBuf>> {
        let filter = crate::db::repository::NoteFilter {
            is_deleted: Some(false),
            ..Default::default()
        };
        
        let notes = self.notes_service.list_notes(filter, crate::db::repository::Pagination::default()).await?;
        let note_ids: Vec<String> = notes.iter().map(|n| n.id.clone()).collect();
        
        self.export_notes(&note_ids, format, output_dir).await
    }

    pub async fn export_as_bundle(&self, note_ids: &[String], output_path: &PathBuf) -> Result<()> {
        // Export as a single JSON bundle with all notes and metadata
        let mut bundle = ExportBundle {
            version: env!("CARGO_PKG_VERSION").to_string(),
            exported_at: chrono::Utc::now(),
            notes: Vec::new(),
        };

        for note_id in note_ids {
            if let Some(note) = self.notes_service.get_note_with_relations(note_id).await? {
                bundle.notes.push(note);
            }
        }

        let json = serde_json::to_string_pretty(&bundle)?;
        fs::write(output_path, json).await?;
        Ok(())
    }

    pub async fn import_bundle(&self, bundle_path: &PathBuf, target_folder: Option<String>) -> Result<ImportResult> {
        let json = fs::read_to_string(bundle_path).await?;
        let bundle: ExportBundle = serde_json::from_str(&json)?;

        let mut result = ImportResult {
            success: true,
            imported_count: 0,
            failed_count: 0,
            errors: Vec::new(),
            notes: Vec::new(),
        };

        for note_with_relations in bundle.notes {
            let mut note = note_with_relations.note;
            note.folder_id = target_folder.clone();
            note.id = uuid::Uuid::new_v4().to_string();
            note.created_at = chrono::Utc::now();
            note.updated_at = chrono::Utc::now();
            note.last_edited_at = chrono::Utc::now();

            match self.notes_service.update_note(&note).await {
                Ok(_) => {
                    result.imported_count += 1;
                    result.notes.push(note);
                }
                Err(e) => {
                    result.failed_count += 1;
                    result.errors.push(format!("Failed to import '{}': {}", note.title, e));
                }
            }
        }

        result.success = result.failed_count == 0;
        Ok(result)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportBundle {
    pub version: String,
    pub exported_at: chrono::DateTime<chrono::Utc>,
    pub notes: Vec<NoteWithRelations>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub imported_count: i32,
    pub failed_count: i32,
    pub errors: Vec<String>,
    pub notes: Vec<Note>,
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}