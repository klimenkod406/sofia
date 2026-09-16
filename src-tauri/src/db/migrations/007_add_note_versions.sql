-- Note versions for history/undo in Σόφια

-- Note versions table (created in initial migration)
-- Adding more features

ALTER TABLE note_versions ADD COLUMN author TEXT DEFAULT 'user';
ALTER TABLE note_versions ADD COLUMN metadata TEXT DEFAULT '{}';

-- Index for note versions
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id_version ON note_versions(note_id, version DESC);

-- Trigger to auto-create version on note update
CREATE TRIGGER IF NOT EXISTS note_version_au AFTER UPDATE ON notes
WHEN old.content != new.content OR old.title != new.title
BEGIN
    INSERT INTO note_versions (id, note_id, title, content, content_md, version, change_type, created_at)
    VALUES (
        lower(hex(randomblob(16))),
        new.id,
        new.title,
        new.content,
        new.content_md,
        (SELECT COALESCE(MAX(version), 0) + 1 FROM note_versions WHERE note_id = new.id),
        CASE 
            WHEN old.content != new.content AND old.title != new.title THEN 'edit_both'
            WHEN old.content != new.content THEN 'edit_content'
            WHEN old.title != new.title THEN 'edit_title'
            ELSE 'edit'
        END,
        CURRENT_TIMESTAMP
    );
    
    -- Keep only last 50 versions per note
    DELETE FROM note_versions 
    WHERE note_id = new.id 
    AND version < (SELECT MAX(version) - 49 FROM note_versions WHERE note_id = new.id);
END;

-- Function to restore note version (called from application)
-- This is a helper, actual restore is done in application code