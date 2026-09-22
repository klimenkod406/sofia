// Загружает все заметки для календаря (активность создания/правок),
// а не только первую страницу из главного стора.
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNotes, type Note } from '@/stores/notes';

function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w;
}

export function useCalendarNotes(): Note[] {
  const storeNotes = useNotes(s => s.notes);
  const [notes, setNotes] = useState<Note[]>(storeNotes);

  useEffect(() => {
    let cancelled = false;
    if (!isTauri()) {
      setNotes(storeNotes);
      return;
    }
    invoke('list_notes', {
      filter: {
        folder_id: null,
        is_deleted: false,
        sort_by: 'updated_at',
        sort_order: 'DESC',
        page: 1,
        per_page: 2000,
      },
    })
      .then(data => {
        if (!cancelled) setNotes(data as Note[]);
      })
      .catch(() => {
        // Backend недоступен — довольствуемся тем, что есть в сторе.
        if (!cancelled) setNotes(storeNotes);
      });
    return () => {
      cancelled = true;
    };
  }, [storeNotes]);

  return notes;
}
