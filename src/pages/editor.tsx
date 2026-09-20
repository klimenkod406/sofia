'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { invoke } from '@tauri-apps/api/core';
import { useNotes, type Note } from '@/stores/notes';
import { useSettings } from '@/stores/settings';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, Search, X } from 'lucide-react';

// Общий экземпляр подсветки синтаксиса (lowlight v3): создаём один раз.
const lowlight = createLowlight(common);

export function EditorPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { currentNote, setCurrentNote, updateNote } = useNotes();
  const { font, editor: editorSettings, uiPreferences } = useSettings();
  // Вход в редактор — только с существующим id (создание происходит
  // на главной / в чёлке с немедленным переходом на /editor/:id).
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [docStats, setDocStats] = useState({ words: 0, chars: 0 });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isSavingRef = useRef(false);
  // Всё изменяемое — через ref'ы: onUpdate в useEditor регистрируется один раз
  // при монтировании, замыкание на state было бы протухшим (это и ломало сейв).
  const noteRef = useRef<Note | null>(null);
  const settingsRef = useRef(editorSettings);
  const updateRef = useRef(updateNote);
  const pendingRef = useRef<{ html: string; text: string } | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  noteRef.current = currentNote;
  settingsRef.current = editorSettings;
  updateRef.current = updateNote;

  const doSave = async (html: string, text: string) => {
    const note = noteRef.current;
    if (!note || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateRef.current({
        id: note.id,
        content: text,
        content_md: text,
        content_html: html,
      });
    } catch (e) {
      console.error('autosave failed', e);
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const scheduleSave = (html: string, text: string) => {
    pendingRef.current = { html, text };
    if (!settingsRef.current.autoSave) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const delay = Math.max(500, settingsRef.current.autoSaveInterval || 2000);
    saveTimeoutRef.current = setTimeout(() => {
      const p = pendingRef.current;
      pendingRef.current = null;
      if (p) void doSave(p.html, p.text);
    }, delay);
  };

  const flushSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) void doSave(p.html, p.text);
  };

  // Initialize Tiptap editor
  const tiptapEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        // CodeBlockLowlight ниже предоставляет свой codeBlock — иначе дубликат 'blockCode'.
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? 'Заголовок' : 'Начните писать…',
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty-node',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline hover:no-underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full h-auto' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'javascript' }),
      Markdown.configure({ transformPastedText: true, transformCopiedText: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: currentNote?.content_html || '',
    editorProps: {
      attributes: {
        class: 'editor-prose',
        style: `font-family: ${font.family}; font-size: ${font.size}px; line-height: ${font.lineHeight};`,
      },
    },
    onUpdate: ({ editor }) => {
      // Колбэк живёт с монтирования — внутри только ref-безопасный scheduleSave.
      scheduleSave(editor.getHTML(), editor.getText());
    },
    onCreate: ({ editor }) => {
      editor.commands.focus();
    },
  });

  // Живой счётчик слов/символов: пересчитываем на каждую транзакцию контента.
  useEffect(() => {
    if (!tiptapEditor) return;
    const update = () => {
      const text = tiptapEditor.state.doc.textContent;
      setDocStats({
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        chars: text.length,
      });
    };
    update();
    tiptapEditor.on('update', update);
    return () => {
      tiptapEditor.off('update', update);
    };
  }, [tiptapEditor]);

  // Вход в редактор — только с существующим id (создание происходит
  // на главной / в чёлке с немедленным переходом на /editor/:id).
  useEffect(() => {
    if (!noteId) return;
    setNotFound(false);
    setLoadError(null);
    setSaveError(null);
    loadedIdRef.current = null;
    void loadNote(noteId);
    return () => {
      // Уходим со страницы — досохраняем недосохранённое.
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Контент подставляем, когда ГОТОВЫ ОБА: редактор и загруженная заметка
  // (раньше loadNote мог сработать до готовности редактора и текст терялся).
  useEffect(() => {
    if (
      tiptapEditor &&
      currentNote &&
      currentNote.id === noteId &&
      loadedIdRef.current !== currentNote.id
    ) {
      loadedIdRef.current = currentNote.id;
      tiptapEditor.commands.setContent(currentNote.content_html || '', false);
    }
  }, [tiptapEditor, currentNote, noteId]);

  const replaceAllMatches = () => {
    if (!tiptapEditor || !searchQuery) return;
    const query = searchQuery.toLocaleLowerCase();
    const transaction = tiptapEditor.state.tr;
    const matches: Array<{ from: number; to: number }> = [];
    tiptapEditor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let offset = 0;
      const text = node.text.toLocaleLowerCase();
      let index = text.indexOf(query);
      while (index !== -1) {
        matches.push({ from: pos + 1 + index, to: pos + 1 + index + searchQuery.length });
        offset = index + query.length;
        index = text.indexOf(query, offset);
      }
    });
    [...matches].reverse().forEach(match => transaction.insertText(replaceQuery, match.from, match.to));
    if (matches.length) tiptapEditor.view.dispatch(transaction);
  };

  const findNextMatch = () => {
    if (!tiptapEditor || !searchQuery) return;
    const query = searchQuery.toLocaleLowerCase();
    let found: { from: number; to: number } | null = null;
    tiptapEditor.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const start = node.text.toLocaleLowerCase().indexOf(query);
      if (start >= 0) found = { from: pos + 1 + start, to: pos + 1 + start + searchQuery.length };
    });
    if (found) {
      tiptapEditor.commands.setTextSelection(found);
      tiptapEditor.commands.focus();
    }
  };

  const loadNote = async (id: string) => {
    try {
      const note = (await invoke('get_note', { id })) as unknown as Note | null;
      if (note) {
        setCurrentNote(note);
      } else {
        setNotFound(true);
      }
    } catch (e) {
      console.error('load note failed', e);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (tiptapEditor && noteRef.current) {
          // Ctrl+S — сохранить немедленно, не ждать дебаунс
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = undefined;
          }
          pendingRef.current = null;
          void doSave(tiptapEditor.getHTML(), tiptapEditor.getText());
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Пустую ссылку не вставляем — иначе в тексте появляется битый <a href="">.
        const url = window.prompt('Ссылка (https://…):');
        if (url) tiptapEditor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
    };

    // «Сохранить» из меню «Ещё» тулбара — тот же немедленный сейв, что и Ctrl+S.
    const handleSaveEvent = () => {
      if (tiptapEditor && noteRef.current) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = undefined;
        }
        pendingRef.current = null;
        void doSave(tiptapEditor.getHTML(), tiptapEditor.getText());
      }
    };
    window.addEventListener('sofia:save-note', handleSaveEvent);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('sofia:save-note', handleSaveEvent);
    };
  }, [tiptapEditor]);

  if (!noteId) return <Navigate to="/home" replace />;

  if (notFound) {
    return (
      <div className="liquid-glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl p-10 text-center">
        <h3 className="font-display text-lg font-bold">Заметка не найдена</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Возможно, она была удалена. Вернитесь на главную и откройте другую.
        </p>
        <Button onClick={() => navigate('/home')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="liquid-glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl p-10 text-center">
        <h3 className="font-display text-lg font-bold">Не получилось открыть заметку</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{loadError}</p>
        <Button onClick={() => navigate('/home')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Button>
      </div>
    );
  }

  if (!tiptapEditor || !currentNote || currentNote.id !== noteId) return <LoadingSpinner />;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {/* Статусная строка: возврат, название, состояние сохранения, статистика */}
      <div className="editor-statusbar print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate('/home')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Все заметки
        </Button>
        <span className="truncate font-display text-sm font-bold text-muted-foreground">
          {currentNote.title || 'Без названия'}
        </span>
        {isSaving && (
          <span className="text-xs text-muted-foreground" role="status">
            Сохранение…
          </span>
        )}
        {saveError && (
          <span className="truncate text-xs text-destructive" role="alert" title={saveError}>
            Не сохранилось: {saveError}
          </span>
        )}
        {uiPreferences.showWordCount && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {docStats.words.toLocaleString()} слов · {docStats.chars.toLocaleString()} симв.
          </span>
        )}
      </div>

      {/* Тело редактора: боковые рейки с инструментами + центральная «страница» */}
      <div className="editor-stage">
        <EditorToolbar side="left" editor={tiptapEditor} noteTitle={currentNote.title} onOpenSearch={() => setShowSearch(true)} />

        <div className="editor-column">
          <div
            className="editor-sheet"
            onMouseDown={event => {
              // Клик по полю листа мимо текста ставит курсор в конец заметки.
              const target = event.target as HTMLElement;
              if (target.closest('.ProseMirror')) return;
              event.preventDefault();
              tiptapEditor.commands.focus('end');
            }}
          >
            <EditorContent editor={tiptapEditor} />
          </div>
        </div>

        <EditorToolbar side="right" editor={tiptapEditor} noteTitle={currentNote.title} onOpenSearch={() => setShowSearch(true)} />
      </div>

      {showSearch && (
        <div className="editor-search-panel" role="dialog" aria-label="Поиск и замена">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold">Найти и заменить</h2>
            <button className="editor-search-close" onClick={() => setShowSearch(false)} aria-label="Закрыть">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            autoFocus
            className="input h-9 rounded-xl"
            placeholder="Найти…"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && findNextMatch()}
          />
          <input
            className="input h-9 rounded-xl"
            placeholder="Заменить на…"
            value={replaceQuery}
            onChange={event => setReplaceQuery(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={findNextMatch} disabled={!searchQuery}>
              <Search className="h-4 w-4" /> Найти
            </Button>
            <Button variant="secondary" size="sm" onClick={replaceAllMatches} disabled={!searchQuery}>
              Заменить всё
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
