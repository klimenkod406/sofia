//! Regression test for folder merging: two notes dragged onto each other must
//! both end up inside the newly created folder (and only there).
//!
//! Exercises the real repository code (the same functions the Tauri commands
//! call) against a scratch SQLite database built from the real migrations.

use crate::db::models::{Folder, Note};
use crate::db::repository::{FoldersRepository, NoteFilter, NotesRepository, Pagination};
use crate::db::sql::Sql;

async fn scratch_db() -> (Sql, std::path::PathBuf) {
    let path =
        std::env::temp_dir().join(format!("sofia-merge-test-{}.db", uuid::Uuid::new_v4()));
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

fn home_filter() -> NoteFilter {
    // Mirrors commands::notes::list_notes with an empty filter (home screen).
    NoteFilter {
        folder_id: None,
        is_pinned: None,
        is_archived: None,
        is_deleted: None,
        is_favorite: None,
        search_query: None,
        tag_ids: Vec::new(),
        date_from: None,
        date_to: None,
        sort_by: "updated_at".to_string(),
        sort_order: "DESC".to_string(),
    }
}

#[tokio::test]
async fn merge_two_notes_into_new_folder() {
    let (sql, path) = scratch_db().await;
    let folders = FoldersRepository::new(sql.clone());
    let notes = NotesRepository::new(sql.clone());

    // Two home notes, like NotesService::create_note(None, title).
    let n1 = notes
        .create(Note {
            folder_id: None,
            title: "Первая".to_string(),
            ..Default::default()
        })
        .await
        .expect("create note 1");
    let n2 = notes
        .create(Note {
            folder_id: None,
            title: "Вторая".to_string(),
            ..Default::default()
        })
        .await
        .expect("create note 2");

    // Folder creation, like FoldersService::create_folder(name, None, None, None).
    let folder = folders
        .create(Folder {
            name: "Новая папка 1".to_string(),
            parent_id: None,
            color: "#00BFA6".to_string(),
            icon: "folder".to_string(),
            ..Default::default()
        })
        .await
        .expect("create folder");
    assert!(folder.parent_id.is_none(), "root folder keeps NULL parent");

    // Both moves, like NotesService::move_note(id, Some(folder)).
    notes
        .move_to_folder(&n1.id, Some(&folder.id))
        .await
        .expect("move note 1");
    notes
        .move_to_folder(&n2.id, Some(&folder.id))
        .await
        .expect("move note 2");

    // Folder view must contain exactly both notes.
    let inside = notes
        .list(
            NoteFilter {
                folder_id: Some(folder.id.clone()),
                ..home_filter()
            },
            Pagination::new(1, 100),
        )
        .await
        .expect("list folder");
    let mut inside_ids: Vec<String> = inside.iter().map(|n| n.id.clone()).collect();
    inside_ids.sort();
    let mut expected = vec![n1.id.clone(), n2.id.clone()];
    expected.sort();
    assert_eq!(inside_ids, expected, "both notes are inside the folder");

    // Direct reads agree.
    for id in [&n1.id, &n2.id] {
        let got = notes.get(id).await.expect("get").expect("note exists");
        assert_eq!(got.folder_id.as_deref(), Some(folder.id.as_str()));
    }

    drop(folders);
    drop(notes);
    drop(sql);
    let _ = std::fs::remove_file(path);
}

async fn filed_note(
    notes: &NotesRepository,
    folders: &FoldersRepository,
    title: &str,
) -> (String, String) {
    let folder = folders
        .create(Folder {
            name: "Папка".to_string(),
            parent_id: None,
            color: "#00BFA6".to_string(),
            icon: "folder".to_string(),
            ..Default::default()
        })
        .await
        .expect("create folder");
    let note = notes
        .create(Note {
            folder_id: None,
            title: title.to_string(),
            ..Default::default()
        })
        .await
        .expect("create note");
    notes
        .move_to_folder(&note.id, Some(&folder.id))
        .await
        .expect("file note");
    (folder.id, note.id)
}

#[tokio::test]
async fn delete_folder_only_unfiles_notes() {
    let (sql, path) = scratch_db().await;
    let folders = FoldersRepository::new(sql.clone());
    let notes = NotesRepository::new(sql.clone());

    let (fid, nid) = filed_note(&notes, &folders, "В папке").await;
    folders.delete(&fid, false).await.expect("delete folder");

    assert!(folders.get(&fid).await.expect("get").is_none());
    let note = notes.get(&nid).await.expect("get").expect("note kept");
    assert!(note.folder_id.is_none(), "note is back home");
    assert!(!note.is_deleted);

    drop(folders);
    drop(notes);
    drop(sql);
    let _ = std::fs::remove_file(path);
}

#[tokio::test]
async fn delete_folder_recursive_removes_notes() {
    let (sql, path) = scratch_db().await;
    let folders = FoldersRepository::new(sql.clone());
    let notes = NotesRepository::new(sql.clone());

    let (fid, nid) = filed_note(&notes, &folders, "В папке").await;
    folders.delete(&fid, true).await.expect("delete folder");

    assert!(folders.get(&fid).await.expect("get").is_none());
    let note = notes.get(&nid).await.expect("get");
    // Мягкое удаление: запись жива, но помечена (get скрывает удалённые).
    // Проверяем напрямую через список без фильтра удалённых.
    assert!(note.is_none(), "note is soft-deleted");
    let raw: Vec<serde_json::Value> = sql
        .select_with_params(
            "SELECT is_deleted FROM notes WHERE id = ?",
            vec![crate::db::sql::Value::Text(nid)],
        )
        .await
        .expect("raw select");
    assert_eq!(raw.first().and_then(|r| r.get("is_deleted")).and_then(|v| v.as_i64()), Some(1));

    drop(folders);
    drop(notes);
    drop(sql);
    let _ = std::fs::remove_file(path);
}
