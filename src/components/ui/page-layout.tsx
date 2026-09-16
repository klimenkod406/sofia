'use client'

import { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface PageLayoutProps {
  children: ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 pt-20">
        {children}
      </div>
    </div>
  )
}