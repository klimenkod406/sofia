'use client';

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  /** Максимальная ширина центральной колонки */
  width?: 'narrow' | 'default' | 'wide';
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
 */
export function PageLayout({ children, className, width = 'default' }: PageLayoutProps) {
  const location = useLocation();

  return (
    <div className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <div className="page-viewport min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* Шапка лежит поверх контента (fixed): стартовый отступ, чтобы
            первый экран не прятался под плашкой; при скролле лента свободно
            уходит под неё по центру и доходит до верха по бокам. */}
        <div className={cn('mx-auto w-full px-4 pb-16 pt-20 md:px-8 md:pt-24', widths[width])}>
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
