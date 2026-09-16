//! Services layer for Σόφια

pub mod notes;
pub mod folders;
pub mod calendar;
pub mod settings;
pub mod ai;
pub mod file_ops;
pub mod system;
pub mod backup;
pub mod export;
pub mod tags;

use crate::db::Database;
use std::sync::Arc;

pub use notes::NotesService;
pub use folders::FoldersService;
pub use calendar::CalendarService;
pub use settings::SettingsService;
pub use ai::AIService;
pub use file_ops::FileOpsService;
pub use system::SystemService;
pub use backup::BackupService;
pub use export::ExportService;
pub use tags::TagsService;

pub struct AppState {
    pub db: Arc<Database>,
    pub notes: Arc<NotesService>,
    pub folders: Arc<FoldersService>,
    pub calendar: Arc<CalendarService>,
    pub settings: Arc<SettingsService>,
    pub ai: Arc<AIService>,
    pub tags: Arc<TagsService>,
    pub file_ops: Arc<FileOpsService>,
    pub system: Arc<SystemService>,
    pub backup: Arc<BackupService>,
    pub export: Arc<ExportService>,
}

impl AppState {
    pub fn new(db: Arc<Database>) -> anyhow::Result<Self> {
        let notes = Arc::new(NotesService::new(db.clone()));
        let folders = Arc::new(FoldersService::new(db.clone()));
        let calendar = Arc::new(CalendarService::new(db.clone()));
        let settings = Arc::new(SettingsService::new(db.clone()));
        let ai = Arc::new(AIService::new(db.clone())?);
        let tags = Arc::new(TagsService::new(db.clone()));
        let file_ops = Arc::new(FileOpsService::new(db.clone()));
        let system = Arc::new(SystemService::new(db.clone()));
        let backup = Arc::new(BackupService::new(db.clone()));
        let export = Arc::new(ExportService::new(db.clone()));

        Ok(Self {
            db,
            notes,
            folders,
            calendar,
            settings,
            ai,
            tags,
            file_ops,
            system,
            backup,
            export,
        })
    }
}