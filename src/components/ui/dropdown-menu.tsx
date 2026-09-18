'use client';
/* eslint-disable react-refresh/only-export-components */

import { cn } from '@/utils/cn';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';

// Лёгкое dropdown-меню на жидком стекле: круглые углы, воздушные отступы.
// Контент живёт в портале (document.body) и позиционируется от триггера —
// поэтому его не обрезают overflow:hidden ancestors (карточки и т.п.).
const OpenContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
  anchor: HTMLElement | null;
  setAnchor: (el: HTMLElement | null) => void;
}>({
  open: false,
  setOpen: () => {},
  anchor: null,
  setAnchor: () => {},
});

/** Доступ к состоянию меню изнутри (закрыть после выбора в подменю и т.п.). */
export function useDropdownMenu() {
  return useContext(OpenContext);
}

export interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ className, children, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
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
      <OpenContext.Provider value={{ open, setOpen, anchor, setAnchor }}>
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
  const { open, setOpen, setAnchor } = useContext(OpenContext);
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchor(e.currentTarget);
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
          setAnchor(e.currentTarget as unknown as HTMLElement);
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
  const { open, setOpen, anchor } = useContext(OpenContext);
  const innerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Позиция от якоря: справа/слева под триггером, с клампом к вьюпорту
  // и переворотом вверх, если внизу нет места
  useEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const el = innerRef.current;
      const w = el?.offsetWidth ?? 240;
      const h = el?.offsetHeight ?? 0;
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = r.bottom + 8;
      if (h > 0 && top + h > window.innerHeight - 8) {
        top = Math.max(8, r.top - h - 8);
      }
      setPos(prev => (prev?.top === top && prev?.left === left ? prev : { top, left }));
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, align, children]);

  if (!open) return null;
  return createPortal(
    <div
      ref={node => {
        (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={cn(
        'liquid-glass fixed z-[130] min-w-[220px] rounded-2xl p-1.5 shadow-xl animate-scale-in',
        className
      )}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      onMouseDown={e => {
        // Контент в портале (вне rootRef): не даём документному обработчику
        // закрыть меню до клика по пункту
        e.stopPropagation();
      }}
      onClick={e => {
        e.stopPropagation();
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </div>,
    document.body
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
