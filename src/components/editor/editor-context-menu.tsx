import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import {
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

interface MenuState {
  x: number;
  y: number;
  open: boolean;
  inCodeBlock: boolean;
  codeLang: string | null;
}

interface EditorContextMenuProps {
  editor: Editor;
  children: ReactNode;
}

const HIGHLIGHT_COLORS = ['#fef08a', '#fecaca', '#bbf7d0', '#bfdbfe', '#f5d0fe'];
const TEXT_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7'];

export function EditorContextMenu({ editor, children }: EditorContextMenuProps) {
  const [menu, setMenu] = useState<MenuState>({
    x: 0,
    y: 0,
    open: false,
    inCodeBlock: false,
    codeLang: null,
  });
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
      // Определяем codeBlock по ТОЧКЕ правого клика, а не по текущему
      // selection: браузер не перемещает selection на contextmenu, и при
      // потерянном фокусе focus()+isActive могли смотреть в другой узел.
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      let inCodeBlock = false;
      let codeLang: string | null = null;
      if (coords) {
        const $pos = editor.state.doc.resolve(coords.pos);
        for (let d = $pos.depth; d >= 0; d--) {
          const node = d === 0 ? null : $pos.node(d);
          if (node && node.type.name === 'codeBlock') {
            inCodeBlock = true;
            codeLang = (node.attrs.language as string | null) ?? null;
            break;
          }
        }
      }
      if (!inCodeBlock) {
        // Фолбэк: если координаты не попали в узел (край документа и т.п.),
        // используем selection, но с фокусом — это всё же точнее «голого» isActive.
        editor.chain().focus().run();
        if (editor.isActive('codeBlock')) {
          inCodeBlock = true;
          codeLang = (editor.getAttributes('codeBlock').language as string | null) ?? null;
        }
      }
      setMenu({ x: e.clientX, y: e.clientY, open: true, inCodeBlock, codeLang });
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

  // Clamp menu position so it stays inside the viewport.
  const menuStyle = useMemo(() => {
    const maxX = window.innerWidth - 240;
    const maxY = window.innerHeight - 360;
    return {
      left: Math.min(Math.max(menu.x, 8), Math.max(maxX, 8)),
      top: Math.min(Math.max(menu.y, 8), Math.max(maxY, 8)),
    };
  }, [menu.x, menu.y]);

  const run = useCallback(
    (fn: () => void) => () => {
      fn();
      close();
    },
    [close]
  );

  const insertImage = () => {
    const src = window.prompt('Image URL');
    if (src) editor.chain().focus().setImage({ src }).run();
    close();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return close();
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    close();
  };

  const itemCls =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-zinc-700/70 focus:outline-none';
  const iconCls = 'h-4 w-4 shrink-0 text-zinc-400';
  const dotCls = 'h-4 w-4 shrink-0 rounded-full border border-white/20';

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
          style={{ position: 'fixed', zIndex: 60, ...menuStyle }}
          className="w-[220px] rounded-md border border-zinc-700 bg-zinc-800/95 p-1 shadow-xl backdrop-blur"
          role="menu"
        >
          {!menu.inCodeBlock && (
            <>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleBold().run())}
              >
                <Bold className={iconCls} /> Bold
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleItalic().run())}
              >
                <Italic className={iconCls} /> Italic
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleStrike().run())}
              >
                <Strikethrough className={iconCls} /> Strikethrough
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().toggleCode().run())}
              >
                <Code className={iconCls} /> Inline code
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={() => setSubmenu(submenu === 'highlight' ? null : 'highlight')}
              >
                <Highlighter className={iconCls} /> Highlight
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
                      aria-label={`Highlight ${c}`}
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
                <Palette className={iconCls} /> Text color
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
                      aria-label={`Text color ${c}`}
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
                <LinkIcon className={iconCls} /> Link
              </button>
              <button type="button" className={itemCls} onClick={insertImage}>
                <ImageIcon className={iconCls} /> Image
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
                <TableIcon className={iconCls} /> Table 3×3
              </button>
              <button
                type="button"
                className={itemCls}
                onClick={run(() => editor.chain().focus().insertCodeBlock3().run())}
              >
                <Braces className={iconCls} /> Code block
              </button>
              <div className="my-1 h-px bg-zinc-700" />
            </>
          )}

          {menu.inCodeBlock && (
            <>
              <button
                type="button"
                className={itemCls}
                onClick={() => setSubmenu(submenu === 'lang' ? null : 'lang')}
              >
                <Braces className={iconCls} /> Language:{' '}
                <span className="ml-auto text-zinc-400">
                  {menu.codeLang ? languageLabel(menu.codeLang) : 'Auto'}
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
                <X className={iconCls} /> Remove code block
              </button>
              <div className="my-1 h-px bg-zinc-700" />
            </>
          )}

          <button
            type="button"
            className={itemCls}
            onClick={run(() => {
              const { $from } = editor.state.selection;
              const pos = $from.before($from.depth);
              if (pos >= 0)
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: pos, to: pos + $from.parent.nodeSize })
                  .run();
            })}
          >
            <Trash2 className={iconCls} /> Delete node
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}
          >
            <Eraser className={iconCls} /> Clear formatting
          </button>
        </div>
      )}
    </div>
  );
}

export default EditorContextMenu;
