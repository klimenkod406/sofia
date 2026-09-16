'use client';

import { cn } from '@/utils/cn';
import { forwardRef, useEffect, useRef, useState, createContext, useContext } from 'react';

// Лёгкое dropdown-меню на жидком стекле: круглые углы, воздушные отступы.
const OpenContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ className, children, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;
      const onDocClick = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onKey);
      };
    }, [open]);

    return (
      <OpenContext.Provider value={{ open, setOpen }}>
        <div
          ref={node => {
            (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className={cn('relative inline-block', className)}
          {...props}
        >
          {children}
        </div>
      </OpenContext.Provider>
    );
  }
);
DropdownMenu.displayName = 'DropdownMenu';

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, onClick, ...props }, ref) => {
  const { open, setOpen } = useContext(OpenContext);
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpen(!open);
    onClick?.(e);
  };
  if (asChild) {
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn('inline-flex', className)}
        onClick={e => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      ref={ref}
      className={cn('', className)}
      onClick={toggle}
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' }
>(({ className, align = 'end', children, ...props }, ref) => {
  const { open, setOpen } = useContext(OpenContext);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        'liquid-glass absolute z-50 min-w-[220px] rounded-2xl p-1.5 shadow-xl animate-scale-in',
        align === 'end' ? 'right-0' : 'left-0',
        'top-[calc(100%+8px)]',
        className
      )}
      onClick={e => {
        e.stopPropagation();
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </div>
  );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }
>(({ className, onSelect, children, onClick, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm hover:bg-accent/70 transition-all duration-200 text-left',
      className
    )}
    onClick={e => {
      e.stopPropagation();
      onSelect?.();
      onClick?.(e);
    }}
    {...props}
  >
    {children}
  </button>
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuSeparator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mx-2 my-1.5 h-px bg-border/70', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export const DropdownMenuLabel = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground',
        className
      )}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';
