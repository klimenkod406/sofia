'use client';

import { useEffect, useState } from 'react';
import { useEditor } from '@tiptap/react';
import type { Level } from '@tiptap/extension-heading';
import type { ComponentType } from 'react';
import { cn } from '@/utils/cn';
import { saveTextFile, wrapHtml } from '@/utils/export-note';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useDropdownMenu,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useSettings, TOOLBAR_ITEMS, type ToolbarItemId } from '@/stores/settings';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { _registerT, _translate } from './i18n-bridge';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Link,
  Image,
  Table,
  Undo,
  Redo,
  Save,
  Highlighter,
  CheckSquare,
  Eraser,
  Minus,
  Unlink,
  FileDown,
  FileCode,
  Printer,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Search,
  Type,
  Plus,
  Indent,
  Outdent,
  ArrowUpAZ,
  ArrowDownAZ,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: ReturnType<typeof useEditor>;
  /** Какая рейка: левая (текст/заголовки/списки) или правая (история/блоки/медиа). */
  side: 'left' | 'right';
  /** Название заметки — для имени файла при экспорте. */
  noteTitle?: string;
  onOpenSearch?: () => void;
}

type IconComponent = ComponentType<{ className?: string }>;

interface ToolbarButton {
  kind: 'button';
  id: ToolbarItemId;
  icon: IconComponent;
  action: () => boolean | void;
  disabled?: boolean;
  active?: boolean;
  title: string;
}

interface ToolbarMenu {
  kind: 'menu';
  id: ToolbarItemId;
  icon: ComponentType<{ className?: string }>;
  title: string;
  menuItems: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    action: () => void;
    separatorBefore?: boolean;
    /** Hex-цвет для кружка-свотча вместо иконки (палитры цветов). */
    swatch?: string;
  }[];
}

interface ToolbarCustom {
  kind: 'custom';
  id: ToolbarItemId;
  render: () => JSX.Element;
}

interface ToolbarDivider {
  kind: 'divider';
  id?: string;
  title?: string;
}

type ToolbarItem = ToolbarButton | ToolbarMenu | ToolbarCustom | ToolbarDivider;

/** Тёплая палитра дефолтных цветов подсветки и текста. */
const HIGHLIGHT_COLORS = [
  { label: 'Медовый', value: '#f5e3b8' },
  { label: 'Песочный', value: '#ead9c0' },
  { label: 'Терракотовый', value: '#f0d2c4' },
  { label: 'Оливковый', value: '#dde6c8' },
  { label: 'Пыльная роза', value: '#eccfd6' },
];

const TEXT_COLORS = [
  { label: 'По умолчанию', value: '' },
  { label: 'Терракота', value: '#b3541e' },
  { label: 'Олива', value: '#557a46' },
  { label: 'Индиго', value: '#4a5a8a' },
  { label: 'Бордо', value: '#8f3b4a' },
  { label: 'Серый', value: '#6b6152' },
];

/** Кастомный цвет: value — hex, label — название. */
interface CustomColor {
  value: string;
  label: string;
}

const HIGHLIGHT_STORAGE_KEY = 'sofia:custom-highlight-colors';
const TEXT_STORAGE_KEY = 'sofia:custom-text-colors';
const MAX_RECENT = 5;

function loadCustomColors(key: string): CustomColor[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as CustomColor[];
  } catch {
    return [];
  }
}

function saveCustomColors(key: string, colors: CustomColor[]) {
  localStorage.setItem(key, JSON.stringify(colors));
}

/** Общий per-key кэш кастомных цветов + подписчики.
 *  Левая и правая рейки toolbar — два экземпляра ColorMenu в ОДНОЙ вкладке,
 *  поэтому storage-событие между ними не работает (оно только для других
 *  вкладок). Поднимаем состояние на уровень модуля — без внешних зависимостей. */
const customColorStore = new Map<string, CustomColor[]>();
const colorListeners = new Map<string, Set<() => void>>();

function readColors(key: string): CustomColor[] {
  if (!customColorStore.has(key)) {
    customColorStore.set(key, loadCustomColors(key));
  }
  return customColorStore.get(key)!;
}

function writeColors(key: string, colors: CustomColor[]) {
  customColorStore.set(key, colors);
  saveCustomColors(key, colors);
  colorListeners.get(key)?.forEach(fn => fn());
}

function useCustomColors(storageKey: string) {
  const [colors, setColors] = useState<CustomColor[]>(() => readColors(storageKey));
  useEffect(() => {
    let listeners = colorListeners.get(storageKey);
    if (!listeners) {
      listeners = new Set();
      colorListeners.set(storageKey, listeners);
    }
    const notify = () => setColors(readColors(storageKey));
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, [storageKey]);
  const addColor = (color: CustomColor) => {
    const prev = readColors(storageKey);
    const filtered = prev.filter(c => c.value !== color.value);
    writeColors(storageKey, [color, ...filtered].slice(0, MAX_RECENT));
  };
  return { colors, addColor };
}

function ColorMenu({
  title,
  icon: Icon,
  defaults,
  customKey,
  onSelect,
  onClear,
  side,
  id,
}: {
  title: string;
  icon: IconComponent;
  defaults: CustomColor[];
  customKey: string;
  onSelect: (color: string) => void;
  onClear: () => void;
  side: 'left' | 'right';
  /** Идентификатор из реестра TOOLBAR_ITEMS — для фильтрации видимости. */
  id: ToolbarItemId;
}) {
  const { t } = useTranslation();
  const { colors, addColor } = useCustomColors(customKey);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('');

  const all = [...colors, ...defaults.filter(d => !colors.some(c => c.value === d.value))];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('editor-toolbar-btn')}
          title={title}
          aria-label={title}
          data-toolbar-id={id}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={side === 'left' ? 'start' : 'end'} className="w-56">
        {all.slice(0, MAX_RECENT).map(c => (
          <DropdownMenuItem
            key={c.value}
            onClick={() => onSelect(c.value)}
            className="flex items-center gap-2"
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-border"
              style={{ background: c.value }}
            />
            {c.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnSelect={false}
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> {t('addColor')}
        </DropdownMenuItem>
        {showAdd && (
          <div className="px-3 py-2 space-y-2">
            <input
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
              placeholder={t('colorName')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
              placeholder="#rrggbb"
              value={newHex}
              onChange={e => setNewHex(e.target.value)}
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                const hex = newHex.trim();
                const name = newName.trim() || hex;
                if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                  addColor({ value: hex, label: name });
                  setNewName('');
                  setNewHex('');
                  setShowAdd(false);
                }
              }}
            >
              {t('save')}
            </Button>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClear} className="flex items-center gap-2">
          <Eraser className="h-4 w-4" /> {t('remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Максимальный размер сетки выбора таблицы (8×8). */
const TABLE_MAX = 8;

/** Содержимое меню «Таблица» — отдельный компонент ВНУТРИ <DropdownMenu>,
 *  чтобы useDropdownMenu() получил реальный контекст (а не дефолтный noop). */
function TableInsertMenuContent({
  editor,
  side,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  side: 'left' | 'right';
}) {
  const { setOpen } = useDropdownMenu();
  // Сетка работает как у Google Docs: hover подсвечивает область N×M, подпись
  // показывает текущий размер, клик вставляет таблицу этого размера.
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(null);
  // По умолчанию — небольшая таблица (не на всю ширину листа).
  const [compact, setCompact] = useState(true);
  const rows = hover?.rows ?? 3;
  const cols = hover?.cols ?? 3;

  const insert = (r: number, c: number) => {
    editor
      .chain()
      .focus()
      .insertConfiguredTable({ rows: r, cols: c, size: compact ? 'compact' : 'full' })
      .run();
    setOpen(false);
  };

  return (
    <DropdownMenuContent align={side === 'left' ? 'start' : 'end'} className="w-[248px] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Таблица
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rows} × {cols}
        </span>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${TABLE_MAX}, 1fr)` }}>
        {Array.from({ length: TABLE_MAX * TABLE_MAX }).map((_, i) => {
          const r = Math.floor(i / TABLE_MAX) + 1;
          const c = (i % TABLE_MAX) + 1;
          const active = !!hover && r <= hover.rows && c <= hover.cols;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover({ rows: r, cols: c })}
              onClick={() => insert(r, c)}
              className={cn(
                'aspect-square w-full rounded-[4px] border transition-colors duration-100',
                active
                  ? 'border-primary bg-primary/25'
                  : 'border-border bg-accent/40 hover:bg-accent/70'
              )}
              aria-label={`Таблица ${r} × ${c}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <label htmlFor="table-compact" className="text-xs text-muted-foreground">
          Небольшая (по содержимому)
        </label>
        <Switch id="table-compact" checked={compact} onCheckedChange={setCompact} />
      </div>
    </DropdownMenuContent>
  );
}

/** Преобразовать выделенный текст в верхний/нижний регистр через ProseMirror. */
function transformCase(editor: NonNullable<ReturnType<typeof useEditor>>, mode: 'upper' | 'lower') {
  const { state, dispatch } = editor.view;
  const { from, to, empty } = state.selection;
  if (empty) return false;
  const text = state.doc.textBetween(from, to, '\n', '\n');
  const out = mode === 'upper' ? text.toUpperCase() : text.toLowerCase();
  if (out === text) return false;
  dispatch(state.tr.insertText(out, from, to));
  return true;
}

/** Меню «Таблица»: сетка выбора размера (N×M) + ширина создаваемой таблицы
 *  (небольшая по содержимому или на всю ширину листа). Клик по ячейке вставляет. */
function TableInsertMenu({
  editor,
  side,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  side: 'left' | 'right';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="editor-toolbar-btn"
          title="Таблица"
          aria-label="Таблица"
        >
          <Table className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <TableInsertMenuContent editor={editor} side={side} />
    </DropdownMenu>
  );
}

export function EditorToolbar({ editor, side, noteTitle, onOpenSearch }: EditorToolbarProps) {
  const { t } = useTranslation();
  // Подписка на список видимых инструментов: при изменении настроек
  // (см. Настройки → Редактор → «Меню инструментов») рейка должна
  // перерисоваться. Хук обязан вызываться на каждом рендере в одном порядке.
  const toolbarItems = useSettings(s => s.toolbarItems);
  // Сохраняем t для модульных обработчиков (reportExportError и др.) —
  // реализация моста в ./i18n-bridge.
  _registerT(t as unknown as (key: string, params?: unknown) => string);
  // Без подписки на транзакции кнопки isActive/disabled протухают:
  // рейка рендерится только при смене пропсов, а не при каждом наборе текста.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick(t => t + 1);
    editor.on('transaction', bump);
    return () => {
      editor.off('transaction', bump);
    };
  }, [editor]);

  if (!editor) return null;

  const toolbarVisible = new Set<ToolbarItemId>(toolbarItems);
  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();
  const inList =
    editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList');

  const addHeading = (level: Level) => {
    editor.chain().focus().toggleHeading({ level }).run();
  };

  const addLink = () => {
    const url = window.prompt('Ссылка (https://…):');
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL картинки:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const toggleHighlightColor = (color: string) => {
    // Повторный клик по активному цвету снимает подсветку.
    if (editor.isActive('highlight', { color })) {
      editor.chain().focus().unsetHighlight().run();
      return;
    }
    editor.chain().focus().toggleHighlight({ color }).run();
  };

  const setTextColor = (color: string) => {
    if (!color) {
      editor.chain().focus().unsetColor().run();
      return;
    }
    editor.chain().focus().setColor(color).run();
  };

  const setAlignment = (alignment: 'left' | 'center' | 'right') => {
    editor.chain().focus().setTextAlign(alignment).run();
  };

  const clearFormatting = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  };

  const baseName = (noteTitle || 'note').trim() || 'note';

  // Ctrl+S живёт на странице редактора — меню просто подсказывает пользователю,
  // что автосохранение уже включено; явный клик сохраняет через событие.
  const saveNow = () => {
    window.dispatchEvent(new CustomEvent('sofia:save-note'));
  };

  const exportMarkdown = async () => {
    const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
    const md = storage.markdown?.getMarkdown() ?? editor.getText();
    await saveTextFile({
      defaultName: `${baseName}.md`,
      content: md,
      extensions: ['md'],
      mimeType: 'text/markdown;charset=utf-8',
    });
  };

  const exportHtml = async () => {
    await saveTextFile({
      defaultName: `${baseName}.html`,
      content: wrapHtml(baseName, editor.getHTML()),
      extensions: ['html'],
      mimeType: 'text/html;charset=utf-8',
    });
  };

  const exportPdf = () => {
    window.print();
  };

  // Левая рейка: форматирование текста + заголовки + списки.
  const leftItems: ToolbarItem[] = [
    {
      kind: 'button',
      id: 'bold',
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
      title: t('bold'),
    },
    {
      kind: 'button',
      id: 'italic',
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
      title: t('italic'),
    },
    {
      kind: 'button',
      id: 'strike',
      icon: Strikethrough,
      action: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive('strike'),
      title: t('strikethrough'),
    },
    {
      kind: 'button',
      id: 'code',
      icon: Code,
      action: () => editor.chain().focus().toggleCode().run(),
      active: editor.isActive('code'),
      title: t('code'),
    },
    {
      kind: 'custom',
      id: 'highlight',
      render: () => (
        <ColorMenu
          id="highlight"
          key="highlight-menu"
          title={t('highlight')}
          icon={Highlighter}
          defaults={HIGHLIGHT_COLORS}
          customKey={HIGHLIGHT_STORAGE_KEY}
          onSelect={toggleHighlightColor}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
          side={side}
        />
      ),
    },
    {
      kind: 'custom',
      id: 'textColor',
      render: () => (
        <ColorMenu
          id="textColor"
          key="text-color-menu"
          title={t('textColor')}
          icon={Palette}
          defaults={TEXT_COLORS}
          customKey={TEXT_STORAGE_KEY}
          onSelect={setTextColor}
          onClear={() => editor.chain().focus().unsetColor().run()}
          side={side}
        />
      ),
    },
    { kind: 'divider', id: 'align-divider' },
    {
      kind: 'button',
      id: 'alignLeft',
      icon: AlignLeft,
      action: () => setAlignment('left'),
      active: editor.isActive({ textAlign: 'left' }),
      title: t('alignLeft'),
    },
    {
      kind: 'button',
      id: 'alignCenter',
      icon: AlignCenter,
      action: () => setAlignment('center'),
      active: editor.isActive({ textAlign: 'center' }),
      title: t('alignCenter'),
    },
    {
      kind: 'button',
      id: 'alignRight',
      icon: AlignRight,
      action: () => setAlignment('right'),
      active: editor.isActive({ textAlign: 'right' }),
      title: t('alignRight'),
    },
    { kind: 'divider', id: 'headings-divider' },
    {
      kind: 'button',
      id: 'h1',
      icon: Heading1,
      action: () => addHeading(1),
      active: editor.isActive('heading', { level: 1 }),
      title: t('heading1'),
    },
    {
      kind: 'button',
      id: 'h2',
      icon: Heading2,
      action: () => addHeading(2),
      active: editor.isActive('heading', { level: 2 }),
      title: t('heading2'),
    },
    {
      kind: 'button',
      id: 'h3',
      icon: Heading3,
      action: () => addHeading(3),
      active: editor.isActive('heading', { level: 3 }),
      title: t('heading3'),
    },
    {
      kind: 'button',
      id: 'paragraph',
      icon: Pilcrow,
      action: () => editor.chain().focus().setParagraph().run(),
      active: editor.isActive('paragraph'),
      title: t('paragraph'),
    },
    { kind: 'divider', id: 'lists-divider' },
    {
      kind: 'button',
      id: 'bulletList',
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
      title: t('bulletList'),
    },
    {
      kind: 'button',
      id: 'numberedList',
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
      title: t('numberedList'),
    },
    {
      kind: 'button',
      id: 'taskList',
      icon: CheckSquare,
      action: () => editor.chain().focus().toggleTaskList().run(),
      active: editor.isActive('taskList'),
      title: t('taskList'),
    },
    {
      kind: 'button',
      id: 'indent',
      icon: Indent,
      action: () => editor.chain().focus().sinkListItem('listItem').run(),
      disabled: !inList,
      title: t('indent'),
    },
    {
      kind: 'button',
      id: 'outdent',
      icon: Outdent,
      action: () => editor.chain().focus().liftListItem('listItem').run(),
      disabled: !inList,
      title: t('outdent'),
    },
    { kind: 'divider', id: 'script-divider' },
    {
      kind: 'button',
      id: 'uppercase',
      icon: ArrowUpAZ,
      action: () => transformCase(editor, 'upper'),
      title: t('uppercase'),
    },
    {
      kind: 'button',
      id: 'lowercase',
      icon: ArrowDownAZ,
      action: () => transformCase(editor, 'lower'),
      title: t('lowercase'),
    },
  ];

  // Правая рейка: история + блоки/медиа + чистка + экспорт/печать.
  const rightItems: ToolbarItem[] = [
    {
      kind: 'button',
      id: 'undo',
      icon: Undo,
      action: () => editor.chain().focus().undo().run(),
      disabled: !canUndo,
      title: t('undo'),
    },
    {
      kind: 'button',
      id: 'redo',
      icon: Redo,
      action: () => editor.chain().focus().redo().run(),
      disabled: !canRedo,
      title: t('redo'),
    },
    { kind: 'divider', id: 'blocks-divider' },
    {
      kind: 'button',
      id: 'quote',
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
      title: t('quote'),
    },
    {
      kind: 'button',
      id: 'codeBlock',
      icon: Code,
      action: () => editor.chain().focus().insertCodeBlock3().run(),
      active: editor.isActive('codeBlock'),
      title: t('codeBlock'),
    },
    {
      kind: 'button',
      id: 'hr',
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      title: t('horizontalRule'),
    },
    {
      kind: 'button',
      id: 'link',
      icon: Link,
      action: addLink,
      active: editor.isActive('link'),
      title: t('link'),
    },
    {
      kind: 'button',
      id: 'image',
      icon: Image,
      action: addImage,
      title: t('image'),
    },
    {
      kind: 'custom',
      id: 'table',
      render: () => <TableInsertMenu key="table-menu" editor={editor} side={side} />,
    },
    {
      kind: 'menu',
      id: 'tableFloat',
      icon: AlignCenter,
      title: t('tableFloat'),
      menuItems: [
        {
          icon: AlignLeft,
          label: t('floatLeft'),
          action: () => editor.chain().focus().setTableFloat('left').run(),
        },
        {
          icon: AlignRight,
          label: t('floatRight'),
          action: () => editor.chain().focus().setTableFloat('right').run(),
        },
        {
          icon: AlignCenter,
          label: t('fullWidth'),
          action: () => editor.chain().focus().setTableFloat('none').run(),
        },
      ],
    },
    {
      kind: 'menu',
      id: 'imageSize',
      icon: Type,
      title: t('imageSize'),
      menuItems: [
        { icon: Type, label: '25%', action: () => editor.chain().focus().setImageWidth(25).run() },
        { icon: Type, label: '50%', action: () => editor.chain().focus().setImageWidth(50).run() },
        { icon: Type, label: '75%', action: () => editor.chain().focus().setImageWidth(75).run() },
        {
          icon: Type,
          label: '100%',
          action: () => editor.chain().focus().setImageWidth(100).run(),
        },
      ],
    },
    {
      kind: 'menu',
      id: 'imageFloat',
      icon: AlignCenter,
      title: t('imageFloat'),
      menuItems: [
        {
          icon: AlignLeft,
          label: t('imageFloatLeft'),
          action: () => editor.chain().focus().setImageFloat('left').run(),
        },
        {
          icon: AlignRight,
          label: t('imageFloatRight'),
          action: () => editor.chain().focus().setImageFloat('right').run(),
        },
        {
          icon: AlignCenter,
          label: t('floatNone'),
          action: () => editor.chain().focus().setImageFloat('none').run(),
        },
      ],
    },
    {
      kind: 'button',
      id: 'find',
      icon: Search,
      action: () => onOpenSearch?.(),
      title: t('findAndReplace'),
    },
    { kind: 'divider', id: 'cleanup-divider' },
    {
      kind: 'button',
      id: 'clearFormatting',
      icon: Eraser,
      action: clearFormatting,
      title: t('clearFormatting'),
    },
    {
      kind: 'button',
      id: 'removeLink',
      icon: Unlink,
      action: removeLink,
      title: t('removeLink'),
    },
    {
      kind: 'button',
      id: 'export',
      icon: Save,
      action: saveNow,
      title: t('saveNow'),
    },
    {
      kind: 'menu',
      id: 'print',
      icon: Printer,
      title: t('exportAndPrint'),
      menuItems: [
        {
          icon: FileDown,
          label: t('exportMarkdown'),
          action: () => void exportMarkdown().catch(reportExportError),
        },
        {
          icon: FileCode,
          label: t('exportHtml'),
          action: () => void exportHtml().catch(reportExportError),
        },
        { icon: Printer, label: t('printPdf'), action: exportPdf },
      ],
    },
  ];

  const items = side === 'left' ? leftItems : rightItems;
  // Видимость управляется пользователем: см. Настройки → Редактор →
  // «Меню инструментов». Реестр TOOLBAR_ITEMS задаёт полный набор id, а
  // useSettings().toolbarItems — какие из них показывать. Разделители
  // автоматически исчезают, если соседние группы скрыты.
  type VisibleItem = ToolbarButton | ToolbarMenu | ToolbarCustom;
  const filtered = items.filter((item): item is VisibleItem => {
    if (item.kind === 'divider') return false;
    return toolbarVisible.has(item.id);
  });

  return (
    <div
      className="editor-rail"
      role="toolbar"
      aria-label={side === 'left' ? t('leftRail') : t('rightRail')}
    >
      {filtered.map((item, itemIndex) => {
        if (item.kind === 'custom') {
          return <div key={item.id || itemIndex}>{item.render()}</div>;
        }
        return item.kind === 'menu' ? (
          <DropdownMenu key={item.id || itemIndex}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'editor-toolbar-btn',
                  item.title === t('highlight') && editor.isActive('highlight'),
                  item.title === t('textColor') && editor.isActive('textStyle'),
                  item.title === t('codeLanguage') && editor.isActive('codeBlock')
                )}
                title={item.title}
                aria-label={item.title}
                data-toolbar-id={item.id}
              >
                <item.icon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={side === 'left' ? 'start' : 'end'} className="w-52">
              {item.menuItems.map((menuItem, mi) => (
                <FragmentItem key={mi} menuItem={menuItem} />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            key={item.id || itemIndex}
            variant="ghost"
            size="icon"
            className={cn('editor-toolbar-btn', item.active && 'editor-toolbar-btn-active')}
            onClick={item.action}
            disabled={item.disabled}
            title={item.title}
            aria-label={item.title}
            aria-pressed={item.active}
            data-toolbar-id={item.id}
          >
            <item.icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}

// Маркируем все идентификаторы реестра как «используемые», чтобы линтер
// не ругался, что часть id объявлена, но не вставлена в toolbarItems.
void TOOLBAR_ITEMS;

function FragmentItem({
  menuItem,
}: {
  menuItem: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    action: () => void;
    separatorBefore?: boolean;
    swatch?: string;
  };
}) {
  return (
    <>
      {menuItem.separatorBefore && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={menuItem.action} className="flex items-center gap-2">
        {menuItem.swatch ? (
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-border"
            style={{ background: menuItem.swatch }}
          />
        ) : (
          <menuItem.icon className="h-4 w-4" />
        )}
        {menuItem.label}
      </DropdownMenuItem>
    </>
  );
}

function reportExportError(e: unknown) {
  console.error('export failed', e);
  toast({
    title: _translate('exportError'),
    description: e instanceof Error ? e.message : String(e),
    variant: 'destructive',
  });
}
