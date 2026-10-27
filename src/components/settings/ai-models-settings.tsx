'use client';

// FIXME(LOCAL-QUESTION): локальные модели (скачивание whisper/whisper.cpp и
// локально-развёрнутые сервисы транскрибации) временно отключены в UI —
// оставлены только облачные API. Функции install/remove/pollDownload
// сохранены, но больше нигде не вызываются; чтобы вернуть — убрать условия
// ниже и показывать localChat/localTranscription/own-route-блок снова.

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  Cloud,
  KeyRound,
  Loader2,
  Mic,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AIModel } from '@/types';
import { useTranslation } from '@/lib/i18n';

// FIXME(LOCAL-QUESTION): размер моделей (ГБ/МБ) временно не используется в UI
// (локальные скрыты), но функция оставлена, чтобы не считать заново при
// возврате.
function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} ГБ`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} МБ`;
  return `${Math.round(bytes / 1000)} КБ`;
}
void fmtSize;

function isReady(m: AIModel): boolean {
  // FIXME(LOCAL-QUESTION): вместе со скрытием локальных моделей в UI
  // «готовность» теперь эквивалентна «у этой API-модели сохранён ключ».
  return Boolean(m.api_key_encrypted);
}

type ModelStatus = { ok: boolean; text: string };

function StatusBadge({ ready }: { ready: boolean }) {
  // FIXME(LOCAL-QUESTION): текст бэйджа берём из i18n, чтобы корректно
  // переключался на других языках.
  const { t } = useTranslation();
  return ready ? (
    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      {t('statusReady')}
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      {t('statusNotConfigured')}
    </span>
  );
}

/**
 * Единое место для работы с моделями. Сейчас здесь только облачные API:
 * «Голосовой ввод» (транскрибация по API) и «ИИ-помощник» (чат по API).
 * Локальные модели и «свой сервис» временно отключены — см. FIXME в начале.
 */
export function AiModelsSettings() {
  const { t } = useTranslation();
  // FIXME(LOCAL-QUESTION): временно показываем только API-модели. Локальные
  // скачиваемые модели и «свой сервис транскрибации» спрятаны; см. начало
  // файла. Фильтрация по source === 'api' — единая точка отсечения.
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [keySavingId, setKeySavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, ModelStatus>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await invoke<AIModel[]>('list_local_models');
      // FIXME(LOCAL-QUESTION): см. выше — режем всё, что не API.
      setModels(list.filter(m => m.source === 'api'));
    } catch (e) {
      console.error('list_local_models failed', e);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const transcription = models.filter(m => m.model_type === 'transcription');
  const chatModels = models.filter(m => m.model_type === 'chat' || m.model_type === 'analysis');
  const apiTranscription = transcription;
  const apiChat = chatModels;

  const transcriptionReady = transcription.some(isReady);
  const chatReady = chatModels.some(isReady);
  const readyTranscriptionNames = transcription.filter(isReady).map(m => m.name);
  const readyChatNames = chatModels.filter(isReady).map(m => m.name);

  // FIXME(LOCAL-QUESTION): функции install/remove/pollDownload/saveRoute
  // удалены вместе со скрытием локальных моделей и «своего сервиса». Если
  // нужно вернуть — взять из git-истории этого файла.

  const saveKey = async (model: AIModel) => {
    const apiKey = (keyDrafts[model.id] ?? '').trim();
    if (!apiKey) return;
    setKeySavingId(model.id);
    try {
      await invoke('set_api_key', { modelId: model.id, apiKey });
      setKeyDrafts(d => ({ ...d, [model.id]: '' }));
      setStatus(s => ({ ...s, [model.id]: { ok: true, text: t('apiKeySaved') } }));
      await load();
    } catch (err) {
      setStatus(s => ({
        ...s,
        [model.id]: { ok: false, text: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setKeySavingId(null);
    }
  };

  const test = async (model: AIModel) => {
    setTestingId(model.id);
    try {
      const ok = await invoke<boolean>('test_api_connection', { modelId: model.id });
      setStatus(s => ({
        ...s,
        [model.id]: {
          ok,
          text: ok ? t('apiConnectionOk') : t('apiConnectionFailed'),
        },
      }));
    } catch (err) {
      setStatus(s => ({
        ...s,
        [model.id]: { ok: false, text: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const apiModelRow = (m: AIModel) => {
    const hasKey = Boolean(m.api_key_encrypted);
    const msg = status[m.id];
    return (
      <li key={m.id} className="rounded-lg border border-border px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{m.name}</span>
              <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {hasKey && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {m.api_endpoint}
              {m.model_id ? ` · ${m.model_id}` : ''}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void test(m)}
            disabled={testingId === m.id}
            className="h-8 shrink-0 gap-1.5"
          >
            {testingId === m.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasKey ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {t('check')}
          </Button>
        </div>
        {!hasKey && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={keyDrafts[m.id] ?? ''}
              onChange={e => setKeyDrafts(d => ({ ...d, [m.id]: e.target.value }))}
              placeholder={t('apiKeyPlaceholder')}
              className="h-8 w-56"
              aria-label={t('apiKeyFor', { name: m.name })}
            />
            <Button
              size="sm"
              onClick={() => void saveKey(m)}
              disabled={keySavingId === m.id || !(keyDrafts[m.id] ?? '').trim()}
              className="h-8 gap-1.5"
            >
              {keySavingId === m.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {t('save')}
            </Button>
          </div>
        )}
        {msg && (
          <p className={`mt-1.5 text-xs ${msg.ok ? 'text-emerald-600' : 'text-destructive'}`}>
            {msg.text}
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {/* ============ ГОЛОСОВОЙ ВВОД ============ */}
      <section className="rounded-xl border border-border p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">{t('voiceInput')}</h3>
          </div>
          <StatusBadge ready={transcriptionReady} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t('voiceInputDesc')}</p>

        {transcriptionReady && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              {t('voiceInputReady')}
              {readyTranscriptionNames.length > 0 && <>: {readyTranscriptionNames.join(', ')}</>}.
            </span>
          </div>
        )}

        {!transcriptionReady && apiTranscription.length === 0 && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            {t('voiceInputApiMissing')}
          </div>
        )}

        {apiTranscription.length > 0 && (
          <ul className="space-y-2">{apiTranscription.map(apiModelRow)}</ul>
        )}
      </section>

      {/* ============ ИИ-ПОМОЩНИК ============ */}
      <section className="rounded-xl border border-border p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">{t('aiHelper')}</h3>
          </div>
          <StatusBadge ready={chatReady} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t('aiHelperDesc')}</p>

        {chatReady && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              {t('aiHelperReady')}
              {readyChatNames.length > 0 && <>: {readyChatNames.join(', ')}</>}.
            </span>
          </div>
        )}

        {!chatReady && apiChat.length === 0 && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            {t('aiHelperApiMissing')}
          </div>
        )}

        {apiChat.length > 0 && <ul className="space-y-2">{apiChat.map(apiModelRow)}</ul>}
      </section>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('changesApplyImmediately')}</span>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="h-7 gap-1 px-2">
          <RefreshCw className="h-3.5 w-3.5" /> {t('refresh')}
        </Button>
      </div>
    </div>
  );
}
