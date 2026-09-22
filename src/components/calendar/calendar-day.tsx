'use client';

import { cn, formatTime } from '@/utils/cn';
import type { Event } from '@/types';
import type { NoteReminder } from '@/stores/reminders';
import type { DayActivity } from '@/utils/calendar-utils';

interface CalendarDayProps {
  date: Date;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: Event[];
  /** id событий, начавшихся раньше этого дня (продолжающихся) */
  continuedEvents: Set<string>;
  activity: DayActivity;
  reminders: NoteReminder[];
  onClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onCreateEvent: (date?: Date) => void;
}

function Dot({ className, title }: { className?: string; title: string }) {
  return <span title={title} className={cn('h-1.5 w-1.5 rounded-full', className)} />;
}

export function CalendarDay({
  date,
  day,
  inMonth,
  isToday,
  events,
  continuedEvents,
  activity,
  reminders,
  onClick,
  onEventClick,
  onCreateEvent,
}: CalendarDayProps) {
  const noteTitles = [
    ...activity.created.map(n => `Создано: ${n.title || 'Без названия'}`),
    ...activity.edited.map(n => `Изменено: ${n.title || 'Без названия'}`),
    ...reminders.map(r => `Напоминание: ${r.title}`),
  ].join('\n');

  return (
    <div
      title={noteTitles || undefined}
      className={cn(
        'calendar-day group',
        !inMonth && 'bg-muted/30 text-muted-foreground/40',
        isToday && 'ring-1 ring-inset ring-primary/40'
      )}
      onClick={() => onClick(date)}
      onDoubleClick={() => onCreateEvent(date)}
    >
      {/* Day number */}
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center text-sm font-medium tabular-nums',
          isToday && 'rounded-full bg-primary text-primary-foreground'
        )}
      >
        {day}
      </span>

      {/* Events: свои — с временем, чужие (начались раньше) — свёрткой */}
      <div className="mt-1 space-y-0.5 overflow-hidden">
        {events.slice(0, 2).map(event => (
          <div
            key={event.id}
            className="calendar-event"
            style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
            onClick={e => {
              e.stopPropagation();
              onEventClick(event);
            }}
          >
            {event.all_day || continuedEvents.has(event.id)
              ? event.title
              : `${formatTime(event.start_time)} ${event.title}`}
          </div>
        ))}
        {events.length > 2 && (
          <div className="px-1 text-[10px] text-muted-foreground">+{events.length - 2} ещё</div>
        )}
      </div>

      {/* Note activity + reminders */}
      {(activity.created.length > 0 || activity.edited.length > 0 || reminders.length > 0) && (
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          {activity.created.length > 0 && (
            <span
              title={`Создано заметок: ${activity.created.length}`}
              className="flex items-center gap-1 text-[10px] font-medium text-teal-500"
            >
              <Dot className="bg-teal-500" title="" />
              {activity.created.length}
            </span>
          )}
          {activity.edited.length > 0 && (
            <span
              title={`Изменено заметок: ${activity.edited.length}`}
              className="flex items-center gap-1 text-[10px] font-medium text-amber-500"
            >
              <Dot className="bg-amber-500" title="" />
              {activity.edited.length}
            </span>
          )}
          {reminders.length > 0 && (
            <span
              title={`Напоминаний: ${reminders.length}`}
              className="flex items-center gap-1 text-[10px] font-medium text-red-500"
            >
              <Dot className="bg-red-500" title="" />
              {reminders.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
