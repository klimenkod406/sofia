//! Tags repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct TagsRepository {
    db: Sql,
}

impl TagsRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut tag: Tag) -> Result<Tag> {
        tag.id = Uuid::new_v4().to_string();

        self.db.execute_with_params(
            r#"
            INSERT INTO tags (id, name, color, icon, description, is_system, parent_id, usage_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            vec![
                Value::Text(tag.id.clone()),
                Value::Text(tag.name.clone()),
                Value::Text(tag.color.clone()),
                Value::Text(tag.icon.clone()),
                Value::Text(tag.description.clone()),
                Value::Integer(if tag.is_system { 1 } else { 0 }),
                Value::Text(tag.parent_id.clone().unwrap_or_default()),
                Value::Integer(tag.usage_count as i64),
                Value::Text(tag.created_at.to_rfc3339()),
            ],
        ).await?;

        Ok(tag)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Tag>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM tags WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_tag(row)))
    }

    pub async fn get_by_name(&self, name: &str) -> Result<Option<Tag>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM tags WHERE name = ?",
                vec![Value::Text(name.to_string())],
            )
            .await?;

        Ok(rows.into_iter().next().and_then(|row| self.row_to_tag(row)))
    }

    pub async fn get_or_create(&self, name: &str) -> Result<Tag> {
        if let Some(tag) = self.get_by_name(name).await? {
            return Ok(tag);
        }

        let tag = Tag {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            color: Self::generate_color(name),
            icon: String::new(),
            description: String::new(),
            is_system: false,
            parent_id: None,
            usage_count: 0,
            created_at: Utc::now(),
        };
        self.create(tag).await
    }

    pub async fn update(&self, tag: &Tag) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE tags SET
                name = ?, color = ?, icon = ?, description = ?, is_system = ?,
                parent_id = ?, usage_count = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(tag.name.clone()),
                    Value::Text(tag.color.clone()),
                    Value::Text(tag.icon.clone()),
                    Value::Text(tag.description.clone()),
                    Value::Integer(if tag.is_system { 1 } else { 0 }),
                    Value::Text(tag.parent_id.clone().unwrap_or_default()),
                    Value::Integer(tag.usage_count as i64),
                    Value::Text(tag.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        // Remove from all notes first
        self.db
            .execute_with_params(
                "DELETE FROM note_tags WHERE tag_id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        self.db
            .execute_with_params(
                "DELETE FROM tags WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn list(&self, include_system: bool) -> Result<Vec<Tag>> {
        let query = if include_system {
            "SELECT * FROM tags ORDER BY usage_count DESC, name"
        } else {
            "SELECT * FROM tags WHERE is_system = FALSE ORDER BY usage_count DESC, name"
        };

        let rows = self.db.select(query).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_tag(row))
            .collect())
    }

    pub async fn get_popular(&self, limit: i32) -> Result<Vec<Tag>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM tags ORDER BY usage_count DESC LIMIT ?",
                vec![Value::Integer(limit as i64)],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_tag(row))
            .collect())
    }

    pub async fn search(&self, query: &str, limit: i32) -> Result<Vec<Tag>> {
        let search_term = format!("%{}%", query);
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM tags WHERE name LIKE ? ORDER BY usage_count DESC LIMIT ?",
                vec![Value::Text(search_term), Value::Integer(limit as i64)],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_tag(row))
            .collect())
    }

    pub async fn increment_usage(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn decrement_usage(&self, id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE tags SET usage_count = usage_count - 1 WHERE id = ? AND usage_count > 0",
                vec![Value::Text(id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn get_suggestions(&self, prefix: &str, limit: i32) -> Result<Vec<Tag>> {
        let search_term = format!("{}%", prefix);
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM tags WHERE name LIKE ? ORDER BY usage_count DESC LIMIT ?",
                vec![Value::Text(search_term), Value::Integer(limit as i64)],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_tag(row))
            .collect())
    }

    fn generate_color(name: &str) -> String {
        // Generate consistent color from name hash
        let mut hash = 0u32;
        for c in name.chars() {
            hash = hash.wrapping_mul(31).wrapping_add(c as u32);
        }
        let hue = hash % 360;
        format!("hsl({}, 65%, 45%)", hue)
    }

    fn row_to_tag(&self, row: serde_json::Value) -> Option<Tag> {
        Some(Tag {
            id: row.get("id")?.as_str()?.to_string(),
            name: row.get("name")?.as_str()?.to_string(),
            color: row.get("color")?.as_str()?.to_string(),
            icon: row.get("icon")?.as_str()?.to_string(),
            description: row
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            is_system: row.get("is_system")?.as_i64()? != 0,
            parent_id: row
                .get("parent_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            usage_count: row.get("usage_count")?.as_i64()? as i32,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }
}
