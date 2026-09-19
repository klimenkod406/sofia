'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Minus, Square, Copy, X, Settings, Search, ArrowLeft } from 'lucide-react';
import { useNotes } from '@/stores/notes';
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
 * Единая шапка-оверлей поверх прокручиваемого контента (контент скроллится
 * под ней до самого верха). Без подложки и бортиков.
 * Ряд: слева логотип (drag-регион) и хлебные крошки «Главная» (ведут на
 * главную), по центру — поиск, справа — настройки и кнопки окна (Tauri).
 */
export function TitleBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { filter, setFilter } = useNotes();
  const [tauri, setTauri] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filter.searchQuery ?? '');

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

  // Поиск с дебаунсом: фильтр в сторе, лента главной перезагружается сама.
  // Печатаем не на главной — уводим туда, чтобы результат был виден.
  useEffect(() => {
    const debounce = setTimeout(() => {
      setFilter({ searchQuery });
      if (searchQuery && location.pathname !== '/home') navigate('/home');
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const isSettingsActive = location.pathname.startsWith('/settings');

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

  // Плоские минималистичные кнопки-иконки без подложки и бортиков.
  const iconBtn =
    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={tauri ? toggleMaximize : undefined}
      className="absolute inset-x-0 top-0 z-40 flex h-12 shrink-0 select-none items-start gap-1 bg-transparent px-3"
      aria-label="Window title bar"
    >
      {/* Лого слева (чуть ниже верха) — drag-регион, клик ведёт на главную;
          под лого — хлебная крошка «Главная» (скрыта на самой главной) */}
      <div className="flex shrink-0 flex-col items-start gap-0.5 pl-1">
        <button
          data-tauri-drag-region
          onClick={() => navigate('/home')}
          className="mt-1.5 flex cursor-pointer items-center"
          aria-label="На главную"
          title="На главную"
        >
          <span className="font-display text-[17px] font-bold tracking-tight text-foreground/90">
            Σόφια
          </span>
        </button>

        {location.pathname !== '/home' && (
          <nav role="navigation" aria-label="Навигация по разделам">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="На главную"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Главная
            </button>
          </nav>
        )}
      </div>

      {/* Поиск — по центру, опущен на 40px от верха */}
      <div className="notch-search mt-[40px]" role="search">
        <div className="notch-search-box mx-auto">
          <Search className="notch-search-icon" aria-hidden="true" />
          <input
            className="notch-search-input"
            placeholder="Найти…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Поиск заметок"
          />
          {searchQuery && (
            <button
              className="notch-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить поиск"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Настройки + кнопки окна — справа */}
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Управление окном">
        <button
          className={cn(iconBtn, isSettingsActive && 'bg-accent/70 text-foreground')}
          onClick={() => navigate('/settings')}
          data-active={isSettingsActive ? 'true' : 'false'}
          aria-current={isSettingsActive ? 'page' : undefined}
          aria-label="Настройки"
          title="Настройки"
        >
          <Settings className="h-[17px] w-[17px]" aria-hidden="true" />
        </button>

        {tauri && (
          <>
            <button
              className={iconBtn}
              onClick={minimize}
              title="Свернуть"
              aria-label="Minimize window"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              className={iconBtn}
              onClick={toggleMaximize}
              title={maximized ? 'Восстановить' : 'Развернуть'}
              aria-label={maximized ? 'Restore window' : 'Maximize window'}
            >
              {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </button>
            <button
              className={cn(
                iconBtn,
                'hover:!bg-[hsl(var(--destructive))] hover:!text-[hsl(var(--destructive-foreground))]'
              )}
              onClick={close}
              title="Закрыть"
              aria-label="Close window"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}