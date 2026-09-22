'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { cn, formatDate, formatTime } from '@/utils/cn';
import type { Event } from '@/types';
import type { Note } from '@/stores/notes';
import type { NoteReminder } from '@/stores/reminders';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildActivityIndex, dayKey, startOfDay, type DayActivity } from '@/utils/calendar-utils';

interface CalendarSidebarProps {
  currentDate: Date;
  events: Event[];
  notes: Note[];
  reminders: NoteReminder[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onOpenNote: (noteId: string) => void;
  onToggleReminder: (id: string) => void;
  onRemoveReminder: (id: string) => void;
}

export function CalendarSidebar({
  currentDate,
  events,
  notes,
  reminders,
  onDateSelect,
  onEventClick,
  onOpenNote,
  onToggleReminder,
  onRemoveReminder,
}: CalendarSidebarProps) {
  const [showReminders, setShowReminders] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  // «Сейчас» для просрочки: обновляется раз в 30 секунд ЛОКАЛЬНО, чтобы
  // страница целиком не перерендеривалась по тику (раньше тик жил в ней).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);

  const activityIndex = useMemo(() => buildActivityIndex(notes), [notes]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter(e => new Date(e.start_time) >= today && !e.is_completed)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 10),
    [events, today]
  );

  const sortedReminders = useMemo(
    () =>
      [...reminders].sort(
        (a, b) => new Date(a.trigger_at).getTime() - new Date(b.trigger_at).getTime()
      ),
    [reminders]
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Mini calendar */}
      <div className="border-b p-4">
        <div className="mb-3 flex items-center justify-between">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">
            {currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <MiniCalendar
          currentDate={currentDate}
          activityIndex={activityIndex}
          reminders={reminders}
          onDateSelect={onDateSelect}
        />
        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> создано
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> изменено
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> напоминание
          </span>
        </div>
      </div>

      {/* Reminders */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b p-4 pb-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Bell className="h-4 w-4 text-red-500" />
            Напоминания
            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
              {sortedReminders.length}
            </span>
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowReminders(!showReminders)}
            className="h-6 w-6"
          >
            {showReminders ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {showReminders && (
          <ScrollArea className="max-h-56">
            {sortedReminders.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-6 w-6 opacity-40" />
                Напоминаний нет
              </div>
            ) : (
              <div className="space-y-1.5 p-3">
                {sortedReminders.map(reminder => {
                  const overdue = !reminder.done && new Date(reminder.trigger_at).getTime() <= now;
                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'group rounded-lg border p-2.5 transition-colors',
                        reminder.done
                          ? 'border-border/40 opacity-60'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => onOpenNote(reminder.note_id)}
                          title="Открыть заметку"
                        >
                          <p
                            className={cn(
                              'truncate text-sm font-medium',
                              reminder.done && 'line-through'
                            )}
                          >
                            {reminder.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDate(reminder.trigger_at, {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            · {formatTime(reminder.trigger_at)}
                            {overdue && <span className="text-red-500"> · просрочено</span>}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            title={reminder.done ? 'Вернуть' : 'Отметить выполненным'}
                            className={cn(
                              'rounded-md p-1 transition-colors',
                              reminder.done
                                ? 'text-primary'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                            onClick={() => onToggleReminder(reminder.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Удалить"
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-red-500"
                            onClick={() => onRemoveReminder(reminder.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      {/* Upcoming events */}
      <div className="flex flex-col border-t">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="font-semibold">Ближайшие события</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowEvents(!showEvents)}
            className="h-6 w-6"
          >
            {showEvents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        {showEvents && (
          <ScrollArea className="max-h-56">
            {upcomingEvents.length === 0 ? (
              <div className="px-4 pb-6 text-center text-sm text-muted-foreground">
                <CalendarIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
                Событий нет
              </div>
            ) : (
              <div className="space-y-2 p-3 pt-0">
                {upcomingEvents.map(event => (
                  <div
                    key={event.id}
                    className="cursor-pointer rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
                    onClick={() => onEventClick(event)}
                    style={{ borderLeft: `3px solid ${event.color || 'hsl(var(--primary))'}` }}
                  >
                    <h4 className="truncate font-medium">{event.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(event.start_time, {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {formatTime(event.start_time)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function MiniCalendar({
  currentDate,
  activityIndex,
  reminders,
  onDateSelect,
}: {
  currentDate: Date;
  activityIndex: Map<string, DayActivity>;
  reminders: NoteReminder[];
  onDateSelect: (date: Date) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = startOfDay(first);
    start.setDate(start.getDate() - start.getDay());
    const rows: { date: Date; inMonth: boolean }[][] = [];
    let cursor = new Date(start);
    while (cursor <= last) {
      const row: { date: Date; inMonth: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        row.push({
          date: new Date(cursor),
          inMonth: cursor.getMonth() === month && cursor.getFullYear() === year,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [year, month]);

  const today = startOfDay(new Date());

  return (
    <div className="grid grid-cols-7 gap-y-1 text-center">
      {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((d, idx) => (
        <div
          key={`weekday-${idx}`}
          className="py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {d}
        </div>
      ))}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="contents">
          {week.map(({ date, inMonth }) => {
            const key = dayKey(date);
            const activity = activityIndex.get(key);
            const hasReminder = reminders.some(r => {
              if (r.done) return false;
              const t = new Date(r.trigger_at);
              return (
                t.getFullYear() === date.getFullYear() &&
                t.getMonth() === date.getMonth() &&
                t.getDate() === date.getDate()
              );
            });
            const isToday = date.getTime() === today.getTime();
            const isSelected = date.getTime() === startOfDay(currentDate).getTime();
            return (
              <button
                key={key}
                onClick={() => onDateSelect(date)}
                className={cn(
                  'relative mx-auto flex h-7 w-7 flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors',
                  !inMonth && 'text-muted-foreground/40',
                  isToday && 'bg-primary text-primary-foreground',
                  !isToday && isSelected && 'bg-accent text-foreground',
                  !isToday && !isSelected && 'hover:bg-accent/60'
                )}
              >
                {date.getDate()}
                {(activity || hasReminder) && (
                  <span className="absolute bottom-0.5 flex items-center gap-[3px]">
                    {activity && activity.created.length > 0 && (
                      <span className="h-1 w-1 rounded-full bg-teal-500" />
                    )}
                    {activity && activity.edited.length > 0 && (
                      <span className="h-1 w-1 rounded-full bg-amber-500" />
                    )}
                    {hasReminder && <span className="h-1 w-1 rounded-full bg-red-500" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
