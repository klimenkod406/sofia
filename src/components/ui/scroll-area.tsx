'use client'

import { cn } from '@/utils/cn'
import { forwardRef, useRef, useEffect } from 'react'

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      const element = scrollRef.current
      if (!element) return

      // Add scrollbar styling
      element.style.scrollbarWidth = 'thin'
      element.style.scrollbarColor = 'hsl(var(--muted-foreground) / 0.3) transparent'
    }, [])

    return (
      <div
        ref={(el) => {
          if (typeof ref === 'function') {
            ref(el)
          } else if (ref) {
            ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = el
          }
          scrollRef.current = el
        }}
        className={cn('flex h-full overflow-auto scrollbar-hide', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

export const ScrollBar = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: 'vertical' | 'horizontal' }>(
  ({ className, orientation = 'vertical', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex touch-none select-none transition-colors',
        orientation === 'vertical' ? 'h-full w-1.5' : 'h-1.5 w-full',
        className
      )}
      {...props}
    >
      <div className="relative flex-1 rounded-full bg-border" />
    </div>
  )
)
ScrollBar.displayName = 'ScrollBar'