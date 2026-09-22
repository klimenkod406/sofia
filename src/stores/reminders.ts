// Лёгкие напоминания, привязанные к заметкам.
// Хранятся локально (localStorage) — без backend-команды, работают и в Tauri,
// и в браузерном dev-режиме.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface NoteReminder {
  id: string;
  note_id: string;
  title: string;
  message: string;
  /** ISO datetime — когда напомнить. */
  trigger_at: string;
  done: boolean;
  created_at: string;
}

interface RemindersState {
  reminders: NoteReminder[];
  add: (data: Omit<NoteReminder, 'id' | 'done' | 'created_at'>) => NoteReminder;
  toggleDone: (id: string) => void;
  /** Отложить напоминание на N минут. */
  snooze: (id: string, minutes: number) => void;
  remove: (id: string) => void;
  clearForNote: (noteId: string) => void;
}

function localId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `rem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const useReminders = create<RemindersState>()(
  persist(
    set => ({
      reminders: [],
      add: data => {
        const reminder: NoteReminder = {
          id: localId(),
          note_id: data.note_id,
          title: data.title,
          message: data.message,
          trigger_at: data.trigger_at,
          done: false,
          created_at: new Date().toISOString(),
        };
        set(state => ({ reminders: [...state.reminders, reminder] }));
        return reminder;
      },
      toggleDone: id =>
        set(state => ({
          reminders: state.reminders.map(r => (r.id === id ? { ...r, done: !r.done } : r)),
        })),
      snooze: (id, minutes) =>
        set(state => ({
          reminders: state.reminders.map(r => {
            if (r.id !== id) return r;
            // Отсчёт от «сейчас», если напоминание уже просрочено:
            // иначе «+5 минут» к старому trigger_at оставило бы его в прошлом
            // и оно мгновенно стало бы снова просроченным.
            const base = Math.max(new Date(r.trigger_at).getTime(), Date.now());
            return {
              ...r,
              trigger_at: new Date(base + minutes * 60000).toISOString(),
            };
          }),
        })),
      remove: id => set(state => ({ reminders: state.reminders.filter(r => r.id !== id) })),
      clearForNote: noteId =>
        set(state => ({ reminders: state.reminders.filter(r => r.note_id !== noteId) })),
    }),
    { name: 'sofia.reminders', storage: createJSONStorage(() => localStorage) }
  )
);

/** Напоминания, которые пора показать (не отмеченные и не в будущем). */
export function getDueReminders(reminders: NoteReminder[], now: Date = new Date()): NoteReminder[] {
  return reminders
    .filter(r => !r.done && new Date(r.trigger_at) <= now)
    .sort((a, b) => new Date(a.trigger_at).getTime() - new Date(b.trigger_at).getTime());
}

/** Напоминания, назначенные на конкретный день. */
export function getRemindersForDate(reminders: NoteReminder[], date: Date): NoteReminder[] {
  return reminders.filter(r => {
    const t = new Date(r.trigger_at);
    return (
      t.getFullYear() === date.getFullYear() &&
      t.getMonth() === date.getMonth() &&
      t.getDate() === date.getDate()
    );
  });
}
