'use client';

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  FileText,
  Calendar,
  Settings,
  Bot,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/components/ui/theme-provider';
import { useNotes } from '@/stores/notes';

const navItems = [
  { path: '/home', label: 'Главная', icon: Home },
  { path: '/editor', label: 'Заметка', icon: FileText },
  { path: '/calendar', label: 'Календарь', icon: Calendar },
  { path: '/ai-chat', label: 'ИИ-чат', icon: Bot },
  { path: '/settings', label: 'Настройки', icon: Settings },
] as const;

/**
 * Верхняя «чёлка» — приклеена к верху экрана без отступа, на всю ширину.
 * Границы гибкие (CSS-переменные --notch-radius-bottom / --notch-pad-x),
 * каждая кнопка штатно анимирует радиус/фон — задел под hover-анимации.
 * Раскрытие/сжатие — плавное через max-width + opacity подписей.
 */
export function SidebarNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uiPreferences, toggleSidebar } = useSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const { createNote } = useNotes();
  const [creating, setCreating] = useState(false);
  const collapsed = uiPreferences.sidebarCollapsed;

  const handleNewNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await createNote(undefined, 'Новая заметка');
      navigate(`/editor/${note.id}`);
    } catch (e) {
      console.error('create note failed', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <header className="top-notch" data-collapsed={collapsed ? 'true' : 'false'} role="banner">
      <div className="notch-inner">
        {/* Левая зона: логотип по центру композиции + collapse */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2 transition-all duration-300 hover:bg-accent/70"
            aria-label="На главную"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-2xl font-display text-base font-extrabold"
              style={{ background: 'hsl(var(--primary) / 0.28)', color: 'hsl(var(--foreground))' }}
            >
              Σ
            </span>
            {!collapsed && (
              <span className="notch-label font-display text-[17px] font-bold tracking-tight">
                Σόφια
              </span>
            )}
          </button>
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-muted-foreground transition-all duration-300 hover:bg-accent/70 hover:text-foreground"
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            title={collapsed ? 'Развернуть' : 'Свернуть'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Центр: навигация — смысловой центр экрана */}
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
                className="notch-btn"
                data-active={isActive ? 'true' : 'false'}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {!collapsed && <span className="notch-label hidden sm:inline">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Правая зона: тема + единственная кнопка создания */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-all duration-300 hover:bg-accent/70 hover:text-foreground"
            aria-label="Переключить тему"
            title={resolvedTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>
          <button
            onClick={handleNewNote}
            disabled={creating}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-60',
              'shadow-[0_2px_12px_rgba(87,80,70,0.18),inset_0_1px_0_rgba(255,255,255,0.35)]'
            )}
            style={{
              background: 'hsl(var(--primary) / 0.9)',
              color: 'hsl(var(--primary-foreground))',
            }}
            aria-label="Новая заметка"
            title="Новая заметка"
          >
            <Plus className="h-4 w-4" />
            {!collapsed && (
              <span className="notch-label hidden md:inline">{creating ? '…' : 'Новая'}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
