'use client';

import { useEffect, useState } from 'react';
import type { useEditor } from '@tiptap/react';
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
} from '@/components/ui/dropdown-menu';
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
  Languages,
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
  }[];
}

interface ToolbarDivider {
  kind: 'divider';
  title?: string;
}

type ToolbarItem = ToolbarButton | ToolbarMenu | ToolbarDivider;

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

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
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

  const setCodeLanguage = (language: string) => {
    if (!editor.isActive('codeBlock')) {
      editor.chain().focus().toggleCodeBlock().run();
    }
    editor.chain().focus().updateAttributes('codeBlock', { language }).run();
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
      kind: 'menu',
      icon: Highlighter,
      title: 'Маркер',
      menuItems: [
        ...HIGHLIGHT_COLORS.map(c => ({
          icon: Highlighter,
          label: c.label,
          action: () => toggleHighlightColor(c.value),
        })),
        {
          icon: Eraser,
          label: 'Убрать маркер',
          action: () => editor.chain().focus().unsetHighlight().run(),
          separatorBefore: true,
        },
      ],
    },
    {
      kind: 'menu',
      icon: Palette,
      title: 'Цвет текста',
      menuItems: TEXT_COLORS.map(c => ({
        icon: Palette,
        label: c.label,
        action: () => setTextColor(c.value),
      })),
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
      action: () => editor.chain().focus().toggleCodeBlock().run(),
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
    { kind: 'button', icon: Table, action: addTable, title: 'Таблица' },
    {
      kind: 'menu',
      icon: Languages,
      title: 'Язык кода',
      menuItems: ['plaintext', 'javascript', 'typescript', 'python', 'json', 'html', 'css', 'bash', 'sql', 'rust'].map(
        language => ({
          icon: Code,
          label: language,
          action: () => setCodeLanguage(language),
        }),
      ),
    },
    { kind: 'button', icon: Search, action: () => onOpenSearch?.(), title: 'Найти и заменить (Ctrl+F)' },
    {
      kind: 'menu',
      icon: MoreHorizontal,
      title: 'Ещё',
      menuItems: [
        { icon: Eraser, label: 'Сбросить форматирование', action: clearFormatting },
        { icon: Unlink, label: 'Убрать ссылку', action: removeLink },
        { icon: Save, label: 'Сохранить (Ctrl+S)', action: saveNow },
        { icon: FileDown, label: 'Экспорт в Markdown', action: () => void exportMarkdown().catch(reportExportError) },
        { icon: FileCode, label: 'Экспорт в HTML', action: () => void exportHtml().catch(reportExportError) },
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
                  item.title === 'Язык кода' && editor.isActive('codeBlock'),
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
  };
}) {
  return (
    <>
      {menuItem.separatorBefore && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={menuItem.action} className="flex items-center gap-2">
        <menuItem.icon className="h-4 w-4" />
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
