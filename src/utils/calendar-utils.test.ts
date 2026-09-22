import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  sameDay,
  dayKey,
  addDays,
  startOfWeek,
  getISOWeekNumber,
  getMonthWeeks,
  buildActivityIndex,
  getOnThisDay,
} from './calendar-utils';
import type { Note } from '@/stores/notes';

function makeNote(overrides: Partial<Note>): Note {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'note-1',
    folder_id: null,
    title: overrides.title ?? 'Заметка',
    content: '',
    content_md: '',
    content_html: '',
    excerpt: '',
    word_count: 0,
    char_count: 0,
    reading_time: 0,
    is_pinned: false,
    is_archived: false,
    is_deleted: false,
    is_favorite: false,
    cover_image: null,
    cover_color: null,
    template_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    last_edited_at: now,
    ...overrides,
  };
}

describe('startOfDay / sameDay / dayKey', () => {
  it('zeroes the time part', () => {
    const d = startOfDay(new Date(2026, 8, 21, 14, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('compares days only', () => {
    expect(sameDay(new Date(2026, 8, 21, 1), new Date(2026, 8, 21, 23))).toBe(true);
    expect(sameDay(new Date(2026, 8, 21), new Date(2026, 8, 22))).toBe(false);
  });

  it('produces zero-padded local keys', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds days across month boundaries', () => {
    expect(dayKey(addDays(new Date(2026, 8, 30), 2))).toBe('2026-10-02');
  });
});

describe('startOfWeek', () => {
  it('returns the preceding Sunday', () => {
    const sunday = startOfWeek(new Date(2026, 8, 24)); // четверг
    expect(sunday.getDay()).toBe(0);
    expect(sunday.getDate()).toBe(20);
  });
});

describe('getISOWeekNumber', () => {
  it('computes ISO week numbers', () => {
    // 2026-09-21 (понедельник) — ISO неделя 39
    expect(getISOWeekNumber(new Date(2026, 8, 21))).toBe(39);
    // Первые дни января 2021 относятся к 53-й неделе 2020
    expect(getISOWeekNumber(new Date(2021, 0, 1))).toBe(53);
  });
});

describe('getMonthWeeks', () => {
  it('covers the whole month with Sunday-first weeks', () => {
    // Сентябрь 2026 начинается со вторника
    const weeks = getMonthWeeks(2026, 8);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(6);
    expect(weeks[0][0].date.getDay()).toBe(0);
    const days = weeks.flat();
    const hasFirst = days.some(c => c.date.getDate() === 1 && c.inMonth);
    const hasLast = days.some(c => c.date.getDate() === 30 && c.inMonth);
    expect(hasFirst).toBe(true);
    expect(hasLast).toBe(true);
    expect(weeks.every(w => w.length === 7)).toBe(true);
  });
});

describe('buildActivityIndex', () => {
  it('indexes notes by creation and edit day', () => {
    const notes: Note[] = [
      makeNote({
        id: 'a',
        created_at: '2026-09-21T10:00:00.000Z',
        last_edited_at: '2026-09-21T10:00:00.000Z',
      }),
      makeNote({
        id: 'b',
        created_at: '2026-09-21T12:00:00.000Z',
        last_edited_at: '2026-09-22T09:00:00.000Z',
      }),
    ];
    const index = buildActivityIndex(notes);
    // local dates: +8 часов к UTC для Китая; день не меняется для 21-22
    const created = [...(index.get(dayKey(new Date(2026, 8, 21)))?.created ?? [])];
    const edited = [...(index.get(dayKey(new Date(2026, 8, 22)))?.edited ?? [])];
    expect(created.map(n => n.id)).toContain('a');
    expect(created.map(n => n.id)).toContain('b');
    expect(edited.map(n => n.id)).toEqual(['b']);
  });

  it('does not double-count a note edited on its creation day', () => {
    const notes: Note[] = [
      makeNote({
        id: 'a',
        created_at: '2026-09-21T10:00:00.000Z',
        last_edited_at: '2026-09-21T18:00:00.000Z',
      }),
    ];
    const index = buildActivityIndex(notes);
    const day = dayKey(new Date(2026, 8, 21));
    expect(index.get(day)?.created).toHaveLength(1);
    expect(index.get(day)?.edited ?? []).toHaveLength(0);
  });

  it('skips deleted notes', () => {
    const notes: Note[] = [makeNote({ id: 'x', is_deleted: true })];
    expect(buildActivityIndex(notes).size).toBe(0);
  });
});

describe('getOnThisDay', () => {
  it('returns notes created on this date in previous years', () => {
    const notes: Note[] = [
      makeNote({ id: 'old', created_at: '2024-09-21T10:00:00.000Z' }),
      makeNote({ id: 'same-year', created_at: '2026-09-21T10:00:00.000Z' }),
      makeNote({ id: 'other-day', created_at: '2024-09-22T10:00:00.000Z' }),
    ];
    const result = getOnThisDay(notes, new Date(2026, 8, 21));
    expect(result.map(n => n.id)).toEqual(['old']);
  });

  it('ignores deleted notes', () => {
    const notes: Note[] = [
      makeNote({ id: 'old', created_at: '2024-09-21T10:00:00.000Z', is_deleted: true }),
    ];
    expect(getOnThisDay(notes, new Date(2026, 8, 21))).toHaveLength(0);
  });
});
