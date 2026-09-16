-- Performance indexes for Σόφια

-- Notes indexes
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_last_edited_at ON notes(last_edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived) WHERE is_archived = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON notes(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);

-- Folders indexes
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_sort_order ON folders(sort_order);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_is_completed ON events(is_completed) WHERE is_completed = FALSE;

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_trigger_at ON reminders(trigger_at);
CREATE INDEX IF NOT EXISTS idx_reminders_target ON reminders(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reminders_is_sent ON reminders(is_sent) WHERE is_sent = FALSE;

-- Note versions indexes
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_created_at ON note_versions(created_at DESC);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);

-- Note tags indexes
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);

-- AI Models indexes
CREATE INDEX IF NOT EXISTS idx_ai_models_type ON ai_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ai_models_source ON ai_models(source);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_models_is_downloaded ON ai_models(is_downloaded) WHERE is_downloaded = TRUE;

-- AI Chats indexes
CREATE INDEX IF NOT EXISTS idx_ai_chats_note_id ON ai_chats(note_id);
CREATE INDEX IF NOT EXISTS idx_ai_chats_model_id ON ai_chats(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_chats_updated_at ON ai_chats(updated_at DESC);

-- AI Messages indexes
CREATE INDEX IF NOT EXISTS idx_ai_messages_chat_id ON ai_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- Transcription jobs indexes
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs(status);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_created_at ON transcription_jobs(created_at DESC);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_mime_type ON attachments(mime_type);