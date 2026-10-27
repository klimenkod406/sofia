'use client';

// FIXME(LOCAL-QUESTION): локальные модели диктовки временно отключены —
// показываем только API-сервисы с сохранённым ключом. Чтобы вернуть
// локальные модели, убрать условие source === 'api' ниже.

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
import type { AIModel } from '@/types';
// FIXME(LOCAL-QUESTION): ModelRecommendation временно не используется
// (рекомендация была только для локальных моделей). Импорт удалён —
// восстановить вместе с возвратом локальных моделей.
import type { LiveTranscriptionController } from '@/hooks/use-live-transcription';
import { useTranslation } from '@/lib/i18n';

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
  const { t } = useTranslation();
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [language, setLanguage] = useState('auto');
  // FIXME(LOCAL-QUESTION): recommendation/ModelRecommendation временно не
  // используются (рекомендация была только для локальных моделей). Тип
  // импортирован как type-only, но useState/state удалены — оставлен только
  // комментарий, чтобы было легко вернуть при восстановлении локальных моделей.

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // FIXME(LOCAL-QUESTION): рекомендация recommend_transcription_model
      // была про локальные модели и временно не вызывается. Возвращается
      // вместе с локальными моделями.
      const list = await invoke<AIModel[]>('list_local_models', {
        modelType: 'transcription',
      }).catch(() => null);
      if (cancelled) return;
      if (!list) {
        setModels([]);
        return;
      }
      setModels(list);
      // Только API-модели с сохранённым ключом: локальные скрыты до возврата.
      const usable = list.filter(m => m.source === 'api' && Boolean(m.api_key_encrypted));
      if (usable.length > 0) {
        setSelectedModelId(prev => prev || usable[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // FIXME(LOCAL-QUESTION): локальные модели скрыты — оставляем только API
  // с сохранённым ключом. Чтобы вернуть локальные, достаточно убрать фильтр.
  const usableModels = models.filter(m => m.source === 'api' && Boolean(m.api_key_encrypted));
  const sortedModels = [...usableModels].sort(
    (a, b) => (a.recommended_ram_gb ?? 0) - (b.recommended_ram_gb ?? 0)
  );

  // FIXME(LOCAL-QUESTION): подсказка выключена вместе с локальными моделями.
  const statusLabel: string | null = null;

  const toggle = async () => {
    if (controller.isRecording) {
      await controller.stopRecording();
    } else {
      await controller.startRecording(selectedModelId || undefined, language);
    }
  };

  return (
    <div className="liquid-glass fixed bottom-6 left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl px-2 py-2 shadow-lg">
      <Button
        size="sm"
        variant={controller.isRecording ? 'destructive' : 'primary'}
        onClick={toggle}
        disabled={!controller.isRecording && sortedModels.length === 0}
        className="gap-2 shrink-0"
        title={
          controller.isRecording
            ? t('stopTranscription')
            : sortedModels.length === 0
              ? t('installModelFirst')
              : t('startTranscription')
        }
      >
        {controller.isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {controller.isRecording ? t('stop') : t('dictation')}
      </Button>

      <Select value={language} onValueChange={setLanguage}>
        <SelectTrigger className="h-9 w-[7.5rem] shrink-0">
          <SelectValue placeholder={t('language')} />
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
          <SelectValue placeholder={t('model')} />
        </SelectTrigger>
        <SelectContent>
          {sortedModels.length === 0 ? (
            <SelectItem value="__none__" disabled>
              {t('noModelsInstalled')}
            </SelectItem>
          ) : (
            sortedModels.map(model => (
              <SelectItem key={model.id} value={model.id}>
                {model.name} · {model.recommended_ram_gb ?? '?'} {t('gbUnit')}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {controller.isRecording && (
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="max-w-[24rem] truncate italic">
            {controller.partialText || t('listening')}
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
