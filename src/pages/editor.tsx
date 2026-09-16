'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Sparkles, Mic } from 'lucide-react';

export function EditorPage() {
  const { noteId } = useParams<{ noteId?: string }>();
  const navigate = useNavigate();
  const { currentNote, setCurrentNote, createNote, updateNote } = useNotes();
  const { font, editor: editorSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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
      // Auto-save
      if (editorSettings.autoSave && currentNote) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          void handleSave(editor.getHTML(), editor.getText(), editor.getText());
        }, editorSettings.autoSaveInterval);
      }
    },
    onCreate: ({ editor }) => {
      editor.commands.focus();
    },
  });

  // Load note when noteId changes
  useEffect(() => {
    if (noteId) {
      if (noteId === 'new') {
        void handleNewNote();
      } else {
        void loadNote(noteId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const loadNote = async (id: string) => {
    const note = (await invoke('get_note', { id })) as unknown as Note | null;
    if (note) {
      setCurrentNote(note);
      tiptapEditor?.commands.setContent(
        (note as unknown as Record<string, string>).content_html || '',
        false
      );
    }
  };

  const handleNewNote = async () => {
    const note = await createNote();
    setCurrentNote(note);
    navigate(`/editor/${note.id}`, { replace: true });
    tiptapEditor?.commands.setContent('', false);
  };

  const handleSave = async (html: string, text: string, markdown: string) => {
    if (!currentNote || isSaving) return;

    setIsSaving(true);
    try {
      await updateNote({
        id: currentNote.id,
        content: text,
        content_md: markdown,
        content_html: html,
      });
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (tiptapEditor && currentNote) {
          void handleSave(tiptapEditor.getHTML(), tiptapEditor.getText(), tiptapEditor.getText());
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        tiptapEditor?.chain().focus().setLink({ href: '' }).run();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiptapEditor, currentNote]);

  if (!tiptapEditor) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Editor Toolbar */}
      <EditorToolbar editor={tiptapEditor} />

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
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
