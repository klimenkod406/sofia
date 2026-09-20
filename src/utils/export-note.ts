'use client';

import { invoke } from '@tauri-apps/api/core';

function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SaveTextFileOptions {
  defaultName: string;
  content: string;
  /** Расширения для фильтра диалога сохранения (без точки). */
  extensions: string[];
  mimeType: string;
}

/**
 * Сохраняет текстовый контент в файл. В Tauri открывает системный диалог
 * сохранения и пишет через backend-команду `write_file` (обычный PathBuf,
 * без ограничений scope плагина fs). В браузере (npm run dev без Tauri)
 * скачивает файл через Blob.
 */
export async function saveTextFile(opts: SaveTextFileOptions): Promise<void> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: opts.defaultName,
      filters: [{ name: 'Document', extensions: opts.extensions }],
    });
    if (!path) return; // пользователь отменил диалог
    await invoke('write_file', { request: { path, content: opts.content } });
    return;
  }

  const blob = new Blob([opts.content], { type: opts.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Оборачивает HTML заметки в полноценный документ для экспорта. */
export function wrapHtml(title: string, bodyHtml: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="ru">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    'body { max-width: 65ch; margin: 3rem auto; padding: 0 1.5rem; font: 16px/1.7 -apple-system, "Segoe UI", system-ui, sans-serif; color: #2a241e; }',
    'h1,h2,h3 { line-height: 1.25; }',
    'pre { background: #f5f1ea; padding: 1rem; border-radius: 10px; overflow-x: auto; }',
    'pre code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.9em; }',
    'blockquote { border-left: 3px solid #c9bda8; margin-left: 0; padding-left: 1rem; color: #6b6152; }',
    'img { max-width: 100%; border-radius: 8px; }',
    'table { border-collapse: collapse; }',
    'th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; }',
    '</style>',
    '</head>',
    '<body>',
    bodyHtml,
    '</body>',
    '</html>',
  ].join('\n');
}
