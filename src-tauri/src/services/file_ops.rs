//! File operations service

use crate::db::Database;
use anyhow::Result;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use walkdir::WalkDir;

pub struct FileOpsService {
    app_data_dir: PathBuf,
}

impl FileOpsService {
    pub fn new(db: Arc<Database>) -> Self {
        let app_data_dir = directories::BaseDirs::new()
            .map(|b| b.data_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."))
            .join("sofia");
        
        Self { app_data_dir }
    }

    pub fn get_app_data_dir(&self) -> &Path {
        &self.app_data_dir
    }

    pub fn get_notes_dir(&self) -> PathBuf {
        self.app_data_dir.join("notes")
    }

    pub fn get_attachments_dir(&self) -> PathBuf {
        self.app_data_dir.join("attachments")
    }

    pub fn get_models_dir(&self) -> PathBuf {
        self.app_data_dir.join("models")
    }

    pub fn get_backups_dir(&self) -> PathBuf {
        self.app_data_dir.join("backups")
    }

    pub fn get_temp_dir(&self) -> PathBuf {
        self.app_data_dir.join("temp")
    }

    pub async fn ensure_directories(&self) -> Result<()> {
        fs::create_dir_all(self.get_notes_dir()).await?;
        fs::create_dir_all(self.get_attachments_dir()).await?;
        fs::create_dir_all(self.get_models_dir()).await?;
        fs::create_dir_all(self.get_backups_dir()).await?;
        fs::create_dir_all(self.get_temp_dir()).await?;
        Ok(())
    }

    pub async fn read_file(&self, path: &Path) -> Result<String> {
        Ok(fs::read_to_string(path).await?)
    }

    pub async fn read_file_bytes(&self, path: &Path) -> Result<Vec<u8>> {
        Ok(fs::read(path).await?)
    }

    pub async fn write_file(&self, path: &Path, content: &str) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }
        Ok(fs::write(path, content).await?)
    }

    pub async fn write_file_bytes(&self, path: &Path, content: &[u8]) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }
        Ok(fs::write(path, content).await?)
    }

    pub async fn delete_file(&self, path: &Path) -> Result<()> {
        if path.exists() {
            fs::remove_file(path).await?;
        }
        Ok(())
    }

    pub async fn delete_directory(&self, path: &Path) -> Result<()> {
        if path.exists() {
            fs::remove_dir_all(path).await?;
        }
        Ok(())
    }

    pub async fn list_directory(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let mut entries = Vec::new();
        let mut dir = fs::read_dir(path).await?;
        while let Some(entry) = dir.next_entry().await? {
            let metadata = entry.metadata().await?;
            entries.push(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                modified: metadata.modified().ok(),
            });
        }
        entries.sort_by(|a, b| {
            // Directories first, then alphabetical
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        Ok(entries)
    }

    pub async fn create_directory(&self, path: &Path) -> Result<()> {
        fs::create_dir_all(path).await?;
        Ok(())
    }

    pub async fn copy_file(&self, from: &Path, to: &Path) -> Result<()> {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::copy(from, to).await?;
        Ok(())
    }

    pub async fn move_file(&self, from: &Path, to: &Path) -> Result<()> {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::rename(from, to).await?;
        Ok(())
    }

    pub async fn file_exists(&self, path: &Path) -> bool {
        path.exists()
    }

    pub async fn get_file_size(&self, path: &Path) -> Result<u64> {
        let metadata = fs::metadata(path).await?;
        Ok(metadata.len())
    }

    pub async fn get_mime_type(&self, path: &Path) -> String {
        mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string()
    }

    pub async fn find_files(&self, root: &Path, pattern: &str) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();
        for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let name = entry.file_name().to_string_lossy();
                if glob_match(&name, pattern) {
                    files.push(entry.path().to_path_buf());
                }
            }
        }
        Ok(files)
    }

    pub async fn get_disk_usage(&self) -> Result<DiskUsage> {
        let mut total_size = 0u64;
        let mut file_count = 0u64;

        for entry in WalkDir::new(&self.app_data_dir).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                    file_count += 1;
                }
            }
        }

        Ok(DiskUsage {
            total_size,
            file_count,
            notes_size: self.get_dir_size(self.get_notes_dir()).await?,
            attachments_size: self.get_dir_size(self.get_attachments_dir()).await?,
            models_size: self.get_dir_size(self.get_models_dir()).await?,
            backups_size: self.get_dir_size(self.get_backups_dir()).await?,
        })
    }

    async fn get_dir_size(&self, path: PathBuf) -> Result<u64> {
        let mut size = 0u64;
        if path.exists() {
            for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    if let Ok(metadata) = entry.metadata() {
                        size += metadata.len();
                    }
                }
            }
        }
        Ok(size)
    }

    pub async fn clean_temp(&self) -> Result<u64> {
        let mut freed = 0u64;
        let temp_dir = self.get_temp_dir();
        if temp_dir.exists() {
            for entry in WalkDir::new(&temp_dir).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    if let Ok(metadata) = entry.metadata() {
                        freed += metadata.len();
                    }
                }
            }
            fs::remove_dir_all(&temp_dir).await?;
            fs::create_dir_all(&temp_dir).await?;
        }
        Ok(freed)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: PathBuf,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<std::time::SystemTime>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiskUsage {
    pub total_size: u64,
    pub file_count: u64,
    pub notes_size: u64,
    pub attachments_size: u64,
    pub models_size: u64,
    pub backups_size: u64,
}

fn glob_match(name: &str, pattern: &str) -> bool {
    // Simple glob matching
    let pattern = pattern.replace('*', ".*").replace('?', ".");
    regex::Regex::new(&format!("^{}$", pattern))
        .map(|re| re.is_match(name))
        .unwrap_or(false)
}