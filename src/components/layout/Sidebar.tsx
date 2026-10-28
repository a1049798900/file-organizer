import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Inbox, CalendarDays, Briefcase, BookOpen, Globe, Settings, UserRound, Network, House } from 'lucide-react';
import { useUiStore, type NavKey } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { SortableNavItem, type NavItemDef } from './SortableNavItem';
import { normalizeSidebarOrder, resolveSidebarDragOrder } from '@/lib/sidebarOrder';
import { cn } from '@/lib/cn';

const NAV_DEFS: NavItemDef[] = [
  { view: 'inbox', icon: Inbox, label: '收件箱', showCount: true },
  { view: 'calendar', icon: CalendarDays, label: '日历' },
  { view: 'contacts', icon: UserRound, label: '通讯录' },
  { view: 'projects', icon: Briefcase, label: '项目' },
  { view: 'kb', icon: BookOpen, label: '资料库', tooltip: '存放你主动收进来的文件资料，不是写笔记的地方。' },
  { view: 'web', icon: Globe, label: '🌐 网页' },
  { view: 'graph', icon: Network, label: '关系图' },
];

// key 查找，避免硬编码重复
const NAV_MAP: Record<NavKey, NavItemDef> = NAV_DEFS.reduce(
  (acc, item) => {
    acc[item.view] = item;
    return acc;
  },
  {} as Record<NavKey, NavItemDef>,
);

const CONTACTS_KEY: NavKey = 'contacts';

/** 通讯录禁止拖入 */
const forbidDrop = {
  onDragOver: (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  },
  onDrop: (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  },
};

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const sidebarOrder = useUiStore((s) => s.sidebarOrder);
  const setSidebarOrder = useUiStore((s) => s.setSidebarOrder);
  const webSidePanelOpen = useUiStore((s) => s.webSidePanelOpen);
  const setWebSidePanelOpen = useUiStore((s) => s.setWebSidePanelOpen);
  const setWebForm = useUiStore((s) => s.setWebForm);
  const inboxCount = useDataStore((s) => s.inboxCount);

  const [activeId, setActiveId] = useState<NavKey | null>(null);

  // 拖拽传感器：鼠标移动 4px 后才判定为拖拽（防误触）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  // 从顺序数组派生出当前渲染列表；归一化（过滤非法 key、补全新增项）
  // 与拖拽重排共用 normalizeSidebarOrder，保证索引坐标系一致
  const orderedItems = useMemo(() => {
    const validKeys = NAV_DEFS.map((d) => d.view);
    return normalizeSidebarOrder(sidebarOrder, validKeys).map((k) => NAV_MAP[k]);
  }, [sidebarOrder]);

  const items = orderedItems.map((it) => it.view);

  const isActive = (view: NavKey) => {
    if (view === 'projects' && activeView === 'project-detail') return true;
    if (view === 'calendar' && activeView === 'area-detail') return true;
    return activeView === view;
  };

  const handleClick = (view: NavKey) => {
    if (view === 'web') {
      // Web 主视图：设置 main 形态 + 关掉侧屏避免同时渲染
      setWebForm('main');
      if (webSidePanelOpen) setWebSidePanelOpen(false);
    }
    setActiveView(view);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as NavKey);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    // arrayMove 必须作用在归一化后的数组上（索引来源数组），
    // 否则旧版持久化顺序缺少新增导航项时索引越界，导致换位无效/复位
    const newOrder = resolveSidebarDragOrder(
      sidebarOrder,
      NAV_DEFS.map((d) => d.view),
      active.id as NavKey,
      over.id as NavKey,
    );
    if (newOrder) setSidebarOrder(newOrder);
  };

  const activeDef = activeId ? NAV_MAP[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <aside
        className={cn(
          'flex flex-col bg-bg-panel border-r border-line flex-shrink-0',
          collapsed ? 'w-14' : '',
        )}
        style={collapsed ? undefined : { width: sidebarWidth }}
      >
        {/* 每日总览 —— 固定置顶，不参与排序 */}
        <div className="pt-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className={cn(
              'flex items-center gap-2 h-9 px-5 w-full',
              'text-base transition-colors',
              activeView === 'dashboard'
                ? 'bg-accent-weak text-accent font-semibold shadow-[inset_-3px_0_0_var(--color-accent)]'
                : 'text-ink-2 hover:bg-bg-hover',
            )}
            title={collapsed ? '每日总览' : undefined}
          >
            {/* 占位对齐可排序项的拖拽手柄宽度 */}
            <span className="w-4 h-4 flex-shrink-0" />
            <House size={16} className="flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left truncate">每日总览</span>}
          </button>
        </div>

        {/* 主导航（可排序区） */}
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="flex-1 py-1 flex flex-col">
            {orderedItems.map((item) => {
              const active = isActive(item.view);
              return (
                <SortableNavItem
                  key={item.view}
                  item={item}
                  collapsed={collapsed}
                  active={active}
                  inboxCount={inboxCount}
                  onClick={() => handleClick(item.view)}
                  forbidDrop={item.view === CONTACTS_KEY ? forbidDrop : undefined}
                />
              );
            })}
          </div>
        </SortableContext>

        {/* 分隔线 —— 在 SortableContext 外 */}
        <div className="h-px bg-line" />

        {/* 设置 —— 固定底部，不参与排序 */}
        <div className="py-1">
          <button
            onClick={() => setActiveView('settings')}
            className={cn(
              'flex items-center gap-2 h-9 px-5 w-full',
              'text-base transition-colors',
              activeView === 'settings'
                ? 'bg-accent-weak text-accent font-semibold shadow-[inset_-3px_0_0_var(--color-accent)]'
                : 'text-ink-2 hover:bg-bg-hover',
            )}
            title={collapsed ? '设置' : undefined}
          >
            <Settings size={16} className="flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left">设置</span>}
          </button>
        </div>
      </aside>

      {/* 拖拽浮层 —— 拖拽中项会显示在这里（有阴影 + 缩放），原位置是透明占位 */}
      <DragOverlay dropAnimation={null}>
        {activeDef ? (
          <div
            className={cn(
              'flex items-center gap-2 h-8 rounded-md px-2',
              'bg-white text-ink shadow-lg ring-1 ring-line',
              'scale-[1.02] cursor-grabbing',
              collapsed ? 'px-2' : '',
            )}
            style={{ width: collapsed ? 32 : sidebarWidth }}
          >
            <activeDef.icon size={16} className="flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{activeDef.label}</span>
                {activeDef.showCount && inboxCount > 0 && (
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
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
