import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { LiveSegment, LiveStatus, LiveTranscriptionResult } from '@/types';

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 2;
const PROCESSOR_BUFFER = 4096;

const EVT_SEGMENT = 'live-transcription://segment';
const EVT_PARTIAL = 'live-transcription://partial';
const EVT_STATUS = 'live-transcription://status';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export interface LiveTranscriptionController {
  sessionId: string | null;
  isRecording: boolean;
  segments: LiveSegment[];
  partialText: string;
  status: LiveStatus | null;
  error: string | null;
  startRecording: (modelId?: string, language?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
}

export function useLiveTranscription(): LiveTranscriptionController {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [partialText, setPartialText] = useState('');
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const accumulatorRef = useRef<Float32Array>(new Float32Array(0));
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const unsubscribe = useCallback(() => {
    unlistenersRef.current.forEach(fn => fn());
    unlistenersRef.current = [];
  }, []);

  const subscribe = useCallback(async (sid: string) => {
    const unlisteners: UnlistenFn[] = [];
    unlisteners.push(
      await listen<LiveSegment>(EVT_SEGMENT, event => {
        if (event.payload.session_id === sid) {
          setSegments(prev => {
            // guard against a duplicate id if the worker ever re-emits
            const seen = prev.some(s => s.paragraph_id === event.payload.paragraph_id);
            return seen ? prev : [...prev, event.payload];
          });
        }
      })
    );
    unlisteners.push(
      await listen<{ session_id: string; text: string }>(EVT_PARTIAL, event => {
        if (event.payload.session_id === sid) setPartialText(event.payload.text);
      })
    );
    unlisteners.push(
      await listen<LiveStatus>(EVT_STATUS, event => {
        if (event.payload.session_id === sid) {
          setStatus(event.payload);
          if (event.payload.error) setError(event.payload.error);
        }
      })
    );
    unlistenersRef.current = unlisteners;
  }, []);

  const sendChunk = useCallback(async (sid: string, floats: Float32Array) => {
    const int16 = new Int16Array(floats.length);
    for (let i = 0; i < floats.length; i += 1) {
      const s = Math.max(-1, Math.min(1, floats[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(int16.buffer);
    await invoke('push_live_audio_chunk', { sessionId: sid, chunkBase64: bytesToBase64(bytes) });
  }, []);

  const teardownCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    accumulatorRef.current = new Float32Array(0);
  }, []);

  const startRecording = useCallback(
    async (modelId?: string, language?: string) => {
      if (sessionRef.current) return; // already recording
      setError(null);
      setSegments([]);
      setPartialText('');
      setStatus(null);
      try {
        const sid = (await invoke('start_live_transcription', {
          request: { model_id: modelId ?? null, language: language ?? 'auto', options: null },
        })) as string;
        sessionRef.current = sid;
        setSessionId(sid);
        setIsRecording(true);
        await subscribe(sid);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
        const perChunk = TARGET_SAMPLE_RATE * CHUNK_SECONDS;

        processor.onaudioprocess = e => {
          const input = e.inputBuffer.getChannelData(0);
          const cur = accumulatorRef.current;
          const next = new Float32Array(cur.length + input.length);
          next.set(cur, 0);
          next.set(input, cur.length);
          if (next.length >= perChunk) {
            const chunk = next.subarray(0, perChunk);
            accumulatorRef.current = next.slice(perChunk);
            void sendChunk(sid, chunk).catch((err: unknown) =>
              setError(String(err instanceof Error ? err.message : err))
            );
          } else {
            accumulatorRef.current = next;
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        processorRef.current = processor;
      } catch (err: unknown) {
        setError(String(err instanceof Error ? err.message : err));
        teardownCapture();
        // roll back the backend session if it ever started
        const sid = sessionRef.current;
        if (sid) {
          try {
            await invoke('stop_live_transcription', { sessionId: sid });
          } catch {
            /* ignore */
          }
        }
        sessionRef.current = null;
        setSessionId(null);
        setIsRecording(false);
        unsubscribe();
      }
    },
    [sendChunk, subscribe, teardownCapture, unsubscribe]
  );

  const stopRecording = useCallback(async () => {
    // Двойной клик / повторный вызов не должен останавливать сессию дважды —
    // второй `stop_live_transcription` упал бы с «Unknown live session».
    if (stoppingRef.current) return;
    const sid = sessionRef.current;
    if (!sid) return;
    stoppingRef.current = true;

    // Финальный результат бэкенда (все абзацы, включая хвост). Хук
    // отписывается от событий сразу после остановки, а финальные segment
    // события могут не успеть дойти до webview — поэтому хвост берём из
    // возвращённого значения и мёржим в состояние по paragraph_id.
    let finalSegments: LiveSegment[] = [];

    try {
      // Flush the trailing partial chunk (the <2s tail that never triggered a
      // full-chunk send) so the final backend decode sees every sample.
      if (accumulatorRef.current.length > 0) {
        const tail = accumulatorRef.current;
        accumulatorRef.current = new Float32Array(0);
        try {
          await sendChunk(sid, tail);
        } catch (err: unknown) {
          setError(String(err instanceof Error ? err.message : err));
        }
      }
      teardownCapture();
      try {
        const result = (await invoke('stop_live_transcription', {
          sessionId: sid,
        })) as LiveTranscriptionResult | null;
        finalSegments = result?.paragraphs ?? [];
      } catch (err: unknown) {
        setError(String(err instanceof Error ? err.message : err));
      }
    } finally {
      sessionRef.current = null;
      setSessionId(null);
      setIsRecording(false);
      stoppingRef.current = false;
      if (finalSegments.length > 0) {
        setSegments(prev => {
          const seen = new Set(prev.map(s => s.paragraph_id));
          const fresh = finalSegments.filter(s => !seen.has(s.paragraph_id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }
      // keep segments around so the caller can still see what was captured
      unsubscribe();
    }
  }, [sendChunk, teardownCapture, unsubscribe]);

  useEffect(() => unsubscribe, [unsubscribe]);

  return {
    sessionId,
    isRecording,
    segments,
    partialText,
    status,
    error,
    startRecording,
    stopRecording,
  };
}
