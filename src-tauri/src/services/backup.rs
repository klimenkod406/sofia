//! Backup service

use crate::db::Database;
use crate::services::file_ops::FileOpsService;
use anyhow::Result;
use chrono::{DateTime, Utc};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use zip::write::FileOptions;
use zip::ZipWriter;

pub struct BackupService {
    file_ops: Arc<FileOpsService>,
}

impl BackupService {
    pub fn new(db: Arc<Database>) -> Self {
        // FileOpsService will be injected properly in production
        Self {
            file_ops: Arc::new(FileOpsService::new(db)),
        }
    }

    pub fn set_file_ops(&mut self, file_ops: Arc<FileOpsService>) {
        self.file_ops = file_ops;
    }

    pub async fn create_backup(
        &self,
        include_attachments: bool,
        include_models: bool,
    ) -> Result<BackupMetadata> {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let backup_name = format!("sofia_backup_{}.zip", timestamp);
        let backup_path = self.file_ops.get_backups_dir().join(&backup_name);

        // Ensure backups directory exists
        fs::create_dir_all(self.file_ops.get_backups_dir()).await?;

        // Create zip file
        let file = std::fs::File::create(&backup_path)?;
        let mut zip = ZipWriter::new(file);
        let options =
            FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);

        // Export database
        let db_path = self.file_ops.get_app_data_dir().join("sofia.db");
        if db_path.exists() {
            zip.start_file("sofia.db", options)?;
            let db_data = std::fs::read(&db_path)?;
            zip.write_all(&db_data)?;
        }

        // Export settings
        let settings_path = self.file_ops.get_app_data_dir().join("settings.json");
        if settings_path.exists() {
            zip.start_file("settings.json", options)?;
            let settings_data = std::fs::read(&settings_path)?;
            zip.write_all(&settings_data)?;
        }

        // Export notes as markdown
        let notes_dir = self.file_ops.get_notes_dir();
        if notes_dir.exists() {
            for entry in walkdir::WalkDir::new(&notes_dir)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if entry.file_type().is_file() {
                    let rel_path = entry.path().strip_prefix(&notes_dir).unwrap();
                    let zip_path = format!("notes/{}", rel_path.to_string_lossy());
                    zip.start_file(&zip_path, options)?;
                    let file_data = std::fs::read(entry.path())?;
                    zip.write_all(&file_data)?;
                }
            }
        }

        // Include attachments if requested
        if include_attachments {
            let attachments_dir = self.file_ops.get_attachments_dir();
            if attachments_dir.exists() {
                for entry in walkdir::WalkDir::new(&attachments_dir)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if entry.file_type().is_file() {
                        let rel_path = entry.path().strip_prefix(&attachments_dir).unwrap();
                        let zip_path = format!("attachments/{}", rel_path.to_string_lossy());
                        zip.start_file(&zip_path, options)?;
                        let file_data = std::fs::read(entry.path())?;
                        zip.write_all(&file_data)?;
                    }
                }
            }
        }

        // Include models if requested
        if include_models {
            let models_dir = self.file_ops.get_models_dir();
            if models_dir.exists() {
                for entry in walkdir::WalkDir::new(&models_dir)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if entry.file_type().is_file() {
                        let rel_path = entry.path().strip_prefix(&models_dir).unwrap();
                        let zip_path = format!("models/{}", rel_path.to_string_lossy());
                        zip.start_file(&zip_path, options)?;
                        let file_data = std::fs::read(entry.path())?;
                        zip.write_all(&file_data)?;
                    }
                }
            }
        }

        zip.finish()?;

        // Get backup size
        let metadata = fs::metadata(&backup_path).await?;
        let size = metadata.len();

        Ok(BackupMetadata {
            version: env!("CARGO_PKG_VERSION").to_string(),
            created_at: Utc::now(),
            note_count: self.count_notes().await?,
            folder_count: self.count_folders().await?,
            event_count: self.count_events().await?,
            tag_count: self.count_tags().await?,
            size_bytes: size,
        })
    }

    pub async fn restore_backup(&self, backup_path: &PathBuf) -> Result<BackupMetadata> {
        // Extract zip
        let file = std::fs::File::open(backup_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        // Restore database
        if let Ok(mut db_file) = archive.by_name("sofia.db") {
            let db_path = self.file_ops.get_app_data_dir().join("sofia.db");
            let mut dest = std::fs::File::create(&db_path)?;
            std::io::copy(&mut db_file, &mut dest)?;
        }

        // Restore settings
        if let Ok(mut settings_file) = archive.by_name("settings.json") {
            let settings_path = self.file_ops.get_app_data_dir().join("settings.json");
            let mut dest = std::fs::File::create(&settings_path)?;
            std::io::copy(&mut settings_file, &mut dest)?;
        }

        // Restore notes
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let name = file.name().to_string();

            if let Some(rel_path) = name.strip_prefix("notes/") {
                // Remove "notes/"
                let dest_path = self.file_ops.get_notes_dir().join(rel_path);
                fs::create_dir_all(dest_path.parent().unwrap()).await?;
                let mut dest = std::fs::File::create(&dest_path)?;
                std::io::copy(&mut file, &mut dest)?;
            } else if let Some(rel_path) = name.strip_prefix("attachments/") {
                // Remove "attachments/"
                let dest_path = self.file_ops.get_attachments_dir().join(rel_path);
                fs::create_dir_all(dest_path.parent().unwrap()).await?;
                let mut dest = std::fs::File::create(&dest_path)?;
                std::io::copy(&mut file, &mut dest)?;
            } else if let Some(rel_path) = name.strip_prefix("models/") {
                // Remove "models/"
                let dest_path = self.file_ops.get_models_dir().join(rel_path);
                fs::create_dir_all(dest_path.parent().unwrap()).await?;
                let mut dest = std::fs::File::create(&dest_path)?;
                std::io::copy(&mut file, &mut dest)?;
            }
        }

        // Return metadata about restored backup
        Ok(BackupMetadata {
            version: env!("CARGO_PKG_VERSION").to_string(),
            created_at: Utc::now(),
            note_count: self.count_notes().await?,
            folder_count: self.count_folders().await?,
            event_count: self.count_events().await?,
            tag_count: self.count_tags().await?,
            size_bytes: fs::metadata(backup_path).await?.len(),
        })
    }

    pub async fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        let mut backups = Vec::new();
        let backups_dir = self.file_ops.get_backups_dir();

        if backups_dir.exists() {
            let mut dir = fs::read_dir(backups_dir).await?;
            while let Some(entry) = dir.next_entry().await? {
                if entry.path().extension().is_some_and(|ext| ext == "zip") {
                    let metadata = entry.metadata().await?;
                    backups.push(BackupInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: entry.path(),
                        size: metadata.len(),
                        created_at: metadata.created().ok(),
                    });
                }
            }
        }

        backups.sort_by_key(|b| std::cmp::Reverse(b.created_at));
        Ok(backups)
    }

    pub async fn delete_backup(&self, backup_name: &str) -> Result<()> {
        let backup_path = self.file_ops.get_backups_dir().join(backup_name);
        if backup_path.exists() {
            fs::remove_file(backup_path).await?;
        }
        Ok(())
    }

    pub async fn auto_backup(&self) -> Result<Option<BackupMetadata>> {
        // Check if auto-backup is enabled and when last backup was
        // This would be called on a timer
        let backups = self.list_backups().await?;

        // If no backup in last 24 hours, create one
        let should_backup = backups.first().is_none_or(|last| {
            last.created_at
                .and_then(|t| t.elapsed().ok())
                .is_none_or(|elapsed| elapsed.as_secs() >= 24 * 3600)
        });

        if should_backup {
            Ok(Some(self.create_backup(true, false).await?))
        } else {
            Ok(None)
        }
    }

    async fn count_notes(&self) -> Result<i64> {
        // Would query database
        Ok(0)
    }

    async fn count_folders(&self) -> Result<i64> {
        Ok(0)
    }

    async fn count_events(&self) -> Result<i64> {
        Ok(0)
    }

    async fn count_tags(&self) -> Result<i64> {
        Ok(0)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupMetadata {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub note_count: i64,
    pub folder_count: i64,
    pub event_count: i64,
    pub tag_count: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupInfo {
    pub name: String,
    pub path: PathBuf,
    pub size: u64,
    pub created_at: Option<std::time::SystemTime>,
}
