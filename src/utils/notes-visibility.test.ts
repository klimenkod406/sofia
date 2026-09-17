import { describe, it, expect } from 'vitest';
import {
  filterVisibleNotes,
  canMergeNotes,
  type HomeVisibility,
} from './notes-visibility';
import type { Note } from '@/stores/notes';

const base: HomeVisibility = {
  folderId: null,
  searchQuery: '',
  showArchived: false,
  showFavoritesOnly: false,
};

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    folder_id: null,
    title: 'Заметка',
    content: '',
    content_md: '',
    content_html: '',
    excerpt: '',
    word_count: 0,
    char_count: 0,
    reading_time: 0,
    is_pinned: false,
    is_archived: false,
    is_deleted: false,
    is_favorite: false,
    cover_image: null,
    cover_color: null,
    template_id: null,
    created_at: '2026-09-17T10:00:00.000Z',
    updated_at: '2026-09-17T10:00:00.000Z',
    deleted_at: null,
    last_edited_at: '2026-09-17T10:00:00.000Z',
    ...partial,
  };
}

describe('filterVisibleNotes', () => {
  it('скрывает заметки из папок на главной', () => {
    const notes = [note({ id: 'a' }), note({ id: 'b', folder_id: 'f1' })];
    expect(filterVisibleNotes(notes, base).map(n => n.id)).toEqual(['a']);
  });

  it('показывает обе заметки внутри их папки и только её', () => {
    const notes = [
      note({ id: 'a', folder_id: 'f1' }),
      note({ id: 'b', folder_id: 'f1' }),
      note({ id: 'c' }),
      note({ id: 'd', folder_id: 'f2' }),
    ];
    expect(
      filterVisibleNotes(notes, { ...base, folderId: 'f1' }).map(n => n.id).sort()
    ).toEqual(['a', 'b']);
  });

  it('после слияния на главной остаётся пусто, в папке — обе', () => {
    const notes = [
      note({ id: 'a', folder_id: 'new-folder' }),
      note({ id: 'b', folder_id: 'new-folder' }),
    ];
    expect(filterVisibleNotes(notes, base)).toEqual([]);
    expect(
      filterVisibleNotes(notes, { ...base, folderId: 'new-folder' }).map(n => n.id).sort()
    ).toEqual(['a', 'b']);
  });

  it('закрепы всплывают первыми', () => {
    const notes = [
      note({ id: 'a', updated_at: '2026-09-17T12:00:00.000Z' }),
      note({ id: 'b', is_pinned: true, updated_at: '2026-09-17T10:00:00.000Z' }),
    ];
    expect(filterVisibleNotes(notes, base).map(n => n.id)).toEqual(['b', 'a']);
  });

  it('архив скрыт по умолчанию и виден по флагу', () => {
    const notes = [note({ id: 'a', is_archived: true })];
    expect(filterVisibleNotes(notes, base)).toEqual([]);
    expect(filterVisibleNotes(notes, { ...base, showArchived: true }).map(n => n.id)).toEqual([
      'a',
    ]);
  });
});

describe('canMergeNotes', () => {
  it('разрешает слияние двух заметок на главной', () => {
    expect(canMergeNotes(note({ id: 'a' }), note({ id: 'b' }))).toBe(true);
  });

  it('запрещает, если любая сторона уже в папке', () => {
    expect(canMergeNotes(note({ id: 'a', folder_id: 'f1' }), note({ id: 'b' }))).toBe(false);
    expect(canMergeNotes(note({ id: 'a' }), note({ id: 'b', folder_id: 'f1' }))).toBe(false);
    expect(
      canMergeNotes(note({ id: 'a', folder_id: 'f1' }), note({ id: 'b', folder_id: 'f1' }))
    ).toBe(false);
  });

  it('запрещает при пустых сторонах', () => {
    expect(canMergeNotes(null, note({ id: 'b' }))).toBe(false);
    expect(canMergeNotes(note({ id: 'a' }), undefined)).toBe(false);
  });
});
