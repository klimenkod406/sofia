'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal,
  Pin,
  Archive,
  Star,
  Trash2,
  Edit,
  Copy,
  Tag,
  Clock,
  FolderInput,
} from 'lucide-react';
import { cn, formatRelativeTime, truncate } from '@/utils/cn';
import { Note } from '@/stores/notes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  onMoveToFolder?: (note: Note) => void;
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
  onMoveToFolder,
}: NoteCardProps) {
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx) return;
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtx(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtx(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctx]);

  const menuItems = (
    <>
      <DropdownMenuItem onClick={() => onClick()}>
        <Edit className="w-4 h-4 mr-1" />
        Открыть
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDuplicate?.(note)}>
        <Copy className="w-4 h-4 mr-1" />
        Дублировать
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMoveToFolder?.(note)}>
        <FolderInput className="w-4 h-4 mr-1" />
        Переместить в папку
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
    <article
      className={cn('note-card group', variant === 'ghost' && 'opacity-70 hover:opacity-100')}
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
      title="Потяните, чтобы переместить · отпустите на другой заметке, чтобы создать папку"
    >
      {note.cover_image && (
        <div className="note-card-cover relative">
          <img
            src={note.cover_image}
            alt=""
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}
      {note.cover_color && !note.cover_image && (
        <div className="note-card-cover" style={{ backgroundColor: note.cover_color }} />
      )}

      <div className="note-card-content">
        <div className="flex items-start justify-between gap-3">
          <h3 className="note-card-title flex-1 min-w-0">{note.title}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {note.is_pinned && <Pin className="w-3.5 h-3.5 opacity-60" aria-label="Закреплена" />}
            {note.is_favorite && (
              <Star className="w-3.5 h-3.5 opacity-70 fill-current" aria-label="В избранном" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!h-8 !w-8 !rounded-xl opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    aria-label="Меню заметки"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {menuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="note-card-excerpt">{truncate(note.content_md || note.content || '', 120)}</p>

        <div className="note-card-meta">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(note.updated_at)}
          </span>
          <span>
            {note.word_count} слов · {note.reading_time} мин
          </span>
        </div>
      </div>

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
            onClickCapture={() => setCtx(null)}
          >
            {menuItems}
          </div>,
          document.body
        )}
    </article>
  );
}
