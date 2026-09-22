import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { CommandProps } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { detectLanguage } from './code-utils';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertCodeBlock3: {
      /** Toggle a code block: insert outside one, remove when already inside. */
      insertCodeBlock3: () => ReturnType;
    };
  }
}

/** Track the doc of the last auto-detect pass so we never loop. */
let lastAutoDetectedDoc: unknown = null;

function findActiveCodeBlock(
  state: import('@tiptap/pm/state').EditorState
): { node: PMNode; pos: number } | null {
  const $from = state.selection.$from;
  if ($from.parent.type.name === 'codeBlock') {
    return { node: $from.parent, pos: $from.before() };
  }
  // Walk up ancestors (e.g. when selection is inside a heading inside? codeBlock is flat,
  // but the selection may be in a paragraph directly inside).
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'codeBlock') {
      return { node: $from.node(d), pos: $from.before(d) };
    }
  }
  return null;
}

export const EnhancedCodeBlock = CodeBlockLowlight.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      insertCodeBlock3:
        () =>
        ({ chain, state, commands }: CommandProps) => {
          if (findActiveCodeBlock(state)) {
            // Курсор уже внутри блока кода: убираем его. Родительская команда
            // зовём через editor.commands — у неё правильный CommandProps
            // (state/chain вручную собрать нельзя: toggleCodeBlock внутри
            // обращается к commands и упадёт на деструктуризации).
            return commands.toggleCodeBlock();
          }
          return chain().toggleCodeBlock().run();
        },
    };
  },

  // Пишем data-language на <pre>, чтобы CSS мог показать подпись языка сверху.
  renderHTML({ node, HTMLAttributes }) {
    const language = (node.attrs.language as string | null) ?? null;
    const attrs = { ...HTMLAttributes };
    if (language && language !== 'null' && language !== 'plaintext') {
      attrs['data-language'] = language;
    } else {
      delete attrs['data-language'];
    }
    return ['pre', mergeAttributes(this.options.HTMLAttributes, attrs), ['code', 0]];
  },

  // NodeView: оборачиваем в div с номерами строк слева; contentDOM = code,
  // поэтому подсветка синтаксиса (lowlight decorations) продолжает работать.
  // Горизонтальный скролл применяем к code, а не к wrap — номера всегда видны.
  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const wrap = document.createElement('div');
      wrap.className = 'cb-wrapper';

      const gutter = document.createElement('div');
      gutter.className = 'cb-gutter';
      gutter.setAttribute('contenteditable', 'false');

      const pre = document.createElement('pre');
      pre.className = 'cb-pre';

      const language = (node.attrs.language as string | null) ?? null;
      if (language && language !== 'null' && language !== 'plaintext') {
        pre.setAttribute('data-language', language);
      }
      Object.entries(mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)).forEach(
        ([key, value]) => {
          if (key !== 'data-language') pre.setAttribute(key, String(value));
        }
      );

      const code = document.createElement('code');
      if (language && language !== 'null') code.classList.add('language-' + language);
      pre.appendChild(code);

      const updateGutter = (text: string) => {
        const count = text ? text.split('\n').length : 1;
        gutter.textContent = '';
        for (let i = 1; i <= count; i++) {
          const span = document.createElement('div');
          span.textContent = String(i);
          gutter.appendChild(span);
        }
      };
      updateGutter(node.textContent ?? '');

      wrap.appendChild(gutter);
      wrap.appendChild(pre);

      return {
        dom: wrap,
        contentDOM: code,
        update: updatedNode => {
          if (updatedNode.type.name !== node.type.name) return false;
          const newLang = (updatedNode.attrs.language as string | null) ?? null;
          if (newLang && newLang !== 'null' && newLang !== 'plaintext') {
            pre.setAttribute('data-language', newLang);
            code.className = 'language-' + newLang + ' hljs';
          } else {
            pre.removeAttribute('data-language');
            code.className = 'hljs';
          }
          updateGutter(updatedNode.textContent ?? '');
          return true;
        },
      };
    };
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? [];

    const autoDetect = new Plugin({
      key: new PluginKey('enhancedCodeBlockAutoDetect'),
      appendTransaction(transactions: readonly Transaction[], _oldState, newState) {
        // Only run when the doc actually changed (someone typed / pasted).
        if (!transactions.some(tr => tr.docChanged)) return null;

        // Avoid re-running on our own attribute patch.
        if (lastAutoDetectedDoc === newState.doc) return null;

        const found = findActiveCodeBlock(newState);
        if (!found) return null;

        const { node, pos } = found;
        const lang = (node.attrs.language as string | null) ?? null;
        if (lang && lang !== 'plaintext' && lang !== 'null') return null;

        const text = node.textContent;
        if (!text.trim()) return null;

        const detected = detectLanguage(text);
        if (!detected || detected === 'plaintext' || detected === lang) return null;

        lastAutoDetectedDoc = newState.doc;
        return newState.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          language: detected,
        });
      },
    });

    return [...plugins, autoDetect];
  },
});

export default EnhancedCodeBlock;
