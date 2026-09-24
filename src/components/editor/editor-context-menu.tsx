import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Braces,
  Code,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  Palette,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, languageLabel } from './code-utils';
import { useTranslation } from '@/lib/i18n';

type MenuKind = 'text' | 'code' | 'image' | 'table';

interface MenuState {
  x: number;
  y: number;
  open: boolean;
  kind: MenuKind;
  codeLang: string | null;
}

interface EditorContextMenuProps {
  editor: Editor;
  children: ReactNode;
}

const HIGHLIGHT_COLORS = ['#fef08a', '#fecaca', '#bbf7d0', '#bfdbfe', '#f5d0fe'];
const TEXT_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7'];

/**
 * Позиция узла изображения/таблицы по точке правого клика: идём от глубины
 * позиции вверх (узел, в котором стоит курсор), затем проверяем границы
 * атомарного узла — posAtCoords может вернуть позицию ДО/ПОСЛЕ картинки,
 * а не внутрь неё.
 */
function findNodeTarget(doc: ProseMirrorNode, pos: number, name: string): number | null {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === name) return $pos.before(d);
  }
  const after = doc.nodeAt(pos);
  if (after && after.type.name === name) return pos;
  const before = $pos.nodeBefore;
  if (before && before.type.name === name) return pos - before.nodeSize;
  return null;
}

export function EditorContextMenu({ editor, children }: EditorContextMenuProps) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState>({
    x: 0,
    y: 0,
    open: false,
    kind: 'text',
    codeLang: null,
  });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [submenu, setSubmenu] = useState<'highlight' | 'color' | 'lang' | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setMenu(m => ({ ...m, open: false }));
    setSubmenu(null);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Цель определяем по ТОЧКЕ правого клика, а не по текущему selection:
      // браузер не перемещает selection на contextmenu, и при потерянном
      // фокусе focus()+isActive могли смотреть в другой узел.
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      let kind: MenuKind = 'text';
      let codeLang: string | null = null;

      if (coords) {
        const doc = editor.state.doc;
        const imagePos = findNodeTarget(doc, coords.pos, 'image');
        if (imagePos !== null) {
          kind = 'image';
          // Выделяем картинку: setImageWidth/setImageFloat читают NodeSelection.
          editor.chain().focus().setNodeSelection(imagePos).run();
        } else if (findNodeTarget(doc, coords.pos, 'table') !== null) {
          kind = 'table';
          // Курсор внутрь ячейки: команды строк/столбцов таблицы работают от
          // выделения, а браузер его на contextmenu не перемещает.
          editor.chain().focus().setTextSelection(coords.pos).run();
        } else {
          const $pos = doc.resolve(coords.pos);
          for (let d = $pos.depth; d >= 1; d--) {
            const node = $pos.node(d);
            if (node.type.name === 'codeBlock') {
              kind = 'code';
              codeLang = (node.attrs.language as string | null) ?? null;
              break;
            }
          }
        }
      }
      if (kind === 'text') {
        // Фолбэк: если координаты не попали в узел (край документа и т.п.),
        // используем selection, но с фокусом — это всё же точнее «голого» isActive.
        editor.chain().focus().run();
        if (editor.isActive('codeBlock')) {
          kind = 'code';
          codeLang = (editor.getAttributes('codeBlock').language as string | null) ?? null;
        }
      }
      setPos({ x: e.clientX, y: e.clientY });
      setMenu({ x: e.clientX, y: e.clientY, open: true, kind, codeLang });
      setSubmenu(null);
    },
    [editor]
  );

  // Close on click-outside, Esc, scroll.
  useEffect(() => {
    if (!menu.open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menu.open, close]);

  // Держим меню в пределах окна: измеряем НАТУРАЛЬНУЮ высоту (без клампа),
  // затем поджимаем позицию. Если измерять сразу после рендера на сырых
  // координатах клика, браузер уже применяет maxHeight и возвращает
  // усечённую высоту — кламп получается неверным и меню всё равно обрезано.
  useLayoutEffect(() => {
    if (!menu.open) return;
    const el = menuRef.current;
    if (!el) return;
    // Временно убираем ограничения, чтобы измерить реальный размер контента.
    el.style.maxHeight = 'none';
    el.style.top = '0px';
    const rect = el.getBoundingClientRect();
    const naturalHeight = rect.height || 320;
    const width = rect.width || 220;
    // Восстанавливаем ограничение и рассчитываем позицию.
    el.style.maxHeight = '';
    const GAP_BOTTOM = 12;
    const x = Math.min(Math.max(menu.x, 8), Math.max(8, window.innerWidth - width - 8));
    const y = Math.min(
      Math.max(menu.y, 8),
      Math.max(8, window.innerHeight - naturalHeight - GAP_BOTTOM)
    );
    setPos(prev => (prev.x === x && prev.y === y ? prev : { x, y }));
  }, [menu.open, menu.x, menu.y, menu.kind, submenu]);

  const run = useCallback(
    (fn: () => void) => () => {
      fn();
      close();
    },
    [close]
  );

  const insertImage = () => {
    const src = window.prompt(t('imageUrlPrompt'));
    if (src) editor.chain().focus().setImage({ src }).run();
    close();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('linkUrlPrompt'), prev ?? 'https://');
    if (url === null) return close();
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    close();
  };

  const deleteNode = () => {
    // Для выделенной картинки/таблицы (NodeSelection) удаляем сам узел,
    // для текста — ближайший блок под курсором.
    const { selection } = editor.state;
    if (selection instanceof NodeSelection) {
      editor.chain().focus().deleteSelection().run();
      return;
    }
    const { $from } = selection;
    const nodePos = $from.before($from.depth);
    if (nodePos >= 0)
      editor
        .chain()
        .focus()
        .deleteRange({ from: nodePos, to: nodePos + $from.parent.nodeSize })
        .run();
  };

  const itemCls =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-zinc-700/70 focus:outline-none';
  const iconCls = 'h-4 w-4 shrink-0 text-zinc-400';
  const dotCls = 'h-4 w-4 shrink-0 rounded-full border border-white/20';
  const headerCls = 'px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
  const divider = <div className="my-1 h-px bg-zinc-700" />;

  return (
    <div
      ref={wrapRef}
      onContextMenu={handleContextMenu}
      className="relative mb-14 flex min-h-0 flex-1 flex-col"
    >
      {children}
      {menu.open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            zIndex: 60,
            left: pos.x,
            top: pos.y,
            maxHeight: 'calc(100vh - 20px)',
            overflowY: 'auto',
          }}
          className="w-[220px] rounded-md border border-zinc-700 bg-zinc-800/95 p-1 shadow-xl backdrop-blur"
          role="menu"
        >
          {menu.kind === 'text' && (
            <>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleBold().run())}
              >
                <Bold className={iconCls} /> {t('bold').replace(/\s*\(Ctrl\+B\)/, '')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleItalic().run())}
              >
                <Italic className={iconCls} /> {t('italic').replace(/\s*\(Ctrl\+I\)/, '')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleStrike().run())}
              >
                <Strikethrough className={iconCls} /> {t('strikethrough')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleCode().run())}
              >
                <Code className={iconCls} /> {t('inlineCode')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={() => setSubmenu(submenu === 'highlight' ? null : 'highlight')}
              >
                <Highlighter className={iconCls} /> {t('highlight')}
              </button>
              {submenu === 'highlight' && (
                <div className="ml-6 flex items-center gap-1.5 px-2 py-1.5">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={dotCls}
                      style={{ backgroundColor: c }}
                      onClick={run(() =>
                        editor.chain().focus().toggleHighlight({ color: c }).run()
                      )}
                      aria-label={`${t('highlight')} ${c}`}
                    />
                  ))}
                  <button
                    type="button"
                    className="ml-1 rounded px-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                    onClick={run(() => editor.chain().focus().unsetHighlight().run())}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                className={itemCls}
                onClick={() => setSubmenu(submenu === 'color' ? null : 'color')}
              >
                <Palette className={iconCls} /> {t('textColor')}
              </button>
              {submenu === 'color' && (
                <div className="ml-6 flex items-center gap-1.5 px-2 py-1.5">
                  {TEXT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={dotCls}
                      style={{ backgroundColor: c }}
                      onClick={run(() => editor.chain().focus().setColor(c).run())}
                      aria-label={`${t('textColor')} ${c}`}
                    />
                  ))}
                  <button
                    type="button"
                    className="ml-1 rounded px-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                    onClick={run(() => editor.chain().focus().unsetColor().run())}
                  >
                    <Type className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button type="button" className={itemCls} onClick={setLink}>
                <LinkIcon className={iconCls} /> {t('link').replace(/\s*\(Ctrl\+K\)/, '')}
              </button>
              <button type="button" className={itemCls} onClick={insertImage}>
                <ImageIcon className={iconCls} /> {t('image')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() =>
                  editor
                    .chain()
                    .focus()
                    .insertConfiguredTable({ rows: 3, cols: 3, size: 'compact' })
                    .run()
                )}
              >
                <TableIcon className={iconCls} /> {t('table3x3')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().insertCodeBlock3().run())}
              >
                <Braces className={iconCls} /> {t('codeBlock')}
              </button>
              {divider}
              <button type="button" className={itemCls} onClick={run(deleteNode)}>
                <Trash2 className={iconCls} /> {t('deleteNode')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}
              >
                <Eraser className={iconCls} /> {t('clearFormatting')}
              </button>
            </>
          )}

          {menu.kind === 'code' && (
            <>
              <button
                type="button"
                className={itemCls}
                onClick={() => setSubmenu(submenu === 'lang' ? null : 'lang')}
              >
                <Braces className={iconCls} /> {t('languageLabel', { name: '' }).replace('{name}', '')}:
                <span className="ml-auto text-zinc-400">
                  {menu.codeLang ? languageLabel(menu.codeLang) : t('auto')}
                </span>
              </button>
              {submenu === 'lang' && (
                <div className="ml-4 max-h-44 overflow-y-auto py-1">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      className={`${itemCls} ${lang === menu.codeLang ? 'bg-zinc-700/70' : ''}`}
                      onClick={run(() =>
                        editor
                          .chain()
                          .focus()
                          .updateAttributes('codeBlock', { language: lang })
                          .run()
                      )}
                    >
                      {languageLabel(lang)}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleCodeBlock().run())}
              >
                <X className={iconCls} /> {t('removeCodeBlock')}
              </button>
              {divider}
            </>
          )}

          {menu.kind === 'image' && (
            <>
              <div className={headerCls}>{t('image')}</div>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageWidth(25).run())}
              >
                <Type className={iconCls} /> {t('width25')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageWidth(50).run())}
              >
                <Type className={iconCls} /> {t('width50')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageWidth(75).run())}
              >
                <Type className={iconCls} /> {t('width75')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageWidth(100).run())}
              >
                <Type className={iconCls} /> {t('width100')}
              </button>
              {divider}
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageFloat('left').run())}
              >
                <AlignLeft className={iconCls} /> {t('floatLeft').replace(/\s*\(Umfließung\)|\s*\(float\)/, '')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageFloat('right').run())}
              >
                <AlignRight className={iconCls} /> {t('floatRight').replace(/\s*\(Umfließung\)|\s*\(float\)/, '')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setImageFloat('none').run())}
              >
                <AlignCenter className={iconCls} /> {t('floatNone')}
              </button>
              {divider}
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().deleteSelection().run())}
              >
                <Trash2 className={iconCls} /> {t('deleteImage')}
              </button>
            </>
          )}

          {menu.kind === 'table' && (
            <>
              <div className={headerCls}>{t('table')}</div>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().addRowBefore().run())}
              >
                <ArrowUp className={iconCls} /> {t('rowAbove')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().addRowAfter().run())}
              >
                <ArrowDown className={iconCls} /> {t('rowBelow')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().addColumnBefore().run())}
              >
                <ArrowLeft className={iconCls} /> {t('columnLeft')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().addColumnAfter().run())}
              >
                <ArrowRight className={iconCls} /> {t('columnRight')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleHeaderRow().run())}
              >
                <TableIcon className={iconCls} /> {t('toggleHeader')}
              </button>
              {divider}
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setTableFloat('left').run())}
              >
                <AlignLeft className={iconCls} /> {t('floatLeft').replace(/\s*\(Umfließung\)|\s*\(float\)/, '')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setTableFloat('right').run())}
              >
                <AlignRight className={iconCls} /> {t('floatRight').replace(/\s*\(Umfließung\)|\s*\(float\)/, '')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setTableFloat('none').run())}
              >
                <AlignCenter className={iconCls} /> {t('floatNone')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setTableSize('compact').run())}
              >
                <Type className={iconCls} /> {t('compactWidth')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().setTableSize('full').run())}
              >
                <TableIcon className={iconCls} /> {t('fullWidth')}
              </button>
              {divider}
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().deleteRow().run())}
              >
                <X className={iconCls} /> {t('deleteRow')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().deleteColumn().run())}
              >
                <X className={iconCls} /> {t('deleteColumn')}
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().deleteTable().run())}
              >
                <Trash2 className={iconCls} /> {t('deleteTable')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EditorContextMenu;
