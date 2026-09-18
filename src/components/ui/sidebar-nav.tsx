'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, Bot, Settings, Search, X } from 'lucide-react';
import { useNotes } from '@/stores/notes';

// Навигация верхнего уровня. Редактора здесь нет осознанно:
// заметка создаётся (empty-state на главной) и открывается сразу по id;
// вход в существующую — только через домашний экран.
const navItems = [
  { path: '/home', label: 'Главная', icon: Home },
  { path: '/calendar', label: 'Календарь', icon: Calendar },
  { path: '/ai-chat', label: 'ИИ-чат', icon: Bot },
] as const;

/**
 * Верхняя зона: два элемента с отступом от края.
 * - Слева — просто надпись-логотип (клик ведёт домой).
 * - По центру — стеклянный островок: иконки разделов, поиск, настройки.
 * Островок виден всегда, никакого разворачивания.
 * Поиск — глобальный: печатаешь где угодно, фильтр применяется и ведёт на /home.
 */
export function SidebarNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { filter, setFilter } = useNotes();
  const [searchQuery, setSearchQuery] = useState(filter.searchQuery ?? '');

  // Поиск с дебаунсом: фильтр живёт в сторе, лента главной перезагружается сама.
  // Если печатаем не на главной — уводим туда, чтобы результат был виден.
  useEffect(() => {
    const debounce = setTimeout(() => {
      setFilter({ searchQuery });
      if (searchQuery && location.pathname !== '/home') navigate('/home');
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <>
      {/* Логотип — просто надпись слева */}
      <div className="logo-island">
        <button
          onClick={() => navigate('/home')}
          className="notch-logo"
          aria-label="На главную"
          title="На главную"
        >
          <span className="font-display text-[17px] font-bold tracking-tight">Σόφια</span>
        </button>
      </div>

      {/* Островок навигации — по центру */}
      <header className="top-notch" role="banner">
        <div className="notch-inner">
          <nav
            className="flex shrink-0 items-center gap-1.5"
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

          <div className="notch-divider" aria-hidden="true" />

          <div className="notch-search" role="search">
            <div className="notch-search-box">
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

          <div className="notch-divider" aria-hidden="true" />

          <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Настройки">
            <button
              onClick={() => navigate('/settings')}
              className="notch-btn group"
              data-active={isSettingsActive ? 'true' : 'false'}
              aria-current={isSettingsActive ? 'page' : undefined}
              aria-label="Настройки"
            >
              <Settings className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="notch-tip" aria-hidden="true">
                Настройки
              </span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
