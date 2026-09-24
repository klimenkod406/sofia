'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Markdown } from 'tiptap-markdown';
import { invoke } from '@tauri-apps/api/core';
import { useNotes, type Note } from '@/stores/notes';
import { useSettings } from '@/stores/settings';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorContextMenu } from '@/components/editor/editor-context-menu';
import { LiveTranscriptionBar } from '@/components/editor/live-transcription-bar';
import {
  EnhancedImage,
  EnhancedTable,
  EnhancedTableRow,
  EnhancedTableCell,
  EnhancedTableHeader,
} from '@/components/editor/extensions';
import EnhancedCodeBlock from '@/components/editor/enhanced-code-block';
import { createLowlight, common } from 'lowlight';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useLiveTranscription } from '@/hooks/use-live-transcription';
import { useTranslation } from '@/lib/i18n';

// Общий экземпляр подсветки синтаксиса (lowlight v3): создаём один раз.
const lowlight = createLowlight(common);

// Абзац расшифровки: обычный (финальный) или курсивный «черновик» с ещё
// не зафиксированным промежуточным текстом.
function makeTranscriptParagraph(editor: Editor, text: string, pending: boolean) {
  const { state } = editor;
  const textNode = pending
    ? state.schema.text(text, [state.schema.marks.italic.create()])
    : state.schema.text(text);
  return state.schema.nodes.paragraph.create(null, textNode);
}

// Живой черновик: partial-текст печатается в документе курсивом сразу, как
// только бэкенд его прислал — не нужно ждать паузы или остановки записи.
// Пока черновик не создан — вставляем его в точку вставки (позиция курсора
// на старте сессии); потом обновляем на месте.
function upsertTranscriptDraft(
  editor: Editor,
  text: string,
  insertPos: { current: number | null },
  draft: { pos: number | null; size: number }
) {
  const { state, view } = editor;
  const doc = state.doc;
  const node = makeTranscriptParagraph(editor, text, true);

  if (draft.pos !== null) {
    const cur = doc.nodeAt(draft.pos);
    if (cur?.type.name === 'paragraph' && cur.textContent !== text) {
      view.dispatch(
        state.tr
          .replaceWith(draft.pos, draft.pos + draft.size, node)
          .setMeta('addToHistory', false)
      );
      draft.size = node.nodeSize;
    }
    return;
  }

  const blankDoc =
    doc.childCount === 1 &&
    doc.firstChild?.type.name === 'paragraph' &&
    doc.firstChild.textContent === '';
  if (blankDoc) {
    view.dispatch(
      state.tr.replaceWith(0, doc.content.size, node).setMeta('addToHistory', false)
    );
    draft.pos = 0;
    draft.size = node.nodeSize;
    return;
  }
  const pos = Math.min(Math.max(insertPos.current ?? doc.content.size, 0), doc.content.size);
  view.dispatch(state.tr.insert(pos, node).setMeta('addToHistory', false));
  draft.pos = pos;
  draft.size = node.nodeSize;
  // Якорь не двигаем: когда придут финальные сегменты, черновик заменится
  // на месте, а точка вставки сдвинется за них.
}

// Вставка финального абзаца расшифровки. Если для этого текста уже был
// показан черновик — заменяем его обычным абзацем; иначе вставляем в точку
// вставки (позиция курсора на старте сессии), каждый следующий — сразу
// после предыдущего, чтобы расшифровка «печаталась» в одном месте.
// Позиция клампится в актуальный диапазон документа: между вставками
// пользователь может править текст.
function insertTranscriptParagraph(
  editor: Editor,
  text: string,
  insertPos: { current: number | null },
  draft: { pos: number | null; size: number }
) {
  const { state, view } = editor;
  const doc = state.doc;
  const node = makeTranscriptParagraph(editor, text, false);

  if (draft.pos !== null) {
    const cur = doc.nodeAt(draft.pos);
    if (cur?.type.name === 'paragraph') {
      view.dispatch(
        state.tr
          .replaceWith(draft.pos, draft.pos + draft.size, node)
          .setMeta('addToHistory', false)
      );
      insertPos.current = draft.pos + node.nodeSize;
      draft.pos = null;
      draft.size = 0;
      return;
    }
    draft.pos = null;
    draft.size = 0;
  }

  const blankDoc =
    doc.childCount === 1 &&
    doc.firstChild?.type.name === 'paragraph' &&
    doc.firstChild.textContent === '';
  if (blankDoc) {
    // Первый пустой документ заменяется целиком, дальше абзацы добавляются
    // друг за другом — так расшифровка остаётся «с логическими разделениями»,
    // а не сливается в сплошной текст.
    view.dispatch(
      state.tr.replaceWith(0, doc.content.size, node).setMeta('addToHistory', false)
    );
    insertPos.current = node.nodeSize;
    return;
  }
  const pos = Math.min(Math.max(insertPos.current ?? doc.content.size, 0), doc.content.size);
  view.dispatch(state.tr.insert(pos, node).setMeta('addToHistory', false));
  // Точка сразу после вставленного абзаца — следующий абзац пойдёт следом.
  insertPos.current = pos + node.nodeSize;
}

export function EditorPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  // refs до зон скролла: колонка (прокрутчик) и лист (прямоугольная зона печати).
  const columnRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const lastDocSizeRef = useRef(0);
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

  // Живая расшифровка речи (микрофон). Хук живёт здесь и поднимает
  // commit/partial/status события из Tauri; вставка в документ — ниже.
  const live = useLiveTranscription();
  const transcriptInsertedRef = useRef<Set<number>>(new Set());
  // Точка вставки расшифровки в документе (позиция курсора на старте
  // сессии), сдвигается после каждого вставленного абзаца.
  const transcriptInsertPosRef = useRef<number | null>(null);
  // Живой черновик: курсивный абзац с промежуточным (partial) текстом,
  // который заменяется финальным абзацем по мере готовности сегментов.
  const transcriptDraftRef = useRef<{ pos: number | null; size: number }>({
    pos: null,
    size: 0,
  });

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
        placeholder: ({ node }) => (node.type.name === 'heading' ? t('heading') : t('startWriting')),
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty-node',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline hover:no-underline' },
      }),
      EnhancedImage.configure({
        HTMLAttributes: { class: 'rounded-lg' },
      }),
      EnhancedTable.configure({ resizable: true }),
      EnhancedTableRow,
      EnhancedTableCell,
      EnhancedTableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      EnhancedCodeBlock.configure({ lowlight, defaultLanguage: 'javascript' }),
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

  // При старте новой сессии диктовки запоминаем точку вставки: текущую
  // позицию курсора в редакторе. Клик по кнопке «Диктовка» уводит фокус из
  // редактора, но selection в состоянии ProseMirror сохраняется — это и есть
  // место, куда пользователь поставил каретку. Сбрасываем только на СТАРТЕ
  // сессии: при остановке ref'ы ещё нужны эффектам ниже для финализации.
  useEffect(() => {
    if (!live.sessionId || !tiptapEditor) return;
    transcriptInsertedRef.current = new Set();
    transcriptInsertPosRef.current = tiptapEditor.state.selection.from;
    transcriptDraftRef.current.pos = null;
    transcriptDraftRef.current.size = 0;
  }, [live.sessionId, tiptapEditor]);

  // Финальные абзацы расшифровки вставляем в документ по мере готовности.
  // paragraph_id монотонно растёт в рамках сессии — защита от дублей.
  // Если для этого текста уже печатался живой черновик, он заменяется
  // обычным абзацем на том же месте.
  useEffect(() => {
    if (!tiptapEditor) return;
    for (const seg of live.segments) {
      if (transcriptInsertedRef.current.has(seg.paragraph_id)) continue;
      transcriptInsertedRef.current.add(seg.paragraph_id);
      insertTranscriptParagraph(tiptapEditor, seg.text, transcriptInsertPosRef, transcriptDraftRef.current);
    }
  }, [live.segments, tiptapEditor]);

  // Живой черновик: пока идёт запись, промежуточный текст печатается
  // в документ курсивом сразу — «моментально с микрофоном», без ожидания
  // паузы или остановки.
  useEffect(() => {
    if (!tiptapEditor || !live.sessionId || !live.isRecording) return;
    const text = live.partialText.trim();
    if (!text) return;
    upsertTranscriptDraft(tiptapEditor, text, transcriptInsertPosRef, transcriptDraftRef.current);
  }, [tiptapEditor, live.sessionId, live.isRecording, live.partialText]);

  // Запись закончилась: если черновик так и не был заменён финальным абзацем
  // (например, хвост оказался тишиной) — превращаем его в обычный текст,
  // чтобы курсив не остался в заметке.
  useEffect(() => {
    if (!tiptapEditor || live.isRecording) return;
    if (transcriptDraftRef.current.pos === null) return;
    const { state, view } = tiptapEditor;
    const { pos, size } = transcriptDraftRef.current;
    const cur = state.doc.nodeAt(pos);
    if (cur?.type.name === 'paragraph') {
      const node = makeTranscriptParagraph(tiptapEditor, cur.textContent, false);
      view.dispatch(
        state.tr.replaceWith(pos, pos + size, node).setMeta('addToHistory', false)
      );
    }
    transcriptDraftRef.current.pos = null;
    transcriptDraftRef.current.size = 0;
  }, [tiptapEditor, live.isRecording]);

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

  // Скролл за прямоугольной зоной печати: при вводе текста прокручиваем так,
  // чтобы нижняя кромка листа оставалась у низа колонки (с учётом её нижнего
  // поля), а не только строку курсора. Реагируем только на рост документа,
  // чтобы выделение/сервисные транзакции не дёргали скролл.
  useEffect(() => {
    if (!tiptapEditor) return;
    const scrollToSheetEdge = () => {
      const column = columnRef.current;
      const sheet = sheetRef.current;
      if (!column || !sheet) return;
      const docSize = tiptapEditor.state.doc.content.size;
      if (docSize <= lastDocSizeRef.current) {
        lastDocSizeRef.current = docSize;
        return;
      }
      lastDocSizeRef.current = docSize;
      const colRect = column.getBoundingClientRect();
      // Скроллим только если курсор ввода за нижней границей видимой области:
      // при наборе вверху/середине длинного листа не прыгаем в самый низ.
      const sel = tiptapEditor.state.selection;
      const cursorCoords = tiptapEditor.view.coordsAtPos(sel.empty ? sel.from : sel.to);
      if (cursorCoords.bottom <= colRect.bottom) return;
      const sheetRect = sheet.getBoundingClientRect();
      // Нижняя кромка листа в координатах прокрутки колонки + нижнее поле.
      const edgeOffset =
        sheetRect.bottom -
        colRect.top +
        column.scrollTop +
        parseFloat(getComputedStyle(column).paddingBottom || '0');
      const viewBottom = column.scrollTop + colRect.height;
      if (edgeOffset > viewBottom) {
        column.scrollTop = edgeOffset - colRect.height;
      }
    };
    tiptapEditor.on('transaction', scrollToSheetEdge);
    return () => {
      tiptapEditor.off('transaction', scrollToSheetEdge);
    };
  }, [tiptapEditor]);

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
    [...matches]
      .reverse()
      .forEach(match => transaction.insertText(replaceQuery, match.from, match.to));
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
        const url = window.prompt(t('linkPrompt'));
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
        <h3 className="font-display text-lg font-bold">{t('noteNotFound')}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('noteNotFoundDesc')}
        </p>
        <Button onClick={() => navigate('/home')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('backToHome')}
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="liquid-glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl p-10 text-center">
        <h3 className="font-display text-lg font-bold">{t('failedToOpenNote')}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{loadError}</p>
        <Button onClick={() => navigate('/home')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('backToHome')}
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
          {t('allNotes')}
        </Button>
        <span className="truncate font-display text-sm font-bold text-muted-foreground">
          {currentNote.title || t('untitled')}
        </span>
        {isSaving && (
          <span className="text-xs text-muted-foreground" role="status">
            {t('saving')}
          </span>
        )}
        {saveError && (
          <span className="truncate text-xs text-destructive" role="alert" title={saveError}>
            {t('saveFailed')}: {saveError}
          </span>
        )}
        {uiPreferences.showWordCount && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {docStats.words.toLocaleString()} {t('words')} · {docStats.chars.toLocaleString()} {t('chars')}
          </span>
        )}
      </div>

      {/* Тело редактора: боковые рейки с инструментами + центральная «страница» */}
      <div className="editor-stage">
        <EditorToolbar
          side="left"
          editor={tiptapEditor}
          noteTitle={currentNote.title}
          onOpenSearch={() => setShowSearch(true)}
        />

        <div className="editor-column" ref={columnRef}>
          <EditorContextMenu editor={tiptapEditor}>
            <div
              className="editor-sheet"
              ref={sheetRef}
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
          </EditorContextMenu>
        </div>

        <EditorToolbar
          side="right"
          editor={tiptapEditor}
          noteTitle={currentNote.title}
          onOpenSearch={() => setShowSearch(true)}
        />
      </div>

      <LiveTranscriptionBar controller={live} />

      {showSearch && (
        <div className="editor-search-panel" role="dialog" aria-label={t('findAndReplace')}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold">{t('findAndReplace')}</h2>
            <button
              className="editor-search-close"
              onClick={() => setShowSearch(false)}
              aria-label={t('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            autoFocus
            className="input h-9 rounded-xl"
            placeholder={t('find')}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && findNextMatch()}
          />
          <input
            className="input h-9 rounded-xl"
            placeholder={t('replaceWith')}
            value={replaceQuery}
            onChange={event => setReplaceQuery(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={findNextMatch} disabled={!searchQuery}>
              <Search className="h-4 w-4" /> {t('find')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={replaceAllMatches}
              disabled={!searchQuery}
            >
              {t('replaceAll')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
