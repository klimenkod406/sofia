'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MoreVertical,
  ArrowUpDown,
  Archive,
  FileText,
  Folder as FolderIcon,
  Plus,
  Pin,
  Star,
} from 'lucide-react';
import { useNotes, type Note, type Folder } from '@/stores/notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteCard } from '@/components/home/note-card';
import { FolderDock, FolderCrumbs } from '@/components/home/folder-sidebar';
import {
  FolderDeleteDialog,
  type FolderDeleteMode,
} from '@/components/home/folder-delete-dialog';
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

const sortOptions = [
  { value: 'updated_at:desc', label: 'Сначала недавние' },
  { value: 'created_at:desc', label: 'Сначала новые' },
  { value: 'title:asc', label: 'По названию (А–Я)' },
  { value: 'title:desc', label: 'По названию (Я–А)' },
] as const;

export function HomePage() {
  const navigate = useNavigate();
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
    createFolder,
    deleteFolder,
  } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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
    const t = el?.closest?.(
      '[data-note-id],[data-folder-id],[data-dock-folder-id]'
    ) as HTMLElement | null;
    if (!t) return null;
    if (t.hasAttribute('data-note-id')) {
      const id = t.getAttribute('data-note-id')!;
      if (id === ignoreId) return null;
      // Слияние — только для заметок на главной: из папки новые не создаём
      if (isFiled(ignoreId) || isFiled(id)) return null;
      return `n:${id}`;
    }
    if (t.hasAttribute('data-folder-id')) return `f:${t.getAttribute('data-folder-id')}`;
    return `d:${t.getAttribute('data-dock-folder-id')}`;
  };

  const detachDragListeners = () => {
    window.removeEventListener('pointermove', onDragPointerMove);
    window.removeEventListener('pointerup', onDragPointerUp);
    window.removeEventListener('pointercancel', onDragCancel);
  };

  const onCardPointerDown = (e: React.PointerEvent, note: Note) => {
    suppressClickRef.current = false;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest('button, a, input, textarea, [role="menu"]')
    )
      return;
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
      if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < DRAG_THRESHOLD)
        return;
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
    const t = pickDropTarget(e.clientX, e.clientY, press.note.id);
    if (!t) {
      // Бросок на заметку из папки: слияние запрещено — объясняем и возвращаем
      const blocked = findNoteUnderCursor(e.clientX, e.clientY, press.note.id);
      if (blocked) {
        dropCardEl(press.note.id, press.session, true);
        toast({
          title: 'Заметка уже в папке',
          description:
            'Новые папки создаются только из заметок на главной — сначала уберите её из папки',
        });
        return;
      }
      // Мимо целей: внутри папки — убрать из неё, иначе возврат на место
      dropCardEl(press.note.id, press.session, !filter.folderId);
      if (filter.folderId) void moveNoteToFolder(press.note.id, null);
      return;
    }
    dropCardEl(press.note.id, press.session, false);
    const sep = t.indexOf(':');
    const kind = t.slice(0, sep);
    const id = t.slice(sep + 1);
    if (kind === 'n') void mergeNotesToFolder(press.note.id, id);
    else if (kind === 'f') void moveNoteToFolder(press.note.id, id);
    else void moveNoteToFolder(press.note.id, id === '__all__' ? null : id);
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
    const debounce = setTimeout(() => {
      setFilter({ searchQuery });
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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
            ? `Папка «${folder.name}» и заметки удалены`
            : `Папка «${folder.name}» удалена, заметки вернулись на главную`,
      });
    } catch (e) {
      console.error('delete folder failed', e);
      toast({
        title: 'Не получилось удалить папку',
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
      const note = await createNote(filter.folderId ?? null, 'Новая заметка');
      navigate(`/editor/${note.id}`);
    } catch (e) {
      console.error('create note failed', e);
      toast({
        title: 'Не получилось создать заметку',
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
        title: 'Заметка уже в папке',
        description:
          'Новые папки создаются только из заметок на главной — сначала уберите её из папки',
      });
      return;
    }
    try {
      const folder = await createFolder(`Новая папка ${folders.length + 1}`);
      await moveNote(source.id, folder.id);
      await moveNote(target.id, folder.id);
      setJustCreatedFolderId(folder.id);
      await loadNotes();
      await loadFolders();
      toast({
        title: 'Папка создана',
        description: `«${truncate(source.title, 24)}» + «${truncate(target.title, 24)}» → ${folder.name}`,
      });
    } catch (e) {
      console.error('merge to folder failed', e);
      toast({
        title: 'Не получилось создать папку',
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
        toast({ title: `Перемещено в «${dest?.name ?? 'папку'}»` });
      } else {
        toast({ title: 'Заметка убрана из папки' });
      }
    } catch (e) {
      console.error('move to folder failed', e);
      toast({
        title: 'Не получилось переместить',
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
    onMoveToFolder: (n: Note) => {
      // Из папки — убрать из неё; без папок — создать новую; иначе — в первую.
      // Всегда с тостом, молчаливых перемещений больше нет.
      const done = (title: string) => {
        loadNotes().catch(console.error);
        toast({ title });
      };
      const fail = (e: unknown) => {
        console.error('move to folder failed', e);
        toast({
          title: 'Не получилось переместить',
          description: e instanceof Error ? e.message : String(e),
        });
        loadNotes().catch(console.error);
      };
      if (n.folder_id) {
        moveNote(n.id, null).then(() => done('Заметка убрана из папки')).catch(fail);
      } else if (folders.length > 0) {
        const first = folders[0];
        moveNote(n.id, first.id)
          .then(() => done(`Перемещено в «${first.name}»`))
          .catch(fail);
      } else {
        createFolder(`Новая папка ${folders.length + 1}`)
          .then(f => moveNote(n.id, f.id).then(() => f))
          .then(f => {
            loadFolders().catch(console.error);
            done(`Папка создана: ${f.name}`);
          })
          .catch(fail);
      }
    },
  };

  const activeSort = `${filter.sortBy}:${filter.sortOrder}`;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-5">
      {/* Центрированный заголовок */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-[32px] font-extrabold leading-none tracking-tight">
          {currentFolder ? currentFolder.name : 'Мои заметки'}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {currentFolder
            ? `${visibleNotes.length} заметок в папке · перетащите заметку сюда или друг на друга`
            : 'Одно спокойное пространство · перетащите заметку на другую, чтобы создать папку'}
        </p>
      </div>

      {/* Центрированный поиск + меню «…» (п.10: всё второстепенное — в меню) */}
      <div className="mx-auto flex w-full min-w-0 max-w-xl items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Найти заметку…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="!pl-11"
            aria-label="Поиск заметок"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span>
              <Button variant="outline" size="icon" aria-label="Вид и сортировка">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Сортировка
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
                {o.label}
                {activeSort === o.value && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowArchived(v => !v)}>
              <Archive className="mr-1 h-4 w-4" />
              {showArchived ? 'Скрыть архив' : 'Показать архив'}
              {showArchived && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowFavoritesOnly(v => !v)}>
              <Star className="mr-1 h-4 w-4" />
              {showFavoritesOnly ? 'Все заметки' : 'Только избранное'}
              {showFavoritesOnly && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Лента папок по центру (не сайдбар) */}
      <div className="mx-auto w-full max-w-3xl">
        <FolderDock
          folders={folders}
          currentFolderId={filter.folderId}
          onSelect={setFilter}
          counts={counts}
          dragging={!!draggedNote}
          dropTargetId={dropTargetId}
        />
        {currentFolder && (
          <div className="mt-3 flex justify-center">
            <FolderCrumbs folder={currentFolder} onHome={() => setFilter({ folderId: null })} />
          </div>
        )}
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
              <h3 className="font-display text-lg font-bold">Пока тихо и пусто</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Создайте первую заметку — она появится здесь
              </p>
            </div>
            <Button onClick={handleNewNote} disabled={creating} className="gap-2">
              <Plus className="h-4 w-4" />
              {creating ? 'Создаём…' : 'Создать заметку'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {/* Папки — карточки в том же пространстве */}
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
                    setDeletingFolder(folder);
                  }}
                  className={cn(
                    'folder-card group text-left',
                    justCreatedFolderId === folder.id && 'folder-just-created',
                    dropTargetId === `f:${folder.id}` && 'animate-drop-glow'
                  )}
                  aria-label={`Открыть папку ${folder.name}`}
                  title="Открыть · правый клик — удалить"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
                      style={{ background: `${folder.color}26` }}
                    >
                      <FolderIcon className="h-5 w-5" style={{ color: folder.color }} />
                    </span>
                    <span className="badge badge-secondary">{count}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-display text-[17px] font-bold leading-snug">
                      {folder.name}
                      {justCreatedFolderId === folder.id && (
                        <span className="badge badge-primary ml-2 align-middle">новая</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {draggedNote ? 'Отпустите, чтобы переместить сюда' : 'Нажмите, чтобы открыть'}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Заметки — единым потоком; тянутся за указателем */}
            {visibleNotes.map(note => (
              <div
                key={note.id}
                ref={setCardEl(note.id)}
                data-note-id={note.id}
                className={cn('select-none', note.is_archived && 'opacity-60')}
                onPointerDown={e => onCardPointerDown(e, note)}
                onDragStart={e => e.preventDefault()}
              >
                <NoteCard
                  note={note}
                  onClick={() => onCardClick(note)}
                  variant={note.is_archived ? 'ghost' : 'default'}
                  isDragging={draggedNote?.id === note.id}
                  isDropTarget={dropTargetId === `n:${note.id}`}
                  {...cardActions}
                />
                {note.is_pinned && (
                  <div className="mt-1.5 flex items-center gap-1 pl-1 text-[11px] text-muted-foreground">
                    <Pin className="h-3 w-3" /> закреплена
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {draggedNote && (
          <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
            {draggedNote.folder_id
              ? 'Заметка уже в папке: её можно переместить на папку, чип вверху или пустое место'
              : 'На другую заметку — создать папку · на папку или чип вверху — переместить · на пустое место — убрать из папки'}
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
      </div>
    </div>
  );
}
