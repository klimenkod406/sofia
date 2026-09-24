'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  Download,
  KeyRound,
  Loader2,
  MemoryStick,
  Mic,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AIModel, DeviceProfile, DownloadState, ModelRecommendation } from '@/types';

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} ГБ`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} МБ`;
  return `${Math.round(bytes / 1000)} КБ`;
}

function isReady(m: AIModel): boolean {
  return m.source === 'local' ? m.is_downloaded : Boolean(m.api_key_encrypted);
}

type ModelStatus = { ok: boolean; text: string };

/** Тонкая полоса прогресса загрузки модели. */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Загрузка модели…
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      Готово
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      Не настроено
    </span>
  );
}

function Details({ title }: { title: string }) {
  return (
    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
      {title}
      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
    </summary>
  );
}

/**
 * Единое место для работы с моделями. Без жаргона: «Голосовой ввод» (одна
 * локальная модель или облачный сервис) и «ИИ-помощник» (чат с текстом
 * заметок — облако по умолчанию, тяжёлые локальные модели опционально).
 */
export function AiModelsSettings() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [keySavingId, setKeySavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, ModelStatus>>({});

  const [routeName, setRouteName] = useState('');
  const [routeEndpoint, setRouteEndpoint] = useState('');
  const [routeModel, setRouteModel] = useState('');
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSaved, setRouteSaved] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const [list, prof, rec] = await Promise.allSettled([
      invoke<AIModel[]>('list_local_models'),
      invoke<DeviceProfile>('get_device_profile'),
      invoke<ModelRecommendation>('recommend_transcription_model'),
    ]);

    const errors: string[] = [];
    if (list.status === 'fulfilled') setModels(list.value);
    else errors.push('каталог моделей');
    if (prof.status === 'fulfilled') setProfile(prof.value);
    else errors.push('устройство');
    // Рекомендация необязательна: без активных моделей бэкенд вернёт ошибку —
    // это не повод ругать пользователя за «старый билд».
    if (rec.status === 'fulfilled') setRecommendation(rec.value);
    else setRecommendation(null);

    if (errors.length > 0) {
      setLoadError(
        `Не удалось загрузить: ${errors.join(', ')}. Похоже, запущен старый билд — перезапустите приложение (нужна пересборка backend).`
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Опрос загрузки после размонтирования страницы останавливаем.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const transcription = models.filter(m => m.model_type === 'transcription');
  const localTranscription = transcription
    .filter(m => m.source === 'local')
    .sort((a, b) => a.size_bytes - b.size_bytes);
  const apiTranscription = transcription.filter(m => m.source === 'api');
  const chatModels = models.filter(
    m => m.model_type === 'chat' || m.model_type === 'analysis'
  );
  const localChat = chatModels
    .filter(m => m.source === 'local')
    .sort((a, b) => a.size_bytes - b.size_bytes);
  const apiChat = chatModels.filter(m => m.source === 'api');

  const transcriptionReady = transcription.some(isReady);
  const chatReady = chatModels.some(isReady);
  const readyTranscriptionNames = transcription.filter(isReady).map(m => m.name);
  const readyChatNames = chatModels.filter(isReady).map(m => m.name);

  const recommendedModel = recommendation
    ? (models.find(m => m.id === recommendation.model_id) ?? null)
    : null;

  /** Ждём завершения фоновой загрузки, опрашивая `get_download_progress`. */
  const pollDownload = async (modelId: string): Promise<void> => {
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
      if (!mountedRef.current) return;
      let st: DownloadState | null = null;
      try {
        st = await invoke<DownloadState | null>('get_download_progress', { modelId });
      } catch {
        st = null;
      }
      if (!st) continue;
      setProgress(p => ({ ...p, [modelId]: st.progress }));
      if (st.status === 'completed') return;
      if (st.status === 'failed' || st.status === 'cancelled') {
        throw new Error(st.error || 'Не удалось скачать модель.');
      }
    }
    throw new Error(
      'Превышено время ожидания загрузки. Проверьте интернет и попробуйте ещё раз.'
    );
  };

  const install = async (model: AIModel) => {
    setBusyModelId(model.id);
    setProgress(p => ({ ...p, [model.id]: 0 }));
    setStatus(s => ({ ...s, [model.id]: { ok: true, text: 'Загрузка…' } }));
    try {
      // Команда стартует загрузку в фоне и возвращается сразу.
      await invoke('install_model', { modelId: model.id });
      await pollDownload(model.id);
      if (!mountedRef.current) return;
      setStatus(s => ({ ...s, [model.id]: { ok: true, text: 'Модель установлена.' } }));
      await load();
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus(s => ({
        ...s,
        [model.id]: { ok: false, text: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      if (mountedRef.current) {
        setBusyModelId(null);
        setProgress(p => ({ ...p, [model.id]: 0 }));
      }
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
    const apiKey = (keyDrafts[model.id] ?? '').trim();
    if (!apiKey) return;
    setKeySavingId(model.id);
    try {
      await invoke('set_api_key', { modelId: model.id, apiKey });
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
            ? 'Соединение установлено — сервис доступен.'
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

  const saveRoute = async () => {
    if (!routeName.trim() || !routeEndpoint.trim()) {
      setRouteError('Укажите название и адрес API');
      return;
    }
    setRouteSaving(true);
    setRouteError(null);
    setRouteSaved(false);
    try {
      await invoke('save_custom_api_model', {
        request: {
          id: null,
          name: routeName.trim(),
          api_endpoint: routeEndpoint.trim(),
          model_name: routeModel.trim() || 'whisper-1',
        },
      });
      setRouteName('');
      setRouteEndpoint('');
      setRouteModel('');
      setRouteSaved(true);
      await load();
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : String(err));
    } finally {
      setRouteSaving(false);
    }
  };

  const localModelRow = (m: AIModel, highlightRecommended: boolean) => {
    const busy = busyModelId === m.id;
    // Загрузка, начатая ранее (например, после перехода в настройки): прогресс
    // живёт в БД, список моделей его подхватывает при загрузке.
    const backgroundDownload =
      !busy && !m.is_downloaded && m.download_progress > 0 && m.download_progress < 1;
    const showBar = busy || backgroundDownload;
    const barValue = busy ? (progress[m.id] ?? 0) : m.download_progress;
    const msg = status[m.id];
    return (
      <li key={m.id} className="rounded-lg border border-border px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{m.name}</span>
              {highlightRecommended && !m.is_downloaded && (
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                  рекомендована
                </span>
              )}
              {m.is_downloaded && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {fmtSize(m.size_bytes)} · ОЗУ ~{m.recommended_ram_gb} ГБ
              {m.is_downloaded ? '' : ' · требуется загрузка'}
            </div>
            {msg && (
              <p className={`mt-1 text-xs ${msg.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                {msg.text}
              </p>
            )}
          </div>
          {m.is_downloaded ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void remove(m)}
              disabled={busy}
              className="h-8 shrink-0 gap-1.5 text-muted-foreground"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Удалить
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void install(m)}
              disabled={busy || backgroundDownload}
              className="h-8 shrink-0 gap-1.5"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? 'Загрузка…' : 'Скачать'}
            </Button>
          )}
        </div>
        {showBar && (
          <div className="mt-2">
            <ProgressBar value={barValue} />
          </div>
        )}
      </li>
    );
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
            Проверить
          </Button>
        </div>
        {!hasKey && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={keyDrafts[m.id] ?? ''}
              onChange={e => setKeyDrafts(d => ({ ...d, [m.id]: e.target.value }))}
              placeholder="API-ключ (sk-...)"
              className="h-8 w-56"
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
            <h3 className="font-display text-sm font-semibold">Голосовой ввод</h3>
          </div>
          <StatusBadge ready={transcriptionReady} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Диктовка и транскрибация аудио в заметках. Достаточно одной локальной
          модели — или подключите облачный сервис.
        </p>

        {!transcriptionReady && recommendedModel && (
          <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {profile && (
                <>
                  <span className="flex items-center gap-1">
                    <MemoryStick className="h-3.5 w-3.5" />
                    ОЗУ {profile.available_ram_gb} / {profile.total_ram_gb} ГБ
                  </span>
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5" />
                    {profile.cpu_count} ядер
                  </span>
                </>
              )}
              <span>Подобрано автоматически под ваше устройство</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{recommendedModel.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize(recommendedModel.size_bytes)} · ОЗУ ~
                  {recommendedModel.recommended_ram_gb} ГБ
                </p>
              </div>
              <Button
                onClick={() => void install(recommendedModel)}
                disabled={busyModelId === recommendedModel.id}
                className="gap-2"
              >
                {busyModelId === recommendedModel.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {busyModelId === recommendedModel.id ? 'Загрузка…' : 'Установить'}
              </Button>
            </div>
            {busyModelId === recommendedModel.id && (
              <div className="mt-3">
                <ProgressBar value={progress[recommendedModel.id] ?? 0} />
              </div>
            )}
          </div>
        )}

        {transcriptionReady && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Голосовой ввод работает
              {readyTranscriptionNames.length > 0 && <>: {readyTranscriptionNames.join(', ')}</>}.
            </span>
          </div>
        )}

        {localTranscription.length > 0 && (
          <details className="group mb-2">
            <Details title="Локальные модели" />
            <ul className="mt-3 space-y-2">
              {localTranscription.map(m => localModelRow(m, recommendation?.model_id === m.id))}
            </ul>
          </details>
        )}

        <details className="group">
          <Details title="Облачная транскрибация (API)" />
          <div className="mt-3 space-y-4">
            {apiTranscription.length > 0 && (
              <ul className="space-y-2">{apiTranscription.map(apiModelRow)}</ul>
            )}

            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium">Свой сервис транскрибации</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Подключите свою службу с протоколом OpenAI{' '}
                <code className="mx-0.5 rounded bg-muted px-1">/audio/transcriptions</code>.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Название</Label>
                  <Input
                    value={routeName}
                    onChange={e => setRouteName(e.target.value)}
                    placeholder="Мой сервер"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Адрес API</Label>
                  <Input
                    value={routeEndpoint}
                    onChange={e => setRouteEndpoint(e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Имя модели</Label>
                  <Input
                    value={routeModel}
                    onChange={e => setRouteModel(e.target.value)}
                    placeholder="whisper-1"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => void saveRoute()}
                  disabled={routeSaving}
                  className="gap-2"
                >
                  <Loader2 className={`h-4 w-4 ${routeSaving ? 'animate-spin' : 'hidden'}`} />
                  <PlusCircle className={`h-4 w-4 ${routeSaving ? 'hidden' : ''}`} />
                  {routeSaving ? 'Сохранение…' : 'Добавить'}
                </Button>
                {routeSaved && <span className="text-xs text-emerald-600">Сохранено</span>}
                {routeError && (
                  <span className="text-xs text-destructive" role="alert">
                    {routeError}
                  </span>
                )}
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* ============ ИИ-ПОМОЩНИК ============ */}
      <section className="rounded-xl border border-border p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">ИИ-помощник</h3>
          </div>
          <StatusBadge ready={chatReady} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Работает с текстом заметок: суммаризация, исправление ошибок, перевод и
          ответы на вопросы — в разделе «AI-чат».
        </p>

        {chatReady && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Помощник доступен
              {readyChatNames.length > 0 && <>: {readyChatNames.join(', ')}</>}.
            </span>
          </div>
        )}

        {apiChat.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-sm font-medium">Облачный вариант (рекомендуется)</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Работает быстро и не занимает место на диске. Нужен API-ключ сервиса.
            </p>
            <ul className="space-y-2">{apiChat.map(apiModelRow)}</ul>
          </div>
        )}

        {localChat.length > 0 && (
          <details className="group">
            <Details title="Локальные модели (без интернета)" />
            <div className="mt-3">
              <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                Такие модели весят 2–4,5 ГБ и работают медленнее на ноутбуке.
                Ставьте их, только если нужен чат без доступа в интернет.
              </p>
              <ul className="space-y-2">{localChat.map(m => localModelRow(m, false))}</ul>
            </div>
          </details>
        )}
      </section>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Изменения применяются сразу.</span>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="h-7 gap-1 px-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Обновить
        </Button>
      </div>
    </div>
  );
}
