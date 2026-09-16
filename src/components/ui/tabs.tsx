'use client'

import { cn } from '@/utils/cn'
import { forwardRef, createContext, useContext } from 'react'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  return useContext(TabsContext)
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
  defaultValue?: string
  orientation?: 'horizontal' | 'vertical'
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, children, value, onValueChange, defaultValue: _defaultValue, orientation: _orientation = 'horizontal', ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={cn('space-y-4', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

export const TabsList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn('inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground', className)}
      {...props}
    >
      {children}
    </div>
  )
)
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, children, onClick, ...props }, ref) => {
    const ctx = useTabsContext()
    const isActive = ctx ? ctx.value === value : false
    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
          className
        )}
        data-state={isActive ? 'active' : 'inactive'}
        aria-selected={isActive}
        onClick={(e) => {
          onClick?.(e)
          if (!disabled) ctx?.onValueChange(value)
        }}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = useTabsContext()
    // If inside a Tabs provider, only render the active panel; otherwise render always (uncontrolled usage)
    if (ctx && ctx.value !== value) {
      return null
    }
    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
        data-state={ctx && ctx.value === value ? 'active' : 'inactive'}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = 'TabsContent'
