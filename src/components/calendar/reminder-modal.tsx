'use client';

import { useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { Note } from '@/stores/notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ReminderDraft {
  note_id: string;
  title: string;
  message: string;
  trigger_at: string;
}

interface ReminderModalProps {
  notes: Note[];
  initialNoteId?: string | null;
  initialDate?: Date;
  onClose: () => void;
  onSave: (data: ReminderDraft) => void;
}

function toDatetimeLocal(date: Date): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderModal({
  notes,
  initialNoteId,
  initialDate,
  onClose,
  onSave,
}: ReminderModalProps) {
  const sortedNotes = useMemo(
    () =>
      [...notes]
        .filter(n => !n.is_deleted)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [notes]
  );

  const defaultNote = sortedNotes.find(n => n.id === initialNoteId) ?? sortedNotes[0] ?? null;

  const defaultTrigger = useMemo(() => {
    if (initialDate) {
      // Первое будущее 9:00 начиная с выбранной даты. Цикл вместо +1 день:
      // выбранная дата может быть в далёком прошлом (например, прыжок в 2020 год).
      const d = new Date(initialDate);
      d.setHours(9, 0, 0, 0);
      while (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    }
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  }, [initialDate]);

  const [noteId, setNoteId] = useState<string>(defaultNote?.id ?? '');
  const [title, setTitle] = useState<string>(defaultNote?.title ?? '');
  const [message, setMessage] = useState('');
  const [triggerAt, setTriggerAt] = useState<string>(toDatetimeLocal(defaultTrigger));

  const handleNoteChange = (id: string) => {
    setNoteId(id);
    const note = sortedNotes.find(n => n.id === id);
    if (note) setTitle(note.title);
  };

  const handleSave = () => {
    if (!noteId || !title.trim() || !triggerAt || isPast) return;
    onSave({
      note_id: noteId,
      title: title.trim(),
      message: message.trim(),
      trigger_at: new Date(triggerAt).toISOString(),
    });
  };

  // Напоминание в прошлом: сработает мгновенно, поэтому предупреждаем и не даём
  // сохранить (допускаем текущую минуту — по сути «прямо сейчас»).
  const triggerTime = triggerAt ? new Date(triggerAt).getTime() : NaN;
  const isPast = Number.isFinite(triggerTime) && triggerTime < Date.now() - 60000;

  const roundTo5 = (d: Date) => {
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  };

  const quickOptions = [
    {
      label: 'Через час',
      get: () => roundTo5(new Date(Date.now() + 3600000)),
    },
    {
      label: 'Завтра в 9:00',
      get: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Завтра в это же время',
      get: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-xl animate-scale-in">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="h-4 w-4 text-red-500" />
            Напоминание
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form
          className="space-y-4 p-4"
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="reminder-note">Заметка</Label>
            <select
              id="reminder-note"
              value={noteId}
              onChange={e => handleNoteChange(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {sortedNotes.length === 0 && <option value="">Нет заметок</option>}
              {sortedNotes.map(note => (
                <option key={note.id} value={note.id}>
                  {note.title || 'Без названия'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-title">Заголовок</Label>
            <Input
              id="reminder-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="О чём напомнить"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-when">Когда</Label>
            <Input
              id="reminder-when"
              type="datetime-local"
              value={triggerAt}
              onChange={e => setTriggerAt(e.target.value)}
            />
            {isPast && (
              <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs font-medium text-red-500">
                  Время уже прошло — напоминание сработает сразу. Выберите время в будущем:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quickOptions.map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setTriggerAt(toDatetimeLocal(opt.get()))}
                      className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-message">Сообщение (необязательно)</Label>
            <Textarea
              id="reminder-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Например: доделать план на неделю"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} type="button">
              Отмена
            </Button>
            <Button type="submit" disabled={!noteId || !title.trim() || !triggerAt || isPast}>
              {isPast ? 'Время в прошлом' : 'Создать напоминание'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
