'use client'

import { cn } from '@/utils/cn'
import { forwardRef } from 'react'

// Simplified dropdown menu - in production use @radix-ui/react-dropdown-menu
export interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative inline-block', className)} {...props}>
      {children}
    </div>
  )
)
DropdownMenu.displayName = 'DropdownMenu'

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ className, children, asChild, ...props }, ref) => {
    if (asChild) {
      return <span ref={ref as React.Ref<HTMLSpanElement>} className={cn('inline-flex', className)}>{children}</span>
    }
    return (
      <button ref={ref} className={cn('', className)} {...props}>
        {children}
      </button>
    )
  }
)
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

export const DropdownMenuContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' }>(
  ({ className, align = 'end', children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 min-w-[200px] rounded-xl bg-popover text-popover-foreground shadow-lg border animate-scale-in',
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }>(
  ({ className, onSelect, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'flex w-full items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors',
        className
      )}
      onClick={(e) => { onSelect?.(); props.onClick?.(e) }}
      {...props}
    >
      {children}
    </button>
  )
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuSeparator = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('h-px bg-border my-1', className)} {...props} />
  )
)
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export const DropdownMenuLabel = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 py-2 text-sm font-semibold text-muted-foreground', className)} {...props} />
  )
)
DropdownMenuLabel.displayName = 'DropdownMenuLabel'