//! Σόφια - Main entry point
//!
//! A modern note-taking application with AI-powered transcription and analysis.

mod ai;
mod commands;
mod db;
mod services;

use std::sync::Arc;
use tauri::{Emitter, Manager, Runtime};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tracing::info;

use db::Database;
use services::AppState;

fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Σόφια application");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize database (pool + embedded migrations + seed data)
            let db = Arc::new(Database::new(&handle)?);
            tauri::async_runtime::block_on(async {
                if let Err(e) = db.run_migrations().await {
                    eprintln!("MIGRATION ERROR: {:?}", e);
                    return Err(e);
                }
                db.initialize().await?;
                Ok::<(), anyhow::Error>(())
            })?;

            // Initialize services
            let state = AppState::new(db)?;

            // Manage state
            app.manage(state);

            // Setup system tray (best effort — app works without it)
            if let Err(e) = setup_tray(app.handle()) {
                tracing::warn!("Failed to setup tray: {}", e);
            }

            // Setup global shortcuts (best effort)
            if let Err(e) = setup_shortcuts(app.handle()) {
                tracing::warn!("Failed to setup shortcuts: {}", e);
            }

            // Minimize to tray instead of quitting.
            // NOTE: the window is created with "visible": false (see
            // tauri.conf.json), so it must be shown explicitly.
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.set_focus();
                let win = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            info!("Application initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Notes
            commands::notes::create_note,
            commands::notes::get_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::list_notes,
            commands::notes::search_notes,
            commands::notes::export_note,
            commands::notes::import_note,
            commands::notes::get_note_tree,
            commands::notes::move_note,
            commands::notes::duplicate_note,
            commands::notes::pin_note,
            commands::notes::archive_note,
            commands::notes::favorite_note,
            commands::notes::add_tag_to_note,
            commands::notes::remove_tag_from_note,
            commands::notes::get_recent_notes,
            commands::notes::get_pinned_notes,
            commands::notes::get_archived_notes,
            commands::notes::get_note_statistics,
            // Folders
            commands::folders::list_folders,
            commands::folders::create_folder,
            commands::folders::update_folder,
            commands::folders::delete_folder,
            commands::folders::get_folder_tree,
            commands::folders::move_folder,
            // Tags
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::delete_tag,
            // Calendar
            commands::calendar::get_events,
            commands::calendar::create_event,
            commands::calendar::update_event,
            commands::calendar::delete_event,
            commands::calendar::get_events_for_date,
            commands::calendar::get_upcoming_events,
            commands::calendar::get_today_events,
            commands::calendar::get_week_events,
            commands::calendar::get_month_events,
            commands::calendar::set_reminder,
            commands::calendar::complete_event,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::get_theme,
            commands::settings::set_theme,
            commands::settings::get_font_settings,
            commands::settings::set_font_settings,
            commands::settings::reset_settings,
            // AI
            commands::ai::transcribe_audio,
            commands::ai::transcribe_stream,
            commands::ai::analyze_text,
            commands::ai::chat_completion,
            commands::ai::get_available_models,
            commands::ai::download_model,
            commands::ai::delete_model,
            commands::ai::set_api_key,
            commands::ai::test_api_connection,
            commands::ai::create_ai_chat,
            commands::ai::get_ai_chat,
            commands::ai::get_chats_for_note,
            commands::ai::add_ai_message,
            commands::ai::get_ai_messages,
            commands::ai::update_ai_chat,
            commands::ai::clear_chat_messages,
            // Models
            commands::models::list_local_models,
            commands::models::get_model_info,
            commands::models::install_model,
            commands::models::uninstall_model,
            // File operations
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::file_ops::delete_file,
            commands::file_ops::list_directory,
            commands::file_ops::create_directory,
            commands::file_ops::get_disk_usage,
            commands::file_ops::clean_temp,
            // System
            commands::system::get_system_info,
            commands::system::check_updates,
            commands::system::install_update,
            commands::system::open_external,
            commands::system::get_app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> anyhow::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Σόφια", true, None::<&str>)?;
    let new_note = MenuItem::with_id(app, "new_note", "New Note", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &new_note, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main").menu(&menu);
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    let _tray = builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "new_note" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("new-note", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn setup_shortcuts<R: Runtime>(app: &tauri::AppHandle<R>) -> anyhow::Result<()> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    // Toggle window: Ctrl+Space
    app.global_shortcut().on_shortcut("Ctrl+Space", |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
    })?;

    // New note: Ctrl+N
    app.global_shortcut().on_shortcut("Ctrl+N", |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("new-note", ());
            }
        }
    })?;

    Ok(())
}
