'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Bell, ChevronUp, ChevronDown } from 'lucide-react'
import { cn, formatDate } from '@/utils/cn'
import { Event } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CalendarSidebarProps {
  currentDate: Date
  events: Event[]
  onDateSelect: (date: Date) => void
  onEventClick: (event: Event) => void
}

export function CalendarSidebar({ currentDate, events, onDateSelect, onEventClick }: CalendarSidebarProps) {
  const [showCalendars, setShowCalendars] = useState(true)
  const [showEvents, setShowEvents] = useState(true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingEvents = events
    .filter(e => new Date(e.start_time) >= today && !e.is_completed)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 10)

  const calendars = [
    { id: 'personal', name: 'Personal', color: '#00BFA6', visible: true },
    { id: 'work', name: 'Work', color: '#3B82F6', visible: true },
    { id: 'family', name: 'Family', color: '#F59E0B', visible: true },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Mini Calendar */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <CalendarIcon className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        </div>
        <MiniCalendar currentDate={currentDate} onDateSelect={onDateSelect} />
      </div>

      {/* Calendars */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Calendars</h3>
          <Button variant="ghost" size="icon" onClick={() => setShowCalendars(!showCalendars)} className="h-6 w-6">
            {showCalendars ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        {showCalendars && (
          <div className="space-y-2">
            {calendars.map(cal => (
              <label key={cal.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={cal.visible} className="rounded border-input" />
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }} />
                <span className="text-sm">{cal.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Upcoming Events</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowEvents(!showEvents)} className="h-6 w-6">
              {showEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {showEvents && (
          <ScrollArea className="flex-1 p-4">
            {upcomingEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-card border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onEventClick(event)}
                    style={{ borderLeft: `3px solid ${event.color}` }}
                  >
                    <h4 className="font-medium truncate">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(event.start_time, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {event.location && ` · ${event.location}`}
                    </p>
                    {event.reminder_minutes && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Bell className="w-3 h-3" />
                        {event.reminder_minutes} min before
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

function MiniCalendar({ currentDate, onDateSelect }: { currentDate: Date; onDateSelect: (date: Date) => void }) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startingDay = firstDay.getDay()
  const totalDays = lastDay.getDate()
  
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  
  const weeks = []
  let day = 1
  
  for (let i = 0; i < 6; i++) {
    const week = []
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < startingDay) {
        week.push({ day: prevMonthLastDay - startingDay + j + 1, isCurrentMonth: false })
      } else if (day > totalDays) {
        week.push({ day: day - totalDays, isCurrentMonth: false })
        day++
      } else {
        week.push({ day, isCurrentMonth: true })
        day++
      }
    }
    weeks.push(week)
    if (day > totalDays && i > 0) break
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
        <div key={`weekday-${idx}`} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
      ))}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="contents">
          {week.map(({ day, isCurrentMonth }, dayIdx) => (
            <button
              key={`${weekIndex}-${dayIdx}-${day}`}
              onClick={() => onDateSelect(new Date(year, month, day))}
              className={cn(
                "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                !isCurrentMonth && "text-muted-foreground/50",
                today.getDate() === day && today.getMonth() === month && today.getFullYear() === year 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}