'use client'

import { useMemo } from 'react'
import { CalendarDay } from './calendar-day'
import { Event } from '@/types'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'

interface CalendarGridProps {
  view: 'month' | 'week' | 'day'
  currentDate: Date
  events: Event[]
  onDateClick: (date: Date) => void
  onEventClick: (event: Event) => void
  onCreateEvent: (date?: Date) => void
}

export function CalendarGrid({ view, currentDate, events, onDateClick, onEventClick, onCreateEvent }: CalendarGridProps) {
  const filteredEvents = useMemo(() => {
    if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      return events.filter(e => new Date(e.start_time) <= end && new Date(e.end_time) >= start)
    }
    if (view === 'week') {
      const start = new Date(currentDate)
      start.setDate(start.getDate() - start.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return events.filter(e => new Date(e.start_time) <= end && new Date(e.end_time) >= start)
    }
    // day view
    const start = new Date(currentDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(currentDate)
    end.setHours(23, 59, 59, 999)
    return events.filter(e => new Date(e.start_time) <= end && new Date(e.end_time) >= start)
  }, [view, currentDate, events])

  if (view === 'month') {
    return <CalendarMonthView currentDate={currentDate} events={filteredEvents} onDateClick={onDateClick} onEventClick={onEventClick} onCreateEvent={onCreateEvent} />
  }
  if (view === 'week') {
    return <CalendarWeekView currentDate={currentDate} events={filteredEvents} onEventClick={onEventClick} onCreateEvent={onCreateEvent} />
  }
  return <CalendarDayView currentDate={currentDate} events={filteredEvents} onEventClick={onEventClick} onCreateEvent={onCreateEvent} />
}

function CalendarMonthView({ currentDate, events, onDateClick, onEventClick, onCreateEvent }: Omit<CalendarGridProps, 'view'>) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startingDay = firstDay.getDay() // 0 = Sunday
  const totalDays = lastDay.getDate()
  
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  
  const weeks = []
  let day = 1
  
  for (let i = 0; i < 6; i++) {
    const week = []
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < startingDay) {
        // Previous month days
        const prevDay = prevMonthLastDay - startingDay + j + 1
        week.push({ day: prevDay, isCurrentMonth: false, date: new Date(year, month - 1, prevDay) })
      } else if (day > totalDays) {
        // Next month days
        const nextDay = day - totalDays
        week.push({ day: nextDay, isCurrentMonth: false, date: new Date(year, month + 1, nextDay) })
        day++
      } else {
        // Current month days
        week.push({ day, isCurrentMonth: true, date: new Date(year, month, day) })
        day++
      }
    }
    weeks.push(week)
    if (day > totalDays && i > 0) break
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="calendar-grid rounded-xl border overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        
        {/* Weeks */}
        <div className="calendar-grid">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map(({ day, isCurrentMonth, date }) => (
                <CalendarDay
                  key={`${date.getTime()}`}
                  date={date}
                  day={day}
                  isCurrentMonth={isCurrentMonth}
                  isToday={date.getTime() === today.getTime()}
                  events={events.filter(e => {
                    const eventStart = new Date(e.start_time)
                    return eventStart.getDate() === date.getDate() &&
                           eventStart.getMonth() === date.getMonth() &&
                           eventStart.getFullYear() === date.getFullYear()
                  })}
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
  )
}

function CalendarWeekView({ currentDate, events, onEventClick, onCreateEvent }: Omit<CalendarGridProps, 'view' | 'onDateClick'>) {
  const startOfWeek = useMemo(() => {
    const date = new Date(currentDate)
    date.setDate(date.getDate() - date.getDay())
    date.setHours(0, 0, 0, 0)
    return date
  }, [currentDate])

  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(date.getDate() + i)
      arr.push(date)
    }
    return arr
  }, [startOfWeek])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex overflow-x-auto">
        {/* Time column */}
        <div className="w-20 flex-shrink-0 border-r bg-muted/50">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="h-24 border-b text-xs text-right pr-2 pt-1 text-muted-foreground">
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        
        {/* Days */}
        <div className="flex min-w-max">
          {days.map((date) => (
            <CalendarWeekDay
              key={date.getTime()}
              date={date}
              isToday={date.getTime() === today.getTime()}
              events={events.filter(e => {
                const eventStart = new Date(e.start_time)
                return eventStart.getDate() === date.getDate() &&
                       eventStart.getMonth() === date.getMonth() &&
                       eventStart.getFullYear() === date.getFullYear()
                  })}
              onEventClick={onEventClick}
              onCreateEvent={onCreateEvent}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CalendarWeekDay({ date, isToday, events, onEventClick, onCreateEvent }: {
  date: Date
  isToday: boolean
  events: Event[]
  onEventClick: (event: Event) => void
  onCreateEvent: (date?: Date) => void
}) {
  return (
    <div className={cn("w-64 flex-shrink-0 border-r relative", isToday && "bg-primary/5")}>
      <div className="p-2 text-center font-medium border-b">
        {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
      <div className="relative h-[552px] overflow-y-auto">
        {events.map(event => {
          const start = new Date(event.start_time)
          const end = new Date(event.end_time)
          const top = (start.getHours() * 60 + start.getMinutes()) * 1.15 // 24px per hour
          const height = ((end.getTime() - start.getTime()) / 60000) * 1.15
          return (
            <div
              key={event.id}
              className="calendar-event"
              style={{ top: `${top}px`, height: `${Math.max(height, 24)}px`, backgroundColor: event.color }}
              onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
            >
              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {event.title}
            </div>
          )
        })}
        {/* Add event areas */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="h-24 border-b"
            onDoubleClick={() => onCreateEvent(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h))}
          />
        ))}
      </div>
    </div>
  )
}

function CalendarDayView({ currentDate, events, onEventClick, onCreateEvent }: Omit<CalendarGridProps, 'view' | 'onDateClick'>) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 p-4 bg-card rounded-xl border">
          <h2 className="text-xl font-semibold">
            {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
        </div>
        
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No events scheduled</p>
              <Button onClick={() => onCreateEvent(currentDate)} className="mt-4" variant="outline">
                Create Event
              </Button>
            </div>
          ) : (
            events
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .map(event => (
                <div
                  key={event.id}
                  className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onEventClick(event)}
                  style={{ borderLeft: `4px solid ${event.color}` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                        {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {event.location && ` · ${event.location}`}
                      </p>
                      {event.description && <p className="mt-2 text-sm">{event.description}</p>}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}