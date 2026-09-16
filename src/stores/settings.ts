'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

export interface FontSettings {
  family: string;
  size: number;
  lineHeight: number;
}

export interface EditorSettings {
  mode: 'wysiwyg' | 'markdown';
  autoSave: boolean;
  autoSaveInterval: number;
  spellCheck: boolean;
  showLineNumbers: boolean;
  vimMode: boolean;
}

export interface AISettings {
  transcriptionLanguage: string;
  transcriptionModel: string;
  analysisModel: string;
  apiProvider: string;
}

export interface UIPreferences {
  sidebarCollapsed: boolean;
  editorLayout: 'single' | 'split' | 'triple';
  showWordCount: boolean;
  showReadingTime: boolean;
}

interface SettingsState {
  theme: 'light' | 'dark';
  font: FontSettings;
  editor: EditorSettings;
  ai: AISettings;
  uiPreferences: UIPreferences;

  setTheme: (theme: 'light' | 'dark') => void;
  setFont: (font: Partial<FontSettings>) => void;
  setEditor: (editor: Partial<EditorSettings>) => void;
  setAI: (ai: Partial<AISettings>) => void;
  setUIPreferences: (ui: Partial<UIPreferences>) => void;
  toggleSidebar: () => void;
  resetToDefaults: () => void;
  loadFromBackend: () => Promise<void>;
  saveToBackend: () => Promise<void>;
}

const defaultFont: FontSettings = {
  family: 'Onest',
  size: 15,
  lineHeight: 1.7,
};

const defaultEditor: EditorSettings = {
  mode: 'wysiwyg',
  autoSave: true,
  autoSaveInterval: 2000,
  spellCheck: true,
  showLineNumbers: false,
  vimMode: false,
};

const defaultAI: AISettings = {
  transcriptionLanguage: 'auto',
  transcriptionModel: 'funasr',
  analysisModel: 'local',
  apiProvider: 'openai',
};

const defaultUI: UIPreferences = {
  sidebarCollapsed: false,
  editorLayout: 'single',
  showWordCount: true,
  showReadingTime: true,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      font: defaultFont,
      editor: defaultEditor,
      ai: defaultAI,
      uiPreferences: defaultUI,

      setTheme: theme => {
        set({ theme });
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
      },

      setFont: font => set(state => ({ font: { ...state.font, ...font } })),
      setEditor: editor => set(state => ({ editor: { ...state.editor, ...editor } })),
      setAI: ai => set(state => ({ ai: { ...state.ai, ...ai } })),
      setUIPreferences: ui => set(state => ({ uiPreferences: { ...state.uiPreferences, ...ui } })),

      toggleSidebar: () =>
        set(state => ({
          uiPreferences: {
            ...state.uiPreferences,
            sidebarCollapsed: !state.uiPreferences.sidebarCollapsed,
          },
        })),

      resetToDefaults: () =>
        set({
          font: defaultFont,
          editor: defaultEditor,
          ai: defaultAI,
          uiPreferences: defaultUI,
        }),

      loadFromBackend: async () => {
        try {
          const settings = (await invoke('get_settings')) as Record<string, unknown>;
          if (settings.theme === 'light' || settings.theme === 'dark')
            set({ theme: settings.theme });
          if (settings.font_family || settings.font_size || settings.line_height) {
            set(state => ({
              font: {
                ...state.font,
                family: (settings.font_family as string) || state.font.family,
                size: (settings.font_size as number) || state.font.size,
                lineHeight: (settings.line_height as number) || state.font.lineHeight,
              },
            }));
          }
        } catch (error) {
          console.error('Failed to load settings from backend:', error);
        }
      },

      saveToBackend: async () => {
        const state = get();
        try {
          await invoke('update_settings', { settings: state });
        } catch (error) {
          console.error('Failed to save settings to backend:', error);
        }
      },
    }),
    {
      name: 'sofia-settings',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Record<string, unknown>;
        if (version < 2 && s.theme === 'system') {
          return { ...s, theme: 'light' } as SettingsState;
        }
        return persistedState as SettingsState;
      },
    }
  )
);

if (typeof window !== 'undefined') {
  useSettings.getState().loadFromBackend();

  useSettings.subscribe(() => {
    setTimeout(() => {
      useSettings.getState().saveToBackend();
    }, 1000);
  });
}
