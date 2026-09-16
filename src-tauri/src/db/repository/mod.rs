//! Repository layer for database operations

pub mod notes;
pub mod folders;
pub mod events;
pub mod settings;
pub mod models;
pub mod reminders;
pub mod tags;
pub mod attachments;
pub mod ai_chat;
pub mod transcription;

pub use notes::{NotesRepository, NoteFilter, Pagination};
pub use folders::FoldersRepository;
pub use events::{EventsRepository, EventFilter};
pub use settings::SettingsRepository;
pub use models::ModelsRepository;
pub use reminders::RemindersRepository;
pub use tags::TagsRepository;
pub use attachments::AttachmentsRepository;
pub use ai_chat::AIChatRepository;
pub use transcription::TranscriptionRepository;
