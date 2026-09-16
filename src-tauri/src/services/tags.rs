//! Tags service

use crate::db::models::Tag;
use crate::db::repository::TagsRepository;
use crate::db::Database;
use anyhow::Result;
use std::sync::Arc;

pub struct TagsService {
    repo: TagsRepository,
}

impl TagsService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { repo: db.tags() }
    }

    pub async fn list_tags(&self, include_system: bool) -> Result<Vec<Tag>> {
        self.repo.list(include_system).await
    }

    pub async fn create_tag(&self, name: &str, color: Option<&str>) -> Result<Tag> {
        let mut tag = self.repo.get_or_create(name).await?;
        if let Some(color) = color {
            tag.color = color.to_string();
            self.repo.update(&tag).await?;
        }
        Ok(tag)
    }

    pub async fn delete_tag(&self, id: &str) -> Result<()> {
        self.repo.delete(id).await
    }
}
