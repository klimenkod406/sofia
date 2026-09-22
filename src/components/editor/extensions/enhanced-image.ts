import { mergeAttributes } from '@tiptap/core';
import type { NodeViewRendererProps } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export type ImageFloat = 'left' | 'right' | 'none';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    enhancedImage: {
      setImageWidth: (width: number) => ReturnType;
      setImageFloat: (float: ImageFloat) => ReturnType;
      setImageAlignX: (alignX: number) => ReturnType;
    };
  }
}

function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return 100;
  return Math.min(100, Math.max(1, Math.round(width)));
}

/** Курсор внутри ячейки таблицы? В ячейках запрещены картинки и вложенные таблицы. */
export function isInsideTableCell(state: {
  selection: { $from: { depth: number; node(d: number): { type: { name: string } } } };
}): boolean {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === 'tableCell' || name === 'tableHeader') return true;
  }
  return false;
}

/** Позиция левого края картинки, % ширины колонки; картинка не выходит за край. */
function clampAlignX(alignX: number, width: number): number {
  if (!Number.isFinite(alignX)) return 0;
  return Math.min(100 - width, Math.max(0, Math.round(alignX)));
}

/** Легаси-зеркало data-float по горизонтальной позиции (для старых версий). */
function floatFromX(alignX: number, width: number): ImageFloat {
  if (alignX <= 3) return 'left';
  if (alignX >= 100 - width - 3) return 'right';
  return 'none';
}

/** Минимальная ширина при перетаскивании (px), чтобы маркер не схлопнулся. */
const MIN_DRAG_WIDTH_PX = 24;
/** Движение мыши меньше этого порога считается кликом, а не перетаскиванием. */
const MOVE_THRESHOLD_PX = 5;

/** Ширина контентной области редактора (без паддингов) в пикселях. */
function contentWidthOf(view: EditorView): number {
  const dom = view.dom;
  const style = getComputedStyle(dom);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  return Math.max(1, dom.clientWidth - padL - padR);
}

/**
 * Процент ширины колонки, при котором картинка отображается в естественном
 * размере (исходная ширина в px, но не шире 100% колонки). При недоступной
 * метрике (не загрузилась / CORS) — 100%.
 */
function naturalWidthPercent(src: string, columnWidth: number): Promise<number> {
  if (!Number.isFinite(columnWidth) || columnWidth <= 0) return Promise.resolve(100);
  return new Promise(resolve => {
    // window.Image — DOM-конструктор (глобальный Image затенён Tiptap-расширением).
    const probe = new window.Image();
    probe.onload = () => {
      const nw = probe.naturalWidth;
      resolve(nw > 0 ? Math.min(100, Math.max(1, Math.round((nw / columnWidth) * 100))) : 100);
    };
    probe.onerror = () => resolve(100);
    probe.src = src;
  });
}

export const EnhancedImage = Image.extend({
  // Картинки хранятся как data-URL (вставка/перенос через FileReader).
  // По умолчанию @tiptap/extension-image НЕ парсит data: — без этой опции
  // изображения молча пропадали бы из заметки при перезагрузке (setContent).
  addOptions() {
    return { ...this.parent?.(), allowBase64: true };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-width');
          if (raw) {
            const n = parseInt(raw, 10);
            if (Number.isFinite(n) && n > 0) return clampWidth(n);
          }
          const style = element.style?.width;
          if (style && style.endsWith('%')) {
            const n = parseInt(style, 10);
            if (Number.isFinite(n) && n > 0) return clampWidth(n);
          }
          return 100;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = clampWidth((attributes.width as number) ?? 100);
          return { 'data-width': String(width) };
        },
      },
      // Легаси-атрибут: старые заметки и тулбар всё ещё пишут data-float.
      // Реальная раскладка теперь от alignX; float хранится зеркалом.
      float: {
        default: 'none' as ImageFloat,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-float');
          return raw === 'left' || raw === 'right' ? raw : 'none';
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const float = (attributes.float as ImageFloat) || 'none';
          return float === 'none' ? {} : { 'data-float': float };
        },
      },
      alignX: {
        default: 0,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-align-x');
          if (raw) {
            const n = parseInt(raw, 10);
            if (Number.isFinite(n)) return n;
          }
          // Легаси: углы из data-float → край; без обтекания — слева (как было).
          const f = element.getAttribute('data-float');
          if (f === 'left') return 0;
          if (f === 'right') return 100;
          return 0;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = clampWidth((attributes.width as number) ?? 100);
          const x = clampAlignX((attributes.alignX as number) ?? 0, width);
          return { 'data-align-x': String(x) };
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    // Ширину и позицию берём из node.attrs: в HTMLAttributes они приходят
    // строками, и Number.isFinite("59") === false сломал бы clamp'ы.
    const width = clampWidth((node.attrs.width as number) ?? 100);
    const alignX = clampAlignX((node.attrs.alignX as number) ?? 0, width);
    const float = floatFromX(alignX, width);
    const style = `width: ${width}%; margin-left: ${alignX}%; height: auto;`;
    const attrs = { ...HTMLAttributes };
    attrs['data-align-x'] = String(alignX);
    if (float !== 'none') attrs['data-float'] = float;
    attrs['style'] = [attrs['style'], style].filter(Boolean).join(' ');
    return ['img', mergeAttributes(this.options.HTMLAttributes, attrs)];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setImage:
        (attrs: { src: string; alt?: string; title?: string; width?: number }) =>
        ({ view }) => {
          // Вставка по URL (кнопка «Картинка»): подбираем ширину под
          // натуральный размер источника, чтобы картинка не растягивалась
          // на всю колонку. См. naturalWidthPercent.
          // В ячейках таблицы картинки запрещены — тихо игнорируем.
          if (isInsideTableCell(view.state)) return false;
          const src = attrs?.src ?? '';
          naturalWidthPercent(src, contentWidthOf(view)).then(width => {
            if (view.isDestroyed) return;
            const node = view.state.schema.nodes.image.createAndFill({
              ...attrs,
              width,
            });
            if (!node) return;
            const tr = view.state.tr.replaceSelectionWith(node);
            view.dispatch(tr.scrollIntoView());
          });
          return true;
        },
      setImageWidth:
        (width: number) =>
        ({ state, commands }) => {
          // Ширина растет вправо от левого края — alignX надо пересчитать,
          // иначе alignX + width > 100 и картинка вылезет за край колонки.
          const w = clampWidth(width);
          const selNode = state.selection instanceof NodeSelection ? state.selection.node : null;
          const alignX = clampAlignX((selNode?.attrs.alignX as number) ?? 0, w);
          return commands.updateAttributes(this.name, { width: w, alignX });
        },
      setImageFloat:
        (float: ImageFloat) =>
        ({ state, commands }) => {
          const selNode = state.selection instanceof NodeSelection ? state.selection.node : null;
          const width = clampWidth((selNode?.attrs.width as number) ?? 100);
          const alignX = float === 'left' ? 0 : float === 'right' ? Math.max(0, 100 - width) : 0;
          return commands.updateAttributes(this.name, { float, alignX });
        },
      setImageAlignX:
        (alignX: number) =>
        ({ state, commands }) => {
          const selNode = state.selection instanceof NodeSelection ? state.selection.node : null;
          const width = clampWidth((selNode?.attrs.width as number) ?? 100);
          const x = clampAlignX(alignX, width);
          return commands.updateAttributes(this.name, {
            alignX: x,
            float: floatFromX(x, width),
          });
        },
    };
  },

  // NodeView: контейнер нулевой высоты + невидимый float-блок (задаёт область
  // обтекания текстом через shape-outside) + картинка, спозиционированная по
  // alignX. Перетаскивание картинки меняет её горизонтальную позицию и место
  // между блоками, перетаскивание маркера — ширину.
  addNodeView() {
    return ({ node, HTMLAttributes, editor, getPos }: NodeViewRendererProps) => {
      const container = document.createElement('div');
      container.className = 'image-container';

      // Невидимый float-блок: без него float на картинке не может «отойти»
      // от края. shape-outside: border-box ограничивает обтекание контуром
      // картинки (со скруглением), padding справа/снизу — воздух для текста.
      // Сторона обтекания выбирается по позиции картинки (см. applyAttrs):
      // левая половина колонки → текст справа, правая → текст слева.
      const shape = document.createElement('div');
      shape.className = 'image-shape';
      shape.setAttribute('contenteditable', 'false');
      container.appendChild(shape);

      const img = document.createElement('img');
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (
          key === 'style' ||
          key === 'data-width' ||
          key === 'data-float' ||
          key === 'data-align-x'
        ) {
          return;
        }
        if (value != null) img.setAttribute(key, String(value));
      });
      img.draggable = false; // перемещение своё, нативное браузеру не нужно
      container.appendChild(img);

      const handle = document.createElement('div');
      handle.className = 'image-resize-handle';
      handle.setAttribute('contenteditable', 'false');
      handle.setAttribute('aria-label', 'Изменить размер изображения');
      handle.title = 'Изменить размер: тяните за угол';
      container.appendChild(handle);

      // Переносит текущие атрибуты узла в DOM: размер/позиция картинки,
      // высота и положение shape-области обтекания, маркер в угол картинки.
      const applyAttrs = () => {
        const width = clampWidth((node.attrs.width as number) ?? 100);
        const alignX = clampAlignX((node.attrs.alignX as number) ?? 0, width);
        container.dataset.width = String(width);
        container.dataset.alignX = String(alignX);

        img.style.left = `${alignX}%`;
        img.style.width = `${width}%`;

        // Сторона обтекания: картинка в левой половине колонки → текст справа
        // (float:left), в правой → текст слева (float:right). Позиция задаётся
        // margin-left/margin-right в %, левый край картинки — всегда alignX.
        // calc(+1em) на ширине: padding shape-области раздвигает ОБЛАСТЬ
        // ОБТЕКАНИЯ за картинку (иначе при box-sizing: border-box зазор бы
        // съедался). Для float:left запас 1em уходит вправо (к тексту);
        // для float:right — влево, поэтому из margin-right 1em НЕ вычитается:
        // border-box левый край = alignX - 1em, и текст слева получает зазор.
        const sideRight = alignX + width / 2 > 50;
        shape.style.float = sideRight ? 'right' : 'left';
        shape.style.width = `calc(${width}% + 1em)`;
        shape.style.marginLeft = sideRight ? '' : `${alignX}%`;
        shape.style.marginRight = sideRight ? `calc(${100 - alignX - width}%)` : '';

        // shape-область — та же ширина и позиция, что у картинки; высота —
        // фактическая высота отрисованной картинки (следим за её загрузкой).
        const height = img.getBoundingClientRect().height;
        shape.style.height = `calc(${height}px + 1em)`;

        const proseW = container.offsetWidth || 1;
        const xPx = (alignX / 100) * proseW;
        const wPx = (width / 100) * proseW;
        handle.style.left = `${xPx + wPx - 10}px`;
        handle.style.top = `${height - 10}px`;
      };
      const onImgLoad = () => applyAttrs();
      const onWindowResize = () => applyAttrs();
      // Если картинка уже в кэше, событие load могло пройти ДО подписки —
      // иначе shape-область обтекания осталась бы нулевой высоты.
      if (img.complete) onImgLoad();
      img.addEventListener('load', onImgLoad);
      window.addEventListener('resize', onWindowResize);
      applyAttrs();

      // Маркер показываем только для выбранного изображения.
      const updateSelected = () => {
        const pos = getPos();
        const { from, to } = editor.state.selection;
        const selected = pos >= 0 && from === pos && to === pos + node.nodeSize;
        container.classList.toggle('is-selected', selected);
      };
      editor.on('selectionUpdate', updateSelected);
      updateSelected();

      // Всплывающие элементы: пилюля ресайза, призрак и линия сброса.
      const pill = document.createElement('div');
      pill.className = 'image-resize-pill';
      const ghost = document.createElement('div');
      ghost.className = 'image-move-ghost';
      const line = document.createElement('div');
      line.className = 'image-drop-line';

      // ---------- Изменение размера: тянем маркер за угол ----------
      const onHandleMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const pos = getPos();
        if (pos >= 0) editor.commands.setNodeSelection(pos);

        const startX = event.pageX;
        const widthAttr = clampWidth((node.attrs.width as number) ?? 100);
        const alignX = clampAlignX((node.attrs.alignX as number) ?? 0, widthAttr);
        const proseW = container.offsetWidth || 1;
        const startWidthPx = (widthAttr / 100) * proseW;
        // Картинку нельзя растянуть за правый край колонки.
        const maxWidthPx = ((100 - alignX) / 100) * proseW;
        const startHeightPx = img.getBoundingClientRect().height;
        const percentOf = (px: number) =>
          Math.max(1, Math.min(100 - alignX, Math.round((px / proseW) * 100)));

        const movePill = (clientX: number, clientY: number, percent: number) => {
          pill.textContent = `${percent}%`;
          pill.style.left = `${clientX}px`;
          pill.style.top = `${clientY}px`;
          if (!pill.isConnected) document.body.appendChild(pill);
        };
        movePill(event.clientX, event.clientY, percentOf(startWidthPx));

        const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          const px = Math.min(
            maxWidthPx,
            Math.max(MIN_DRAG_WIDTH_PX, startWidthPx + moveEvent.pageX - startX)
          );
          const ratio = startHeightPx > 0 ? px / startWidthPx : 1;
          // Живой предпросмотр: картинка, область обтекания и маркер.
          img.style.width = `${px}px`;
          shape.style.width = `calc(${px}px + 1em)`;
          shape.style.height = `calc(${startHeightPx * ratio}px + 1em)`;
          handle.style.left = `${(alignX / 100) * proseW + px - 10}px`;
          handle.style.top = `${startHeightPx * ratio - 10}px`;
          movePill(moveEvent.clientX, moveEvent.clientY, percentOf(px));
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('mouseup', onMouseUp, true);
          document.body.classList.remove('image-resizing');
          if (pill.isConnected) pill.remove();
          const px = parseFloat(img.style.width) || startWidthPx;
          const percent = percentOf(px);
          const nodePos = getPos();
          if (nodePos >= 0) {
            const tr = editor.state.tr.setNodeMarkup(nodePos, null, {
              ...node.attrs,
              width: percent,
            });
            editor.view.dispatch(tr);
          }
          applyAttrs();
        };

        document.body.classList.add('image-resizing');
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
      };
      handle.addEventListener('mousedown', onHandleMouseDown);

      // ---------- Перемещение: тянем саму картинку ----------
      // Вертикальная цель: граница ближайшего блока верхнего уровня документа.
      const dropTarget = (clientX: number, clientY: number) => {
        const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
        if (!coords) return null;
        const $pos = editor.state.doc.resolve(coords.pos);
        if ($pos.depth === 0) {
          // Курсор над границей документа (или прямо у узла картинки, когда
          // posAtCoords возвращает её позицию): цель — сама эта граница, а не
          // «начало документа», иначе картинка улетала бы вверх при драге.
          const domRect = editor.view.dom.getBoundingClientRect();
          return {
            pos: $pos.pos,
            y: $pos.pos === 0 ? domRect.top : domRect.bottom,
          };
        }
        const start = $pos.before(1);
        const end = start + $pos.node(1).nodeSize;
        const blockDom = editor.view.nodeDOM(start) as HTMLElement | null;
        const rect = (blockDom ?? editor.view.dom).getBoundingClientRect();
        const before = clientY < rect.top + rect.height / 2;
        return { pos: before ? start : end, y: before ? rect.top : rect.bottom };
      };

      let moveState: {
        startX: number;
        startY: number;
        lastX: number;
        lastY: number;
        targetPos: number;
        alignX: number;
        ghostW: number;
        ghostH: number;
      } | null = null;
      let moveRaf = 0;

      const cleanupMove = () => {
        cancelAnimationFrame(moveRaf);
        if (ghost.isConnected) ghost.remove();
        if (line.isConnected) line.remove();
        document.body.classList.remove('image-moving');
        moveState = null;
      };

      const updateMove = () => {
        const state = moveState;
        if (!state) return;
        const prose = editor.view.dom.getBoundingClientRect();
        // Центр призрака следует за курсором, но картинка не выходит за колонку.
        const minCx = prose.left + state.ghostW / 2;
        const maxCx = prose.right - state.ghostW / 2;
        const cx = Math.min(maxCx, Math.max(minCx, state.lastX));
        ghost.style.left = `${cx}px`;
        ghost.style.top = `${state.lastY}px`;
        // Горизонтальная позиция: левый край картинки, в % ширины колонки.
        state.alignX = Math.round(((cx - state.ghostW / 2 - prose.left) / prose.width) * 100);

        const target = dropTarget(state.lastX, state.lastY);
        if (target) {
          line.style.display = 'block';
          line.style.left = `${prose.left}px`;
          line.style.width = `${prose.width}px`;
          line.style.top = `${target.y}px`;
          state.targetPos = target.pos;
        } else {
          line.style.display = 'none';
        }

        // Автопрокрутка, когда курсор у края колонки.
        const column = editor.view.dom.closest('.editor-column') as HTMLElement | null;
        if (column) {
          const cr = column.getBoundingClientRect();
          if (state.lastY < cr.top + 40) column.scrollTop -= 12;
          else if (state.lastY > cr.bottom - 40) column.scrollTop += 12;
        }
        moveRaf = requestAnimationFrame(updateMove);
      };

      const applyMove = (targetPos: number, alignX: number) => {
        const pos = getPos();
        if (pos < 0) return;
        const current = editor.state.doc.nodeAt(pos);
        if (!current || current.type.name !== 'image') return;
        const width = clampWidth((current.attrs.width as number) ?? 100);
        const x = clampAlignX(alignX, width);
        const attrs = { ...current.attrs, alignX: x, float: floatFromX(x, width) };
        const nodeSize = current.nodeSize;
        const tr = editor.state.tr;
        if (targetPos === pos || targetPos === pos + nodeSize) {
          // Позиция не изменилась — меняем только горизонтальную позицию.
          if (attrs.alignX === current.attrs.alignX) return;
          tr.setNodeMarkup(pos, null, attrs);
          editor.view.dispatch(tr);
          return;
        }
        // Перемещение: вырезаем узел и вставляем у новой границы блоков.
        tr.delete(pos, pos + nodeSize);
        const insertPos = Math.max(
          0,
          Math.min(tr.doc.content.size, targetPos > pos ? targetPos - nodeSize : targetPos)
        );
        tr.insert(insertPos, current.type.create(attrs));
        tr.setSelection(NodeSelection.create(tr.doc, insertPos));
        editor.view.dispatch(tr);
      };

      const onImgMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const pos = getPos();
        if (pos >= 0) editor.commands.setNodeSelection(pos);

        const rect = img.getBoundingClientRect();
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        // Призрак строим заново: клон <img> унаследовал бы absolute-стили.
        const ghostImg = document.createElement('img');
        const src = node.attrs.src as string;
        if (src) ghostImg.src = src;
        const alt = node.attrs.alt as string | undefined;
        if (alt) ghostImg.alt = alt;
        ghost.replaceChildren(ghostImg);
        if (!ghost.isConnected) document.body.appendChild(ghost);
        if (!line.isConnected) document.body.appendChild(line);
        document.body.classList.add('image-moving');
        moveState = {
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          targetPos: pos,
          alignX: clampAlignX(
            (node.attrs.alignX as number) ?? 0,
            clampWidth((node.attrs.width as number) ?? 100)
          ),
          ghostW: rect.width,
          ghostH: rect.height,
        };
        updateMove();

        const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          if (!moveState) return;
          moveState.lastX = moveEvent.clientX;
          moveState.lastY = moveEvent.clientY;
          updateMove();
        };
        const onMouseUp = (upEvent: MouseEvent) => {
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('mouseup', onMouseUp, true);
          const state = moveState;
          cleanupMove();
          if (!state) return;
          // Обычный клик без перетаскивания ничего не перемещает.
          if (
            Math.hypot(upEvent.clientX - state.startX, upEvent.clientY - state.startY) <
            MOVE_THRESHOLD_PX
          ) {
            return;
          }
          applyMove(state.targetPos, state.alignX);
        };
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
      };
      img.addEventListener('mousedown', onImgMouseDown);

      return {
        dom: container,
        update: updatedNode => {
          if (updatedNode.type.name !== node.type.name) return false;
          node = updatedNode;
          applyAttrs();
          updateSelected();
          return true;
        },
        destroy: () => {
          editor.off('selectionUpdate', updateSelected);
          img.removeEventListener('load', onImgLoad);
          window.removeEventListener('resize', onWindowResize);
          handle.removeEventListener('mousedown', onHandleMouseDown);
          img.removeEventListener('mousedown', onImgMouseDown);
          cleanupMove();
          if (pill.isConnected) pill.remove();
        },
        // События на маркере, картинке и shape-области обтекания не отдаём
        // редактору — иначе клик сбросит выделение, а PM начнёт нативное
        // перетаскивание узла.
        stopEvent: event =>
          event.target === handle || event.target === img || event.target === shape,
      };
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('enhancedImagePaste'),
        props: {
          handlePaste: (view, event) => {
            const items = event.clipboardData?.items;
            if (!items) return false;
            // В ячейках таблицы картинки запрещены — даём обработать текст как обычно.
            if (isInsideTableCell(view.state)) return false;
            for (const item of Array.from(items)) {
              if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (!file) return false;
                const reader = new FileReader();
                reader.onload = async () => {
                  const dataUrl = reader.result as string;
                  const width = await naturalWidthPercent(dataUrl, contentWidthOf(view));
                  if (view.isDestroyed) return;
                  const node = view.state.schema.nodes.image.createAndFill({
                    src: dataUrl,
                    width,
                  });
                  if (!node) return;
                  const tr = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr.scrollIntoView());
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
            return false;
          },
          handleDrop: (view, event) => {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;
            // В ячейках таблицы картинки запрещены — не перехватываем drop.
            if (isInsideTableCell(view.state)) return false;
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (!imageFiles.length) return false;
            event.preventDefault();
            const tr = view.state.tr;
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            const insertPos = pos ? pos.pos : tr.selection.from;
            // FileReader.onload срабатывает асинхронно и не гарантирует порядок
            // (соответствие порядку в files), поэтому offset по факту готовности
            // перемешивал бы картинки. Вставляем строго в порядке очереди:
            // каждый ждёт завершения предыдущего.
            let offset = 0;
            let chain: Promise<void> = Promise.resolve();
            for (const file of imageFiles) {
              chain = chain.then(
                () =>
                  new Promise<void>(resolve => {
                    const reader = new FileReader();
                    reader.onload = async () => {
                      try {
                        const dataUrl = reader.result as string;
                        const width = await naturalWidthPercent(dataUrl, contentWidthOf(view));
                        if (view.isDestroyed) return;
                        const node = view.state.schema.nodes.image.createAndFill({
                          src: dataUrl,
                          width,
                        });
                        if (!node) return;
                        const dropTr = view.state.tr.insert(insertPos + offset, node);
                        offset += node.nodeSize;
                        view.dispatch(dropTr.scrollIntoView());
                      } finally {
                        resolve();
                      }
                    };
                    reader.onerror = () => resolve();
                    reader.readAsDataURL(file);
                  })
              );
            }
            return true;
          },
        },
      }),
    ];
  },
});

export default EnhancedImage;
