'use client'

import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Event } from '@/types'

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Partial<Event> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await invoke('get_events', {
        filter: { calendar_id: 'default' },
        pagination: { page: 1, per_page: 500 }
      }) as Event[]
      setEvents(data)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const createEvent = async (eventData: Partial<Event>) => {
    const event = await invoke('create_event', { request: eventData }) as Event
    setEvents(prev => [...prev, event])
    return event
  }

  const updateEvent = async (eventData: Partial<Event> & { id: string }) => {
    await invoke('update_event', { request: eventData })
    setEvents(prev => prev.map(e => e.id === eventData.id ? { ...e, ...eventData } : e))
  }

  const deleteEvent = async (id: string) => {
    await invoke('delete_event', { id })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const getEventsForDate = async (date: Date) => {
    const data = await invoke('get_events_for_date', { date: date.toISOString().split('T')[0] }) as Event[]
    return data
  }

  return {
    currentDate,
    setCurrentDate,
    events,
    selectedEvent,
    setSelectedEvent,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    refresh: loadEvents,
  }
}