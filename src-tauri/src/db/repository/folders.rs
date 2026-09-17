//! Folders repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct FoldersRepository {
    db: Sql,
}

impl FoldersRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut folder: Folder) -> Result<Folder> {
        folder.id = Uuid::new_v4().to_string();

        self.db.execute_with_params(
            r#"
            INSERT INTO folders (id, name, parent_id, color, icon, sort_order, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            vec![
                Value::Text(folder.id.clone()),
                Value::Text(folder.name.clone()),
                folder.parent_id.clone().map(Value::Text).unwrap_or(Value::Null),
                Value::Text(folder.color.clone()),
                Value::Text(folder.icon.clone()),
                Value::Integer(folder.sort_order as i64),
                Value::Integer(if folder.is_system { 1 } else { 0 }),
                Value::Text(folder.created_at.to_rfc3339()),
                Value::Text(folder.updated_at.to_rfc3339()),
            ],
        ).await?;

        Ok(folder)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Folder>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM folders WHERE id = ?",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_folder(row)))
    }

    pub async fn update(&self, folder: &Folder) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE folders SET
                name = ?, parent_id = ?, color = ?, icon = ?, sort_order = ?,
                is_system = ?, updated_at = ?
            WHERE id = ?
            "#,
                vec![
                    Value::Text(folder.name.clone()),
                    folder.parent_id.clone().map(Value::Text).unwrap_or(Value::Null),
                    Value::Text(folder.color.clone()),
                    Value::Text(folder.icon.clone()),
                    Value::Integer(folder.sort_order as i64),
                    Value::Integer(if folder.is_system { 1 } else { 0 }),
                    Value::Text(folder.updated_at.to_rfc3339()),
                    Value::Text(folder.id.clone()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str, recursive: bool) -> Result<()> {
        self.delete_inner(id.to_string(), recursive).await
    }

    fn delete_inner<'a>(
        &'a self,
        id: String,
        recursive: bool,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
            if recursive {
                // Delete all child folders recursively
                let children = self.get_children(&id).await?;
                for child in children {
                    self.delete_inner(child.id, true).await?;
                }
            } else {
                // Move children to parent
                let folder = self.get(&id).await?;
                if let Some(folder) = folder {
                    self.db
                        .execute_with_params(
                            "UPDATE folders SET parent_id = ?, updated_at = ? WHERE parent_id = ?",
                            vec![
                                folder.parent_id.map(Value::Text).unwrap_or(Value::Null),
                                Value::Text(Utc::now().to_rfc3339()),
                                Value::Text(id.clone()),
                            ],
                        )
                        .await?;
                }
            }

            // Заметки папки: при recursive — мягко удаляем вместе с папкой,
            // иначе — возвращаем на главную (folder_id = NULL).
            // Ветка выполняется для каждой папки рекурсии, включая вложенные.
            if recursive {
                let now = Utc::now().to_rfc3339();
                self.db
                    .execute_with_params(
                        "UPDATE notes SET is_deleted = TRUE, deleted_at = ?, updated_at = ? WHERE folder_id = ?",
                        vec![
                            Value::Text(now.clone()),
                            Value::Text(now),
                            Value::Text(id.clone()),
                        ],
                    )
                    .await?;
            } else {
                self.db
                    .execute_with_params(
                        "UPDATE notes SET folder_id = NULL, updated_at = ? WHERE folder_id = ?",
                        vec![
                            Value::Text(Utc::now().to_rfc3339()),
                            Value::Text(id.clone()),
                        ],
                    )
                    .await?;
            }

            self.db
                .execute_with_params("DELETE FROM folders WHERE id = ?", vec![Value::Text(id)])
                .await?;
            Ok(())
        })
    }

    pub async fn list(&self, parent_id: Option<&str>) -> Result<Vec<Folder>> {
        let query = if let Some(_parent_id) = parent_id {
            "SELECT * FROM folders WHERE parent_id = ? ORDER BY sort_order, name"
        } else {
            "SELECT * FROM folders WHERE parent_id IS NULL OR parent_id = '' ORDER BY sort_order, name"
        };

        let rows = if let Some(parent_id) = parent_id {
            self.db
                .select_with_params(query, vec![Value::Text(parent_id.to_string())])
                .await?
        } else {
            self.db.select(query).await?
        };

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_folder(row))
            .collect())
    }

    pub async fn get_all(&self) -> Result<Vec<Folder>> {
        let rows = self
            .db
            .select("SELECT * FROM folders ORDER BY sort_order, name")
            .await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_folder(row))
            .collect())
    }

    pub async fn get_children(&self, parent_id: &str) -> Result<Vec<Folder>> {
        self.list(Some(parent_id)).await
    }

    pub async fn get_tree(&self) -> Result<Vec<FolderTree>> {
        let all_folders = self.get_all().await?;
        let mut roots = Vec::new();

        for folder in &all_folders {
            if folder.parent_id.is_none() || folder.parent_id.as_deref() == Some("") {
                let children = self.build_tree(&all_folders, &folder.id).await?;
                roots.push(FolderTree {
                    folder: folder.clone(),
                    children,
                    note_count: 0, // Would be populated by notes repository
                });
            }
        }

        Ok(roots)
    }

    fn build_tree<'a>(
        &'a self,
        all_folders: &'a [Folder],
        parent_id: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<FolderTree>>> + Send + 'a>>
    {
        Box::pin(async move {
            let mut tree = Vec::new();
            for folder in all_folders {
                if folder.parent_id.as_deref() == Some(parent_id) {
                    let children = self.build_tree(all_folders, &folder.id).await?;
                    tree.push(FolderTree {
                        folder: folder.clone(),
                        children,
                        note_count: 0,
                    });
                }
            }
            Ok(tree)
        })
    }

    pub async fn move_folder(&self, id: &str, new_parent_id: Option<&str>) -> Result<()> {
        // Prevent moving a folder into its own descendant
        if let Some(new_parent) = new_parent_id {
            if self.is_descendant(id, new_parent).await? {
                return Err(anyhow::anyhow!(
                    "Cannot move folder into its own descendant"
                ));
            }
        }

        self.db
            .execute_with_params(
                "UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?",
                vec![
                    Value::Text(new_parent_id.unwrap_or("").to_string()),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    async fn is_descendant(&self, ancestor_id: &str, descendant_id: &str) -> Result<bool> {
        let mut current_id = Some(descendant_id.to_string());
        while let Some(id) = current_id {
            if id == ancestor_id {
                return Ok(true);
            }
            let folder = self.get(&id).await?;
            current_id = folder.and_then(|f| f.parent_id);
        }
        Ok(false)
    }

    pub async fn reorder(&self, folder_ids: &[String]) -> Result<()> {
        for (index, id) in folder_ids.iter().enumerate() {
            self.db
                .execute_with_params(
                    "UPDATE folders SET sort_order = ?, updated_at = ? WHERE id = ?",
                    vec![
                        Value::Integer(index as i64),
                        Value::Text(Utc::now().to_rfc3339()),
                        Value::Text(id.clone()),
                    ],
                )
                .await?;
        }
        Ok(())
    }

    fn row_to_folder(&self, row: serde_json::Value) -> Option<Folder> {
        Some(Folder {
            id: row.get("id")?.as_str()?.to_string(),
            name: row.get("name")?.as_str()?.to_string(),
            parent_id: row
                .get("parent_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            color: row.get("color")?.as_str()?.to_string(),
            icon: row.get("icon")?.as_str()?.to_string(),
            sort_order: row.get("sort_order")?.as_i64()? as i32,
            is_system: row.get("is_system")?.as_i64()? != 0,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }
}
