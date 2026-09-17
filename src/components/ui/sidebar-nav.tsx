'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, Settings, Bot, Plus, Sun, Moon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTheme } from '@/components/ui/theme-provider';
import { useNotes } from '@/stores/notes';
import { toast } from '@/hooks/use-toast';

// Навигация верхнего уровня. Редактора здесь нет осознанно:
// заметка создаётся (кнопка «Новая» / empty-state на главной) и открывается
// сразу по id; вход в существующую — только через домашний экран.
const navItems = [
  { path: '/home', label: 'Главная', icon: Home },
  { path: '/calendar', label: 'Календарь', icon: Calendar },
  { path: '/ai-chat', label: 'ИИ-чат', icon: Bot },
  { path: '/settings', label: 'Настройки', icon: Settings },
] as const;

/**
 * Верхняя шапка-плашка: прямоугольник строго по центру верха, пришит
 * к верхней кромке, по бокам пусто. Лежит поверх контента (fixed):
 * при скролле лента уходит под неё, слева/справа доходит до верха.
 * Все кнопки — только иконки; подпись всплывает оверлейным окном
 * при наведении (.notch-tip). Логотип — только надпись без иконки.
 */
export function SidebarNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const { createNote } = useNotes();
  const [creating, setCreating] = useState(false);
  // В Tauri сверху системный TitleBar (h-9 = 36px) — плашка пришивается под ним,
  // в обычном браузере TitleBar нет — пришивается к самому верху.
  const [tauriOffset, setTauriOffset] = useState(0);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    if ('__TAURI_INTERNALS__' in w || '__TAURI__' in w) setTauriOffset(36);
  }, []);

  const handleNewNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await createNote(null, 'Новая заметка');
      navigate(`/editor/${note.id}`);
    } catch (e) {
      console.error('create note failed', e);
      toast({
        title: 'Не получилось создать заметку',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="top-notch shrink-0" style={{ top: tauriOffset }} role="banner">
        <div className="notch-inner">
          {/* Левая зона: только надпись, без иконки */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/home')}
              className="rounded-2xl px-3 py-2 transition-all duration-300 hover:bg-accent/70"
              aria-label="На главную"
            >
              <span className="font-display text-[17px] font-bold tracking-tight">Σόφια</span>
            </button>
          </div>

          {/* Центр: навигация — только иконки, подпись оверлеем при наведении */}
          <nav
            className="flex flex-1 items-center justify-center gap-1.5"
            role="navigation"
            aria-label="Основная навигация"
          >
            {navItems.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="notch-btn group"
                  data-active={isActive ? 'true' : 'false'}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="notch-tip" aria-hidden="true">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Правый угол: тема + создание без подложки, на одной линии с шапкой */}
      <div
        className="notch-actions"
        style={{ top: tauriOffset + 8 }}
        role="group"
        aria-label="Быстрые действия"
      >
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="notch-btn group"
          aria-label={resolvedTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
          <span className="notch-tip" aria-hidden="true">
            {resolvedTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          </span>
        </button>
        <button
          onClick={handleNewNote}
          disabled={creating}
          className={cn('notch-btn notch-btn-accent group', creating && 'animate-pulse')}
          aria-label="Новая заметка"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="notch-tip" aria-hidden="true">
            {creating ? 'Создание…' : 'Новая заметка'}
          </span>
        </button>
      </div>
    </>
  );
}
