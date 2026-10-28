// 关系图谱确定性径向布局
// 焦点固定在圆心，第一环按类型分扇区（项目→文件→联系人→专题→领域），同环均分角度。
// 纯函数：同一输入永远得到完全相同的坐标；本轮不做力导向。

import type { GraphNodeType } from '@shared/graph';

/** 第一环半径占画布短边的比例 */
export const GRAPH_RING_RATIO = 0.38;

/** 扇区顺序：任务书要求 项目→文件→联系人→专题，领域补充在最后 */
export const GRAPH_TYPE_SECTOR_ORDER: GraphNodeType[] = [
  'project',
  'file',
  'contact',
  'topic',
  'area',
];

const TYPE_ORDER_INDEX: Record<GraphNodeType, number> = {
  project: 0,
  file: 1,
  contact: 2,
  topic: 3,
  area: 4,
};

export interface GraphLayoutInputNode {
  key: string;
  type: GraphNodeType;
  isFocus: boolean;
}

export interface GraphLayoutInput {
  nodes: GraphLayoutInputNode[];
  width: number;
  height: number;
}

export interface GraphLayoutNode {
  key: string;
  x: number;
  y: number;
}

export interface GraphLayoutResult {
  nodes: GraphLayoutNode[];
  radius: number;
  centerX: number;
  centerY: number;
}

/**
 * 计算径向布局。
 * - 焦点在圆心
 * - 非焦点节点按类型分组，组间按数量比例分配扇区，组内按数量均分角度
 * - 排序使用 key 保证确定性
 */
export function computeRadialLayout(input: GraphLayoutInput): GraphLayoutResult {
  const width = Number.isFinite(input.width) && input.width > 0 ? input.width : 1;
  const height = Number.isFinite(input.height) && input.height > 0 ? input.height : 1;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * GRAPH_RING_RATIO;

  const focus = input.nodes.find((node) => node.isFocus) ?? null;
  const ringNodes = input.nodes
    .filter((node) => !node.isFocus)
    .sort((a, b) => {
      const typeDiff = TYPE_ORDER_INDEX[a.type] - TYPE_ORDER_INDEX[b.type];
      if (typeDiff !== 0) return typeDiff;
      return a.key.localeCompare(b.key);
    });

  const positions = new Map<string, GraphLayoutNode>();
  if (focus) positions.set(focus.key, { key: focus.key, x: centerX, y: centerY });

  if (ringNodes.length === 0) {
    return { nodes: Array.from(positions.values()), radius, centerX, centerY };
  }

  // 按类型分组（已按类型与 key 排序）
  const groups: { type: GraphNodeType; nodes: GraphLayoutInputNode[] }[] = [];
  for (const node of ringNodes) {
    const last = groups[groups.length - 1];
    if (last && last.type === node.type) {
      last.nodes.push(node);
    } else {
      groups.push({ type: node.type, nodes: [node] });
    }
  }

  const total = ringNodes.length;
  const twoPi = Math.PI * 2;
  // 从正上方开始顺时针分布
  let angle = -Math.PI / 2;

  for (const group of groups) {
    const span = (group.nodes.length / total) * twoPi;
    const step = span / group.nodes.length;
    group.nodes.forEach((node, index) => {
      const nodeAngle = angle + step * (index + 0.5);
      positions.set(node.key, {
        key: node.key,
        x: centerX + radius * Math.cos(nodeAngle),
        y: centerY + radius * Math.sin(nodeAngle),
      });
    });
    angle += span;
  }

  return {
    nodes: Array.from(positions.values()),
    radius,
    centerX,
    centerY,
  };
}
