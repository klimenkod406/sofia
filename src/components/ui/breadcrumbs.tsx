'use client';

import { ArrowLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

interface BreadcrumbsProps {
  /** Куда ведёт стрелка-возврат (клик по ней). */
  onBack?: () => void;
  /** Подпись родительского раздела (например «Все заметки» / «Главная»). */
  parentLabel: string;
  /** Текущий раздел — жирный, без клика. */
  current: string;
  className?: string;
}

/** Хлебные крошки в стиле страницы заметок: стрелка-возврат + родительский
 *  раздел, рядом — текущий раздел. Центрируются в потоке родителя. */
export function Breadcrumbs({ onBack, parentLabel, current, className }: BreadcrumbsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5 text-sm', className)}>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-muted-foreground transition-all duration-300 hover:bg-accent/70 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {parentLabel}
      </button>
      <span className="font-display font-bold">{current}</span>
    </div>
  );
}
