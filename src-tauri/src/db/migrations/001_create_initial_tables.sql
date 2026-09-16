-- Initial schema for Σόφια

-- Folders table for organizing notes
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    color TEXT DEFAULT '#00BFA6',
    icon TEXT DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    content_md TEXT DEFAULT '',
    content_html TEXT DEFAULT '',
    excerpt TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    reading_time INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    cover_image TEXT DEFAULT NULL,
    cover_color TEXT DEFAULT NULL,
    template_id TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    last_edited_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note versions for history/undo
CREATE TABLE IF NOT EXISTS note_versions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_md TEXT NOT NULL,
    version INTEGER NOT NULL,
    change_type TEXT NOT NULL DEFAULT 'edit',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Calendar events
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    location TEXT DEFAULT '',
    color TEXT DEFAULT '#00BFA6',
    calendar_id TEXT DEFAULT 'default',
    recurrence_rule TEXT DEFAULT NULL,
    recurrence_exception TEXT DEFAULT NULL,
    reminder_minutes INTEGER DEFAULT 15,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reminders for events and notes
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL CHECK (target_type IN ('event', 'note')),
    target_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    trigger_at DATETIME NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    repeat_rule TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT DEFAULT 'string',
    description TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags for notes
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#00BFA6',
    icon TEXT DEFAULT 'tag',
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note-Tag many-to-many relationship
CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- AI Models table
CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('transcription', 'analysis', 'chat', 'embedding')),
    source TEXT NOT NULL CHECK (source IN ('local', 'api', 'huggingface')),
    model_id TEXT DEFAULT NULL,
    api_endpoint TEXT DEFAULT NULL,
    api_key_encrypted TEXT DEFAULT NULL,
    local_path TEXT DEFAULT NULL,
    size_bytes INTEGER DEFAULT 0,
    quantization TEXT DEFAULT NULL,
    languages TEXT DEFAULT '["en", "zh"]',
    capabilities TEXT DEFAULT '[]',
    config TEXT DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_downloaded BOOLEAN DEFAULT FALSE,
    download_progress REAL DEFAULT 0.0,
    last_used_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat sessions
CREATE TABLE IF NOT EXISTS ai_chats (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'New Chat',
    model_id TEXT REFERENCES ai_models(id) ON DELETE SET NULL,
    system_prompt TEXT DEFAULT '',
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    tool_calls TEXT DEFAULT NULL,
    tool_call_id TEXT DEFAULT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transcription jobs
CREATE TABLE IF NOT EXISTS transcription_jobs (
    id TEXT PRIMARY KEY,
    audio_path TEXT NOT NULL,
    model_id TEXT REFERENCES ai_models(id) ON DELETE SET NULL,
    language TEXT DEFAULT 'auto',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    progress REAL DEFAULT 0.0,
    result_text TEXT DEFAULT '',
    result_segments TEXT DEFAULT '[]',
    error_message TEXT DEFAULT NULL,
    duration_seconds REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL
);

-- File attachments
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    width INTEGER DEFAULT NULL,
    height INTEGER DEFAULT NULL,
    duration_seconds REAL DEFAULT NULL,
    thumbnail_path TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences (UI state)
CREATE TABLE IF NOT EXISTS ui_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create default root folder
INSERT OR IGNORE INTO folders (id, name, parent_id, color, icon, sort_order, is_system, created_at, updated_at)
VALUES ('root', 'All Notes', NULL, '#00BFA6', 'folder', 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Create default settings
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at) VALUES
    ('theme', 'system', 'string', 'UI theme: light, dark, or system', CURRENT_TIMESTAMP),
    ('font_family', 'Inter', 'string', 'Default font family for editor', CURRENT_TIMESTAMP),
    ('font_size', '14', 'number', 'Default font size in pixels', CURRENT_TIMESTAMP),
    ('line_height', '1.6', 'number', 'Default line height', CURRENT_TIMESTAMP),
    ('editor_mode', 'wysiwyg', 'string', 'Editor mode: wysiwyg or markdown', CURRENT_TIMESTAMP),
    ('auto_save', 'true', 'boolean', 'Auto-save notes', CURRENT_TIMESTAMP),
    ('spell_check', 'true', 'boolean', 'Enable spell checking', CURRENT_TIMESTAMP),
    ('auto_save_interval', '2000', 'number', 'Auto-save interval in ms', CURRENT_TIMESTAMP),
    ('show_line_numbers', 'false', 'boolean', 'Show line numbers in markdown mode', CURRENT_TIMESTAMP),
    ('vim_mode', 'false', 'boolean', 'Enable vim keybindings', CURRENT_TIMESTAMP),
    ('transcription_language', 'auto', 'string', 'Default transcription language', CURRENT_TIMESTAMP),
    ('transcription_model', 'funasr', 'string', 'Default transcription model', CURRENT_TIMESTAMP),
    ('analysis_model', 'local', 'string', 'Default analysis model', CURRENT_TIMESTAMP),
    ('api_provider', 'openai', 'string', 'Default API provider', CURRENT_TIMESTAMP),
    ('sidebar_collapsed', 'false', 'boolean', 'Sidebar collapsed state', CURRENT_TIMESTAMP),
    ('editor_layout', 'single', 'string', 'Editor layout: single, split, triple', CURRENT_TIMESTAMP),
    ('show_word_count', 'true', 'boolean', 'Show word count in status bar', CURRENT_TIMESTAMP),
    ('show_reading_time', 'true', 'boolean', 'Show reading time in status bar', CURRENT_TIMESTAMP);