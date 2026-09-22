//! Database migrations for Σόφια

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        // Initial schema
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("migrations/001_create_initial_tables.sql"),
            kind: MigrationKind::Up,
        },
        // Add indexes for performance
        Migration {
            version: 2,
            description: "add_performance_indexes",
            sql: include_str!("migrations/002_add_performance_indexes.sql"),
            kind: MigrationKind::Up,
        },
        // Add full-text search
        Migration {
            version: 3,
            description: "add_full_text_search",
            sql: include_str!("migrations/003_add_full_text_search.sql"),
            kind: MigrationKind::Up,
        },
        // Add AI models table
        Migration {
            version: 4,
            description: "add_ai_models_table",
            sql: include_str!("migrations/004_add_ai_models_table.sql"),
            kind: MigrationKind::Up,
        },
        // Add reminders table
        Migration {
            version: 5,
            description: "add_reminders_table",
            sql: include_str!("migrations/005_add_reminders_table.sql"),
            kind: MigrationKind::Up,
        },
        // Add tags and note_tags tables
        Migration {
            version: 6,
            description: "add_tags_support",
            sql: include_str!("migrations/006_add_tags_support.sql"),
            kind: MigrationKind::Up,
        },
        // Add note versions for history
        Migration {
            version: 7,
            description: "add_note_versions",
            sql: include_str!("migrations/007_add_note_versions.sql"),
            kind: MigrationKind::Up,
        },
        // Add local whisper.cpp transcription models (live transcription)
        Migration {
            version: 8,
            description: "add_local_transcription_models",
            sql: include_str!("migrations/008_add_local_transcription_models.sql"),
            kind: MigrationKind::Up,
        },
        // Clear fake AI model settings (nothing is installed/connected by default)
        Migration {
            version: 9,
            description: "reset_ai_model_settings",
            sql: include_str!("migrations/009_reset_ai_model_settings.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
