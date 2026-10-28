import { memo } from 'react';
import type { FileRow as FileRowData } from '@shared/types';
import { Checkbox } from '../ui/Checkbox';
import { formatSize, formatMtime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { buildGridTemplate, type ColumnWidths } from './fileColumns';

interface FileRowProps {
  file: FileRowData;
  isSelected: boolean;
  isFocused: boolean;
  onToggleSelect: (checked: boolean) => void;
  onRowClick: (e: React.MouseEvent) => void;
  onRowDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
  showSourceBadge?: boolean;
  showKbBadge?: boolean;
  style?: React.CSSProperties;
  widths: ColumnWidths;
  containerWidth: number;
}

function FileRowComponent({
  file,
  isSelected,
  isFocused,
  onToggleSelect,
  onRowClick,
  onRowDoubleClick,
  onContextMenu,
  onDragStart,
  draggable = false,
  showSourceBadge,
  showKbBadge,
  style,
  widths,
  containerWidth,
}: FileRowProps) {
  const tagText = file.tags.map((t) => t.name).join(', ');
  const displayName = file.alias || file.name;

  const sourceBadgeText = (() => {
    if (!showSourceBadge) return null;
    if (file.status === 'inbox') return { text: '📥 收件箱', bg: 'bg-blue-50 text-blue-600' };
    if (file.inKnowledge) return { text: '📚 资料库', bg: 'bg-purple-50 text-purple-600' };
    return { text: '💼 项目', bg: 'bg-green-50 text-green-600' };
  })();

  return (
    <div
      className={cn(
        'flex items-center h-9 cursor-pointer transition-colors text-base',
        'border-b border-line/50',
        isSelected
          ? 'bg-accent-weak'
          : 'hover:bg-bg-hover',
        isFocused ? 'outline outline-1 outline-accent/40 -outline-offset-1' : '',
      )}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: buildGridTemplate(widths, containerWidth),
        alignItems: 'center',
        columnGap: 0,
        boxShadow: isSelected ? 'inset 3px 0 0 #0A84FF' : undefined,
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onRowClick}
      onDoubleClick={onRowDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* 复选框 */}
      <div style={{ width: 40 }} className="flex justify-center items-center">
        <Checkbox
          checked={isSelected}
          onChange={(e) => onToggleSelect(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 文件名 */}
      <div className="min-w-0 flex items-center gap-1.5 overflow-hidden px-2">
        {sourceBadgeText && (
          <span
            className={cn(
              'text-[11px] px-1.5 py-0.5 rounded flex-shrink-0',
              sourceBadgeText.bg,
            )}
          >
            {sourceBadgeText.text}
          </span>
        )}
        <span className="truncate text-ink" title={displayName}>
          {displayName}
          {showKbBadge && file.inKnowledge && (
            <span className="ml-1">📚</span>
          )}
        </span>
        {file.pathMissing && (
          <span className="text-danger text-xs flex-shrink-0 ml-1">⚠ 路径失效</span>
        )}
      </div>

      {/* 类型 */}
      <div className="text-ink-2 truncate px-2" title={file.ext.toUpperCase()}>
        {file.ext.toUpperCase()}
      </div>

      {/* 大小 */}
      <div className="text-right text-ink-2 tabular-nums px-2">
        {formatSize(file.size)}
      </div>

      {/* 修改时间 */}
      <div className="text-ink-2 truncate px-2" title={formatMtime(file.mtime)}>
        {formatMtime(file.mtime)}
      </div>

      {/* 标签 */}
      <div className="text-ink-3 truncate px-2" title={tagText}>
        {tagText}
      </div>
    </div>
  );
}

export const FileRow = memo(FileRowComponent);
