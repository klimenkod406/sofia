//! Notes repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Default)]
pub struct Pagination {
    pub page: i32,
    pub per_page: i32,
    pub offset: i32,
}

impl Pagination {
    pub fn new(page: i32, per_page: i32) -> Self {
        let offset = (page - 1) * per_page;
        Self {
            page,
            per_page,
            offset,
        }
    }
}

#[derive(Debug, Clone)]
pub struct NoteFilter {
    pub folder_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_deleted: Option<bool>,
    pub is_favorite: Option<bool>,
    pub search_query: Option<String>,
    pub tag_ids: Vec<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub sort_by: String,
    pub sort_order: String,
}

impl Default for NoteFilter {
    fn default() -> Self {
        Self {
            folder_id: None,
            is_pinned: Some(false),
            is_archived: Some(false),
            is_deleted: Some(false),
            is_favorite: None,
            search_query: None,
            tag_ids: Vec::new(),
            date_from: None,
            date_to: None,
            sort_by: "updated_at".to_string(),
            sort_order: "DESC".to_string(),
        }
    }
}

pub struct NotesRepository {
    db: Sql,
}

impl NotesRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn create(&self, mut note: Note) -> Result<Note> {
        note.id = Uuid::new_v4().to_string();
        note.update_counts();

        self.db
            .execute_with_params(
                r#"
            INSERT INTO notes (id, folder_id, title, content, content_md, content_html, excerpt,
                              word_count, char_count, reading_time, is_pinned, is_archived,
                              is_deleted, is_favorite, cover_image, cover_color, template_id,
                              created_at, updated_at, last_edited_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
                vec![
                    Value::Text(note.id.clone()),
                    note.folder_id
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    Value::Text(note.title.clone()),
                    Value::Text(note.content.clone()),
                    Value::Text(note.content_md.clone()),
                    Value::Text(note.content_html.clone()),
                    Value::Text(note.excerpt.clone()),
                    Value::Integer(note.word_count as i64),
                    Value::Integer(note.char_count as i64),
                    Value::Integer(note.reading_time as i64),
                    Value::Integer(if note.is_pinned { 1 } else { 0 }),
                    Value::Integer(if note.is_archived { 1 } else { 0 }),
                    Value::Integer(if note.is_deleted { 1 } else { 0 }),
                    Value::Integer(if note.is_favorite { 1 } else { 0 }),
                    note.cover_image
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    note.cover_color
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    note.template_id
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    Value::Text(note.created_at.to_rfc3339()),
                    Value::Text(note.updated_at.to_rfc3339()),
                    Value::Text(note.last_edited_at.to_rfc3339()),
                ],
            )
            .await?;

        Ok(note)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Note>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM notes WHERE id = ? AND is_deleted = FALSE",
                vec![Value::Text(id.to_string())],
            )
            .await?;

        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_note(row)))
    }

    pub async fn get_with_relations(&self, id: &str) -> Result<Option<NoteWithRelations>> {
        let note = self.get(id).await?;
        if note.is_none() {
            return Ok(None);
        }
        let note = note.unwrap();

        let folder = if let Some(folder_id) = &note.folder_id {
            self.get_folder(folder_id).await?
        } else {
            None
        };

        let tags = self.get_tags_for_note(&note.id).await?;
        let attachments = self.get_attachments_for_note(&note.id).await?;

        Ok(Some(NoteWithRelations {
            note,
            folder,
            tags,
            attachments,
        }))
    }

    pub async fn update(&self, note: &Note) -> Result<()> {
        self.db
            .execute_with_params(
                r#"
            UPDATE notes SET
                folder_id = ?, title = ?, content = ?, content_md = ?, content_html = ?,
                excerpt = ?, word_count = ?, char_count = ?, reading_time = ?,
                is_pinned = ?, is_archived = ?, is_deleted = ?, is_favorite = ?,
                cover_image = ?, cover_color = ?, template_id = ?, updated_at = ?,
                last_edited_at = ?
            WHERE id = ?
            "#,
                vec![
                    note.folder_id
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    Value::Text(note.title.clone()),
                    Value::Text(note.content.clone()),
                    Value::Text(note.content_md.clone()),
                    Value::Text(note.content_html.clone()),
                    Value::Text(note.excerpt.clone()),
                    Value::Integer(note.word_count as i64),
                    Value::Integer(note.char_count as i64),
                    Value::Integer(note.reading_time as i64),
                    Value::Integer(if note.is_pinned { 1 } else { 0 }),
                    Value::Integer(if note.is_archived { 1 } else { 0 }),
                    Value::Integer(if note.is_deleted { 1 } else { 0 }),
                    Value::Integer(if note.is_favorite { 1 } else { 0 }),
                    note.cover_image
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    note.cover_color
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    note.template_id
                        .clone()
                        .map(Value::Text)
                        .unwrap_or(Value::Null),
                    Value::Text(note.updated_at.to_rfc3339()),
                    Value::Text(note.last_edited_at.to_rfc3339()),
                    Value::Text(note.id.clone()),
                ],
            )
            .await?;

        Ok(())
    }

    pub async fn delete(&self, id: &str, permanent: bool) -> Result<()> {
        if permanent {
            self.db
                .execute_with_params(
                    "DELETE FROM notes WHERE id = ?",
                    vec![Value::Text(id.to_string())],
                )
                .await?;
        } else {
            self.db.execute_with_params(
                "UPDATE notes SET is_deleted = TRUE, deleted_at = ?, updated_at = ? WHERE id = ?",
                vec![
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            ).await?;
        }
        Ok(())
    }

    pub async fn list(&self, filter: NoteFilter, pagination: Pagination) -> Result<Vec<Note>> {
        let mut query = String::from("SELECT * FROM notes WHERE 1=1");
        let mut params = Vec::new();

        if let Some(folder_id) = &filter.folder_id {
            query.push_str(" AND folder_id = ?");
            params.push(Value::Text(folder_id.clone()));
        }

        if let Some(is_pinned) = filter.is_pinned {
            query.push_str(" AND is_pinned = ?");
            params.push(Value::Integer(if is_pinned { 1 } else { 0 }));
        }

        if let Some(is_archived) = filter.is_archived {
            query.push_str(" AND is_archived = ?");
            params.push(Value::Integer(if is_archived { 1 } else { 0 }));
        }

        if let Some(is_deleted) = filter.is_deleted {
            query.push_str(" AND is_deleted = ?");
            params.push(Value::Integer(if is_deleted { 1 } else { 0 }));
        }

        if let Some(is_favorite) = filter.is_favorite {
            query.push_str(" AND is_favorite = ?");
            params.push(Value::Integer(if is_favorite { 1 } else { 0 }));
        }

        if let Some(search) = &filter.search_query {
            query.push_str(" AND (title LIKE ? OR content LIKE ? OR excerpt LIKE ?)");
            let search_term = format!("%{}%", search);
            params.push(Value::Text(search_term.clone()));
            params.push(Value::Text(search_term.clone()));
            params.push(Value::Text(search_term));
        }

        if !filter.tag_ids.is_empty() {
            let placeholders = filter
                .tag_ids
                .iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");
            query.push_str(&format!(
                " AND id IN (SELECT note_id FROM note_tags WHERE tag_id IN ({}))",
                placeholders
            ));
            for tag_id in &filter.tag_ids {
                params.push(Value::Text(tag_id.clone()));
            }
        }

        if let Some(date_from) = filter.date_from {
            query.push_str(" AND created_at >= ?");
            params.push(Value::Text(date_from.to_rfc3339()));
        }

        if let Some(date_to) = filter.date_to {
            query.push_str(" AND created_at <= ?");
            params.push(Value::Text(date_to.to_rfc3339()));
        }

        // Validate sort_by to prevent SQL injection
        let valid_sort_columns = [
            "created_at",
            "updated_at",
            "last_edited_at",
            "title",
            "word_count",
        ];
        let sort_by = if valid_sort_columns.contains(&filter.sort_by.as_str()) {
            filter.sort_by
        } else {
            "updated_at".to_string()
        };

        let sort_order = if filter.sort_order.to_uppercase() == "ASC" {
            "ASC"
        } else {
            "DESC"
        };
        query.push_str(&format!(" ORDER BY {} {}", sort_by, sort_order));

        query.push_str(" LIMIT ? OFFSET ?");
        params.push(Value::Integer(pagination.per_page as i64));
        params.push(Value::Integer(pagination.offset as i64));

        let rows = self.db.select_with_params(&query, params).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_note(row))
            .collect())
    }

    pub async fn count(&self, filter: NoteFilter) -> Result<i64> {
        let mut query = String::from("SELECT COUNT(*) as count FROM notes WHERE 1=1");
        let mut params = Vec::new();

        if let Some(folder_id) = &filter.folder_id {
            query.push_str(" AND folder_id = ?");
            params.push(Value::Text(folder_id.clone()));
        }

        if let Some(is_pinned) = filter.is_pinned {
            query.push_str(" AND is_pinned = ?");
            params.push(Value::Integer(if is_pinned { 1 } else { 0 }));
        }

        if let Some(is_archived) = filter.is_archived {
            query.push_str(" AND is_archived = ?");
            params.push(Value::Integer(if is_archived { 1 } else { 0 }));
        }

        if let Some(is_deleted) = filter.is_deleted {
            query.push_str(" AND is_deleted = ?");
            params.push(Value::Integer(if is_deleted { 1 } else { 0 }));
        }

        if let Some(search) = &filter.search_query {
            query.push_str(" AND (title LIKE ? OR content LIKE ? OR excerpt LIKE ?)");
            let search_term = format!("%{}%", search);
            params.push(Value::Text(search_term.clone()));
            params.push(Value::Text(search_term.clone()));
            params.push(Value::Text(search_term));
        }

        let rows = self.db.select_with_params(&query, params).await?;
        Ok(rows
            .first()
            .and_then(|row| row.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0))
    }

    pub async fn search(&self, query: &str, limit: i32) -> Result<Vec<SearchResult>> {
        let search_term = format!("%{}%", query);
        let rows = self
            .db
            .select_with_params(
                r#"
            SELECT n.*, 'note' as type,
                   snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as highlight
            FROM notes n
            JOIN notes_fts ON n.rowid = notes_fts.rowid
            WHERE notes_fts MATCH ? AND n.is_deleted = FALSE
            ORDER BY rank
            LIMIT ?
            "#,
                vec![Value::Text(search_term), Value::Integer(limit as i64)],
            )
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_search_result(row))
            .collect())
    }

    pub async fn get_recent(&self, limit: i32) -> Result<Vec<Note>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM notes WHERE is_deleted = FALSE AND is_archived = FALSE ORDER BY last_edited_at DESC LIMIT ?",
            vec![Value::Integer(limit as i64)],
        ).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_note(row))
            .collect())
    }

    pub async fn get_pinned(&self) -> Result<Vec<Note>> {
        let rows = self.db.select(
            "SELECT * FROM notes WHERE is_pinned = TRUE AND is_deleted = FALSE ORDER BY updated_at DESC"
        ).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_note(row))
            .collect())
    }

    pub async fn get_archived(&self, pagination: Pagination) -> Result<Vec<Note>> {
        let rows = self.db.select_with_params(
            "SELECT * FROM notes WHERE is_archived = TRUE AND is_deleted = FALSE ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            vec![
                Value::Integer(pagination.per_page as i64),
                Value::Integer(pagination.offset as i64),
            ],
        ).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_note(row))
            .collect())
    }

    pub async fn move_to_folder(&self, note_id: &str, folder_id: Option<&str>) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?",
                vec![
                    folder_id
                        .map(|s| Value::Text(s.to_string()))
                        .unwrap_or(Value::Null),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(note_id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn duplicate(&self, id: &str) -> Result<Note> {
        let original = self
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Note not found"))?;
        let mut new_note = original;
        new_note.id = Uuid::new_v4().to_string();
        new_note.title = format!("{} (Copy)", new_note.title);
        new_note.created_at = Utc::now();
        new_note.updated_at = Utc::now();
        new_note.last_edited_at = Utc::now();
        self.create(new_note).await
    }

    pub async fn pin(&self, id: &str, pinned: bool) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?",
                vec![
                    Value::Integer(if pinned { 1 } else { 0 }),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn archive(&self, id: &str, archived: bool) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE notes SET is_archived = ?, updated_at = ? WHERE id = ?",
                vec![
                    Value::Integer(if archived { 1 } else { 0 }),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn favorite(&self, id: &str, favorite: bool) -> Result<()> {
        self.db
            .execute_with_params(
                "UPDATE notes SET is_favorite = ?, updated_at = ? WHERE id = ?",
                vec![
                    Value::Integer(if favorite { 1 } else { 0 }),
                    Value::Text(Utc::now().to_rfc3339()),
                    Value::Text(id.to_string()),
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn add_tag(&self, note_id: &str, tag_id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
                vec![
                    Value::Text(note_id.to_string()),
                    Value::Text(tag_id.to_string()),
                ],
            )
            .await?;

        self.db
            .execute_with_params(
                "UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?",
                vec![Value::Text(tag_id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn remove_tag(&self, note_id: &str, tag_id: &str) -> Result<()> {
        self.db
            .execute_with_params(
                "DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?",
                vec![
                    Value::Text(note_id.to_string()),
                    Value::Text(tag_id.to_string()),
                ],
            )
            .await?;

        self.db
            .execute_with_params(
                "UPDATE tags SET usage_count = usage_count - 1 WHERE id = ? AND usage_count > 0",
                vec![Value::Text(tag_id.to_string())],
            )
            .await?;
        Ok(())
    }

    pub async fn get_tags_for_note(&self, note_id: &str) -> Result<Vec<Tag>> {
        let rows = self
            .db
            .select_with_params(
                r#"
            SELECT t.* FROM tags t
            JOIN note_tags nt ON t.id = nt.tag_id
            WHERE nt.note_id = ?
            ORDER BY t.name
            "#,
                vec![Value::Text(note_id.to_string())],
            )
            .await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_tag(row))
            .collect())
    }

    pub async fn get_attachments_for_note(&self, note_id: &str) -> Result<Vec<Attachment>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at DESC",
                vec![Value::Text(note_id.to_string())],
            )
            .await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_attachment(row))
            .collect())
    }

    pub async fn get_folder(&self, folder_id: &str) -> Result<Option<Folder>> {
        let rows = self
            .db
            .select_with_params(
                "SELECT * FROM folders WHERE id = ?",
                vec![Value::Text(folder_id.to_string())],
            )
            .await?;
        Ok(rows
            .into_iter()
            .next()
            .and_then(|row| self.row_to_folder(row)))
    }

    pub async fn get_note_tree(&self, folder_id: Option<&str>) -> Result<Vec<FolderTree>> {
        // This would be implemented with a recursive CTE or multiple queries
        // Simplified version for now
        let folders = self.get_all_folders().await?;
        let mut tree = Vec::new();

        for folder in &folders {
            if folder.parent_id.as_deref() == folder_id {
                let children = self.build_folder_tree(&folders, &folder.id).await?;
                let note_count = self.count_notes_in_folder(&folder.id).await?;
                tree.push(FolderTree {
                    folder: folder.clone(),
                    children,
                    note_count,
                });
            }
        }
        Ok(tree)
    }

    fn build_folder_tree<'a>(
        &'a self,
        all_folders: &'a [Folder],
        parent_id: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<FolderTree>>> + Send + 'a>>
    {
        Box::pin(async move {
            let mut tree = Vec::new();
            for folder in all_folders {
                if folder.parent_id.as_deref() == Some(parent_id) {
                    let children = self.build_folder_tree(all_folders, &folder.id).await?;
                    let note_count = self.count_notes_in_folder(&folder.id).await?;
                    tree.push(FolderTree {
                        folder: folder.clone(),
                        children,
                        note_count,
                    });
                }
            }
            Ok(tree)
        })
    }

    async fn get_all_folders(&self) -> Result<Vec<Folder>> {
        let rows = self
            .db
            .select("SELECT * FROM folders ORDER BY sort_order, name")
            .await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| self.row_to_folder(row))
            .collect())
    }

    async fn count_notes_in_folder(&self, folder_id: &str) -> Result<i32> {
        let rows = self
            .db
            .select_with_params(
                "SELECT COUNT(*) as count FROM notes WHERE folder_id = ? AND is_deleted = FALSE",
                vec![Value::Text(folder_id.to_string())],
            )
            .await?;
        Ok(rows
            .first()
            .and_then(|row| row.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32)
    }

    pub async fn export_note(&self, id: &str, format: ExportFormat) -> Result<String> {
        let note = self
            .get_with_relations(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Note not found"))?;

        match format {
            ExportFormat::Markdown => Ok(self.note_to_markdown(&note)),
            ExportFormat::HTML => Ok(self.note_to_html(&note)),
            ExportFormat::JSON => Ok(serde_json::to_string_pretty(&note)?),
            ExportFormat::PlainText => Ok(self.note_to_plain_text(&note)),
            ExportFormat::PDF => Err(anyhow::anyhow!("PDF export not implemented in repository")),
        }
    }

    fn note_to_markdown(&self, note: &NoteWithRelations) -> String {
        let mut md = String::new();
        md.push_str(&format!("# {}\n\n", note.note.title));

        if !note.tags.is_empty() {
            md.push_str("Tags: ");
            md.push_str(
                &note
                    .tags
                    .iter()
                    .map(|t| format!("#{}", t.name))
                    .collect::<Vec<_>>()
                    .join(" "),
            );
            md.push_str("\n\n");
        }

        md.push_str(&note.note.content_md);
        md
    }

    fn note_to_html(&self, note: &NoteWithRelations) -> String {
        format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }}
        .tags {{ color: #666; margin-bottom: 1rem; }}
        .tag {{ background: #00BFA6; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.875rem; margin-right: 0.5rem; }}
    </style>
</head>
<body>
    <h1>{}</h1>
    <div class="tags">{}</div>
    <div>{}</div>
</body>
</html>"#,
            note.note.title,
            note.note.title,
            note.tags
                .iter()
                .map(|t| format!("<span class=\"tag\">#{}</span>", t.name))
                .collect::<String>(),
            note.note.content_html
        )
    }

    fn note_to_plain_text(&self, note: &NoteWithRelations) -> String {
        let mut text = String::new();
        text.push_str(&format!("{}\n\n", note.note.title));

        if !note.tags.is_empty() {
            text.push_str("Tags: ");
            text.push_str(
                &note
                    .tags
                    .iter()
                    .map(|t| format!("#{}", t.name))
                    .collect::<Vec<_>>()
                    .join(" "),
            );
            text.push_str("\n\n");
        }

        // Strip HTML tags for plain text
        text.push_str(&strip_html(&note.note.content_html));
        text
    }

    fn row_to_note(&self, row: serde_json::Value) -> Option<Note> {
        Some(Note {
            id: row.get("id")?.as_str()?.to_string(),
            folder_id: row
                .get("folder_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            title: row.get("title")?.as_str()?.to_string(),
            content: row.get("content")?.as_str()?.to_string(),
            content_md: row.get("content_md")?.as_str()?.to_string(),
            content_html: row.get("content_html")?.as_str()?.to_string(),
            excerpt: row.get("excerpt")?.as_str()?.to_string(),
            word_count: row.get("word_count")?.as_i64()? as i32,
            char_count: row.get("char_count")?.as_i64()? as i32,
            reading_time: row.get("reading_time")?.as_i64()? as i32,
            is_pinned: row.get("is_pinned")?.as_i64()? != 0,
            is_archived: row.get("is_archived")?.as_i64()? != 0,
            is_deleted: row.get("is_deleted")?.as_i64()? != 0,
            is_favorite: row.get("is_favorite")?.as_i64()? != 0,
            cover_image: row
                .get("cover_image")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            cover_color: row
                .get("cover_color")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            template_id: row
                .get("template_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            deleted_at: row
                .get("deleted_at")
                .and_then(|v| v.as_str())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|d| d.with_timezone(&Utc)),
            last_edited_at: DateTime::parse_from_rfc3339(row.get("last_edited_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
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

    fn row_to_attachment(&self, row: serde_json::Value) -> Option<Attachment> {
        Some(Attachment {
            id: row.get("id")?.as_str()?.to_string(),
            note_id: row
                .get("note_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            file_name: row.get("file_name")?.as_str()?.to_string(),
            file_path: row.get("file_path")?.as_str()?.to_string(),
            mime_type: row.get("mime_type")?.as_str()?.to_string(),
            size_bytes: row.get("size_bytes")?.as_i64()?,
            width: row.get("width").and_then(|v| v.as_i64()).map(|v| v as i32),
            height: row.get("height").and_then(|v| v.as_i64()).map(|v| v as i32),
            duration_seconds: row
                .get("duration_seconds")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            thumbnail_path: row
                .get("thumbnail_path")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }

    fn row_to_search_result(&self, row: serde_json::Value) -> Option<SearchResult> {
        Some(SearchResult {
            id: row.get("id")?.as_str()?.to_string(),
            type_: "note".to_string(),
            title: row.get("title")?.as_str()?.to_string(),
            excerpt: row.get("excerpt")?.as_str()?.to_string(),
            highlight: row.get("highlight")?.as_str()?.to_string(),
            score: 1.0,
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")?.as_str()?)
                .ok()?
                .with_timezone(&Utc),
        })
    }
}

fn strip_html(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }
    result
}
