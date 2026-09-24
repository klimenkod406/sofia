'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Plus, StickyNote } from 'lucide-react';
import { useCalendar } from '@/hooks/use-calendar';
import { useCalendarNotes } from '@/hooks/use-calendar-notes';
import { useReminders, getDueReminders } from '@/stores/reminders';
import { useNotes } from '@/stores/notes';
import { startOfWeek } from '@/utils/calendar-utils';
import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { CalendarSidebar } from '@/components/calendar/calendar-sidebar';
import { EventModal } from '@/components/calendar/event-modal';
import { MonthYearPicker } from '@/components/calendar/month-year-picker';
import { ReminderModal, type ReminderDraft } from '@/components/calendar/reminder-modal';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useDropdownMenu,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n';

type View = 'month' | 'week' | 'day';

export function CalendarPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const locale = getLocale(language);
  const {
    currentDate,
    setCurrentDate,
    events,
    selectedEvent,
    setSelectedEvent,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendar();
  const notes = useCalendarNotes();
  const { createNote } = useNotes();
  const {
    reminders,
    add: addReminder,
    toggleDone,
    snooze,
    remove: removeReminder,
  } = useReminders();

  const [view, setView] = useState<View>('month');
  const [reminderDraft, setReminderDraft] = useState<{ noteId?: string; date?: Date } | null>(null);

  const navigateView = useCallback(
    (delta: number) => {
      const d = new Date(currentDate);
      if (view === 'month') d.setMonth(d.getMonth() + delta);
      else if (view === 'week') d.setDate(d.getDate() + delta * 7);
      else d.setDate(d.getDate() + delta);
      setCurrentDate(d);
    },
    [view, currentDate, setCurrentDate]
  );

  const goToToday = useCallback(() => setCurrentDate(new Date()), [setCurrentDate]);

  // Быстрый переход к выбранному месяцу/году (1-е число месяца).
  const handleQuickDate = useCallback(
    (d: Date) => {
      setCurrentDate(d);
      setView('month');
    },
    [setCurrentDate]
  );

  // Клавиатурные сокращения: M/W/D — виды, T — сегодня, ←/→ — навигация.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      )
        return;
      switch (e.key.toLowerCase()) {
        case 'm':
          setView('month');
          break;
        case 'w':
          setView('week');
          break;
        case 'd':
          setView('day');
          break;
        case 't':
          goToToday();
          break;
        case 'arrowleft':
          navigateView(-1);
          break;
        case 'arrowright':
          navigateView(1);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateView, goToToday]);

  const openNote = useCallback((id: string) => navigate(`/editor/${id}`), [navigate]);

  const handleCreateNote = useCallback(
    async (_date?: Date) => {
      try {
        const note = await createNote(null, t('newNote'));
        if (note) navigate(`/editor/${note.id}`);
      } catch (e) {
        console.error('create note failed', e);
        toast({ title: t('createNoteFailed'), variant: 'destructive' });
      }
    },
    [createNote, navigate, toast, t]
  );

  const handleCreateEvent = useCallback(
    (date?: Date) => {
      // Двойной клик по week/day-ячейке передаёт конкретный день и час;
      // кнопка «Событие» в шапке — без аргумента (текущая дата).
      const start = date ? new Date(date) : new Date(currentDate);
      const end = new Date(start.getTime() + 3600000);
      setSelectedEvent({
        title: '',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
    },
    [currentDate, setSelectedEvent]
  );

  const handleSaveReminder = useCallback(
    (data: ReminderDraft) => {
      addReminder(data);
      toast({ title: t('reminderCreated'), description: data.title });
      setReminderDraft(null);
    },
    [addReminder, toast, t]
  );

  const subtitle =
    view === 'month'
      ? currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${t('weekFrom')} ${startOfWeek(currentDate).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
          })}`
        : currentDate.toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

  return (
    <div className="flex h-full min-h-0 flex-col px-4 md:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        {/* До xl шапка всегда в две строки (заголовок + панель управления),
            поэтому длинная дата («понедельник, …») не переносится и не сдвигает
            кнопки; min-w-0 + truncate — страховка на случай очень узкого окна. */}
        <div className="min-w-0">
          <Breadcrumbs
            onBack={() => navigate('/home')}
            parentLabel={t('home')}
            current={t('calendar')}
            className="mb-1 justify-start"
          />
          <h1 className="text-3xl font-bold tracking-tight">{t('calendar')}</h1>
          <p className="truncate text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden overflow-hidden rounded-xl border sm:flex">
            {(['month', 'week', 'day'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {v === 'month' ? t('viewMonth') : v === 'week' ? t('viewWeek') : t('viewDay')}
              </button>
            ))}
          </div>

          <MonthYearPicker value={currentDate} onSelect={handleQuickDate} />

          <Button variant="outline" onClick={goToToday} className="hidden sm:flex">
            <CalendarDays className="mr-1 h-4 w-4" />
            {t('today')}
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateView(-1)} title={t('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateView(1)} title={t('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <RemindersBell
            onOpenNote={openNote}
            onSnooze={snooze}
            onToggleDone={toggleDone}
            onNewReminder={() => setReminderDraft({})}
          />

          <Button variant="outline" onClick={() => handleCreateNote()}>
            <StickyNote className="mr-1 h-4 w-4" />
            {t('note')}
          </Button>
          <Button onClick={() => handleCreateEvent()}>
            <Plus className="mr-1 h-4 w-4" />
            {t('event')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r lg:block">
          <CalendarSidebar
            currentDate={currentDate}
            events={events}
            notes={notes}
            reminders={reminders}
            onDateSelect={setCurrentDate}
            onEventClick={setSelectedEvent}
            onOpenNote={openNote}
            onToggleReminder={toggleDone}
            onRemoveReminder={removeReminder}
          />
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CalendarGrid
            view={view}
            currentDate={currentDate}
            events={events}
            notes={notes}
            reminders={reminders}
            onDateClick={date => {
              setCurrentDate(date);
              setView('day');
            }}
            onEventClick={setSelectedEvent}
            onCreateEvent={handleCreateEvent}
            onCreateReminder={date => setReminderDraft({ date })}
            onOpenNote={openNote}
          />
        </div>
      </div>

      {/* Event modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={async eventData => {
            if (selectedEvent.id) {
              await updateEvent({ ...selectedEvent, ...eventData, id: selectedEvent.id });
            } else {
              await createEvent(eventData);
            }
            setSelectedEvent(null);
          }}
          onDelete={selectedEvent.id ? () => deleteEvent(selectedEvent.id as string) : undefined}
        />
      )}

      {/* Reminder modal */}
      {reminderDraft && (
        <ReminderModal
          notes={notes}
          initialNoteId={reminderDraft.noteId}
          initialDate={reminderDraft.date}
          onClose={() => setReminderDraft(null)}
          onSave={handleSaveReminder}
        />
      )}
    </div>
  );
}

/** Колокольчик просроченных напоминаний. Тик «сейчас» живёт ЗДЕСЬ, а не на
 *  странице: иначе каждые 30 секунд перерендеривался весь календарь. */
function RemindersBell({
  onOpenNote,
  onSnooze,
  onToggleDone,
  onNewReminder,
}: {
  onOpenNote: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onToggleDone: (id: string) => void;
  onNewReminder: () => void;
}) {
  const reminders = useReminders(s => s.reminders);
  const { t, language } = useTranslation();
  const locale = getLocale(language);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const dueReminders = useMemo(() => getDueReminders(reminders, new Date(now)), [reminders, now]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={t('remindersBell')}
      >
        <Bell className="h-4 w-4" />
        {dueReminders.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {dueReminders.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel>{t('timeToRemind')}</DropdownMenuLabel>
        {dueReminders.length === 0 ? (
          <div className="px-3.5 py-3 text-sm text-muted-foreground">
            {t('noOverdueReminders')}
          </div>
        ) : (
          dueReminders.map(reminder => (
            <div key={reminder.id} className="px-3.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{reminder.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(reminder.trigger_at).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {reminder.message && (
                <p className="mt-0.5 text-xs text-muted-foreground">{reminder.message}</p>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onOpenNote(reminder.note_id)}
                >
                  {t('open')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onSnooze(reminder.id, 5)}
                >
                  {t('later')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onToggleDone(reminder.id)}
                >
                  {t('done')}
                </Button>
              </div>
            </div>
          ))
        )}
        <DropdownMenuSeparator />
        <NewReminderMenuItem onSelect={onNewReminder} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Пункт меню колокольчика, который закрывает меню перед открытием модалки. */
function NewReminderMenuItem({ onSelect }: { onSelect: () => void }) {
  const { setOpen } = useDropdownMenu();
  const { t } = useTranslation();
  return (
    <DropdownMenuItem
      onSelect={() => {
        setOpen(false);
        onSelect();
      }}
      className="justify-center text-muted-foreground"
    >
      <Bell className="h-3.5 w-3.5" />
      {t('newReminder')}
    </DropdownMenuItem>
  );
}
