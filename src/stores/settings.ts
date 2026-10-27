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
  /** Интервал между абзацами в редакторе, rem (0–1.5). */
  paragraphSpacing: number;
  /** Ширина листа редактора в rem (узкий/обычный/широкий). */
  sheetWidth: 'narrow' | 'normal' | 'wide';
  /** Жирность основного текста: regular/medium/semibold. */
  textWeight: 'regular' | 'medium' | 'semibold';
}

/** Идентификаторы инструментов тулбара редактора — фиксированный реестр.
 *  Порядок и видимость каждой кнопки задаются в editorSettings.toolbarItems. */
export const TOOLBAR_ITEMS = [
  'bold',
  'italic',
  'strike',
  'code',
  'highlight',
  'textColor',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'h1',
  'h2',
  'h3',
  'paragraph',
  'bulletList',
  'numberedList',
  'taskList',
  'indent',
  'outdent',
  'uppercase',
  'lowercase',
  'quote',
  'codeBlock',
  'hr',
  'link',
  'image',
  'table',
  'tableFloat',
  'imageSize',
  'imageFloat',
  'find',
  'undo',
  'redo',
  'clearFormatting',
  'removeLink',
  'export',
  'print',
] as const;

export type ToolbarItemId = (typeof TOOLBAR_ITEMS)[number];

export const DEFAULT_TOOLBAR_ITEMS: ToolbarItemId[] = [
  'bold',
  'italic',
  'strike',
  'code',
  'highlight',
  'textColor',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'h1',
  'h2',
  'h3',
  'paragraph',
  'bulletList',
  'numberedList',
  'taskList',
  'indent',
  'outdent',
  'uppercase',
  'lowercase',
  'quote',
  'codeBlock',
  'hr',
  'link',
  'image',
  'table',
  'tableFloat',
  'imageSize',
  'imageFloat',
  'find',
  'undo',
  'redo',
];

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
  theme: 'light' | 'dark' | 'system';
  font: FontSettings;
  editor: EditorSettings;
  toolbarItems: ToolbarItemId[];
  ai: AISettings;
  uiPreferences: UIPreferences;

  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFont: (font: Partial<FontSettings>) => void;
  setEditor: (editor: Partial<EditorSettings>) => void;
  setToolbarItems: (items: ToolbarItemId[]) => void;
  toggleToolbarItem: (id: ToolbarItemId) => void;
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
  paragraphSpacing: 0.5,
  sheetWidth: 'normal',
  textWeight: 'regular',
};

// No model is configured until the user actually downloads local weights or
// adds an API key — keep these neutral so the UI never pretends otherwise.
const defaultAI: AISettings = {
  transcriptionLanguage: 'auto',
  transcriptionModel: '',
  analysisModel: '',
  apiProvider: '',
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
      toolbarItems: DEFAULT_TOOLBAR_ITEMS,
      ai: defaultAI,
      uiPreferences: defaultUI,

      setTheme: theme => {
        set({ theme });
        const resolved =
          theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : theme;
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(resolved);
      },

      setFont: font => set(state => ({ font: { ...state.font, ...font } })),
      setEditor: editor => set(state => ({ editor: { ...state.editor, ...editor } })),
      setToolbarItems: items => set({ toolbarItems: items }),
      toggleToolbarItem: id =>
        set(state => {
          const current = state.toolbarItems;
          if (current.includes(id)) {
            return { toolbarItems: current.filter(x => x !== id) };
          }
          // При включении добавляем в конец, чтобы порядок остальных не менялся.
          return { toolbarItems: [...current, id] };
        }),
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
          toolbarItems: DEFAULT_TOOLBAR_ITEMS,
          ai: defaultAI,
          uiPreferences: defaultUI,
        }),

      loadFromBackend: async () => {
        try {
          const settings = (await invoke('get_settings')) as Record<string, unknown>;
          if (
            settings.theme === 'light' ||
            settings.theme === 'dark' ||
            settings.theme === 'system'
          )
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
      version: 5,
      migrate: (persistedState: unknown, version: number) => {
        let s = persistedState as Record<string, unknown>;
        if (version < 2 && s.theme === 'system') {
          s = { ...s, theme: 'light' };
        }
        if (version < 3) {
          // Drop the old fake AI defaults (funasr/local/openai): no model was
          // ever installed or connected, so nothing should claim otherwise.
          const ai = (s.ai ?? {}) as Record<string, unknown>;
          s = {
            ...s,
            ai: {
              transcriptionLanguage:
                typeof ai.transcriptionLanguage === 'string' ? ai.transcriptionLanguage : 'auto',
              transcriptionModel: '',
              analysisModel: '',
              apiProvider: '',
            },
          };
        }
        // v3 → v4: разрешаем 'system' тему (раньше принудительно сбрасывалась на light)
        if (version < 4) {
          const t = s.theme;
          if (t !== 'light' && t !== 'dark' && t !== 'system') {
            s = { ...s, theme: 'light' };
          }
        }
        // v4 → v5: новые поля редактора (paragraphSpacing, sheetWidth,
        // textWeight) и toolbarItems. Старые настройки остаются валидными,
        // просто дозаполняем дефолтами.
        if (version < 5) {
          const editor = (s.editor ?? {}) as Record<string, unknown>;
          s = {
            ...s,
            editor: {
              ...defaultEditor,
              ...editor,
              paragraphSpacing:
                typeof editor.paragraphSpacing === 'number'
                  ? editor.paragraphSpacing
                  : defaultEditor.paragraphSpacing,
              sheetWidth:
                editor.sheetWidth === 'narrow' ||
                editor.sheetWidth === 'normal' ||
                editor.sheetWidth === 'wide'
                  ? editor.sheetWidth
                  : defaultEditor.sheetWidth,
              textWeight:
                editor.textWeight === 'regular' ||
                editor.textWeight === 'medium' ||
                editor.textWeight === 'semibold'
                  ? editor.textWeight
                  : defaultEditor.textWeight,
            },
            toolbarItems: DEFAULT_TOOLBAR_ITEMS,
          };
        }
        return s as unknown as SettingsState;
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
