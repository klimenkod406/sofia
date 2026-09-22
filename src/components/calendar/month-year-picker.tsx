'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

const MONTHS_SHORT = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

interface MonthYearPickerProps {
  value: Date;
  onSelect: (date: Date) => void;
}

/** Быстрое переключение месяца и года: кнопка с текущим месяцем в шапке. */
export function MonthYearPicker({ value, onSelect }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value.getFullYear());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current;
      const el = panelRef.current;
      if (!t || !el) return;
      const r = t.getBoundingClientRect();
      const w = el.offsetWidth || 280;
      const h = el.offsetHeight || 300;
      let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      setPos(prev => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    };
    place();
    const raf = requestAnimationFrame(place);
    const onDocClick = (e: MouseEvent) => {
      const node = e.target as Node;
      if (triggerRef.current?.contains(node) || panelRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const now = new Date();
  const selectedMonth = value.getMonth();
  const selectedYear = value.getFullYear();

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => {
          setYear(value.getFullYear());
          setOpen(o => !o);
        }}
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Быстро сменить месяц и год"
        aria-expanded={open}
      >
        <CalendarRange className="h-4 w-4" />
        {value.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
        <ChevronDown
          className={cn('h-3.5 w-3.5 opacity-60 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="liquid-glass fixed z-[130] w-72 rounded-2xl p-3 shadow-xl animate-scale-in"
            style={pos ?? { visibility: 'hidden' }}
          >
            {/* Год */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setYear(y => y - 1)}
                className="rounded-lg p-1.5 transition-colors hover:bg-accent"
                title="Прошлый год"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{year}</span>
                {year !== now.getFullYear() && (
                  <button
                    onClick={() => setYear(now.getFullYear())}
                    className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    сейчас
                  </button>
                )}
              </div>
              <button
                onClick={() => setYear(y => y + 1)}
                className="rounded-lg p-1.5 transition-colors hover:bg-accent"
                title="Следующий год"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Месяцы */}
            <div className="grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((m, i) => {
                const isSelected = i === selectedMonth && year === selectedYear;
                const isCurrentMonth = i === now.getMonth() && year === now.getFullYear();
                return (
                  <button
                    key={m}
                    onClick={() => {
                      onSelect(new Date(year, i, 1));
                      setOpen(false);
                    }}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-sm transition-colors',
                      isSelected
                        ? 'bg-primary font-medium text-primary-foreground'
                        : 'hover:bg-accent',
                      !isSelected && isCurrentMonth && 'font-medium text-primary'
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
