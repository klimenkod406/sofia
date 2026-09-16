-- Full-text search for Σόφια

-- Create FTS5 virtual table for notes search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content,
    content_md,
    excerpt,
    content='notes',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 1'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content, content_md, excerpt)
    VALUES (new.rowid, new.title, new.content, new.content_md, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content, content_md, excerpt)
    VALUES ('delete', old.rowid, old.title, old.content, old.content_md, old.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content, content_md, excerpt)
    VALUES ('delete', old.rowid, old.title, old.content, old.content_md, old.excerpt);
    INSERT INTO notes_fts(rowid, title, content, content_md, excerpt)
    VALUES (new.rowid, new.title, new.content, new.content_md, new.excerpt);
END;

-- Rebuild FTS index (run once after migration)
-- INSERT INTO notes_fts(notes_fts) VALUES('rebuild');

-- FTS for events
CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
    title,
    description,
    location,
    content='events',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 1'
);

CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
    INSERT INTO events_fts(rowid, title, description, location)
    VALUES (new.rowid, new.title, new.description, new.location);
END;

CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
    INSERT INTO events_fts(events_fts, rowid, title, description, location)
    VALUES ('delete', old.rowid, old.title, old.description, old.location);
END;

CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
    INSERT INTO events_fts(events_fts, rowid, title, description, location)
    VALUES ('delete', old.rowid, old.title, old.description, old.location);
    INSERT INTO events_fts(rowid, title, description, location)
    VALUES (new.rowid, new.title, new.description, new.location);
END;