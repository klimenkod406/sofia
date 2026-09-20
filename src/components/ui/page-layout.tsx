'use client';

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  /** Максимальная ширина центральной колонки */
  width?: 'narrow' | 'default' | 'wide';
  /** Полноэкранный режим (редактор): контент сам управляет скроллом
      и занимает всю высоту под шапкой-оверлеем. */
  fill?: boolean;
}

const widths = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  /** Широкая сцена главной: рабочее пространство во всю ширину */
  wide: 'max-w-7xl',
};

/**
 * Центрированная сцена (п.2): никакого «слева меню — справа контент».
 * Контент всегда живёт в средней колонке по центру экрана.
 * Переключение страниц — отдаление с размытием и появление (п.3):
 * key по pathname перезапускает анимацию page-enter.
 *
 * fill=true — полноэкранная сцена без внешнего скролла (редактор заметки):
 * контент получает всю высоту под прозрачной шапкой и сам решает,
 * когда прокручиваться.
 */
export function PageLayout({ children, className, width = 'default', fill = false }: PageLayoutProps) {
  const location = useLocation();

  if (fill) {
    return (
      <div className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-[88px] print:pt-0">
          <div key={location.pathname} className="page-enter min-h-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <div className="page-viewport min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* Верхний отступ учитывает высоту шапки-оверлея (лого/кнопки ~48px
            + поиск на 40px ниже, ~40px) — контент начинается под ней и
            при скролле уходит под матовый поиск, а не обрезается. */}
        <div className={cn('mx-auto w-full px-4 pb-8 pt-28 md:px-8', widths[width])}>
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
