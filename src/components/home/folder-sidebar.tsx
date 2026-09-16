'use client';

import { LayoutGrid, Folder as FolderIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Folder as FolderType } from '@/stores/notes';

interface FolderDockProps {
  folders: FolderType[];
  currentFolderId: string | null;
  onSelect: (filter: { folderId: string | null }) => void;
  /** DnD: сброс заметки на чип папки перемещает её туда */
  onNoteDropOnFolder?: (folderId: string | null) => void;
  counts?: Record<string, number>;
}

/**
 * Горизонтальная центрированная лента папок (замена левого сайдбара).
 * Никакого «слева меню»: папки — чипы по центру над единым пространством.
 */
export function FolderDock({
  folders,
  currentFolderId,
  onSelect,
  onNoteDropOnFolder,
  counts,
}: FolderDockProps) {
  if (folders.length === 0) return null;

  const chip = (
    active: boolean,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    folderId: string | null,
    count?: number
  ) => (
    <button
      key={folderId ?? 'all'}
      onClick={onClick}
      className="folder-chip"
      data-active={active ? 'true' : 'false'}
      onDragOver={e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        onNoteDropOnFolder?.(folderId);
      }}
      aria-pressed={active}
    >
      {icon}
      <span className="max-w-[140px] truncate">{label}</span>
      {typeof count === 'number' && (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: 'hsl(var(--foreground) / 0.08)' }}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="folder-dock scrollbar-hide" role="tablist" aria-label="Папки">
      {chip(
        currentFolderId === null,
        'Все заметки',
        <LayoutGrid className="h-4 w-4 shrink-0" />,
        () => onSelect({ folderId: null }),
        null,
        counts?.__all
      )}
      {folders.map(f =>
        chip(
          currentFolderId === f.id,
          f.name,
          <FolderIcon className="h-4 w-4 shrink-0" style={{ color: f.color }} />,
          () => onSelect({ folderId: f.id }),
          f.id,
          counts?.[f.id]
        )
      )}
    </div>
  );
}

/** Хлебные крошки для открытой папки */
export function FolderCrumbs({ folder, onHome }: { folder: FolderType; onHome: () => void }) {
  return (
    <nav
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
      aria-label="Путь папки"
    >
      <button
        onClick={onHome}
        className="rounded-xl px-2.5 py-1.5 transition-colors hover:bg-accent/70 hover:text-foreground"
      >
        Все заметки
      </button>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className={cn('rounded-xl px-2.5 py-1.5 font-display font-bold text-foreground')}>
        {folder.name}
      </span>
    </nav>
  );
}

/**
 * @deprecated Левый сайдбар упразднён (центрированная архитектура).
 * Оставлен как алиас ленты, чтобы старые импорты не ломались.
 */
export function FolderSidebar(props: FolderDockProps) {
  return (
    <div className="flex flex-col gap-3">
      <FolderDock {...props} />
    </div>
  );
}
