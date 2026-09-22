import { mergeAttributes } from '@tiptap/core';
import { Table, TableView } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { NodeSelection, TextSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { Schema, Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView, ViewMutationRecord } from '@tiptap/pm/view';
import { isInsideTableCell } from './enhanced-image';

export type TableFloat = 'left' | 'right' | 'none';
/** full — на всю ширину листа, compact — компактная, по ширине содержимого. */
export type TableSize = 'full' | 'compact';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    enhancedTable: {
      setTableFloat: (float: TableFloat) => ReturnType;
      setTableSize: (size: TableSize) => ReturnType;
      /** Вставить таблицу с настройками (строки/колонки/ширина) из меню. */
      insertConfiguredTable: (opts: { rows: number; cols: number; size?: TableSize }) => ReturnType;
    };
  }
}

const FLOAT_STYLES: Record<TableFloat, string> = {
  left: 'float: left; margin: 0 1em 1em 0; width: auto;',
  right: 'float: right; margin: 0 0 1em 1em; width: auto;',
  none: '',
};

/** Собрать таблицу с заданными атрибутами (аналог createTable из @tiptap/extension-table,
 *  но с произвольными атрибутами самой таблицы — там они не передаются). */
function createConfiguredTable(
  schema: Schema,
  rowsCount: number,
  colsCount: number,
  withHeaderRow: boolean,
  attrs: Record<string, unknown>
) {
  const cellType = schema.nodes.tableCell;
  const headerType = schema.nodes.tableHeader;
  const rowType = schema.nodes.tableRow;
  const tableType = schema.nodes.table;
  const makeCells = (type: typeof cellType) =>
    Array.from({ length: colsCount }, () => type.createAndFill()).filter(
      (c): c is NonNullable<typeof c> => c !== null
    );
  const cells = makeCells(cellType);
  const headerCells = makeCells(headerType);
  const rows = Array.from({ length: rowsCount }, (_, index) =>
    rowType.createChecked(null, withHeaderRow && index === 0 ? headerCells : cells)
  );
  return tableType.createChecked(attrs, rows);
}

/**
 * Вырезать из вставляемого фрагмента картинки и вложенные таблицы — они
 * запрещены в ячейках таблицы (буфер обмена, drag-and-drop между заметками).
 */
function stripForbiddenInCells(slice: Slice): Slice {
  const banned = new Set(['image', 'table']);
  let changed = false;

  const cleanNode = (node: ProseMirrorNode): ProseMirrorNode | null => {
    if (banned.has(node.type.name)) {
      changed = true;
      return null;
    }
    if (!node.content.size) return node;
    const children: ProseMirrorNode[] = [];
    node.content.forEach(child => {
      const cleaned = cleanNode(child);
      if (cleaned) children.push(cleaned);
    });
    return node.copy(Fragment.fromArray(children));
  };

  const nodes: ProseMirrorNode[] = [];
  slice.content.forEach(child => {
    const cleaned = cleanNode(child);
    if (cleaned) nodes.push(cleaned);
  });
  if (!changed) return slice;
  return new Slice(Fragment.fromArray(nodes), slice.openStart, slice.openEnd);
}

/**
 * NodeView таблицы с ручкой-уголком в правом нижнем углу (как в Word/Google Docs).
 * Перетаскивание ручки масштабирует ширины всех колонок таблицы пропорционально,
 * сохраняя результат в colwidth ячеек (переживает сохранение/перезагрузку).
 */
class EnhancedTableView extends TableView {
  private handle: HTMLDivElement;
  private moveHandle: HTMLDivElement;
  private drag: {
    startX: number;
    startWidths: number[];
    tablePos: number;
    minWidth: number;
  } | null = null;
  private move: {
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    targetPos: number;
    ghostW: number;
    ghostH: number;
  } | null = null;
  private moveRaf = 0;
  private ghost: HTMLDivElement;
  private line: HTMLDivElement;

  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    private view?: EditorView
  ) {
    super(node, cellMinWidth);
    this.dom.classList.add('tableWrapperResizable');
    this.handle = document.createElement('div');
    this.handle.className = 'table-resize-handle';
    this.handle.title = 'Изменить размер таблицы';
    this.dom.appendChild(this.handle);
    this.handle.addEventListener('mousedown', this.onHandleMouseDown);

    // Ручка перемещения — крестик в левом верхнем углу, как в Word/Google Docs.
    this.moveHandle = document.createElement('div');
    this.moveHandle.className = 'table-move-handle';
    this.moveHandle.title = 'Переместить таблицу';
    this.moveHandle.setAttribute('aria-label', 'Переместить таблицу');
    this.dom.appendChild(this.moveHandle);

    // Первоначальная позиция ручки — по реальному размеру таблицы.
    // NodeView создаётся ДО вставки dom в документ (в constructor таблица ещё
    // не имеет размеров), поэтому позицию ставим через setTimeout ПОСЛЕ
    // вставки; resize-наблюдение ненадёжно (rAF не тикает в фоновых вкладках,
    // ResizeObserver не срабатывает в некоторых средах), поэтому дополнительно
    // пересчитываем в update() (любое изменение документа) и endDrag().
    window.setTimeout(() => this.syncHandlePosition(), 0);
    window.setTimeout(() => this.syncHandlePosition(), 50);
    window.setTimeout(() => this.syncHandlePosition(), 300);

    this.ghost = document.createElement('div');
    this.ghost.className = 'table-move-ghost';
    this.line = document.createElement('div');
    this.line.className = 'table-drop-line';
    // Перехватываем mousedown в capture-фазе на document: если оставить это
    // событие ProseMirror/columnResizing, он пересоздаст NodeView таблицы при
    // клике на ручку, а destroy() снимет document-слушатели драга — и
    // перетаскивание умрёт до первого движения мыши.
    document.addEventListener('mousedown', this.onDocMouseDownCapture, true);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // Класс `resizing` на tableWrapper (наш, из startDrag) — внешняя мутация,
    // которую PM иначе сочтёт "изменением извне" и пересоздаст NodeView таблицы,
    // что мгновенно убивает drag (destroy() снимает document-слушатели).
    if (mutation.type === 'attributes' && mutation.target === this.dom) return true;
    if (mutation.target === this.handle || this.handle.contains(mutation.target)) return true;
    if (mutation.target === this.moveHandle || this.moveHandle.contains(mutation.target))
      return true;
    return super.ignoreMutation(mutation);
  }

  update(node: ProseMirrorNode): boolean {
    const updated = super.update(node);
    // Ширина таблицы могла измениться — переставить ручку за её правый нижний угол.
    this.syncHandlePosition();
    return updated;
  }

  /**
   * Позиционирует ресайз-ручку по РЕАЛЬНОМУ правому нижнему углу таблицы.
   * Wrapper растянут на всю ширину колонки, а таблица (особенно компактная)
   * уже него — привязка к углу wrapper'а оставляла бы ручку на месте
   * независимо от размера таблицы.
   *
   * Используем offsetLeft/offsetTop/offsetWidth/offsetHeight (CSS-пиксели
   * относительно offsetParent = wrapper), а не getBoundingClientRect:
   * редактор отмасштабирован (zoom), и масштабированные видимые координаты
   * не совпадают с координатами absolute-позиционирования.
   */
  private syncHandlePosition() {
    this.handle.style.left = `${this.table.offsetLeft + this.table.offsetWidth - 7}px`;
    this.handle.style.top = `${this.table.offsetTop + this.table.offsetHeight - 7}px`;
  }

  destroy() {
    document.removeEventListener('mousedown', this.onDocMouseDownCapture, true);
    this.handle.removeEventListener('mousedown', this.onHandleMouseDown);
    this.endDrag();
    this.cleanupMove();
    this.handle.remove();
    this.moveHandle.remove();
  }

  /** Перехват клика по ручкам раньше ProseMirror (capture, до view.dom). */
  private onDocMouseDownCapture = (event: MouseEvent) => {
    if (event.target === this.handle) {
      event.preventDefault();
      event.stopPropagation();
      this.startDragFromEvent(event);
      return;
    }
    if (event.target === this.moveHandle) {
      event.preventDefault();
      event.stopPropagation();
      this.startMoveFromEvent(event);
    }
  };

  private onHandleMouseDown = (event: MouseEvent) => {
    if (!this.view) return;
    event.preventDefault();
    event.stopPropagation();
    this.startDragFromEvent(event);
  };

  private startDragFromEvent(event: MouseEvent) {
    const view = this.view;
    if (!view) return;
    const tablePos = view.posAtDOM(this.table, 0) - 1;
    const node = view.state.doc.nodeAt(tablePos);
    if (!node || node.type !== view.state.schema.nodes.table) {
      // Возможно, позиция вычислена неверно — пробуем соседнюю.
      const fallback = view.posAtDOM(this.dom, 0);
      const candidate = view.state.doc.nodeAt(fallback);
      if (!candidate || candidate.type !== view.state.schema.nodes.table) return;
      this.startDrag(event, fallback);
      return;
    }
    this.startDrag(event, tablePos);
  }

  private startDrag(event: MouseEvent, tablePos: number) {
    const view = this.view;
    if (!view) return;
    const node = view.state.doc.nodeAt(tablePos);
    if (!node) return;

    // Текущие ширины колонок — РЕАЛЬНЫЕ отрисованные (getBoundingClientRect),
    // а не из colgroup style: у свежей таблицы там только min-width: 25px,
    // и первый же драг схлопнул бы таблицу до 25px на колонку.
    const startWidths = Array.from(this.colgroup.children).map(col =>
      Math.max(this.cellMinWidth, Math.round(col.getBoundingClientRect().width))
    );
    if (!startWidths.length) return;

    const minWidth = startWidths.length * this.cellMinWidth;
    this.drag = { startX: event.clientX, startWidths, tablePos, minWidth };
    document.addEventListener('mousemove', this.onDocMouseMove);
    document.addEventListener('mouseup', this.onDocMouseUp);
    document.body.classList.add('table-resizing');
    this.dom.classList.add('resizing');
  }

  private endDrag() {
    if (!this.drag) return;
    this.drag = null;
    document.removeEventListener('mousemove', this.onDocMouseMove);
    document.removeEventListener('mouseup', this.onDocMouseUp);
    document.body.classList.remove('table-resizing');
    this.dom.classList.remove('resizing');
    this.syncHandlePosition();
  }

  private onDocMouseMove = (event: MouseEvent) => {
    const drag = this.drag;
    const view = this.view;
    if (!drag || !view) return;

    const dx = event.clientX - drag.startX;
    const startTotal = drag.startWidths.reduce((sum, w) => sum + w, 0);
    const newTotal = Math.max(drag.minWidth, startTotal + dx);
    const scale = newTotal / startTotal;

    const newWidths = drag.startWidths.map(w => Math.round(w * scale));
    this.applyColWidths(drag.tablePos, newWidths);
  };

  private onDocMouseUp = () => {
    this.endDrag();
  };

  /** Пропорционально пересчитать colwidth всех ячеек таблицы. */
  private applyColWidths(tablePos: number, newWidths: number[]) {
    const view = this.view;
    if (!view) return;
    const { state } = view;
    const table = state.doc.nodeAt(tablePos);
    if (!table) return;

    const tr = state.tr;
    // Обходим строки, для каждой ячейки пишем ширины покрываемых колонок.
    let rowOffset = 0;
    table.forEach((row, rOffset) => {
      rowOffset = rOffset;
      let colIndex = 0;
      row.forEach((cell, cOffset) => {
        const colspan = cell.attrs.colspan || 1;
        const colwidth = newWidths.slice(colIndex, colIndex + colspan);
        const cellPos = tablePos + 1 + rowOffset + 1 + cOffset;
        tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth });
        colIndex += colspan;
      });
    });
    if (tr.docChanged) view.dispatch(tr);
  }

  // ---------- Перемещение таблицы за ручку-крестик ----------
  // Принцип как у изображения: призрак следует за курсором, а вертикальная
  // цель — граница ближайшего блока верхнего уровня документа; при отпускании
  // таблица вырезается и вставляется у этой границы.

  private tablePos(): number {
    if (!this.view) return -1;
    return this.view.posAtDOM(this.table, 0) - 1;
  }

  private startMoveFromEvent(event: MouseEvent) {
    const view = this.view;
    if (!view) return;
    const tablePos = this.tablePos();
    const node = view.state.doc.nodeAt(tablePos);
    if (!node || node.type !== view.state.schema.nodes.table) return;

    // Выделяем таблицу целиком — как при перемещении изображения.
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, tablePos)));

    const rect = this.table.getBoundingClientRect();
    // Призрак строим из клона реальной таблицы, чтобы было видно, что тянем.
    const ghostTable = this.table.cloneNode(true) as HTMLTableElement;
    ghostTable.style.margin = '0';
    this.ghost.replaceChildren(ghostTable);
    this.ghost.style.width = `${rect.width}px`;
    if (!this.ghost.isConnected) document.body.appendChild(this.ghost);
    if (!this.line.isConnected) document.body.appendChild(this.line);
    document.body.classList.add('table-moving');

    this.move = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      targetPos: tablePos,
      ghostW: rect.width,
      ghostH: rect.height,
    };
    this.updateMove();

    document.addEventListener('mousemove', this.onMoveMouseMove, true);
    document.addEventListener('mouseup', this.onMoveMouseUp, true);
  }

  private cleanupMove() {
    cancelAnimationFrame(this.moveRaf);
    this.moveRaf = 0;
    if (this.ghost.isConnected) this.ghost.remove();
    if (this.line.isConnected) this.line.remove();
    document.body.classList.remove('table-moving');
    document.removeEventListener('mousemove', this.onMoveMouseMove, true);
    document.removeEventListener('mouseup', this.onMoveMouseUp, true);
    this.move = null;
  }

  /** Вертикальная цель: граница ближайшего блока верхнего уровня. */
  private dropTarget(clientX: number, clientY: number) {
    const view = this.view;
    if (!view) return null;
    const coords = view.posAtCoords({ left: clientX, top: clientY });
    if (!coords) return null;
    const $pos = view.state.doc.resolve(coords.pos);
    if ($pos.depth === 0) {
      // Курсор над границей документа: цель — сама эта граница, а не
      // «начало документа», иначе таблица улетала бы вверх при драге.
      const domRect = view.dom.getBoundingClientRect();
      return { pos: $pos.pos, y: $pos.pos === 0 ? domRect.top : domRect.bottom };
    }
    const start = $pos.before(1);
    const end = start + $pos.node(1).nodeSize;
    const blockDom = view.nodeDOM(start) as HTMLElement | null;
    const rect = (blockDom ?? view.dom).getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    return { pos: before ? start : end, y: before ? rect.top : rect.bottom };
  }

  private updateMove = () => {
    const state = this.move;
    if (!state) return;
    const view = this.view;
    if (!view) return;
    const prose = view.dom.getBoundingClientRect();
    const minCx = prose.left + state.ghostW / 2;
    const maxCx = prose.right - state.ghostW / 2;
    const cx = Math.min(maxCx, Math.max(minCx, state.lastX));
    this.ghost.style.left = `${cx}px`;
    this.ghost.style.top = `${state.lastY}px`;

    const target = this.dropTarget(state.lastX, state.lastY);
    if (target) {
      this.line.style.display = 'block';
      this.line.style.left = `${prose.left}px`;
      this.line.style.width = `${prose.width}px`;
      this.line.style.top = `${target.y}px`;
      state.targetPos = target.pos;
    } else {
      this.line.style.display = 'none';
    }

    // Автопрокрутка, когда курсор у края колонки.
    const column = view.dom.closest('.editor-column') as HTMLElement | null;
    if (column) {
      const cr = column.getBoundingClientRect();
      if (state.lastY < cr.top + 40) column.scrollTop -= 12;
      else if (state.lastY > cr.bottom - 40) column.scrollTop += 12;
    }
    this.moveRaf = requestAnimationFrame(this.updateMove);
  };

  private onMoveMouseMove = (event: MouseEvent) => {
    event.preventDefault();
    const state = this.move;
    if (!state) return;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    this.updateMove();
  };

  private onMoveMouseUp = (event: MouseEvent) => {
    const state = this.move;
    if (!state) return;
    this.cleanupMove();
    // Обычный клик без перетаскивания ничего не перемещает.
    if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 5) return;
    this.applyMove(state.targetPos);
  };

  /** Вырезать таблицу и вставить у границы целевого блока. */
  private applyMove(targetPos: number) {
    const view = this.view;
    if (!view) return;
    const pos = this.tablePos();
    const node = view.state.doc.nodeAt(pos);
    if (!node || node.type !== view.state.schema.nodes.table) return;
    if (targetPos === pos || targetPos === pos + node.nodeSize) return;
    const tr = view.state.tr;
    tr.delete(pos, pos + node.nodeSize);
    const insertPos = Math.max(
      0,
      Math.min(tr.doc.content.size, targetPos > pos ? targetPos - node.nodeSize : targetPos)
    );
    tr.insert(insertPos, node);
    tr.setSelection(NodeSelection.create(tr.doc, insertPos));
    view.dispatch(tr.scrollIntoView());
  }
}

export const EnhancedTable = Table.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      View: EnhancedTableView,
    };
  },
  // Вложенные таблицы и картинки в ячейках запрещены: вырезаем такие узлы из
  // вставляемого фрагмента (буфер обмена, drag-and-drop между заметками),
  // но ТОЛЬКО когда курсор находится внутри ячейки — вне таблиц вставка
  // картинок и таблиц работает как раньше.
  // Второй плагин — страховка на ВСЕ остальные пути: перетаскивание узла
  // внутри документа (нативный PM drag&drop НЕ проходит через transformPasted),
  // вставку из других редакторов через setContent/replaceRange и т.п. Если
  // после транзакции в ячейке оказалась картинка или таблица — удаляем их.
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('enhancedTableCellContentGuard'),
        transformPasted: (slice: Slice) =>
          isInsideTableCell(this.editor.state) ? stripForbiddenInCells(slice) : slice,
      }),
      new Plugin({
        key: new PluginKey('enhancedTableCellCleanup'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some(tr => tr.docChanged)) return null;
          // Позиции собираем из НОВОГО документа, удаляем в ОБРАТНОМ порядке:
          // иначе каждое удаление сдвигает позиции ещё не удалённых узлов.
          const targets: { from: number; to: number }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader') return true;
            node.descendants((child, childPos) => {
              if (child.type.name === 'image' || child.type.name === 'table') {
                targets.push({
                  from: pos + 1 + childPos,
                  to: pos + 1 + childPos + child.nodeSize,
                });
              }
              return true;
            });
            return true;
          });
          if (!targets.length) return null;
          const tr = newState.tr;
          targets.sort((a, b) => b.from - a.from).forEach(t => tr.delete(t.from, t.to));
          return tr;
        },
      }),
    ];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      float: {
        default: 'none' as TableFloat,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-float');
          return raw === 'left' || raw === 'right' ? raw : 'none';
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const float = (attributes.float as TableFloat) || 'none';
          if (float === 'none') return {};
          return { 'data-float': float };
        },
      },
      size: {
        default: 'full' as TableSize,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-size') === 'compact' ? 'compact' : 'full',
        renderHTML: (attributes: Record<string, unknown>) => {
          const size = (attributes.size as TableSize) || 'full';
          if (size === 'full') return {};
          return { 'data-size': size };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setTableFloat:
        (float: TableFloat) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { float }),
      setTableSize:
        (size: TableSize) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { size }),
      insertConfiguredTable:
        ({ rows, cols, size = 'full' }: { rows: number; cols: number; size?: TableSize }) =>
        ({ tr, dispatch, editor, state }) => {
          // Вложенные таблицы запрещены: внутри ячейки таблицы не вставляем.
          const $from = state.selection.$from;
          for (let d = $from.depth; d > 0; d--) {
            const name = $from.node(d).type.name;
            if (name === 'tableCell' || name === 'tableHeader') return false;
          }
          const node = createConfiguredTable(editor.schema, rows, cols, true, { size });
          if (dispatch) {
            // replaceSelectionWith сдвигает документ — позицию «после таблицы»
            // считаем ПОСЛЕ вставки, иначе курсор оказывался внутри первой ячейки.
            tr.replaceSelectionWith(node).scrollIntoView();
            const afterPos = tr.selection.$to.pos;
            tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos)));
          }
          return true;
        },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const float = (HTMLAttributes['data-float'] as TableFloat) || 'none';
    const style = FLOAT_STYLES[float];
    const attrs = { ...HTMLAttributes };
    if (style) {
      attrs['style'] = [attrs['style'], style].filter(Boolean).join(' ');
    }
    return ['table', mergeAttributes(this.options.HTMLAttributes, attrs), ['tbody', 0]];
  },
});

// TableRow is unchanged behaviourally; exported for a single registration point.
export const EnhancedTableRow = TableRow;

interface ColwidthCellAttrs {
  colspan: number;
  rowspan: number;
  colwidth: number[] | null;
}

const colwidthAttribute = {
  default: null as number[] | null,
  parseHTML: (element: HTMLElement) => {
    // Preferred: data-colwidth="120,240" (what we emit). Fallback: legacy
    // colwidth attribute and inline width style written by other editors.
    const data = element.getAttribute('data-colwidth');
    if (data) {
      const parsed = data
        .split(',')
        .map(v => parseInt(v, 10))
        .filter(v => Number.isFinite(v) && v > 0);
      return parsed.length ? parsed : null;
    }
    const legacy = element.getAttribute('colwidth');
    if (legacy) {
      const parsed = legacy
        .split(',')
        .map(v => parseInt(v, 10))
        .filter(v => Number.isFinite(v) && v > 0);
      return parsed.length ? parsed : null;
    }
    const width = element.getAttribute('width');
    if (width) {
      const n = parseInt(width, 10);
      return Number.isFinite(n) && n > 0 ? [n] : null;
    }
    return null;
  },
  renderHTML: (attributes: Record<string, unknown>) => {
    const colwidth = attributes.colwidth as number[] | null;
    if (!colwidth || !colwidth.length) return {};
    return { 'data-colwidth': colwidth.join(',') };
  },
};

export const EnhancedTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute,
    } as Record<keyof ColwidthCellAttrs, unknown> & Record<string, unknown>;
  },
});

export const EnhancedTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute,
    } as Record<keyof ColwidthCellAttrs, unknown> & Record<string, unknown>;
  },
});
