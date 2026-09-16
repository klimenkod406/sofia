'use client'

import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

interface PageLayoutProps {
  children: ReactNode
  className?: string
  /** Максимальная ширина центральной колонки */
  width?: 'narrow' | 'default' | 'wide'
}

const widths = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-6xl',
}

/**
 * Центрированная сцена (п.2): никакого «слева меню — справа контент».
 * Контент всегда живёт в средней колонке по центру экрана.
 * Переключение страниц — отдаление с размытием и появление (п.3):
 * key по pathname перезапускает анимацию page-enter.
 */
export function PageLayout({ children, className, width = 'default' }: PageLayoutProps) {
  const location = useLocation()

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="page-viewport flex-1 overflow-y-auto overflow-x-hidden">
        <div className={cn('mx-auto w-full px-4 pb-16 pt-8 md:px-8 md:pt-10', widths[width])}>
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
