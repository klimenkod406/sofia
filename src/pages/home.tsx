'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useNotes, type Note } from '@/stores/notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteCard } from '@/components/home/note-card';
import { FolderDock, FolderCrumbs } from '@/components/home/folder-sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

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
  } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // DnD состояние (п.8): перетаскивание заметки на заметку = новая папка
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
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
  const visibleNotes = useMemo(() => {
    let list = notes.filter(n => !n.is_deleted);
    if (!showArchived) list = list.filter(n => !n.is_archived);
    if (showFavoritesOnly) list = list.filter(n => n.is_favorite);
    if (filter.folderId) list = list.filter(n => n.folder_id === filter.folderId);
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
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
  }, [notes, showArchived, showFavoritesOnly, filter.folderId, filter.searchQuery]);

  const visibleFolders = useMemo(
    () => (filter.folderId ? [] : folders),
    [folders, filter.folderId]
  );

  // Единственная точка создания (п.9): empty-state + глобальный «+» в чёлке.
  const [creating, setCreating] = useState(false);
  const handleNewNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await createNote(filter.folderId ?? undefined, 'Новая заметка');
      navigate(`/editor/${note.id}`);
    } finally {
      setCreating(false);
    }
  };

  // 8. Слияние двух заметок в новую папку
  const handleMergeToFolder = async (target: Note) => {
    if (!draggedNote || draggedNote.id === target.id) return;
    try {
      const name = `Новая папка ${folders.length + 1}`;
      const folder = await createFolder(name);
      await moveNote(draggedNote.id, folder.id);
      await moveNote(target.id, folder.id);
      setJustCreatedFolderId(folder.id);
      await loadNotes();
      await loadFolders();
    } catch (e) {
      console.error('merge to folder failed', e);
    } finally {
      setDraggedNote(null);
      setDropTargetId(null);
    }
  };

  const handleDropOnFolder = async (folderId: string | null) => {
    if (!draggedNote) return;
    try {
      await moveNote(draggedNote.id, folderId);
      await loadNotes();
    } catch (e) {
      console.error('move to folder failed', e);
    } finally {
      setDraggedNote(null);
      setDropTargetId(null);
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
      const first = folders[0];
      if (first) moveNote(n.id, first.id).then(loadNotes).catch(console.error);
    },
  };

  const activeSort = `${filter.sortBy}:${filter.sortOrder}`;

  return (
    <div className="flex h-full flex-col gap-5">
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
      <div className="mx-auto flex w-full max-w-xl items-center gap-2.5">
        <div className="relative flex-1">
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
          onNoteDropOnFolder={handleDropOnFolder}
          counts={counts}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Папки — карточки в том же пространстве */}
            {visibleFolders.map(folder => {
              const count = counts[folder.id] ?? 0;
              return (
                <button
                  key={folder.id}
                  onClick={() => setFilter({ folderId: folder.id })}
                  onDragOver={e => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDropTargetId(folder.id);
                  }}
                  onDragLeave={() => setDropTargetId(id => (id === folder.id ? null : id))}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropOnFolder(folder.id);
                  }}
                  className={cn(
                    'folder-card group text-left',
                    justCreatedFolderId === folder.id && 'folder-just-created',
                    dropTargetId === folder.id && 'animate-drop-glow'
                  )}
                  aria-label={`Открыть папку ${folder.name}`}
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

            {/* Заметки — единым потоком */}
            {visibleNotes.map(note => (
              <div key={note.id} className={cn(note.is_archived && 'opacity-60')}>
                <NoteCard
                  note={note}
                  onClick={() => navigate(`/editor/${note.id}`)}
                  variant={note.is_archived ? 'ghost' : 'default'}
                  draggable
                  isDragging={draggedNote?.id === note.id}
                  isDropTarget={dropTargetId === note.id}
                  onNoteDragStart={n => setDraggedNote(n)}
                  onNoteDragEnd={() => {
                    setDraggedNote(null);
                    setDropTargetId(null);
                  }}
                  onNoteDragOver={t => {
                    if (draggedNote && draggedNote.id !== t.id) setDropTargetId(t.id);
                  }}
                  onNoteDragLeave={() => setDropTargetId(id => (id === note.id ? null : id))}
                  onNoteDrop={handleMergeToFolder}
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
            Отпустите над другой заметкой, чтобы создать папку, или над папкой, чтобы переместить
          </p>
        )}
      </div>
    </div>
  );
}
