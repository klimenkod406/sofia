'use client'

import { useState } from 'react'
import { Event } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { MapPin, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'

interface EventModalProps {
  event: Partial<Event> & { id?: string }
  onClose: () => void
  onSave: (eventData: Partial<Event>) => Promise<void>
  onDelete?: () => Promise<void>
}

export function EventModal({ event, onClose, onSave, onDelete }: EventModalProps) {
  const [formData, setFormData] = useState({
    title: event.title || '',
    description: event.description || '',
    startDate: event.start_time ? format(new Date(event.start_time), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    startTime: event.start_time ? format(new Date(event.start_time), 'HH:mm') : '09:00',
    endDate: event.end_time ? format(new Date(event.end_time), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    endTime: event.end_time ? format(new Date(event.end_time), 'HH:mm') : '10:00',
    allDay: event.all_day || false,
    location: event.location || '',
    color: event.color || '#00BFA6',
    calendarId: event.calendar_id || 'default',
    reminderMinutes: event.reminder_minutes ?? 15,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const startTime = new Date(`${formData.startDate}T${formData.startTime}`)
      const endTime = new Date(`${formData.endDate}T${formData.endTime}`)
      
      await onSave({
        ...formData,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (onDelete && window.confirm('Are you sure you want to delete this event?')) {
      await onDelete()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl border shadow-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{event.id ? 'Edit Event' : 'New Event'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Event title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                disabled={formData.allDay}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                disabled={formData.allDay}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.allDay}
              onChange={(e) => setFormData(prev => ({ ...prev, allDay: e.target.checked }))}
              className="rounded border-input"
            />
            <Label htmlFor="allDay" className="cursor-pointer">All day</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Add location"
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select value={formData.color} onValueChange={(v) => setFormData(prev => ({ ...prev, color: v }))}>
                <SelectTrigger className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: formData.color }} />
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {['#00BFA6', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981'].map(color => (
                    <SelectItem key={color} value={color}>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: color }} />
                        {color}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder">Reminder</Label>
              <Select value={formData.reminderMinutes.toString()} onValueChange={(v) => setFormData(prev => ({ ...prev, reminderMinutes: parseInt(v) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reminder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">At time of event</SelectItem>
                  <SelectItem value="5">5 minutes before</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                  <SelectItem value="10080">1 week before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            {event.id && onDelete && (
              <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !formData.title.trim()}>
              {isSaving ? 'Saving...' : (event.id ? 'Save Changes' : 'Create Event')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}