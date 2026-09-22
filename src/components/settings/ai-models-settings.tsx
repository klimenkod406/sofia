'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  Cloud,
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AIModel } from '@/types';

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} ГБ`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} МБ`;
  return `${Math.round(bytes / 1000)} КБ`;
}

const GROUPS: { type: AIModel['model_type']; label: string }[] = [
  { type: 'transcription', label: 'Транскрибация' },
  { type: 'analysis', label: 'Анализ текста' },
  { type: 'chat', label: 'Чат' },
];

type ModelStatus = { ok: boolean; text: string };

/**
 * Live catalog of AI models. Shows the REAL state of each model (weights
 * downloaded or not, API key set or not) instead of pretending models are
 * configured: nothing is usable until the user downloads local weights or
 * adds an API key.
 */
export function AiModelsSettings() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [keySavingId, setKeySavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, ModelStatus>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    const [list] = await Promise.allSettled([
      invoke<AIModel[]>('list_local_models'),
    ]);
    if (list.status === 'fulfilled') {
      setModels(list.value);
    } else {
      setLoadError(
        'Не удалось загрузить каталог моделей. Похоже, запущен старый билд — перезапустите приложение (нужна пересборка backend).'
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isReady = (m: AIModel): boolean =>
    m.source === 'local' ? m.is_downloaded : Boolean(m.api_key_encrypted);

  const install = async (model: AIModel) => {
    setBusyModelId(model.id);
    setStatus(s => ({ ...s, [model.id]: { ok: true, text: 'Загрузка весов… это может занять время.' } }));
    try {
      await invoke('install_model', { modelId: model.id });
      setStatus(s => ({ ...s, [model.id]: { ok: true, text: 'Модель скачана и готова к работе.' } }));
      await load();
    } catch (err) {
      setStatus(s => ({
        ...s,
        [model.id]: { ok: false, text: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setBusyModelId(null);
    }
  };

  const remove = async (model: AIModel) => {
    setBusyModelId(model.id);
    try {
      await invoke('uninstall_model', { modelId: model.id });
      await load();
    } catch (err) {
      setStatus(s => ({
        ...s,
        [model.id]: { ok: false, text: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setBusyModelId(null);
    }
  };

  const saveKey = async (model: AIModel) => {
    const key = (keyDrafts[model.id] ?? '').trim();
    if (!key) return;
    setKeySavingId(model.id);
    try {
      await invoke('set_api_key', { modelId: model.id, apiKey: key });
      setKeyDrafts(d => ({ ...d, [model.id]: '' }));
      setStatus(s => ({ ...s, [model.id]: { ok: true, text: 'API-ключ сохранён.' } }));
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
          text: ok
            ? 'Соединение установлено — модель доступна.'
            : 'Соединение не удалось — проверьте ключ и адрес API.',
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

  const readyCount = models.filter(isReady).length;
  const groups = GROUPS.map(g => ({
    ...g,
    list: models.filter(m => m.model_type === g.type),
  })).filter(g => g.list.length > 0);

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Каталог моделей</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Готово к работе: {readyCount} из {models.length}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()} className="h-7 gap-1 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {models.length > 0 && readyCount === 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Ни одна модель ещё не подключена и не скачана. Скачайте локальные веса или задайте
          API-ключ — до этого транскрибация и анализ недоступны.
        </div>
      )}

      {models.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground">Модели не найдены.</p>
      )}

      {groups.map(group => {
        const ready = group.list.filter(isReady).length;
        return (
          <div key={group.type} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">{group.label}</h3>
              <span className="text-xs text-muted-foreground">
                {ready} из {group.list.length} готовы
              </span>
            </div>

            <ul className="space-y-2">
              {group.list.map(m => {
                const busy = busyModelId === m.id;
                const local = m.source === 'local';
                const downloaded = m.is_downloaded;
                const hasKey = Boolean(m.api_key_encrypted);
                const msg = status[m.id];

                return (
                  <li key={m.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{m.name}</span>
                          {local ? (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              локальная
                            </span>
                          ) : (
                            <span className="shrink-0 rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-600 dark:text-blue-400">
                              API
                            </span>
                          )}
                          {m.quantization && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {m.quantization}
                            </span>
                          )}
                          {local && downloaded && (
                            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {fmtSize(m.size_bytes)} · ОЗУ ~{m.recommended_ram_gb} ГБ
                          {local && !downloaded && ' · требуется загрузка весов'}
                          {!local && (hasKey ? ' · ключ задан' : ' · ключ не задан')}
                          {!local && m.api_endpoint && ` · ${m.api_endpoint}`}
                        </div>
                      </div>

                      {local &&
                        (downloaded ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(m)}
                            disabled={busy}
                            className="h-8 shrink-0 gap-1.5 text-muted-foreground"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Удалить
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void install(m)}
                            disabled={busy}
                            className="h-8 shrink-0 gap-1.5"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            {busy ? 'Загрузка…' : 'Скачать'}
                          </Button>
                        ))}
                    </div>

                    {!local && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {!hasKey && (
                          <>
                            <Input
                              type="password"
                              value={keyDrafts[m.id] ?? ''}
                              onChange={e =>
                                setKeyDrafts(d => ({ ...d, [m.id]: e.target.value }))
                              }
                              placeholder="sk-..."
                              className="h-8 w-52"
                              aria-label={`API-ключ для ${m.name}`}
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
                              Сохранить
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void test(m)}
                          disabled={testingId === m.id}
                          className="h-8 gap-1.5"
                        >
                          {testingId === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : hasKey ? (
                            <Wifi className="h-4 w-4" />
                          ) : (
                            <WifiOff className="h-4 w-4" />
                          )}
                          Проверить
                        </Button>
                        {hasKey && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <Cloud className="h-3.5 w-3.5" /> подключен
                          </span>
                        )}
                      </div>
                    )}

                    {msg && (
                      <p
                        className={`mt-1.5 text-xs ${
                          msg.ok ? 'text-emerald-600' : 'text-destructive'
                        }`}
                        role="status"
                      >
                        {msg.text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
