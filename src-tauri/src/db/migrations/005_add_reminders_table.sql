-- Reminders table for Σόφια

-- Reminders table (created in initial migration, adding more features here)
ALTER TABLE reminders ADD COLUMN sound TEXT DEFAULT 'default';
ALTER TABLE reminders ADD COLUMN vibration BOOLEAN DEFAULT TRUE;
ALTER TABLE reminders ADD COLUMN priority INTEGER DEFAULT 0 CHECK (priority IN (-1, 0, 1));
ALTER TABLE reminders ADD COLUMN snooze_minutes INTEGER DEFAULT 5;
ALTER TABLE reminders ADD COLUMN max_snooze_count INTEGER DEFAULT 3;
ALTER TABLE reminders ADD COLUMN snooze_count INTEGER DEFAULT 0;
ALTER TABLE reminders ADD COLUMN action_url TEXT DEFAULT NULL;
ALTER TABLE reminders ADD COLUMN metadata TEXT DEFAULT '{}';

-- Index for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_priority ON reminders(priority DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_snooze ON reminders(snooze_count) WHERE snooze_count < 3;

-- Default reminder sounds (stored as settings)
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at) VALUES
    ('reminder_sound_default', 'notification_default', 'string', 'Default reminder sound', CURRENT_TIMESTAMP),
    ('reminder_sound_gentle', 'notification_gentle', 'string', 'Gentle reminder sound', CURRENT_TIMESTAMP),
    ('reminder_sound_urgent', 'notification_urgent', 'string', 'Urgent reminder sound', CURRENT_TIMESTAMP);