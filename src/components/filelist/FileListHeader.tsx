import { useCallback, useRef } from 'react';
import type { FileSortKey, SortDir } from '@shared/types';
import { cn } from '@/lib/cn';
import {
  CHECKBOX_WIDTH,
  type ColumnKey,
  type ColumnWidths,
  COLUMNS,
  MAX_RESIZE_WIDTH,
  buildGridTemplate,
} from './fileColumns';

interface FileListHeaderProps {
  sort: { key: FileSortKey; dir: SortDir };
  sortActive: boolean;
  onSortChange: (key: FileSortKey) => void;
  allIds: number[];
  selectedCount: number;
  onToggleSelectAll: () => void;
  showSourceBadge?: boolean;
  widths: ColumnWidths;
  containerWidth: number;
  onResize: (key: ColumnKey, width: number) => void;
  onResizeCommit: () => void;
}

export function FileListHeader({
  sort,
  sortActive,
  onSortChange,
  allIds,
  selectedCount,
  onToggleSelectAll,
  showSourceBadge,
  widths,
  containerWidth,
  onResize,
  onResizeCommit,
}: FileListHeaderProps) {
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const indeterminate = selectedCount > 0 && selectedCount < allIds.length;
  const draggingRef = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, col: (typeof COLUMNS)[number]) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggingRef.current) return;
      draggingRef.current = true;

      const startX = e.clientX;
      const startWidth = widths[col.key];

      const handleMove = (ev: MouseEvent) => {
        const next = Math.min(
          MAX_RESIZE_WIDTH,
          Math.max(col.minWidth, Math.round(startWidth + (ev.clientX - startX))),
        );
        onResize(col.key, next);
      };

      const handleUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeCommit();
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [widths, onResize],
  );

  return (
    <div
      className="sticky top-0 z-10 border-b border-line bg-bg-panel text-sm text-ink-2"
      style={{
        height: 36,
        display: 'grid',
        gridTemplateColumns: buildGridTemplate(widths, containerWidth),
        alignItems: 'center',
        columnGap: 0,
      }}
    >
      {COLUMNS.map((col) => {
        if (col.key === 'checkbox') {
          return (
            <div key={col.key} className="flex items-center justify-center" style={{ width: CHECKBOX_WIDTH }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = indeterminate;
                }}
                onChange={onToggleSelectAll}
                className="h-4 w-4 cursor-pointer rounded accent-accent"
              />
            </div>
          );
        }

        const isSorted = sortActive && sort.key === col.key;
        const clickable = col.sortable;

        return (
          <div
            key={col.key}
            className={cn(
              'relative flex items-center h-full px-2 min-w-0',
              col.align === 'right' ? 'justify-end' : 'justify-start',
              clickable ? 'cursor-pointer select-none hover:text-ink' : '',
              isSorted ? 'text-ink font-semibold' : '',
            )}
            onClick={() => clickable && onSortChange(col.key as FileSortKey)}
          >
            {showSourceBadge && col.key === 'name' && <span className="w-12 flex-shrink-0" />}
            <span className="truncate">{col.label}</span>
            {col.sortable && (
              <span className={cn('ml-1 flex-shrink-0', isSorted ? 'text-accent' : 'opacity-0')}>
                {isSorted ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
              </span>
            )}

            {col.resizable && (
              <div
                onMouseDown={(e) => handleResizeStart(e, col)}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-accent/40"
                title="拖拽调整列宽"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
