'use client';

import { useState } from 'react';
import { Event } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@/lib/i18n';

interface EventModalProps {
  event: Partial<Event> & { id?: string };
  onClose: () => void;
  onSave: (eventData: Partial<Event>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function EventModal({ event, onClose, onSave, onDelete }: EventModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: event.title || '',
    description: event.description || '',
    startDate: event.start_time
      ? format(new Date(event.start_time), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd'),
    startTime: event.start_time ? format(new Date(event.start_time), 'HH:mm') : '09:00',
    endDate: event.end_time
      ? format(new Date(event.end_time), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd'),
    endTime: event.end_time ? format(new Date(event.end_time), 'HH:mm') : '10:00',
    allDay: event.all_day || false,
    location: event.location || '',
    color: event.color || '#00BFA6',
    calendarId: event.calendar_id || 'default',
    reminderMinutes: event.reminder_minutes ?? 15,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const startTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endTime = new Date(`${formData.endDate}T${formData.endTime}`);

      await onSave({
        ...formData,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete && window.confirm(t('confirmDeleteEvent'))) {
      await onDelete();
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl border shadow-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{event.id ? t('editEvent') : t('newEvent')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
          className="p-4 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          <div className="space-y-2">
            <Label htmlFor="title">{t('eventTitle')}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('eventTitlePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('startDate')}</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('startTime')}</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                disabled={formData.allDay}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('endDate')}</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('endTime')}</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                disabled={formData.allDay}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.allDay}
              onChange={e => setFormData(prev => ({ ...prev, allDay: e.target.checked }))}
              className="rounded border-input"
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              {t('allDay')}
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">{t('location')}</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="location"
                value={formData.location}
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder={t('locationPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">{t('color')}</Label>
              <Select
                value={formData.color}
                onValueChange={v => setFormData(prev => ({ ...prev, color: v }))}
              >
                <SelectTrigger className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: formData.color }}
                  />
                  <SelectValue placeholder={t('selectColor')} />
                </SelectTrigger>
                <SelectContent>
                  {[
                    '#00BFA6',
                    '#3B82F6',
                    '#F59E0B',
                    '#EF4444',
                    '#8B5CF6',
                    '#EC4899',
                    '#06B6D4',
                    '#10B981',
                  ].map(color => (
                    <SelectItem key={color} value={color}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                        {color}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder">{t('reminder')}</Label>
              <Select
                value={formData.reminderMinutes.toString()}
                onValueChange={v =>
                  setFormData(prev => ({ ...prev, reminderMinutes: parseInt(v) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectReminder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('reminderAtEvent')}</SelectItem>
                  <SelectItem value="5">{t('reminder5min')}</SelectItem>
                  <SelectItem value="15">{t('reminder15min')}</SelectItem>
                  <SelectItem value="30">{t('reminder30min')}</SelectItem>
                  <SelectItem value="60">{t('reminder1hour')}</SelectItem>
                  <SelectItem value="1440">{t('reminder1day')}</SelectItem>
                  <SelectItem value="10080">{t('reminder1week')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            {event.id && onDelete && (
              <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              {t('cancelBtn')}
            </Button>
            <Button type="submit" disabled={isSaving || !formData.title.trim()}>
              {isSaving ? t('eventSaving') : event.id ? t('saveChanges') : t('createEventBtn')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
