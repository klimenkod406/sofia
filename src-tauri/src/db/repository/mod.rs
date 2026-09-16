//! Repository layer for database operations

pub mod ai_chat;
pub mod attachments;
pub mod events;
pub mod folders;
pub mod models;
pub mod notes;
pub mod reminders;
pub mod settings;
pub mod tags;
pub mod transcription;

pub use ai_chat::AIChatRepository;
pub use attachments::AttachmentsRepository;
pub use events::{EventFilter, EventsRepository};
pub use folders::FoldersRepository;
pub use models::ModelsRepository;
pub use notes::{NoteFilter, NotesRepository, Pagination};
pub use reminders::RemindersRepository;
pub use settings::SettingsRepository;
pub use tags::TagsRepository;
pub use transcription::TranscriptionRepository;
