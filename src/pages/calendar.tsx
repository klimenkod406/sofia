'use client';

import { useState } from 'react';
import { useCalendar } from '@/hooks/use-calendar';
import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { CalendarSidebar } from '@/components/calendar/calendar-sidebar';
import { EventModal } from '@/components/calendar/event-modal';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn, formatDate } from '@/utils/cn';

export function CalendarPage() {
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

  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [showSidebar] = useState(true);

  const navigateMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleCreateEvent = () => {
    const newEvent = {
      title: '',
      start_time: currentDate.toISOString(),
      end_time: new Date(currentDate.getTime() + 3600000).toISOString(),
    };
    setSelectedEvent(newEvent);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            {view === 'month' && formatDate(currentDate, { month: 'long', year: 'numeric' })}
            {view === 'week' &&
              `Week of ${formatDate(currentDate, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {view === 'day' &&
              formatDate(currentDate, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex border rounded-xl overflow-hidden">
            {(['month', 'week', 'day'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <Button variant="outline" size="icon" onClick={goToToday} className="hidden sm:flex">
            <CalendarDays className="w-4 h-4 mr-1" />
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button onClick={handleCreateEvent} className="gap-2">
            <Plus className="w-4 h-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-72 flex-shrink-0 border-r hidden lg:block">
            <CalendarSidebar
              currentDate={currentDate}
              events={events}
              onDateSelect={setCurrentDate}
              onEventClick={setSelectedEvent}
            />
          </aside>
        )}

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CalendarGrid
            view={view}
            currentDate={currentDate}
            events={events}
            onDateClick={date => {
              setCurrentDate(date);
              setView('day');
            }}
            onEventClick={setSelectedEvent}
            onCreateEvent={handleCreateEvent}
          />
        </div>
      </div>

      {/* Event Modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={async eventData => {
            if (selectedEvent.id) {
              const eventId = selectedEvent.id;
              await updateEvent({ ...selectedEvent, ...eventData, id: eventId });
            } else {
              await createEvent(eventData);
            }
            setSelectedEvent(null);
          }}
          onDelete={selectedEvent.id ? () => deleteEvent(selectedEvent.id as string) : undefined}
        />
      )}
    </div>
  );
}
