//! Regression test for the seeded transcription-model catalog.
//!
//! Migrations 004 and 008 seed the `ai_models` table using SQLite's
//! `CURRENT_TIMESTAMP` (`YYYY-MM-DD HH:MM:SS`). `ModelsRepository::row_to_model`
//! must parse that format; a strict RFC-3339 parser would return `None` for
//! every seeded row and silently blank out the model list.

use crate::db::repository::ModelsRepository;
use crate::db::sql::Sql;

async fn scratch_db() -> (Sql, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("sofia-models-test-{}.db", uuid::Uuid::new_v4()));
    let url = format!("sqlite:{}?mode=rwc", path.to_string_lossy());
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .expect("connect scratch db");
    sqlx::migrate!("src/db/migrations")
        .run(&pool)
        .await
        .expect("run migrations");
    (Sql::new(pool), path)
}

#[tokio::test]
async fn seeded_transcription_models_are_listable() {
    let (sql, path) = scratch_db().await;
    let repo = ModelsRepository::new(sql.clone());

    let models = repo
        .list(Some("transcription"), None, true)
        .await
        .expect("list transcription models");

    let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
    assert!(
        models.len() >= 6,
        "expected >= 6 transcription models, got {ids:?}"
    );
    assert!(ids.contains(&"funasr-zh-en"));
    assert!(ids.contains(&"whisper-tiny"));
    assert!(ids.contains(&"whisper-base"));

    drop(repo);
    drop(sql);
    let _ = std::fs::remove_file(path);
}
