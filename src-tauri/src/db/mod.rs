//! Database module for Σόφια

pub mod migrations;
pub mod models;
pub mod repository;
pub mod sql;

use anyhow::{Context, Result};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tracing::info;

use repository::*;
pub use sql::{Sql, Value};

/// Database wrapper providing high-level operations over a sqlx pool.
#[derive(Debug, Clone)]
pub struct Database {
    pool: sqlx::SqlitePool,
    sql: Sql,
}

impl Database {
    /// Create a new database connection.
    ///
    /// Opens (creating if needed) `sofia.db` in the app data dir and
    /// eagerly establishes the pool inside a short-lived Tokio runtime,
    /// because `setup` itself is synchronous.
    pub fn new(app: &AppHandle) -> Result<Self> {
        let dir = app
            .path()
            .app_data_dir()
            .context("failed to resolve app data dir")?;
        std::fs::create_dir_all(&dir).context("failed to create app data dir")?;
        let db_path = dir.join("sofia.db");
        let url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());
        let pool = tauri::async_runtime::block_on(async {
            SqlitePoolOptions::new()
                .max_connections(5)
                .connect(&url)
                .await
        })
        .context("failed to connect to sqlite")?;
        info!("Database connected at {}", db_path.display());
        Ok(Self {
            pool: pool.clone(),
            sql: Sql::new(pool),
        })
    }

    /// Run embedded SQL migrations.
    pub async fn run_migrations(&self) -> Result<()> {
        sqlx::migrate!("src/db/migrations")
            .run(&self.pool)
            .await
            .context("failed to run migrations")?;
        info!("Database migrations applied");
        Ok(())
    }

    /// Get the underlying SQL wrapper.
    pub fn pool(&self) -> &Sql {
        &self.sql
    }

    /// Get the raw sqlx pool.
    pub fn raw_pool(&self) -> &sqlx::SqlitePool {
        &self.pool
    }

    /// Execute a query
    pub async fn execute(&self, query: &str) -> Result<u64> {
        self.sql.execute(query).await
    }

    /// Execute a query with parameters
    pub async fn execute_with_params(&self, query: &str, params: Vec<Value>) -> Result<u64> {
        self.sql.execute_with_params(query, params).await
    }

    /// Select rows
    pub async fn select(&self, query: &str) -> Result<Vec<serde_json::Value>> {
        self.sql.select(query).await
    }

    /// Select rows with parameters
    pub async fn select_with_params(
        &self,
        query: &str,
        params: Vec<Value>,
    ) -> Result<Vec<serde_json::Value>> {
        self.sql.select_with_params(query, params).await
    }

    /// Select a single row
    pub async fn select_one(&self, query: &str) -> Result<Option<serde_json::Value>> {
        self.sql.select_one(query).await
    }

    /// Select a single row with parameters
    pub async fn select_one_with_params(
        &self,
        query: &str,
        params: Vec<Value>,
    ) -> Result<Option<serde_json::Value>> {
        self.sql.select_one_with_params(query, params).await
    }

    /// Initialize database with default data
    pub async fn initialize(&self) -> Result<()> {
        info!("Initializing database with default data");

        // Create default folder if not exists
        self.execute(
            "INSERT OR IGNORE INTO folders (id, name, parent_id, color, icon, created_at, updated_at)
             VALUES ('root', 'All Notes', NULL, '#00BFA6', 'folder', datetime('now'), datetime('now'))"
        ).await?;

        // Create default settings
        self.execute(
            "INSERT OR IGNORE INTO settings (key, value, updated_at)
             VALUES
             ('theme', 'system', datetime('now')),
             ('font_family', 'Inter', datetime('now')),
             ('font_size', '14', datetime('now')),
             ('line_height', '1.6', datetime('now')),
             ('editor_mode', 'wysiwyg', datetime('now')),
             ('auto_save', 'true', datetime('now')),
             ('spell_check', 'true', datetime('now'))",
        )
        .await?;

        info!("Database initialization complete");
        Ok(())
    }

    /// Get repository instances
    pub fn notes(&self) -> NotesRepository {
        NotesRepository::new(self.sql.clone())
    }

    pub fn folders(&self) -> FoldersRepository {
        FoldersRepository::new(self.sql.clone())
    }

    pub fn events(&self) -> EventsRepository {
        EventsRepository::new(self.sql.clone())
    }

    pub fn settings(&self) -> SettingsRepository {
        SettingsRepository::new(self.sql.clone())
    }

    pub fn models(&self) -> ModelsRepository {
        ModelsRepository::new(self.sql.clone())
    }

    pub fn reminders(&self) -> RemindersRepository {
        RemindersRepository::new(self.sql.clone())
    }

    pub fn tags(&self) -> TagsRepository {
        TagsRepository::new(self.sql.clone())
    }

    pub fn attachments(&self) -> AttachmentsRepository {
        AttachmentsRepository::new(self.sql.clone())
    }

    pub fn ai_chat(&self) -> AIChatRepository {
        AIChatRepository::new(self.sql.clone())
    }

    pub fn transcription(&self) -> TranscriptionRepository {
        TranscriptionRepository::new(self.sql.clone())
    }
}

/// Shared application database handle.
pub type DbHandle = Arc<Database>;
