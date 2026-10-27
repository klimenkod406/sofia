'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  ArrowLeft,
  Archive,
  Calendar,
  FileText,
  Plus,
  Pin,
  Star,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useNotes, type Note, type Folder } from '@/stores/notes';
import { Button } from '@/components/ui/button';
import { NoteCard } from '@/components/home/note-card';
import { FolderDeleteDialog, type FolderDeleteMode } from '@/components/home/folder-delete-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, truncate } from '@/utils/cn';
import { filterVisibleNotes, canMergeNotes } from '@/utils/notes-visibility';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';

const sortOptions = [
  { value: 'updated_at:desc', labelKey: 'sortRecent' },
  { value: 'created_at:desc', labelKey: 'sortNew' },
  { value: 'title:asc', labelKey: 'sortTitleAsc' },
  { value: 'title:desc', labelKey: 'sortTitleDesc' },
] as const;

/** Инлайн-переименование папки: инпут в подписи (ПКМ → Переименовать).
 *  Enter — сохранить, Escape — отменить, blur — сохранить (doneRef
 *  отсекает двойной коммит от размонтирования). */
function FolderRenameInput({
  folder,
  onDone,
}: {
  folder: Folder;
  onDone: (name: string | null) => void;
}) {
  const [draft, setDraft] = useState(folder.name);
  const doneRef = useRef(false);
  const { t } = useTranslation();

  const commit = (v: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(v ? v.trim() : v);
  };

  return (
    <input
      className="object-name-input"
      value={draft}
      autoFocus
      onChange={e => setDraft(e.target.value)}
      onFocus={e => e.target.select()}
      onKeyDown={e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Enter') commit(draft);
        else if (e.key === 'Escape') commit(null);
      }}
      onBlur={() => commit(draft)}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      aria-label={t('folderName')}
    />
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    notes,
    folders,
    isLoading,
    loadNotes,
    loadFolders,
    filter,
    setFilter,
    createNote,
    pinNote,
    archiveNote,
    favoriteNote,
    duplicateNote,
    deleteNote,
    moveNote,
    updateNote,
    createFolder,
    deleteFolder,
    updateFolder,
  } = useNotes();
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // Поиск живёт в шапке (TitleBar) и пишет прямо в store.filter.searchQuery —
  // лента ниже перезагружается по нему сама (см. эффекты loadNotes).

  // Свободное перетаскивание (п.8): едет САМА карточка за указателем
  // (transform, layout не трогаем), цель подсвечивается в реальном времени.
  // Сброс: на заметку — новая папка (обе уходят внутрь), на папку/чип —
  // переместить, на пустое место — убрать из папки.
  // Цели в dropTargetId с префиксом: n:<id> заметка, f:<id> папка, d:<id> чип.
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const pressRef = useRef<{
    note: Note;
    startX: number;
    startY: number;
    active: boolean;
    session: number;
  } | null>(null);
  const cardEls = useRef(new Map<string, HTMLDivElement>());
  const suppressClickRef = useRef(false);
  const sessionRef = useRef(0);
  const DRAG_THRESHOLD = 6;

  const setCardEl = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  };

  // Поднять карточку: выше всех, прозрачна для hit-test (цель ищется честно),
  // без transition — иначе будет отставать от курсора
  const liftCardEl = (id: string) => {
    const el = cardEls.current.get(id);
    if (!el) return;
    el.style.zIndex = '100';
    el.style.pointerEvents = 'none';
    el.style.transition = 'none';
    el.style.willChange = 'transform';
  };

  const moveCardEl = (id: string, dx: number, dy: number) => {
    const el = cardEls.current.get(id);
    if (el) el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.03) rotate(1.2deg)`;
  };

  // Опустить карточку: при отмене — плавный возврат на место,
  // при удачном сбросе — мгновенно (список всё равно перезагрузится)
  const dropCardEl = (id: string, session: number, animateBack: boolean) => {
    const el = cardEls.current.get(id);
    if (!el) return;
    if (!animateBack) {
      el.style.cssText = '';
      return;
    }
    el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = '';
    el.style.pointerEvents = '';
    window.setTimeout(() => {
      // Новая тяга могла начаться за эти 250мс — чужое не трогаем
      if (pressRef.current?.session !== session) return;
      cardEls.current.get(id)?.removeAttribute('style');
    }, 260);
  };

  // Заметка под курсором (без учёта filed-статуса) — для объясняющего тоста
  const findNoteUnderCursor = (x: number, y: number, ignoreId: string): string | null => {
    const el = document.elementFromPoint(x, y);
    const t = el?.closest?.('[data-note-id]') as HTMLElement | null;
    if (!t) return null;
    const id = t.getAttribute('data-note-id')!;
    return id === ignoreId ? null : id;
  };

  const isFiled = (id: string): boolean => !!notes.find(n => n.id === id)?.folder_id;

  const pickDropTarget = (x: number, y: number, ignoreId: string): string | null => {
    const el = document.elementFromPoint(x, y);
    const t = el?.closest?.('[data-note-id],[data-folder-id]') as HTMLElement | null;
    if (!t) return null;
    if (t.hasAttribute('data-note-id')) {
      const id = t.getAttribute('data-note-id')!;
      if (id === ignoreId) return null;
      // Слияние — только для заметок на главной: из папки новые не создаём
      if (isFiled(ignoreId) || isFiled(id)) return null;
      return `n:${id}`;
    }
    return `f:${t.getAttribute('data-folder-id')}`;
  };

  const detachDragListeners = () => {
    window.removeEventListener('pointermove', onDragPointerMove);
    window.removeEventListener('pointerup', onDragPointerUp);
    window.removeEventListener('pointercancel', onDragCancel);
  };

  const onCardPointerDown = (e: React.PointerEvent, note: Note) => {
    suppressClickRef.current = false;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [role="menu"]')) return;
    pressRef.current = {
      note,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      session: ++sessionRef.current,
    };
    window.addEventListener('pointermove', onDragPointerMove);
    window.addEventListener('pointerup', onDragPointerUp);
    window.addEventListener('pointercancel', onDragCancel);
  };

  const onDragPointerMove = (e: PointerEvent) => {
    const press = pressRef.current;
    if (!press) return;
    if (!press.active) {
      if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < DRAG_THRESHOLD) return;
      press.active = true;
      suppressClickRef.current = true;
      liftCardEl(press.note.id);
      setDraggedNote(press.note);
      setDropTargetId(null);
    }
    moveCardEl(press.note.id, e.clientX - press.startX, e.clientY - press.startY);
    const t = pickDropTarget(e.clientX, e.clientY, press.note.id);
    setDropTargetId(prev => (prev === t ? prev : t));
  };

  const onDragPointerUp = (e: PointerEvent) => {
    detachDragListeners();
    const press = pressRef.current;
    pressRef.current = null;
    setDraggedNote(null);
    setDropTargetId(null);
    if (!press?.active) return;
    const dropTarget = pickDropTarget(e.clientX, e.clientY, press.note.id);
    if (!dropTarget) {
      // Бросок на заметку из папки: слияние запрещено — объясняем и возвращаем
      const blocked = findNoteUnderCursor(e.clientX, e.clientY, press.note.id);
      if (blocked) {
        dropCardEl(press.note.id, press.session, true);
        toast({
          title: t('noteAlreadyInFolder'),
          description: t('noteAlreadyInFolderDesc'),
        });
        return;
      }
      // Мимо целей: внутри папки — убрать из неё, иначе возврат на место
      dropCardEl(press.note.id, press.session, !filter.folderId);
      if (filter.folderId) void moveNoteToFolder(press.note.id, null);
      return;
    }
    dropCardEl(press.note.id, press.session, false);
    const sep = dropTarget.indexOf(':');
    const kind = dropTarget.slice(0, sep);
    const id = dropTarget.slice(sep + 1);
    if (kind === 'n') void mergeNotesToFolder(press.note.id, id);
    else void moveNoteToFolder(press.note.id, id);
  };

  const onDragCancel = () => {
    detachDragListeners();
    const press = pressRef.current;
    pressRef.current = null;
    setDraggedNote(null);
    setDropTargetId(null);
    if (press?.active) dropCardEl(press.note.id, press.session, true);
  };

  const onCardClick = (note: Note) => {
    // Клик после перетаскивания — не открывать редактор
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    navigate(`/editor/${note.id}`);
  };
  const [justCreatedFolderId, setJustCreatedFolderId] = useState<string | null>(null);

  useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.folderId, filter.searchQuery, filter.sortBy, filter.sortOrder]);

  useEffect(() => {
    if (!justCreatedFolderId) return;
    const t = setTimeout(() => setJustCreatedFolderId(null), 1600);
    return () => clearTimeout(t);
  }, [justCreatedFolderId]);

  const currentFolder = useMemo(
    () => folders.find(f => f.id === filter.folderId) ?? null,
    [folders, filter.folderId]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { __all: 0 };
    for (const n of notes) {
      if (n.is_deleted) continue;
      if (!showArchived && n.is_archived) continue;
      c.__all += 1;
      if (n.folder_id) c[n.folder_id] = (c[n.folder_id] ?? 0) + 1;
    }
    return c;
  }, [notes, showArchived]);

  // 10. Единое пространство: один список, без секций «закреплённые / архив / теги».
  // Закрепы просто всплывают первыми в том же гриде.
  const visibleNotes = useMemo(
    () =>
      filterVisibleNotes(notes, {
        folderId: filter.folderId,
        searchQuery: filter.searchQuery,
        showArchived,
        showFavoritesOnly,
      }),
    [notes, showArchived, showFavoritesOnly, filter.folderId, filter.searchQuery]
  );

  const visibleFolders = useMemo(
    () => (filter.folderId ? [] : folders),
    [folders, filter.folderId]
  );

  // Удаление папки: диалог уточняет судьбу заметок внутри
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  // Переименование папки: пункт «Переименовать» в ПКМ-меню открывает
  // инлайн-инпут прямо в подписи (folder-object-name → input)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  // ПКМ-меню папки: открыть / переименовать / удалить
  const [folderCtx, setFolderCtx] = useState<{
    folder: Folder;
    x: number;
    y: number;
  } | null>(null);
  const [folderCtxPos, setFolderCtxPos] = useState<{ x: number; y: number } | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);

  // Держим ПКМ-меню папки в пределах окна: измеряем НАТУРАЛЬНУЮ высоту
  // (без клампа), затем поджимаем позицию. Если измерять сразу после рендера
  // на сырых координатах клика, браузер уже применяет maxHeight и возвращает
  // усечённую высоту — кламп получается неверным и меню всё равно обрезано.
  useLayoutEffect(() => {
    if (!folderCtx) return;
    const el = folderMenuRef.current;
    if (!el) return;
    // Временно убираем ограничения, чтобы измерить реальный размер контента.
    el.style.maxHeight = 'none';
    el.style.top = '0px';
    const rect = el.getBoundingClientRect();
    const naturalHeight = rect.height || 180;
    const width = rect.width || 240;
    // Восстанавливаем ограничение и рассчитываем позицию.
    el.style.maxHeight = '';
    const GAP_BOTTOM = 12;
    const x = Math.min(Math.max(folderCtx.x, 8), Math.max(8, window.innerWidth - width - 8));
    const y = Math.min(
      Math.max(folderCtx.y, 8),
      Math.max(8, window.innerHeight - naturalHeight - GAP_BOTTOM)
    );
    setFolderCtxPos(prev => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  }, [folderCtx]);

  // Закрыть ПКМ-меню папки: клик/скролл вне, Escape.
  useEffect(() => {
    if (!folderCtx) return;
    const onDown = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node))
        setFolderCtx(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFolderCtx(null);
    };
    const onScroll = () => setFolderCtx(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [folderCtx]);

  const finishFolderRename = async (folder: Folder, name: string | null) => {
    setRenamingFolderId(null);
    if (!name || name === folder.name) return;
    try {
      await updateFolder({ ...folder, name });
      await loadFolders();
    } catch (e) {
      console.error('rename folder failed', e);
      toast({
        title: t('renameFolderFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const confirmDeleteFolder = async (mode: FolderDeleteMode) => {
    const folder = deletingFolder;
    if (!folder) return;
    setDeletingFolder(null);
    try {
      await deleteFolder(folder.id, mode === 'with-notes');
      await loadNotes();
      await loadFolders();
      toast({
        title:
          mode === 'with-notes'
            ? t('folderAndNotesDeleted', { name: folder.name })
            : t('folderDeletedNotesReturned', { name: folder.name }),
      });
    } catch (e) {
      console.error('delete folder failed', e);
      toast({
        title: t('deleteFolderFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };
  // Единственная точка создания (п.9): empty-state + «+» в правом углу.
  const [creating, setCreating] = useState(false);
  const handleNewNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await createNote(filter.folderId ?? null, t('newNote'));
      navigate(`/editor/${note.id}`);
    } catch (e) {
      console.error('create note failed', e);
      toast({
        title: t('createNoteFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(false);
    }
  };

  // 8. Слияние двух заметок в новую папку
  const mergeNotesToFolder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const source = notes.find(n => n.id === sourceId);
    const target = notes.find(n => n.id === targetId);
    if (!source || !target) return;
    // Из заметок, уже лежащих в папке, новые папки не создаём
    if (!canMergeNotes(source, target)) {
      toast({
        title: t('noteAlreadyInFolder'),
        description: t('noteAlreadyInFolderDesc'),
      });
      return;
    }
    try {
      const folder = await createFolder(`${t('newFolder')} ${folders.length + 1}`);
      await moveNote(source.id, folder.id);
      await moveNote(target.id, folder.id);
      setJustCreatedFolderId(folder.id);
      await loadNotes();
      await loadFolders();
      toast({
        title: t('folderCreated'),
        description: `«${truncate(source.title, 24)}» + «${truncate(target.title, 24)}» → ${folder.name}`,
      });
    } catch (e) {
      console.error('merge to folder failed', e);
      toast({
        title: t('createFolderFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
      await loadNotes();
    }
  };

  const moveNoteToFolder = async (sourceId: string, folderId: string | null) => {
    try {
      await moveNote(sourceId, folderId);
      await loadNotes();
      if (folderId) {
        const dest = folders.find(f => f.id === folderId);
        toast({ title: t('noteMovedTo', { name: dest?.name ?? t('folder') }) });
      } else {
        toast({ title: t('noteRemovedFromFolder') });
      }
    } catch (e) {
      console.error('move to folder failed', e);
      toast({
        title: t('moveNoteFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
      await loadNotes();
    }
  };

  const cardActions = {
    onPin: (n: Note) => pinNote(n.id, !n.is_pinned).then(loadNotes).catch(console.error),
    onFavorite: (n: Note) =>
      favoriteNote(n.id, !n.is_favorite).then(loadNotes).catch(console.error),
    onArchive: (n: Note) => archiveNote(n.id, !n.is_archived).then(loadNotes).catch(console.error),
    onDuplicate: (n: Note) => duplicateNote(n.id).then(loadNotes).catch(console.error),
    onDelete: (n: Note) => deleteNote(n.id).then(loadNotes).catch(console.error),
    onRename: (n: Note, title: string) => {
      updateNote({ id: n.id, title })
        .then(loadNotes)
        .catch((e: unknown) => {
          console.error('rename note failed', e);
          toast({
            title: t('renameNoteFailed'),
            description: e instanceof Error ? e.message : String(e),
          });
        });
    },
    onPickFolder: (n: Note, folderId: string | null) => {
      if (folderId === n.folder_id) return;
      void moveNoteToFolder(n.id, folderId);
    },
  };

  const activeSort = `${filter.sortBy}:${filter.sortOrder}`;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-5">
      {/* Центрированный заголовок + бейджи активных фильтров */}
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-[32px] font-extrabold leading-none tracking-tight">
          {currentFolder ? currentFolder.name : t('myNotes')}
        </h1>
        {(showArchived || showFavoritesOnly || filter.searchQuery) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {showArchived && (
              <button
                onClick={() => setShowArchived(false)}
                className="badge badge-secondary gap-1.5 transition-all hover:bg-accent"
                aria-label={t('hideArchived')}
              >
                <Archive className="h-3 w-3" aria-hidden="true" />
                {t('archive')}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            {showFavoritesOnly && (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className="badge badge-secondary gap-1.5 transition-all hover:bg-accent"
                aria-label={t('showAllNotes')}
              >
                <Star className="h-3 w-3" aria-hidden="true" />
                {t('favorites')}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            {filter.searchQuery && (
              <span className="badge badge-primary gap-1.5">
                {t('searchQuery', { query: truncate(filter.searchQuery, 20) })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Лента папок убрана: папки живут карточками в пространстве ниже.
          Внутри папки — только тонкий возврат назад. */}
      {currentFolder && (
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 text-sm">
          <button
            onClick={() => setFilter({ folderId: null })}
            className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-muted-foreground transition-all duration-300 hover:bg-accent/70 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('allNotes')}
          </button>
          <span className="font-display font-bold">{currentFolder.name}</span>
        </div>
      )}

      {/* Тулбар рабочей зоны: календарь СЛЕВА рядом с сортировкой — только
          иконки, без подписей. Сортировка — только иконка (без текста). */}
      <div className="flex items-center justify-end gap-1.5">
        <Button
          onClick={handleNewNote}
          disabled={creating}
          size="icon"
          className="h-9 w-9 rounded-xl"
          aria-label={t('newNote')}
          title={t('newNote')}
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        </Button>
        <button
          onClick={() => navigate('/calendar')}
          className="toolbar-icon-btn"
          aria-label={t('calendar')}
          title={t('calendar')}
        >
          <Calendar className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          onClick={() => navigate('/archive')}
          className="toolbar-icon-btn"
          aria-label={t('archive')}
          title={t('archive')}
        >
          <Archive className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="toolbar-icon-btn"
              aria-label={t('viewAndSort')}
              title={t('viewAndSort')}
            >
              <ArrowUpDown className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('sortBy')}
            </div>
            {sortOptions.map(o => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => {
                  const [sortBy, sortOrder] = o.value.split(':');
                  setFilter({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' });
                  loadNotes();
                }}
              >
                <ArrowUpDown className="mr-1 h-4 w-4" />
                {t(o.labelKey)}
                {activeSort === o.value && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowArchived(v => !v)}>
              <Archive className="mr-1 h-4 w-4" />
              {showArchived ? t('hideArchived') : t('showArchived')}
              {showArchived && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowFavoritesOnly(v => !v)}>
              <Star className="mr-1 h-4 w-4" />
              {showFavoritesOnly ? t('showAllNotes') : t('showFavoritesOnly')}
              {showFavoritesOnly && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Единое пространство */}
      <div className="flex-1">
        {visibleNotes.length === 0 && visibleFolders.length === 0 && !isLoading ? (
          <div className="liquid-glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl p-10 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-3xl"
              style={{ background: 'hsl(var(--primary) / 0.22)' }}
            >
              <FileText className="h-6 w-6" />
            </span>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold">{t('noNotes')}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t('noNotesDesc')}</p>
            </div>
            <Button onClick={handleNewNote} disabled={creating} className="gap-2">
              <Plus className="h-4 w-4" />
              {creating ? t('creating') : t('createNote')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-1 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 [&>*]:min-w-0">
            {/* Папки — объекты в том же пространстве */}
            {visibleFolders.map(folder => {
              const count = counts[folder.id] ?? 0;
              return (
                <button
                  key={folder.id}
                  data-folder-id={folder.id}
                  onClick={() => setFilter({ folderId: folder.id })}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFolderCtx({ folder, x: e.clientX, y: e.clientY });
                    setFolderCtxPos({ x: e.clientX, y: e.clientY });
                  }}
                  className={cn(
                    'folder-object group',
                    justCreatedFolderId === folder.id && 'folder-just-created',
                    dropTargetId === `f:${folder.id}` && 'folder-object-drop'
                  )}
                  aria-label={t('openFolder', { name: folder.name })}
                >
                  {/* Большая папка (в пустой листиков нет), название — подписью снизу */}
                  <span
                    className="folder-illus"
                    style={{ ['--folder-color' as string]: folder.color }}
                    aria-hidden="true"
                  >
                    <span className="folder-tab" />
                    <span className="folder-back" />
                    {count > 0 && (
                      <>
                        <span className="folder-paper folder-paper-1" />
                        <span className="folder-paper folder-paper-2" />
                      </>
                    )}
                    <span className="folder-front" />
                  </span>
                  <span className="folder-object-caption">
                    {renamingFolderId === folder.id ? (
                      <FolderRenameInput
                        folder={folder}
                        onDone={name => void finishFolderRename(folder, name)}
                      />
                    ) : (
                      <span className="folder-object-name">
                        {folder.name}
                        {justCreatedFolderId === folder.id && (
                          <span className="badge badge-primary ml-2 align-middle">
                            {t('newBadge')}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {/* Заметки-листы — единым потоком; тянутся за указателем.
                Обёртка едет целиком (transform ставит drag-логика выше),
                внутри — объект NoteCard: лист + подпись снизу. */}
            {visibleNotes.map(note => (
              <div
                key={note.id}
                ref={setCardEl(note.id)}
                data-note-id={note.id}
                className="flex min-w-0 flex-col items-center select-none"
                onPointerDown={e => onCardPointerDown(e, note)}
                onDragStart={e => e.preventDefault()}
              >
                <NoteCard
                  note={note}
                  onClick={() => onCardClick(note)}
                  variant={note.is_archived ? 'ghost' : 'default'}
                  isDragging={draggedNote?.id === note.id}
                  isDropTarget={dropTargetId === `n:${note.id}`}
                  folders={folders}
                  folderCounts={counts}
                  {...cardActions}
                />
                {note.is_pinned && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Pin className="h-3 w-3" /> {t('pinned')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {draggedNote && (
          <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
            {draggedNote.folder_id ? t('dragHintInFolder') : t('dragHintMain')}
          </p>
        )}

        {deletingFolder && (
          <FolderDeleteDialog
            folderName={deletingFolder.name}
            noteCount={counts[deletingFolder.id] ?? 0}
            onCancel={() => setDeletingFolder(null)}
            onConfirm={mode => void confirmDeleteFolder(mode)}
          />
        )}

        {folderCtx &&
          createPortal(
            <div
              ref={folderMenuRef}
              className="liquid-glass fixed z-[100] w-60 rounded-2xl p-1.5 shadow-xl animate-scale-in"
              style={{
                left: folderCtxPos?.x ?? folderCtx.x,
                top: folderCtxPos?.y ?? folderCtx.y,
                maxHeight: 'calc(100vh - 20px)',
                overflowY: 'auto',
              }}
              role="menu"
              onClick={e => {
                e.stopPropagation();
                setFolderCtx(null);
              }}
            >
              <DropdownMenuItem onClick={() => setFilter({ folderId: folderCtx.folder.id })}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('open')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenamingFolderId(folderCtx.folder.id)}>
                <Pencil className="w-4 h-4 mr-1" />
                {t('rename')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="!text-[hsl(var(--destructive))]"
                onClick={() => setDeletingFolder(folderCtx.folder)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('delete')}
              </DropdownMenuItem>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
