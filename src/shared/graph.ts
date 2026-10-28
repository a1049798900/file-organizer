// 关系网络视图共享类型
// 仅描述元数据与关联关系，不包含文件内容

import type { ProjectStatus } from './types';

export type GraphNodeType = 'project' | 'file' | 'contact' | 'topic' | 'area';

/** 可作为焦点打开图谱的实体类型 */
export type GraphFocusType = 'project' | 'file' | 'contact' | 'topic' | 'area';

export type GraphRelationType =
  | 'project_file'
  | 'project_contact'
  | 'file_contact'
  | 'file_topic'
  | 'area_file';

export interface GraphFocus {
  type: GraphFocusType;
  id: number;
}

export interface GraphNodeMeta {
  status?: ProjectStatus;
  size?: number;
  fileCount?: number;
  org?: string | null;
  department?: string | null;
  title?: string | null;
}

export interface GraphNode {
  /** `${type}:${entityId}`，在本次图数据内唯一 */
  key: string;
  type: GraphNodeType;
  entityId: number;
  label: string;
  subtitle: string;
  /** 返回结果内可见度数，用于微调节点半径 */
  degree: number;
  isFocus: boolean;
  ext?: string;
  meta?: GraphNodeMeta;
}

export interface GraphEdge {
  key: string;
  /** 节点 key */
  source: string;
  /** 节点 key */
  target: string;
  type: GraphRelationType;
}

export interface GraphData {
  /** 焦点节点 key */
  focus: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 是否因节点上限被截断 */
  truncated: boolean;
}

export interface GraphQueryInput {
  focus: GraphFocus;
  /** Phase 1 固定为 1 */
  hops?: 1;
  /** 默认 200 */
  limit?: number;
}

export interface GraphUnlinkInput {
  relation: GraphRelationType;
  /** 节点 key */
  source: string;
  /** 节点 key */
  target: string;
}

export interface GraphUnlinkResult {
  batchId: string;
  expiresAt: number;
}

export interface GraphHistoryItem {
  type: GraphFocusType;
  id: number;
  label: string;
}

export const GRAPH_NODE_TYPES: GraphNodeType[] = [
  'project',
  'file',
  'contact',
  'topic',
  'area',
];

export const GRAPH_FOCUS_TYPES: GraphFocusType[] = [
  'project',
  'file',
  'contact',
  'topic',
  'area',
];

export const GRAPH_RELATION_TYPES: GraphRelationType[] = [
  'project_file',
  'project_contact',
  'file_contact',
  'file_topic',
  'area_file',
];

export function graphNodeKey(type: GraphNodeType, id: number): string {
  return `${type}:${id}`;
}

export function parseGraphNodeKey(key: string): { type: GraphNodeType; id: number } | null {
  const index = key.indexOf(':');
  if (index <= 0) return null;
  const type = key.slice(0, index) as GraphNodeType;
  const id = Number(key.slice(index + 1));
  if (!GRAPH_NODE_TYPES.includes(type) || !Number.isInteger(id) || id <= 0) return null;
  return { type, id };
}

export function isGraphFocusType(value: unknown): value is GraphFocusType {
  return typeof value === 'string' && GRAPH_FOCUS_TYPES.includes(value as GraphFocusType);
}

export function isGraphRelationType(value: unknown): value is GraphRelationType {
  return typeof value === 'string' && GRAPH_RELATION_TYPES.includes(value as GraphRelationType);
}
