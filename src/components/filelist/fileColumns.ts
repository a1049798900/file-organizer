// 文件列表列定义 — 表头与数据行共用，保证严格对齐
import type { FileSortKey } from '@shared/types';

export type ColumnKey = 'checkbox' | 'name' | FileSortKey;

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** 默认宽度（px） */
  defaultWidth: number;
  /** 最小宽度（px） */
  minWidth: number;
  /** 是否允许拖拽调整宽度 */
  resizable: boolean;
  /** 是否可点击排序 */
  sortable: boolean;
  align?: 'left' | 'right';
}

/** 复选框固定宽度 */
export const CHECKBOX_WIDTH = 40;

/** 可拖拽列的最大宽度（px） */
export const MAX_RESIZE_WIDTH = 600;

export const COLUMNS: ColumnDef[] = [
  { key: 'checkbox', label: '', defaultWidth: CHECKBOX_WIDTH, minWidth: CHECKBOX_WIDTH, resizable: false, sortable: false },
  { key: 'name', label: '文件名', defaultWidth: 320, minWidth: 120, resizable: true, sortable: true, align: 'left' },
  { key: 'ext', label: '类型', defaultWidth: 80, minWidth: 50, resizable: true, sortable: true, align: 'left' },
  { key: 'size', label: '大小', defaultWidth: 100, minWidth: 50, resizable: true, sortable: true, align: 'right' },
  { key: 'mtime', label: '修改时间', defaultWidth: 160, minWidth: 80, resizable: true, sortable: true, align: 'left' },
  { key: 'tags', label: '标签', defaultWidth: 180, minWidth: 50, resizable: true, sortable: true, align: 'left' },
];

export type ColumnWidths = Record<string, number>;

export function defaultColumnWidths(): ColumnWidths {
  const widths: ColumnWidths = {};
  for (const col of COLUMNS) {
    widths[col.key] = col.defaultWidth;
  }
  return widths;
}

/**
 * 根据各列宽度生成 CSS grid-template-columns。
 * containerWidth 有富余时，富余空间全部加给 name 列（无空白缺口）；
 * 列总宽超出容器时按设定值渲染，由外层容器产生横向滚动。
 */
export function buildGridTemplate(widths: ColumnWidths, containerWidth = 0): string {
  const othersTotal = COLUMNS.filter((c) => c.key !== 'name').reduce(
    (sum, col) => sum + (widths[col.key] ?? col.defaultWidth),
    0,
  );
  const nameCol = COLUMNS.find((c) => c.key === 'name')!;
  const nameWidth = widths.name ?? nameCol.defaultWidth;
  const resolvedName = Math.max(nameWidth, containerWidth - othersTotal, nameCol.minWidth);

  return COLUMNS.map((col) => {
    const w = col.key === 'name' ? resolvedName : (widths[col.key] ?? col.defaultWidth);
    return `${w}px`;
  }).join(' ');
}

/** 内容总宽（用于横向滚动容器内层宽度） */
export function contentWidth(widths: ColumnWidths, containerWidth = 0): number {
  const othersTotal = COLUMNS.filter((c) => c.key !== 'name').reduce(
    (sum, col) => sum + (widths[col.key] ?? col.defaultWidth),
    0,
  );
  const nameCol = COLUMNS.find((c) => c.key === 'name')!;
  const resolvedName = Math.max(
    widths.name ?? nameCol.defaultWidth,
    containerWidth - othersTotal,
    nameCol.minWidth,
  );
  return othersTotal + resolvedName;
}

const STORAGE_KEY = 'weave:columnWidths';

export function loadColumnWidths(): ColumnWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultColumnWidths();
    const parsed = JSON.parse(raw) as Partial<ColumnWidths>;
    const widths = defaultColumnWidths();
    for (const col of COLUMNS) {
      if (!col.resizable) continue;
      const saved = parsed[col.key];
      if (typeof saved === 'number' && saved >= col.minWidth && saved <= MAX_RESIZE_WIDTH) {
        widths[col.key] = saved;
      }
    }
    return widths;
  } catch {
    return defaultColumnWidths();
  }
}

export function saveColumnWidths(widths: ColumnWidths): void {
  try {
    const resizable: Record<string, number> = {};
    for (const col of COLUMNS) {
      if (col.resizable) resizable[col.key] = widths[col.key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resizable));
  } catch {
    // ignore
  }
}
