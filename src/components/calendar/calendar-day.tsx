'use client'

import { cn } from '@/utils/cn'
import { Event } from '@/types'

interface CalendarDayProps {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  events: Event[]
  onClick: (date: Date) => void
  onEventClick: (event: Event) => void
  onCreateEvent: (date?: Date) => void
}

export function CalendarDay({ date, day, isCurrentMonth, isToday, events, onClick, onEventClick, onCreateEvent }: CalendarDayProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div
      className={cn(
        "calendar-day relative min-h-[100px] p-2 cursor-pointer transition-colors",
        !isCurrentMonth && "text-muted-foreground/50",
        isToday && "bg-primary/10",
        "hover:bg-accent/50"
      )}
      onClick={() => onClick(date)}
      onDoubleClick={() => onCreateEvent(date)}
    >
      <div className={cn("text-sm font-medium", isToday && "text-primary")}>
        {day}
      </div>
      
      <div className="mt-1 space-y-1 max-h-[80px] overflow-hidden">
        {events.slice(0, 3).map(event => (
          <div
            key={event.id}
            className="calendar-event text-xs truncate px-1.5 py-0.5 rounded"
            style={{ backgroundColor: event.color }}
            onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
          >
            {event.title}
          </div>
        ))}
        {events.length > 3 && (
          <div className="text-xs text-center text-muted-foreground">
            +{events.length - 3} more
          </div>
        )}
      </div>
    </div>
  )
}