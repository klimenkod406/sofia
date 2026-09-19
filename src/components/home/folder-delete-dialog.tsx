'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Folder as FolderIcon, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type FolderDeleteMode = 'keep-notes' | 'with-notes';

interface FolderDeleteDialogProps {
  folderName: string;
  noteCount: number;
  onCancel: () => void;
  onConfirm: (mode: FolderDeleteMode) => void;
}

function pluralNotes(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'заметка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'заметки';
  return 'заметок';
}

/** Подтверждение удаления папки с выбором судьбы заметок внутри. */
export function FolderDeleteDialog({
  folderName,
  noteCount,
  onCancel,
  onConfirm,
}: FolderDeleteDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="liquid-glass w-full max-w-sm space-y-4 rounded-3xl p-6"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Удалить папку ${folderName}`}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'hsl(var(--destructive) / 0.16)' }}
          >
            <FolderIcon className="h-5 w-5 text-destructive" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold">Удалить «{folderName}»?</h3>
            <p className="text-sm text-muted-foreground">
              Внутри: {noteCount} {pluralNotes(noteCount)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => onConfirm('keep-notes')}
            className="w-full justify-start gap-2"
          >
            <Undo2 className="h-4 w-4" />
            Только папку — заметки вернутся на главную
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm('with-notes')}
            className="w-full justify-start gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Папку вместе с заметками
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full">
            Отмена
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
