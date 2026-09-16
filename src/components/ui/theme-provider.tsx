'use client';
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Только две темы: светлая и тёмная (тёплые пастельные), без system.
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'light',
  enableSystem = false,
}: {
  children: ReactNode;
  attribute?: 'class' | 'data-theme';
  defaultTheme?: Theme;
  enableSystem?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('sofia-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    void enableSystem; // проп оставлен для совместимости API

    setResolvedTheme(theme);
    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('sofia-theme', theme);
  }, [theme, enableSystem, mounted, attribute]);

  // Важно: Provider рендерится всегда, даже до mount.
  // Иначе дети (напр. SidebarNav → useTheme) падают на первом рендере
  // с "useTheme must be used within a ThemeProvider" и виден белый экран.
  // Гейт `mounted` остаётся только для записи класса темы в <html>.
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
