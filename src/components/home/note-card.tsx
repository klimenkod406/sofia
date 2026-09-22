'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Pin,
  Archive,
  Star,
  Trash2,
  Edit,
  Copy,
  Tag,
  FolderInput,
  Folder as FolderIcon,
  LayoutGrid,
  ArrowLeft,
  Check,
  Pencil,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Note, type Folder } from '@/stores/notes';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  variant?: 'default' | 'ghost';
  /** Подсветка: карточку тянут / над ней держат другую карточку */
  isDropTarget?: boolean;
  isDragging?: boolean;
  // Действия — единые для «…» и ПКМ-меню (п.10)
  onPin?: (note: Note) => void;
  onFavorite?: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onDuplicate?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  /** Выбор папки из подменю (null — убрать из папки) */
  onPickFolder?: (note: Note, folderId: string | null) => void;
  /** Переименование: инлайн-инпут под именем (ПКМ → Переименовать) */
  onRename?: (note: Note, title: string) => void;
  /** Папки для подменю выбора */
  folders?: Folder[];
  folderCounts?: Record<string, number>;
}

/** Строки подменю «Куда переместить»: только существующие папки + убрать. */
function FolderPickRows({
  note,
  folders,
  counts,
  onPick,
  onBack,
}: {
  note: Note;
  folders: Folder[];
  counts: Record<string, number>;
  onPick: (folderId: string | null) => void;
  /** Назад к действиям — только во встраиваемом виде; в боковом окне нет */
  onBack?: () => void;
}) {
  return (
    <>
      {onBack && (
        <>
          <DropdownMenuItem onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Все действия
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      {note.folder_id && (
        <DropdownMenuItem onClick={() => onPick(null)}>
          <LayoutGrid className="w-4 h-4 mr-1" />
          Убрать из папки
        </DropdownMenuItem>
      )}
      {folders.map(f => (
        <DropdownMenuItem key={f.id} onClick={() => onPick(f.id)}>
          <FolderIcon className="w-4 h-4 mr-1 shrink-0" style={{ color: f.color }} />
          <span className="min-w-0 flex-1 truncate text-left">{f.name}</span>
          <span className="text-xs text-muted-foreground">{counts[f.id] ?? 0}</span>
          {f.id === note.folder_id && <Check className="w-4 h-4 shrink-0" />}
        </DropdownMenuItem>
      ))}
      {folders.length === 0 && !note.folder_id && (
        <div className="px-3.5 py-2 text-sm text-muted-foreground">Папок пока нет</div>
      )}
    </>
  );
}

/** Ховер-состояние бокового подменю: якорь-строка + ленивое закрытие. */
function useSubmenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const cancelSubClose = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /** Только по нажатию: повторный клик по той же строке закрывает. */
  const toggleSub = useCallback(
    (el: HTMLElement) => {
      cancelSubClose();
      setAnchor(prev => (prev === el ? null : el));
    },
    [cancelSubClose]
  );

  const scheduleSubClose = useCallback(() => {
    cancelSubClose();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setAnchor(null);
    }, 150);
  }, [cancelSubClose]);

  const closeSub = useCallback(() => {
    cancelSubClose();
    setAnchor(null);
  }, [cancelSubClose]);

  return useMemo(
    () => ({ anchor, toggleSub, scheduleSubClose, cancelSubClose, closeSub }),
    [anchor, toggleSub, scheduleSubClose, cancelSubClose, closeSub]
  );
}

/** Второе окно рядом со строкой: первое остаётся открытым. */
function FolderSubmenu({
  sub,
  note,
  folders,
  counts,
  onPick,
  subRef,
}: {
  sub: ReturnType<typeof useSubmenu>;
  note: Note;
  folders: Folder[];
  counts: Record<string, number>;
  onPick: (folderId: string | null) => void;
  /** Ref на DOM-элемент портала — для «клик вне» родительского меню. */
  subRef?: React.Ref<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { anchor } = sub;

  useEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const el = ref.current;
      const w = el?.offsetWidth ?? 240;
      const h = el?.offsetHeight ?? 0;
      // Справа от строки с зазором, если не влезает — слева
      let left = r.right + 12;
      if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 12);
      let top = r.top;
      if (h > 0) top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      setPos(prev => (prev?.top === top && prev?.left === left ? prev : { top, left }));
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

  if (!anchor) return null;
  return createPortal(
    <div
      ref={node => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof subRef === 'function') subRef(node);
        else if (subRef) (subRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="liquid-glass fixed z-[140] w-60 rounded-2xl p-1.5 shadow-xl animate-scale-in"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      role="menu"
      aria-label="Выбрать папку"
      onMouseEnter={sub.cancelSubClose}
      onMouseLeave={sub.scheduleSubClose}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <FolderPickRows note={note} folders={folders} counts={counts} onPick={onPick} />
    </div>,
    document.body
  );
}

export function NoteCard({
  note,
  onClick,
  variant = 'default',
  isDropTarget = false,
  isDragging = false,
  onPin,
  onFavorite,
  onArchive,
  onDuplicate,
  onDelete,
  onPickFolder,
  onRename,
  folders = [],
  folderCounts = {},
}: NoteCardProps) {
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const ctxSub = useSubmenu();
  const ctxRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  // Инлайн-переименование названия (ПКМ → Переименовать или клик по имени)
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title);
  // Escape ставит флаг <отменить>, чтобы поздний blur не закоммитил
  const skipRenameRef = useRef(false);

  useEffect(() => {
    setDraftTitle(note.title);
  }, [note.title]);

  const closeCtx = useCallback(() => {
    setCtx(null);
    ctxSub.closeSub();
  }, [ctxSub]);

  useEffect(() => {
    if (!ctx) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      // Подменю папок живёт в ОТДЕЛЬНОМ портале (FolderSubmenu) — клик по нему
      // не содержится в ctxRef. Проверяем оба контейнера, иначе клик по краю
      // подменю закрывал бы его до click по пункту.
      if (ctxRef.current?.contains(target)) return;
      if (subRef.current?.contains(target)) return;
      closeCtx();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCtx();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctx, closeCtx]);

  const pickFolder = (folderId: string | null) => {
    onPickFolder?.(note, folderId);
  };

  const startRename = () => {
    skipRenameRef.current = false;
    setDraftTitle(note.title);
    setRenaming(true);
  };

  const finishRename = () => {
    setRenaming(false);
    const t = draftTitle.trim();
    if (t && t !== note.title) onRename?.(note, t);
  };

  const renderMenuItems = (controls: {
    toggleSub: (anchor: HTMLElement) => void;
    scheduleSubClose: () => void;
  }) => (
    <>
      <DropdownMenuItem onClick={() => onClick()}>
        <Edit className="w-4 h-4 mr-1" />
        Открыть
      </DropdownMenuItem>
      <DropdownMenuItem onClick={startRename}>
        <Pencil className="w-4 h-4 mr-1" />
        Переименовать
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDuplicate?.(note)}>
        <Copy className="w-4 h-4 mr-1" />
        Дублировать
      </DropdownMenuItem>
      <DropdownMenuItem
        onMouseLeave={() => controls.scheduleSubClose()}
        onClick={e => {
          // Подменю живёт в отдельном портале: клик не должен закрывать
          // главное меню (его контейнер закрывается в bubble-фазе).
          e.stopPropagation();
          controls.toggleSub(e.currentTarget);
        }}
      >
        <FolderInput className="w-4 h-4 mr-1" />
        Переместить в папку…
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onPin?.(note)}>
        <Pin className="w-4 h-4 mr-1" />
        {note.is_pinned ? 'Открепить' : 'Закрепить'}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onFavorite?.(note)}>
        <Star className="w-4 h-4 mr-1" />
        {note.is_favorite ? 'Убрать из избранного' : 'В избранное'}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onArchive?.(note)}>
        <Archive className="w-4 h-4 mr-1" />
        {note.is_archived ? 'Разархивировать' : 'В архив'}
      </DropdownMenuItem>
      {note.tags && note.tags.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <div className="px-3.5 py-2 text-xs font-semibold text-muted-foreground">
            Теги — перетащите заметку на другую, чтобы создать папку
          </div>
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
            {note.tags.map(tag => (
              <span key={tag.id} className="badge badge-outline text-[11px]">
                <Tag className="w-3 h-3" />
                {tag.name}
              </span>
            ))}
          </div>
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="!text-[hsl(var(--destructive))]"
        onClick={() => onDelete?.(note)}
      >
        <Trash2 className="w-4 h-4 mr-1" />
        Удалить
      </DropdownMenuItem>
    </>
  );

  return (
    <div
      className={cn('note-object group', variant === 'ghost' && 'opacity-60')}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      role="button"
      aria-label={note.title}
      data-drop-target={isDropTarget ? 'true' : undefined}
      data-dragging={isDragging ? 'true' : undefined}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        setCtx({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Несколько листиков: верхний при наведении перелистывается */}
      <span className="page-illus" aria-hidden="true">
        <span className="page-sheet page-sheet-3" />
        <span className="page-sheet page-sheet-2" />
        <span className="page-sheet page-sheet-1">
          <span className="page-title-line" />
          <span className="page-lines" />
          <span className="page-fold" />
        </span>
      </span>

      {/* Подпись строго по центру под иконкой: только название.
          Меню действий открывается правым кликом (см. onContextMenu выше). */}
      <span className="note-object-caption">
        {note.is_pinned && (
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-label="Закреплена" />
        )}
        {note.is_favorite && (
          <Star
            className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current opacity-70"
            aria-label="В избранном"
          />
        )}
        {renaming ? (
          <input
            className="object-name-input"
            value={draftTitle}
            autoFocus
            onChange={e => setDraftTitle(e.target.value)}
            onFocus={e => e.target.select()}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                finishRename();
                // blur при размонтировании не должен коммитить повторно
                skipRenameRef.current = true;
              } else if (e.key === 'Escape') {
                e.preventDefault();
                skipRenameRef.current = true;
                setRenaming(false);
              }
            }}
            onBlur={() => {
              if (skipRenameRef.current) {
                skipRenameRef.current = false;
                return;
              }
              finishRename();
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            aria-label="Название заметки"
          />
        ) : (
          <span className="note-object-name line-clamp-2">{note.title}</span>
        )}
      </span>

      {/* ПКМ-меню: те же действия, что и в «…» (п.10) */}
      {ctx &&
        createPortal(
          <div
            ref={ctxRef}
            className="liquid-glass fixed z-[100] w-60 rounded-2xl p-1.5 shadow-xl animate-scale-in"
            style={{
              left: Math.min(ctx.x, window.innerWidth - 250),
              top: Math.min(ctx.y, window.innerHeight - 320),
            }}
            role="menu"
            onClick={e => {
              // Портал внутри NoteCard: по фиберам клик «всплывает» до onClick
              // карточки (навигация в редактор). Стоп после действия пункта.
              e.stopPropagation();
              closeCtx();
            }}
          >
            {renderMenuItems({
              toggleSub: ctxSub.toggleSub,
              scheduleSubClose: ctxSub.scheduleSubClose,
            })}
          </div>,
          document.body
        )}
      <FolderSubmenu
        sub={ctxSub}
        note={note}
        folders={folders}
        counts={folderCounts}
        subRef={subRef}
        onPick={id => {
          pickFolder(id);
          closeCtx();
        }}
      />
    </div>
  );
}
