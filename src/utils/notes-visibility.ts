'use client';

import type { Note } from '@/stores/notes';

export interface HomeVisibility {
  folderId: string | null;
  searchQuery: string;
  showArchived: boolean;
  showFavoritesOnly: boolean;
}

/**
 * Новые папки создаются только из заметок на главной:
 * обе стороны слияния должны быть вне папок.
 */
export function canMergeNotes(
  a: Pick<Note, 'folder_id'> | null | undefined,
  b: Pick<Note, 'folder_id'> | null | undefined
): boolean {
  return !!a && !!b && !a.folder_id && !b.folder_id;
}

/**
 * Единое пространство главной (п.10): один список без секций.
 * Внутри папки — только её заметки; на главной filed-заметки скрыты
 * (живут только в папке), закрепы всплывают первыми.
 * Чистые функции — покрыты тестами (notes-visibility.test.ts).
 */
export function filterVisibleNotes(notes: Note[], f: HomeVisibility): Note[] {
  let list = notes.filter(n => !n.is_deleted);
  if (!f.showArchived) list = list.filter(n => !n.is_archived);
  if (f.showFavoritesOnly) list = list.filter(n => n.is_favorite);
  if (f.folderId) list = list.filter(n => n.folder_id === f.folderId);
  else list = list.filter(n => !n.folder_id);
  if (f.searchQuery) {
    const q = f.searchQuery.toLowerCase();
    list = list.filter(
      n =>
        n.title.toLowerCase().includes(q) ||
        (n.content_md || n.content || '').toLowerCase().includes(q)
    );
  }
  return [...list].sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
    return +new Date(b.updated_at) - +new Date(a.updated_at);
  });
}
