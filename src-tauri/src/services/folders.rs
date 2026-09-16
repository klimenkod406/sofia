//! Folders service

use crate::db::models::*;
use crate::db::repository::FoldersRepository;
use crate::db::Database;
use anyhow::Result;
use std::sync::Arc;

pub struct FoldersService {
    repo: FoldersRepository,
}

impl FoldersService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { repo: db.folders() }
    }

    pub async fn create_folder(
        &self,
        name: &str,
        parent_id: Option<String>,
        color: Option<String>,
        icon: Option<String>,
    ) -> Result<Folder> {
        let folder = Folder {
            name: name.to_string(),
            parent_id,
            color: color.unwrap_or_else(|| "#00BFA6".to_string()),
            icon: icon.unwrap_or_else(|| "folder".to_string()),
            ..Default::default()
        };
        self.repo.create(folder).await
    }

    pub async fn get_folder(&self, id: &str) -> Result<Option<Folder>> {
        self.repo.get(id).await
    }

    pub async fn update_folder(&self, folder: &Folder) -> Result<()> {
        self.repo.update(folder).await
    }

    pub async fn delete_folder(&self, id: &str, recursive: bool) -> Result<()> {
        self.repo.delete(id, recursive).await
    }

    pub async fn list_folders(&self, parent_id: Option<&str>) -> Result<Vec<Folder>> {
        self.repo.list(parent_id).await
    }

    pub async fn get_all_folders(&self) -> Result<Vec<Folder>> {
        self.repo.get_all().await
    }

    pub async fn get_folder_tree(&self) -> Result<Vec<FolderTree>> {
        self.repo.get_tree().await
    }

    pub async fn move_folder(&self, id: &str, new_parent_id: Option<&str>) -> Result<()> {
        self.repo.move_folder(id, new_parent_id).await
    }

    pub async fn reorder_folders(&self, folder_ids: &[String]) -> Result<()> {
        self.repo.reorder(folder_ids).await
    }

    pub async fn get_children(&self, parent_id: &str) -> Result<Vec<Folder>> {
        self.repo.get_children(parent_id).await
    }
}
