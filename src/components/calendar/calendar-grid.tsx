'use client';

import { Children, useMemo, type ReactNode } from 'react';
import { Bell, Clock, History, Plus, Sparkles } from 'lucide-react';
import { CalendarDay } from './calendar-day';
import { cn, formatTime } from '@/utils/cn';
import type { Event } from '@/types';
import type { Note } from '@/stores/notes';
import type { NoteReminder } from '@/stores/reminders';
import {
  HOUR_HEIGHT,
  buildActivityIndex,
  dayKey,
  eventDays,
  getISOWeekNumber,
  getMonthWeeks,
  getOnThisDay,
  sameDay,
  startOfDay,
  startOfWeek,
  addDays,
  EMPTY_ACTIVITY,
  type DayActivity,
} from '@/utils/calendar-utils';

const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface CalendarGridProps {
  view: 'month' | 'week' | 'day';
  currentDate: Date;
  events: Event[];
  notes: Note[];
  reminders: NoteReminder[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onCreateEvent: (date?: Date) => void;
  onCreateReminder: (date: Date) => void;
  onOpenNote: (noteId: string) => void;
}

export function CalendarGrid({
  view,
  currentDate,
  events,
  notes,
  reminders,
  onDateClick,
  onEventClick,
  onCreateEvent,
  onCreateReminder,
  onOpenNote,
}: CalendarGridProps) {
  const activityIndex = useMemo(() => buildActivityIndex(notes), [notes]);

  // Событие попадает во ВСЕ дни, которые пересекает (23:00–01:00 видно
  // в обоих днях, мульти-дневное — на каждом своём дне).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const event of events) {
      const days = eventDays(new Date(event.start_time), new Date(event.end_time));
      for (const day of days) {
        const key = dayKey(day);
        const list = map.get(key);
        if (list) list.push(event);
        else map.set(key, [event]);
      }
    }
    return map;
  }, [events]);

  // Событие, начавшееся НЕ сегодня: уходит в «…continued»-свёртку
  // в month-виде и не рисуется с нулевой высотой в таймлайнах week/day.
  const continuedEvents = useMemo(() => {
    const ids = new Set<string>();
    for (const [key, list] of eventsByDay) {
      for (const event of list) {
        if (dayKey(new Date(event.start_time)) !== key) ids.add(event.id);
      }
    }
    return ids;
  }, [eventsByDay]);

  const remindersByDay = useMemo(() => {
    const map = new Map<string, NoteReminder[]>();
    for (const reminder of reminders) {
      const key = dayKey(new Date(reminder.trigger_at));
      const list = map.get(key);
      if (list) list.push(reminder);
      else map.set(key, [reminder]);
    }
    return map;
  }, [reminders]);

  if (view === 'month') {
    return (
      <CalendarMonthView
        currentDate={currentDate}
        eventsByDay={eventsByDay}
        continuedEvents={continuedEvents}
        remindersByDay={remindersByDay}
        activityIndex={activityIndex}
        onDateClick={onDateClick}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );
  }
  if (view === 'week') {
    return (
      <CalendarWeekView
        currentDate={currentDate}
        eventsByDay={eventsByDay}
        continuedEvents={continuedEvents}
        remindersByDay={remindersByDay}
        activityIndex={activityIndex}
        onDateClick={onDateClick}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );
  }
  return (
    <CalendarDayView
      currentDate={currentDate}
      eventsByDay={eventsByDay}
      continuedEvents={continuedEvents}
      remindersByDay={remindersByDay}
      activityIndex={activityIndex}
      notes={notes}
      onEventClick={onEventClick}
      onCreateEvent={onCreateEvent}
      onCreateReminder={onCreateReminder}
      onOpenNote={onOpenNote}
    />
  );
}

function activityFor(activityIndex: Map<string, DayActivity>, date: Date): DayActivity {
  return activityIndex.get(dayKey(date)) ?? EMPTY_ACTIVITY;
}

/* ---------------------------------- Month ---------------------------------- */

function CalendarMonthView({
  currentDate,
  eventsByDay,
  continuedEvents,
  remindersByDay,
  activityIndex,
  onDateClick,
  onEventClick,
  onCreateEvent,
}: {
  currentDate: Date;
  eventsByDay: Map<string, Event[]>;
  continuedEvents: Set<string>;
  remindersByDay: Map<string, NoteReminder[]>;
  activityIndex: Map<string, DayActivity>;
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onCreateEvent: (date?: Date) => void;
}) {
  const weeks = useMemo(
    () => getMonthWeeks(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );
  const today = useMemo(() => startOfDay(new Date()), []);

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="calendar-grid h-full min-w-[600px]">
        {/* Weekday header with week-number gutter */}
        <div className="grid grid-cols-[2.5rem_repeat(7,1fr)] border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          <div className="px-1 py-2 text-[10px] text-muted-foreground/60">Нед.</div>
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="px-1 py-2">
              {label}
            </div>
          ))}
        </div>

        {/* Weeks — equal rows filling the container, never growing the page */}
        <div className="grid min-h-0 flex-1 auto-rows-fr">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid min-h-0 grid-cols-[2.5rem_repeat(7,1fr)]">
              <div className="flex items-start justify-center border-b border-r border-border/60 pt-1 text-[10px] tabular-nums text-muted-foreground/70">
                {getISOWeekNumber(week[0].date)}
              </div>
              {week.map(cell => (
                <CalendarDay
                  key={cell.date.getTime()}
                  date={cell.date}
                  day={cell.date.getDate()}
                  inMonth={cell.inMonth}
                  isToday={sameDay(cell.date, today)}
                  events={eventsByDay.get(dayKey(cell.date)) ?? []}
                  continuedEvents={continuedEvents}
                  activity={activityFor(activityIndex, cell.date)}
                  reminders={remindersByDay.get(dayKey(cell.date)) ?? []}
                  onClick={onDateClick}
                  onEventClick={onEventClick}
                  onCreateEvent={onCreateEvent}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Week ---------------------------------- */

function CalendarWeekView({
  currentDate,
  eventsByDay,
  continuedEvents,
  remindersByDay,
  activityIndex,
  onDateClick,
  onEventClick,
  onCreateEvent,
}: {
  currentDate: Date;
  eventsByDay: Map<string, Event[]>;
  continuedEvents: Set<string>;
  remindersByDay: Map<string, NoteReminder[]>;
  activityIndex: Map<string, DayActivity>;
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onCreateEvent: (date?: Date) => void;
}) {
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const days = useMemo(() => HOURS.slice(0, 7).map(i => addDays(weekStart, i)), [weekStart]);
  const today = useMemo(() => startOfDay(new Date()), []);

  return (
    <div className="flex-1 min-h-0 overflow-hidden p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
        {/* Day headers — 7 flexible columns, never wider than the container */}
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b bg-muted/40 text-center">
          <div className="border-r border-border/60" />
          {days.map(date => {
            const isToday = sameDay(date, today);
            const activity = activityFor(activityIndex, date);
            const reminders = remindersByDay.get(dayKey(date)) ?? [];
            return (
              <button
                key={date.getTime()}
                onClick={() => onDateClick(date)}
                className={cn(
                  'min-w-0 border-l border-border/60 px-1 py-1.5 transition-colors hover:bg-accent/40',
                  isToday && 'bg-primary/10'
                )}
              >
                <div className="text-[11px] font-medium text-muted-foreground">
                  {date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                </div>
                <div className={cn('text-sm font-bold tabular-nums', isToday && 'text-primary')}>
                  {date.getDate()}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  {activity.created.length > 0 && (
                    <span
                      title={`Создано: ${activity.created.length}`}
                      className="h-1.5 w-1.5 rounded-full bg-teal-500"
                    />
                  )}
                  {activity.edited.length > 0 && (
                    <span
                      title={`Изменено: ${activity.edited.length}`}
                      className="h-1.5 w-1.5 rounded-full bg-amber-500"
                    />
                  )}
                  {reminders.length > 0 && (
                    <span
                      title={`Напоминаний: ${reminders.length}`}
                      className="h-1.5 w-1.5 rounded-full bg-red-500"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Timeline — scrolls inside the container */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="grid grid-cols-[3.5rem_repeat(7,1fr)]"
            style={{ height: 24 * HOUR_HEIGHT }}
          >
            <div className="relative border-r border-border/60">
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute right-1 text-[10px] tabular-nums text-muted-foreground"
                  style={{ top: h * HOUR_HEIGHT - 6 }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map(date => (
              <WeekDayColumn
                key={date.getTime()}
                date={date}
                events={(eventsByDay.get(dayKey(date)) ?? []).filter(
                  e => !continuedEvents.has(e.id)
                )}
                onEventClick={onEventClick}
                onCreateEvent={onCreateEvent}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekDayColumn({
  date,
  events,
  onEventClick,
  onCreateEvent,
}: {
  date: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  onCreateEvent: (date?: Date) => void;
}) {
  return (
    <div className="relative min-w-0 border-l border-border/60 group">
      {HOURS.map(h => (
        <div
          key={h}
          className="absolute inset-x-0 border-b border-border/40"
          style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          onDoubleClick={() =>
            onCreateEvent(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h))
          }
        />
      ))}
      {events.map(event => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const top = ((start.getHours() * 60 + start.getMinutes()) / 60) * HOUR_HEIGHT;
        const height = Math.max(((end.getTime() - start.getTime()) / 60000 / 60) * HOUR_HEIGHT, 20);
        return (
          <div
            key={event.id}
            className="absolute inset-x-0.5 z-10 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ top, height, backgroundColor: event.color || 'hsl(var(--primary))' }}
            onClick={e => {
              e.stopPropagation();
              onEventClick(event);
            }}
          >
            {formatTime(start)} {event.title}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------- Day ----------------------------------- */

function CalendarDayView({
  currentDate,
  eventsByDay,
  continuedEvents,
  remindersByDay,
  activityIndex,
  notes,
  onEventClick,
  onCreateEvent,
  onCreateReminder,
  onOpenNote,
}: {
  currentDate: Date;
  eventsByDay: Map<string, Event[]>;
  continuedEvents: Set<string>;
  remindersByDay: Map<string, NoteReminder[]>;
  activityIndex: Map<string, DayActivity>;
  notes: Note[];
  onEventClick: (event: Event) => void;
  onCreateEvent: (date?: Date) => void;
  onCreateReminder: (date: Date) => void;
  onOpenNote: (noteId: string) => void;
}) {
  const key = dayKey(currentDate);
  // slice() перед sort(): sort мутирует массив, а eventsByDay — общий кэш.
  const dayEvents = useMemo(
    () =>
      (eventsByDay.get(key) ?? [])
        .slice()
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .filter(e => !continuedEvents.has(e.id)),
    [eventsByDay, continuedEvents, key]
  );
  const continuedCount = useMemo(
    () => (eventsByDay.get(key) ?? []).length - dayEvents.length,
    [eventsByDay, key, dayEvents.length]
  );
  const activity = activityFor(activityIndex, currentDate);
  const reminders = useMemo(
    () =>
      (remindersByDay.get(key) ?? [])
        .slice()
        .sort((a, b) => a.trigger_at.localeCompare(b.trigger_at)),
    [remindersByDay, key]
  );
  const onThisDay = useMemo(() => getOnThisDay(notes, currentDate), [notes, currentDate]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden p-4">
      <div className="grid h-full min-h-0 gap-4 overflow-hidden lg:grid-cols-[1fr_340px]">
        {/* Timeline */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                {currentDate.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => onCreateEvent(currentDate)}
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                Событие
              </button>
              <button
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => onCreateReminder(currentDate)}
              >
                <Bell className="mr-1 inline h-3.5 w-3.5" />
                Напоминание
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-[3.5rem_1fr]" style={{ height: 24 * HOUR_HEIGHT }}>
              <div className="relative border-r border-border/60">
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute right-1 text-[10px] tabular-nums text-muted-foreground"
                    style={{ top: h * HOUR_HEIGHT - 6 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              <div className="relative min-w-0">
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-b border-border/40"
                    style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    onDoubleClick={() =>
                      onCreateEvent(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          currentDate.getDate(),
                          h
                        )
                      )
                    }
                  />
                ))}
                {dayEvents.map(event => {
                  const start = new Date(event.start_time);
                  const end = new Date(event.end_time);
                  const top = ((start.getHours() * 60 + start.getMinutes()) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    ((end.getTime() - start.getTime()) / 60000 / 60) * HOUR_HEIGHT,
                    20
                  );
                  return (
                    <div
                      key={event.id}
                      className="absolute inset-x-1 z-10 cursor-pointer truncate rounded-md px-2 py-1 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                      style={{ top, height, backgroundColor: event.color || 'hsl(var(--primary))' }}
                      onClick={() => onEventClick(event)}
                    >
                      {formatTime(start)} {event.title}
                    </div>
                  );
                })}
                {dayEvents.length === 0 && continuedCount === 0 && (
                  <div className="absolute inset-x-4 top-6 text-sm text-muted-foreground">
                    Нет событий — двойной клик по времени создаст новое.
                  </div>
                )}
                {continuedCount > 0 && (
                  <div className="absolute inset-x-4 top-6 text-xs text-muted-foreground">
                    +{continuedCount} продолжающихся {continuedCount === 1 ? 'событие' : 'события'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Activity panel */}
        <aside className="min-h-0 space-y-4 overflow-y-auto pb-2">
          <ActivityCard
            icon={<Sparkles className="h-4 w-4 text-teal-500" />}
            title="Созданные заметки"
            empty="В этот день заметки не создавались"
          >
            {activity.created.map(note => (
              <NoteActivityRow
                key={note.id}
                note={note}
                when={`создана в ${formatTime(note.created_at)}`}
                onOpen={onOpenNote}
              />
            ))}
          </ActivityCard>

          <ActivityCard
            icon={<History className="h-4 w-4 text-amber-500" />}
            title="Изменённые заметки"
            empty="В этот день заметки не редактировались"
          >
            {activity.edited.map(note => (
              <NoteActivityRow
                key={note.id}
                note={note}
                when={`изменена в ${formatTime(note.last_edited_at || note.updated_at)}`}
                onOpen={onOpenNote}
              />
            ))}
          </ActivityCard>

          <ActivityCard
            icon={<Bell className="h-4 w-4 text-red-500" />}
            title="Напоминания"
            empty="Напоминаний на этот день нет"
          >
            {reminders.map(reminder => (
              <ReminderRow key={reminder.id} reminder={reminder} onOpen={onOpenNote} />
            ))}
          </ActivityCard>

          {onThisDay.length > 0 && (
            <ActivityCard
              icon={<Clock className="h-4 w-4 text-primary" />}
              title={`В этот день в прошлом (${onThisDay.length})`}
              empty=""
            >
              {onThisDay.map(note => {
                const created = new Date(note.created_at);
                return (
                  <NoteActivityRow
                    key={note.id}
                    note={note}
                    when={`${created.getFullYear()} год`}
                    onOpen={onOpenNote}
                  />
                );
              })}
            </ActivityCard>
          )}

          <div className="rounded-xl border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-medium">
              <Clock className="h-3.5 w-3.5" />
              Навигация
            </div>
            <p>
              <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">M</kbd> месяц
              · <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">W</kbd>{' '}
              неделя ·{' '}
              <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">D</kbd> день
              · <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">T</kbd>{' '}
              сегодня
            </p>
            <p className="mt-1">
              <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">←</kbd>{' '}
              <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">→</kbd>{' '}
              навигация
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActivityCard({
  icon,
  title,
  empty,
  children,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {Children.count(children) === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

function NoteActivityRow({
  note,
  when,
  onOpen,
}: {
  note: Note;
  when: string;
  onOpen: (noteId: string) => void;
}) {
  return (
    <button
      onClick={() => onOpen(note.id)}
      className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
    >
      <span className="truncate text-sm font-medium">{note.title || 'Без названия'}</span>
      <span className="text-[11px] text-muted-foreground">{when}</span>
    </button>
  );
}

function ReminderRow({
  reminder,
  onOpen,
}: {
  reminder: NoteReminder;
  onOpen: (noteId: string) => void;
}) {
  // Подсвечиваем только НЕвыполненные просроченные (как в sidebar).
  const overdue = !reminder.done && new Date(reminder.trigger_at) <= new Date();
  return (
    <button
      onClick={() => onOpen(reminder.note_id)}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60',
        overdue && 'bg-red-500/10'
      )}
    >
      <span className="truncate text-sm font-medium">{reminder.title}</span>
      <span className="text-[11px] text-muted-foreground">
        {formatTime(reminder.trigger_at)}
        {overdue && ' · просрочено'}
      </span>
    </button>
  );
}
