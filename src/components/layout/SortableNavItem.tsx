import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavKey } from '@/stores/useUiStore';

export interface NavItemDef {
  view: NavKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  showCount?: boolean;
  /** 鼠标悬停时显示的说明；若未折叠也会显示（作为 label 的补充） */
  tooltip?: string;
}

interface SortableNavItemProps {
  item: NavItemDef;
  collapsed: boolean;
  active: boolean;
  inboxCount: number;
  onClick: () => void;
  /** 原生 drag 禁止处理（通讯录） */
  forbidDrop?: {
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * 可排序的一级导航项
 * - v10 手柄模式：容器只接 attributes + setNodeRef；把手柄的 setActivatorNodeRef + listeners 挂在手柄上
 * - 按钮主体 onClick 正常触发跳转，手柄才触发拖拽
 * - PointerSensor activationConstraint: { distance: 4 } 由父级 DndContext 统一配置
 */
export function SortableNavItem({
  item,
  collapsed,
  active,
  inboxCount,
  onClick,
  forbidDrop,
}: SortableNavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.view });

  const Icon = item.icon;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 原生 drag 禁止（通讯录）
  const dragAttrs = forbidDrop ?? {};

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      style={style}
      {...attributes}
      {...dragAttrs}
      className={cn(
        'group relative flex items-center gap-2 h-9 px-5 w-full',
        'text-base transition-colors',
        active
          ? 'bg-accent-weak text-accent font-semibold shadow-[inset_-3px_0_0_var(--color-accent)]'
          : 'text-ink-2 hover:bg-bg-hover',
        isDragging && 'opacity-40',
      )}
      title={collapsed ? (item.tooltip ?? item.label) : item.tooltip}
    >
      {/* 拖拽手柄 —— setActivatorNodeRef + listeners，只有这里才会触发 dnd-kit */}
      <span
        ref={setActivatorNodeRef}
        {...listeners}
        role="button"
        tabIndex={-1}
        aria-label={`拖动「${item.label}」`}
        className={cn(
          'flex-shrink-0 flex items-center justify-center w-4 h-4',
          'cursor-grab active:cursor-grabbing rounded hover:bg-black/5',
          'transition-opacity',
          'opacity-0 group-hover:opacity-60',
          collapsed && 'absolute -left-1 top-1/2 -translate-y-1/2',
          isDragging && 'opacity-100 cursor-grabbing',
        )}
      >
        <GripVertical size={14} className="text-ink-3" />
      </span>

      <Icon size={16} className="flex-shrink-0" />

      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.showCount && inboxCount > 0 && (
            <span
              className={cn(
                'text-xs px-1.5 rounded-full min-w-[20px] text-center',
                'bg-accent text-white',
              )}
            >
              {inboxCount > 99 ? '99+' : inboxCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}
