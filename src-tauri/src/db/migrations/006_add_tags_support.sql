-- Tags support for Σόφια

-- Tags table (created in initial migration)
-- Adding more features

ALTER TABLE tags ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE tags ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE tags ADD COLUMN parent_id TEXT REFERENCES tags(id) ON DELETE SET NULL;

-- Index for hierarchical tags
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);

-- Note tags table (created in initial migration)
-- No additional changes needed

-- Default system tags
INSERT OR IGNORE INTO tags (id, name, color, icon, description, is_system, usage_count, created_at) VALUES
    ('tag-meeting', 'Meeting', '#00BFA6', 'users', 'Meeting notes', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-lecture', 'Lecture', '#3B82F6', 'graduation-cap', 'Lecture notes', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-idea', 'Idea', '#F59E0B', 'lightbulb', 'Ideas and thoughts', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-task', 'Task', '#EF4444', 'check-square', 'Action items', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-research', 'Research', '#8B5CF6', 'book-open', 'Research notes', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-personal', 'Personal', '#EC4899', 'heart', 'Personal notes', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-work', 'Work', '#06B6D4', 'briefcase', 'Work related', TRUE, 0, CURRENT_TIMESTAMP),
    ('tag-study', 'Study', '#10B981', 'book', 'Study materials', TRUE, 0, CURRENT_TIMESTAMP);