'use client';

import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { cn } from '@/utils/cn';

function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w;
}

async function appWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

/**
 * Custom frameless-window title bar.
 * Rendered only inside Tauri (hidden in plain browser dev).
 * The container is a drag region (`data-tauri-drag-region`) so the
 * borderless window can be moved; buttons opt out implicitly as
 * separate hit-test targets.
 */
export function TitleBar() {
  const [tauri, setTauri] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setTauri(isTauri());
  }, []);

  useEffect(() => {
    if (!tauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const win = await appWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          try {
            setMaximized(await win.isMaximized());
          } catch {
            /* window gone */
          }
        });
      } catch {
        /* not in Tauri after all */
      }
    })();
    return () => unlisten?.();
  }, [tauri]);

  if (!tauri) return null;

  const minimize = async () => {
    try {
      await (await appWindow()).minimize();
    } catch (e) {
      console.error('minimize failed:', e);
    }
  };

  const toggleMaximize = async () => {
    try {
      const win = await appWindow();
      await win.toggleMaximize();
      setMaximized(await win.isMaximized());
    } catch (e) {
      console.error('toggle maximize failed:', e);
    }
  };

  const close = async () => {
    try {
      await (await appWindow()).close();
    } catch (e) {
      console.error('close failed:', e);
    }
  };

  const btn =
    'flex items-center justify-center w-10 h-9 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent focus-visible:outline-none';

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={toggleMaximize}
      className="titlebar-glass relative z-40 flex h-9 shrink-0 select-none items-center gap-2 pl-3 pr-1"
      aria-label="Window title bar"
    >
      {/* Left: app mark (draggable) */}
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="text-muted-foreground">Σόφια</span>
      </div>

      {/* Center spacer keeps the floating nav pill visually clear */}
      <div className="flex-1" />

      {/* Window controls */}
      <div className="flex items-center">
        <button className={btn} onClick={minimize} title="Свернуть" aria-label="Minimize window">
          <Minus className="h-4 w-4" />
        </button>
        <button
          className={btn}
          onClick={toggleMaximize}
          title={maximized ? 'Восстановить' : 'Развернуть'}
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          className={cn(btn, 'hover:!bg-destructive hover:!text-destructive-foreground')}
          onClick={close}
          title="Закрыть"
          aria-label="Close window"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
