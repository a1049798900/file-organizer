// 侧边栏导航顺序：归一化 + 拖拽重排
// 核心约束：arrayMove 必须作用在「索引来源的同一个数组」上。
// 持久化的 sidebarOrder 可能是旧版本数据（缺少后加的导航项、含已删除项），
// 渲染时会先归一化（过滤非法 key、末尾补全新增项）；若索引用归一化数组计算、
// arrayMove 却作用在原始持久化数组上，索引会错位——拖新增项时 oldIndex 越界，
// 产生 undefined 并在下次渲染被过滤，表现为「松手后自动复位」。
import { arrayMove } from '@dnd-kit/sortable';

/**
 * 归一化导航顺序：过滤非法 key、去重，末尾按 validKeys 顺序补全新增项。
 * 渲染列表与拖拽重排必须共用此结果，保证索引坐标系一致。
 */
export function normalizeSidebarOrder<T extends string>(order: T[], validKeys: T[]): T[] {
  const filtered = order.filter((k, i) => validKeys.includes(k) && order.indexOf(k) === i);
  const seen = new Set(filtered);
  for (const k of validKeys) if (!seen.has(k)) filtered.push(k);
  return filtered;
}

/**
 * 计算拖拽结束后的新顺序。
 * 返回 null 表示无需更新（拖到原位置、或 active/over 不在合法列表中）。
 */
export function resolveSidebarDragOrder<T extends string>(
  order: T[],
  validKeys: T[],
  activeId: T,
  overId: T,
): T[] | null {
  if (activeId === overId) return null;
  const normalized = normalizeSidebarOrder(order, validKeys);
  const oldIndex = normalized.indexOf(activeId);
  const newIndex = normalized.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0) return null;
  return arrayMove(normalized, oldIndex, newIndex);
}
