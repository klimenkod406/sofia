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
import { invoke } from '@tauri-apps/api/core';
import { useNotes, type Note } from '@/stores/notes';
import { useSettings } from '@/stores/settings';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorStatusBar } from '@/components/editor/editor-status-bar';
import { AIChatOverlay } from '@/components/ai/ai-chat-overlay';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Sparkles, Mic, ArrowLeft } from 'lucide-react';

export function EditorPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { currentNote, setCurrentNote, updateNote } = useNotes();
  const { font, editor: editorSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
      }),
      Placeholder.configure({
        placeholder: 'Start writing your note...',
        emptyEditorClass: 'is-editor-empty',
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
    ],
    content: currentNote?.content_html || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-xl xl:prose-2xl max-w-none focus:outline-none min-h-[500px] p-4',
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

  // Вход в редактор — только с существующим id (создание происходит
  // на главной / в чёлке с немедленным переходом на /editor/:id).
  // Пустой «области для печати» без заметки больше нет.
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        tiptapEditor?.chain().focus().setLink({ href: '' }).run();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      {/* Возврат домой: единственный путь входа — через главную, туда же и выходим */}
      <div className="flex min-w-0 items-center gap-2">
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
      </div>
      {/* Editor Toolbar */}
      <EditorToolbar editor={tiptapEditor} />

      {/* Main Editor Area */}
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <EditorContent editor={tiptapEditor} />
          </div>

          {/* Status Bar */}
          <EditorStatusBar editor={tiptapEditor} note={currentNote} isSaving={isSaving} />
        </div>

        {/* AI Chat Overlay */}
        {showAIChat && (
          <AIChatOverlay noteId={currentNote?.id} onClose={() => setShowAIChat(false)} />
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-20">
        <Button
          variant="primary"
          size="icon"
          className="shadow-lg"
          onClick={() => setShowAIChat(true)}
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-5 h-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="shadow-lg"
          onClick={() => {
            // Start voice transcription
          }}
          aria-label="Start voice recording"
        >
          <Mic className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
