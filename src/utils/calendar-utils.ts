// Shared date/activity helpers for the calendar views.
import type { Note } from '@/stores/notes';

/** Pixel height of one hour in the week/day timeline. */
export const HOUR_HEIGHT = 56;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local date key: yyyy-mm-dd — used as the activity index key. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Local midnight of every day an event touches: start day … end day (inclusive). */
export function eventDays(start: Date, end: Date, capDays = 366): Date[] {
  const from = startOfDay(start);
  // end < start или невалидный end — событие всё равно должно показаться
  // хотя бы в день начала (иначе оно молча исчезает из календаря).
  const to = Number.isNaN(end.getTime()) || end < start ? from : startOfDay(end);
  const days: Date[] = [];
  for (let cursor = from, i = 0; cursor <= to && i < capDays; cursor = addDays(cursor, 1), i++) {
    days.push(cursor);
  }
  return days;
}

/** Sunday-based start of week (matches the calendar grid columns). */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** ISO-8601 week number (weeks start on Monday). */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export interface DayCell {
  date: Date;
  inMonth: boolean;
}

/** Full weeks covering the given month, Sunday-first. */
export function getMonthWeeks(year: number, month: number): DayCell[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks: DayCell[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= last) {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(cursor),
        inMonth: cursor.getFullYear() === year && cursor.getMonth() === month,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export interface DayActivity {
  created: Note[];
  edited: Note[];
}

export const EMPTY_ACTIVITY: DayActivity = { created: [], edited: [] };

/**
 * Index notes by the local day they were created / last edited on.
 * A note edited on the same day it was created counts as "created" only,
 * so a single day is never double-counted.
 */
export function buildActivityIndex(notes: Note[]): Map<string, DayActivity> {
  const index = new Map<string, DayActivity>();
  const push = (key: string, kind: 'created' | 'edited', note: Note) => {
    let entry = index.get(key);
    if (!entry) {
      entry = { created: [], edited: [] };
      index.set(key, entry);
    }
    entry[kind].push(note);
  };
  for (const note of notes) {
    if (note.is_deleted) continue;
    push(dayKey(new Date(note.created_at)), 'created', note);
    const edited = new Date(note.last_edited_at || note.updated_at);
    if (!sameDay(edited, new Date(note.created_at))) {
      push(dayKey(edited), 'edited', note);
    }
  }
  return index;
}

/** Notes created on this day in any previous year ("В этот день").
 *  Будущие годы исключаем: заметка, созданная «завтра», не должна
 *  подсвечиваться в прошлогодних датах. */
export function getOnThisDay(notes: Note[], date: Date): Note[] {
  const now = new Date();
  return notes
    .filter(note => {
      if (note.is_deleted) return false;
      const created = new Date(note.created_at);
      return (
        created.getMonth() === date.getMonth() &&
        created.getDate() === date.getDate() &&
        created.getFullYear() < now.getFullYear()
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
