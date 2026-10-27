'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Archive } from 'lucide-react';
import { useNotes, type Note } from '@/stores/notes';
import { NoteCard } from '@/components/home/note-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';

function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w;
}

/**
 * Отдельная страница архива: только заархивированные заметки.
 * Действия карточки — те же, что на главной: разархивировать (вернуть
 * на главную), дублировать, переименовать, удалить (в корзину).
 * Список грузится локально (list_notes с is_archived: true), глобальный
 * фильтр главной не трогаем.
 */
export function ArchivePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { archiveNote, deleteNote, duplicateNote, updateNote, pinNote, favoriteNote } = useNotes();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadArchived = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isTauri()) {
        const archived = (await invoke('list_notes', {
          filter: {
            is_archived: true,
            sort_by: 'updated_at',
            sort_order: 'desc',
            page: 1,
            per_page: 200,
          },
        })) as Note[];
        setNotes(archived.filter(n => !n.is_deleted));
      } else {
        // Браузерный fallback (npm run dev без Tauri): собираем архив
        // из того, что уже лежит в сторе.
        setNotes(
          useNotes
            .getState()
            .notes.filter(n => n.is_archived && !n.is_deleted)
            .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
        );
      }
    } catch (e) {
      console.error('load archived failed', e);
      toast({
        title: t('loadArchivedFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsLoading(false);
    }
    // t стабилен при смене языка (см. useTranslation), eslint не видит замыкания.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadArchived();
  }, [loadArchived]);

  const fail = (title: string) => (e: unknown) => {
    console.error(title, e);
    toast({
      title,
      description: e instanceof Error ? e.message : String(e),
    });
  };

  const cardActions = {
    onArchive: (n: Note) =>
      archiveNote(n.id, false)
        .then(loadArchived)
        .catch(fail(t('unarchiveFailed'))),
    onDelete: (n: Note) =>
      deleteNote(n.id)
        .then(loadArchived)
        .catch(fail(t('deleteFailed'))),
    onDuplicate: (n: Note) =>
      duplicateNote(n.id)
        .then(loadArchived)
        .catch(fail(t('duplicateFailed'))),
    onPin: (n: Note) =>
      pinNote(n.id, !n.is_pinned)
        .then(loadArchived)
        .catch(fail(t('pinFailed'))),
    onFavorite: (n: Note) =>
      favoriteNote(n.id, !n.is_favorite)
        .then(loadArchived)
        .catch(fail(t('favoriteFailed'))),
    onRename: (n: Note, title: string) =>
      updateNote({ id: n.id, title })
        .then(loadArchived)
        .catch(fail(t('renameNoteFailed'))),
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-5">
      {/* Заголовок + возврат на главную в стиле остальных страниц */}
      <div className="flex flex-col items-center gap-3 text-center">
        <Breadcrumbs
          onBack={() => navigate('/home')}
          parentLabel={t('home')}
          current={t('archive')}
        />
        <h1 className="font-display text-[32px] font-extrabold leading-none tracking-tight">
          {t('archive')}
        </h1>
        {!isLoading && notes.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {notes.length === 1
              ? t('archiveNoteCount1')
              : t('archiveNoteCount', { count: notes.length })}{' '}
            · {t('archiveHint')}
          </p>
        )}
      </div>

      <div className="flex-1">
        {isLoading ? (
          <LoadingSpinner />
        ) : notes.length === 0 ? (
          <div className="liquid-glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl p-10 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-3xl"
              style={{ background: 'hsl(var(--primary) / 0.22)' }}
            >
              <Archive className="h-6 w-6" />
            </span>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold">{t('archiveEmpty')}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('archiveEmptyDesc')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-1 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 [&>*]:min-w-0">
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                variant="ghost"
                onClick={() => navigate(`/editor/${note.id}`)}
                {...cardActions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
