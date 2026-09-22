'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mic, Square, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIModel, ModelRecommendation } from '@/types';
import type { LiveTranscriptionController } from '@/hooks/use-live-transcription';

const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'auto', label: 'Авто' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

export function LiveTranscriptionBar({ controller }: { controller: LiveTranscriptionController }) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [language, setLanguage] = useState('auto');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, rec] = await Promise.allSettled([
        invoke<AIModel[]>('list_local_models', { modelType: 'transcription' }),
        invoke<ModelRecommendation>('recommend_transcription_model'),
      ]);
      if (cancelled) return;
      if (list.status === 'fulfilled') setModels(list.value);
      if (rec.status === 'fulfilled') {
        setRecommendation(rec.value);
        setSelectedModelId(prev => prev || rec.value.model_id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Downloaded models first: most likely usable right now.
  const sortedModels = [...models].sort((a, b) => {
    if (a.is_downloaded !== b.is_downloaded) return a.is_downloaded ? -1 : 1;
    return (a.recommended_ram_gb ?? 0) - (b.recommended_ram_gb ?? 0);
  });

  const toggle = async () => {
    if (controller.isRecording) {
      await controller.stopRecording();
    } else {
      await controller.startRecording(selectedModelId || undefined, language);
    }
  };

  const statusLabel = recommendation ? recommendation.reason : null;

  return (
    <div className="liquid-glass fixed bottom-6 left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl px-2 py-2 shadow-lg">
      <Button
        size="sm"
        variant={controller.isRecording ? 'destructive' : 'primary'}
        onClick={toggle}
        className="gap-2 shrink-0"
        title={controller.isRecording ? 'Остановить транскрибацию' : 'Начать транскрибацию'}
      >
        {controller.isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {controller.isRecording ? 'Стоп' : 'Диктовка'}
      </Button>

      <Select value={language} onValueChange={setLanguage}>
        <SelectTrigger className="h-9 w-[7.5rem] shrink-0">
          <SelectValue placeholder="Язык" />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map(lang => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedModelId} onValueChange={setSelectedModelId}>
        <SelectTrigger className="h-9 w-[16rem] shrink-0">
          <SelectValue placeholder="Модель" />
        </SelectTrigger>
        <SelectContent>
          {sortedModels.map(model => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
              {model.is_downloaded ? ` · ${model.recommended_ram_gb ?? '?'} ГБ` : ' · не скачана'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {controller.isRecording && (
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="max-w-[24rem] truncate italic">
            {controller.partialText || 'Слушаю…'}
          </span>
        </span>
      )}

      {controller.error && (
        <span
          className="flex min-w-0 items-center gap-1.5 text-xs text-destructive"
          role="alert"
          title={controller.error}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[24rem] truncate">{controller.error}</span>
        </span>
      )}

      {!controller.isRecording && statusLabel && !controller.error && (
        <span
          className="hidden max-w-[20rem] truncate text-xs text-muted-foreground md:inline"
          title={statusLabel}
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}
