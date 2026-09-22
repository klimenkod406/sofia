'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Check,
  Cpu,
  Download,
  Loader2,
  MemoryStick,
  PlusCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { AIModel, DeviceProfile, ModelRecommendation } from '@/types';

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} ГБ`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} МБ`;
  return `${Math.round(bytes / 1000)} КБ`;
}

function backendOf(m: AIModel): string {
  try {
    const cfg = JSON.parse(m.config) as { backend?: string };
    if (cfg.backend === 'whisper_cpp') return 'whisper.cpp';
    if (cfg.backend === 'funasr') return 'FunASR';
  } catch {
    /* ignore malformed config */
  }
  const mid = (m.model_id ?? '').toLowerCase();
  if (mid.includes('funasr') || mid.includes('paraformer') || mid.includes('iic/')) return 'FunASR';
  if (mid.includes('ggml') || mid.includes('gguf') || mid.includes('whisper')) return 'whisper.cpp';
  return m.source;
}

export function LiveTranscriptionSettings() {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [localModels, setLocalModels] = useState<AIModel[]>([]);
  const [apiModels, setApiModels] = useState<AIModel[]>([]);

  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [modelName, setModelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    // Load each piece independently so one failing/new command (e.g. a stale
    // backend binary) doesn't blank out the whole section.
    const [p, rec, list] = await Promise.allSettled([
      invoke<DeviceProfile>('get_device_profile'),
      invoke<ModelRecommendation>('recommend_transcription_model'),
      invoke<AIModel[]>('list_local_models', { modelType: 'transcription' }),
    ]);

    const errors: string[] = [];
    if (p.status === 'fulfilled') setProfile(p.value);
    else errors.push('устройство');
    if (rec.status === 'fulfilled') setRecommendation(rec.value);
    else errors.push('рекомендация модели');
    if (list.status === 'fulfilled') {
      setLocalModels(list.value.filter(m => m.source === 'local'));
      setApiModels(list.value.filter(m => m.source === 'api'));
    } else {
      errors.push('список моделей');
    }

    if (errors.length > 0) {
      setLoadError(
        `Не удалось загрузить: ${errors.join(', ')}. Похоже, запущен старый билд — перезапустите приложение (нужна пересборка backend).`
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!name.trim() || !endpoint.trim()) {
      setSaveError('Укажите название и адрес API');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await invoke('save_custom_api_model', {
        request: {
          id: null,
          name: name.trim(),
          api_endpoint: endpoint.trim(),
          model_name: modelName.trim() || 'whisper-1',
        },
      });
      setName('');
      setEndpoint('');
      setModelName('');
      setSaved(true);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const install = async (model: AIModel) => {
    setBusyModelId(model.id);
    setModelError(null);
    try {
      await invoke('install_model', { modelId: model.id });
      await load();
    } catch (err) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyModelId(null);
    }
  };

  const remove = async (model: AIModel) => {
    setBusyModelId(model.id);
    setModelError(null);
    try {
      await invoke('uninstall_model', { modelId: model.id });
      await load();
    } catch (err) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyModelId(null);
    }
  };

  const sortedLocal = [...localModels].sort((a, b) => {
    if (a.is_downloaded !== b.is_downloaded) return a.is_downloaded ? -1 : 1;
    return (a.size_bytes ?? 0) - (b.size_bytes ?? 0);
  });

  const fmtRam = (gb: number) => `${gb} ГБ`;

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {/* Информация об устройстве + рекомендация локальной модели */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Устройство и рекомендуемая модель</h3>
          <Button variant="ghost" size="sm" onClick={() => void load()} className="h-7 gap-1 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {profile ? (
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MemoryStick className="h-4 w-4" />
              ОЗУ {fmtRam(profile.available_ram_gb)} / {fmtRam(profile.total_ram_gb)}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Cpu className="h-4 w-4" />
              {profile.cpu_count} ядер
            </div>
            <div className="text-muted-foreground">
              GPU: {profile.gpu_accelerated ? 'есть' : 'нет'}
            </div>
            <div className="text-muted-foreground">OC: {profile.os}</div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Определение устройства…</p>
        )}

        {recommendation && (
          <p className="mt-3 text-sm leading-relaxed">
            <span className="font-medium">Рекомендовано:</span> {recommendation.model_name}
            {recommendation.is_downloaded ? '' : ' — установите ниже.'}
            <span className="text-muted-foreground"> · {recommendation.reason}</span>
          </p>
        )}
      </div>

      {/* Локальные модели: установка / удаление */}
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Локальные модели</h3>
          <span className="text-xs text-muted-foreground">
            {sortedLocal.filter(m => m.is_downloaded).length}/{sortedLocal.length} установлено
          </span>
        </div>

        {modelError && (
          <p className="mb-2 text-xs text-destructive" role="alert">
            {modelError}
          </p>
        )}

        {sortedLocal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Локальные модели не найдены.</p>
        ) : (
          <ul className="space-y-2">
            {sortedLocal.map(m => {
              const busy = busyModelId === m.id;
              const downloaded = m.is_downloaded;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.name}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {backendOf(m)}
                      </span>
                      {downloaded && (
                        <span className="shrink-0 text-emerald-600">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {fmtSize(m.size_bytes)} · ОЗУ ~{fmtRam(m.recommended_ram_gb)}
                      {downloaded ? '' : ' · требует загрузку весов'}
                    </div>
                  </div>
                  {downloaded ? (
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
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Собственный API-роут */}
      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-1 font-display text-sm font-semibold">Собственный API-роут</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Подключите свою службу транскрибации: эндпоинт должен поддерживать протокол OpenAI
          <code className="mx-1 rounded bg-muted px-1">/audio/transcriptions</code>(multipart, поля{' '}
          <code>file</code> и <code>model</code>).
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Название</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Мой сервер" />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label>API Endpoint</Label>
            <Input
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Имя модели</Label>
            <Input
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              placeholder="whisper-1"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={() => void save()} disabled={saving} className="gap-2">
            <Loader2 className={`h-4 w-4 ${saving ? 'animate-spin' : 'hidden'}`} />
            <PlusCircle className={`h-4 w-4 ${saving ? 'hidden' : ''}`} />
            {saving ? 'Сохранение…' : 'Добавить'}
          </Button>
          {saved && <span className="text-xs text-emerald-600">Сохранено</span>}
          {saveError && (
            <span className="text-xs text-destructive" role="alert">
              {saveError}
            </span>
          )}
        </div>

        {apiModels.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {apiModels.map(m => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{m.name}</span>
                <span className="truncate pl-4 text-muted-foreground">
                  {m.api_endpoint}
                  {m.model_id ? ` · ${m.model_id}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
