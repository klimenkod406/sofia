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
import { toast } from '@/hooks/use-toast';
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
  MoreHorizontal,
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
  icon: IconComponent;
  action: () => boolean | void;
  disabled?: boolean;
  active?: boolean;
  title: string;
}

interface ToolbarMenu {
  kind: 'menu';
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
  render: () => JSX.Element;
}

interface ToolbarDivider {
  kind: 'divider';
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
}: {
  title: string;
  icon: IconComponent;
  defaults: CustomColor[];
  customKey: string;
  onSelect: (color: string) => void;
  onClear: () => void;
  side: 'left' | 'right';
}) {
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
          <Plus className="h-4 w-4" /> Добавить цвет…
        </DropdownMenuItem>
        {showAdd && (
          <div className="px-3 py-2 space-y-2">
            <input
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
              placeholder="Название"
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
              Сохранить
            </Button>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClear} className="flex items-center gap-2">
          <Eraser className="h-4 w-4" /> Убрать
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

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

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
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
      title: 'Полужирный (Ctrl+B)',
    },
    {
      kind: 'button',
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
      title: 'Курсив (Ctrl+I)',
    },
    {
      kind: 'button',
      icon: Strikethrough,
      action: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive('strike'),
      title: 'Зачёркнутый',
    },
    {
      kind: 'button',
      icon: Code,
      action: () => editor.chain().focus().toggleCode().run(),
      active: editor.isActive('code'),
      title: 'Моноширинный текст',
    },
    {
      kind: 'custom',
      render: () => (
        <ColorMenu
          key="highlight-menu"
          title="Маркер"
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
      render: () => (
        <ColorMenu
          key="text-color-menu"
          title="Цвет текста"
          icon={Palette}
          defaults={TEXT_COLORS}
          customKey={TEXT_STORAGE_KEY}
          onSelect={setTextColor}
          onClear={() => editor.chain().focus().unsetColor().run()}
          side={side}
        />
      ),
    },
    { kind: 'divider' },
    {
      kind: 'button',
      icon: AlignLeft,
      action: () => setAlignment('left'),
      active: editor.isActive({ textAlign: 'left' }),
      title: 'По левому краю',
    },
    {
      kind: 'button',
      icon: AlignCenter,
      action: () => setAlignment('center'),
      active: editor.isActive({ textAlign: 'center' }),
      title: 'По центру',
    },
    {
      kind: 'button',
      icon: AlignRight,
      action: () => setAlignment('right'),
      active: editor.isActive({ textAlign: 'right' }),
      title: 'По правому краю',
    },
    {
      kind: 'button',
      icon: Heading1,
      action: () => addHeading(1),
      active: editor.isActive('heading', { level: 1 }),
      title: 'Заголовок 1',
    },
    {
      kind: 'button',
      icon: Heading2,
      action: () => addHeading(2),
      active: editor.isActive('heading', { level: 2 }),
      title: 'Заголовок 2',
    },
    {
      kind: 'button',
      icon: Heading3,
      action: () => addHeading(3),
      active: editor.isActive('heading', { level: 3 }),
      title: 'Заголовок 3',
    },
    {
      kind: 'button',
      icon: Pilcrow,
      action: () => editor.chain().focus().setParagraph().run(),
      active: editor.isActive('paragraph'),
      title: 'Обычный текст',
    },
    {
      kind: 'button',
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
      title: 'Список',
    },
    {
      kind: 'button',
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
      title: 'Нумерованный список',
    },
    {
      kind: 'button',
      icon: CheckSquare,
      action: () => editor.chain().focus().toggleTaskList().run(),
      active: editor.isActive('taskList'),
      title: 'Список задач',
    },
  ];

  // Правая рейка: история + блоки/медиа + меню «Ещё».
  const rightItems: ToolbarItem[] = [
    {
      kind: 'button',
      icon: Undo,
      action: () => editor.chain().focus().undo().run(),
      disabled: !canUndo,
      title: 'Отменить (Ctrl+Z)',
    },
    {
      kind: 'button',
      icon: Redo,
      action: () => editor.chain().focus().redo().run(),
      disabled: !canRedo,
      title: 'Вернуть (Ctrl+Shift+Z)',
    },
    {
      kind: 'button',
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
      title: 'Цитата',
    },
    {
      kind: 'button',
      icon: Code,
      action: () => editor.chain().focus().insertCodeBlock3().run(),
      active: editor.isActive('codeBlock'),
      title: 'Блок кода',
    },
    {
      kind: 'button',
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      title: 'Разделитель',
    },
    {
      kind: 'button',
      icon: Link,
      action: addLink,
      active: editor.isActive('link'),
      title: 'Ссылка (Ctrl+K)',
    },
    { kind: 'button', icon: Image, action: addImage, title: 'Картинка' },
    {
      kind: 'custom',
      render: () => <TableInsertMenu key="table-menu" editor={editor} side={side} />,
    },
    {
      kind: 'menu',
      icon: MoreHorizontal,
      title: 'Таблица: обтекание',
      menuItems: [
        {
          icon: AlignLeft,
          label: 'Слева (обтекание)',
          action: () => editor.chain().focus().setTableFloat('left').run(),
        },
        {
          icon: AlignRight,
          label: 'Справа (обтекание)',
          action: () => editor.chain().focus().setTableFloat('right').run(),
        },
        {
          icon: AlignCenter,
          label: 'По ширине',
          action: () => editor.chain().focus().setTableFloat('none').run(),
        },
      ],
    },
    {
      kind: 'menu',
      icon: MoreHorizontal,
      title: 'Картинка: размер',
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
      icon: MoreHorizontal,
      title: 'Картинка: обтекание',
      menuItems: [
        {
          icon: AlignLeft,
          label: 'Слева',
          action: () => editor.chain().focus().setImageFloat('left').run(),
        },
        {
          icon: AlignRight,
          label: 'Справа',
          action: () => editor.chain().focus().setImageFloat('right').run(),
        },
        {
          icon: AlignCenter,
          label: 'Без обтекания',
          action: () => editor.chain().focus().setImageFloat('none').run(),
        },
      ],
    },
    {
      kind: 'button',
      icon: Search,
      action: () => onOpenSearch?.(),
      title: 'Найти и заменить (Ctrl+F)',
    },
    {
      kind: 'menu',
      icon: MoreHorizontal,
      title: 'Ещё',
      menuItems: [
        { icon: Eraser, label: 'Сбросить форматирование', action: clearFormatting },
        { icon: Unlink, label: 'Убрать ссылку', action: removeLink },
        { icon: Save, label: 'Сохранить (Ctrl+S)', action: saveNow },
        {
          icon: FileDown,
          label: 'Экспорт в Markdown',
          action: () => void exportMarkdown().catch(reportExportError),
        },
        {
          icon: FileCode,
          label: 'Экспорт в HTML',
          action: () => void exportHtml().catch(reportExportError),
        },
        { icon: Printer, label: 'Печать / PDF', action: exportPdf },
      ],
    },
  ];

  const items = side === 'left' ? leftItems : rightItems;

  return (
    <div
      className="editor-rail"
      role="toolbar"
      aria-label={side === 'left' ? 'Форматирование текста' : 'История и блоки'}
    >
      {items.map((item, itemIndex) => {
        if (item.kind === 'divider') {
          return <div key={itemIndex} className="editor-rail-divider" aria-hidden="true" />;
        }
        if (item.kind === 'custom') {
          return <div key={itemIndex}>{item.render()}</div>;
        }
        return item.kind === 'menu' ? (
          <DropdownMenu key={itemIndex}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'editor-toolbar-btn',
                  item.title === 'Маркер' && editor.isActive('highlight'),
                  item.title === 'Цвет текста' && editor.isActive('textStyle'),
                  item.title === 'Язык кода' && editor.isActive('codeBlock')
                )}
                title={item.title}
                aria-label={item.title}
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
            key={itemIndex}
            variant="ghost"
            size="icon"
            className={cn('editor-toolbar-btn', item.active && 'editor-toolbar-btn-active')}
            onClick={item.action}
            disabled={item.disabled}
            title={item.title}
            aria-label={item.title}
            aria-pressed={item.active}
          >
            <item.icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}

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
    title: 'Не получилось сохранить файл',
    description: e instanceof Error ? e.message : String(e),
    variant: 'destructive',
  });
}
