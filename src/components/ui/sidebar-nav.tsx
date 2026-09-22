'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useNotes } from '@/stores/notes';

/**
 * Второй ряд шапки (под TitleBar): прозрачный, без подложки и бортиков.
 * Только поиск по центру. «Главная» удалена, «Календарь» переехал на тулбар
 * главной рядом с сортировкой, «Настройки» — к кнопкам окна в TitleBar.
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

  return (
    <header className="top-notch" role="banner">
      <div className="notch-inner">
        {/* Поиск — по центру, единственный элемент */}
        <div className="notch-search" role="search">
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
      </div>
    </header>
  );
}
