// 关系网络查询与取消关联服务
// 只使用元数据与关联表，不读取文件内容
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import {
  graphNodeKey,
  isGraphFocusType,
  isGraphRelationType,
  parseGraphNodeKey,
} from '../../../src/shared/graph';
import type {
  GraphData,
  GraphEdge,
  GraphFocus,
  GraphNode,
  GraphNodeType,
  GraphQueryInput,
  GraphRelationType,
  GraphUnlinkInput,
  GraphUnlinkResult,
} from '../../../src/shared/graph';

type Db = Database.Database;

/** 节点上限默认 200，最大 500 */
export const GRAPH_NODE_LIMIT_DEFAULT = 200;
export const GRAPH_NODE_LIMIT_MAX = 500;

/** 取消关联撤销窗口 10 分钟 */
export const GRAPH_UNLINK_UNDO_WINDOW_MS = 10 * 60 * 1000;

const TYPE_PRIORITY: Record<GraphNodeType, number> = {
  project: 1,
  file: 2,
  contact: 3,
  topic: 4,
  area: 5,
};

const RELATION_TYPES: Record<GraphRelationType, [GraphNodeType, GraphNodeType]> = {
  project_file: ['project', 'file'],
  project_contact: ['project', 'contact'],
  file_contact: ['file', 'contact'],
  file_topic: ['file', 'topic'],
  area_file: ['area', 'file'],
};

type NodeDraft = Omit<GraphNode, 'degree'>;

type ProjectDbRow = {
  id: number;
  name: string;
  status: 'active' | 'done';
  file_count: number;
};

type FileDbRow = {
  id: number;
  name: string;
  alias: string | null;
  ext: string;
  size: number;
};

type ContactDbRow = {
  id: number;
  name: string;
  org: string | null;
  department: string | null;
  title: string | null;
};

type TopicDbRow = {
  id: number;
  name: string;
  file_count: number;
};

function mapProjectNode(row: ProjectDbRow): NodeDraft {
  return {
    key: graphNodeKey('project', row.id),
    type: 'project',
    entityId: row.id,
    label: row.name,
    subtitle: row.status === 'active' ? '进行中' : '已完成',
    isFocus: false,
    meta: { status: row.status, fileCount: row.file_count },
  };
}

function mapFileNode(row: FileDbRow): NodeDraft {
  return {
    key: graphNodeKey('file', row.id),
    type: 'file',
    entityId: row.id,
    label: row.alias || row.name,
    subtitle: row.ext ? row.ext.toUpperCase() : '文件',
    isFocus: false,
    ext: row.ext || 'none',
    meta: { size: row.size },
  };
}

function mapContactNode(row: ContactDbRow): NodeDraft {
  const subtitle = [row.org, row.department, row.title].filter(Boolean).join(' · ');
  return {
    key: graphNodeKey('contact', row.id),
    type: 'contact',
    entityId: row.id,
    label: row.name,
    subtitle,
    isFocus: false,
    meta: {
      org: row.org,
      department: row.department,
      title: row.title,
    },
  };
}

function mapTopicNode(row: TopicDbRow): NodeDraft {
  return {
    key: graphNodeKey('topic', row.id),
    type: 'topic',
    entityId: row.id,
    label: row.name,
    subtitle: `${row.file_count} 个文件`,
    isFocus: false,
    meta: { fileCount: row.file_count },
  };
}

function mapAreaNode(row: { id: number; name: string }): NodeDraft {
  return {
    key: graphNodeKey('area', row.id),
    type: 'area',
    entityId: row.id,
    label: row.name,
    subtitle: '领域',
    isFocus: false,
  };
}

function getFocusNode(db: Db, focus: GraphFocus): NodeDraft | null {
  switch (focus.type) {
    case 'project': {
      const row = db
        .prepare(
          `SELECT p.id, p.name, p.status,
                  (SELECT COUNT(*) FROM project_files pf WHERE pf.project_id = p.id) AS file_count
           FROM projects p WHERE p.id = ?`,
        )
        .get(focus.id) as ProjectDbRow | undefined;
      return row ? { ...mapProjectNode(row), isFocus: true } : null;
    }
    case 'file': {
      const row = db
        .prepare('SELECT id, name, alias, ext, size FROM files WHERE id = ?')
        .get(focus.id) as FileDbRow | undefined;
      return row ? { ...mapFileNode(row), isFocus: true } : null;
    }
    case 'contact': {
      const row = db
        .prepare('SELECT id, name, org, department, title FROM contacts WHERE id = ?')
        .get(focus.id) as ContactDbRow | undefined;
      return row ? { ...mapContactNode(row), isFocus: true } : null;
    }
    case 'topic': {
      const row = db
        .prepare(
          `SELECT t.id, t.name,
                  (SELECT COUNT(*) FROM resource_topic_links l WHERE l.topic_id = t.id) AS file_count
           FROM resource_topics t WHERE t.id = ?`,
        )
        .get(focus.id) as TopicDbRow | undefined;
      return row ? { ...mapTopicNode(row), isFocus: true } : null;
    }
    case 'area': {
      const row = db
        .prepare('SELECT id, name FROM areas WHERE id = ?')
        .get(focus.id) as { id: number; name: string } | undefined;
      return row ? { ...mapAreaNode(row), isFocus: true } : null;
    }
    default:
      return null;
  }
}

function edgeKey(relation: GraphRelationType, a: string, b: string): string {
  const [left, right] = a < b ? [a, b] : [b, a];
  return `${relation}|${left}|${right}`;
}

interface Collection {
  nodes: Map<string, NodeDraft>;
  edges: Map<string, GraphEdge>;
  neighborFileIds: Set<number>;
}

function addNode(collection: Collection, node: NodeDraft): void {
  if (!collection.nodes.has(node.key)) collection.nodes.set(node.key, node);
}

function addEdge(
  collection: Collection,
  relation: GraphRelationType,
  source: string,
  target: string,
): void {
  const key = edgeKey(relation, source, target);
  if (collection.edges.has(key)) return;
  collection.edges.set(key, { key, source, target, type: relation });
}

function addFileRow(collection: Collection, row: FileDbRow): NodeDraft {
  const node = mapFileNode(row);
  addNode(collection, node);
  collection.neighborFileIds.add(row.id);
  return node;
}

/**
 * 一次 IPC 内完成：焦点 + 1 跳邻居 + 邻居牵出的专题，合并去重后按上限截断
 */
export function getGraphDataFrom(db: Db, input: GraphQueryInput): GraphData {
  if (!input || !input.focus || !isGraphFocusType(input.focus.type)) {
    throw new Error('无效的焦点类型');
  }
  if (!Number.isInteger(input.focus.id) || input.focus.id <= 0) {
    throw new Error('无效的焦点 ID');
  }
  if (input.hops != null && input.hops !== 1) {
    throw new Error('Phase 1 仅支持 1 跳关系');
  }

  const focus = getFocusNode(db, input.focus);
  if (!focus) throw new Error('焦点不存在或已被删除');

  const collection: Collection = {
    nodes: new Map(),
    edges: new Map(),
    neighborFileIds: new Set(),
  };
  addNode(collection, focus);

  const focusKey = focus.key;

  switch (focus.type) {
    case 'project': {
      const files = db
        .prepare(
          `SELECT f.id, f.name, f.alias, f.ext, f.size
           FROM files f
           JOIN project_files pf ON pf.file_id = f.id
           WHERE pf.project_id = ?
           ORDER BY f.id ASC`,
        )
        .all(focus.entityId) as FileDbRow[];
      for (const row of files) {
        const node = addFileRow(collection, row);
        addEdge(collection, 'project_file', focusKey, node.key);
      }

      const contacts = db
        .prepare(
          `SELECT c.id, c.name, c.org, c.department, c.title
           FROM contacts c
           JOIN project_contacts pc ON pc.contact_id = c.id
           WHERE pc.project_id = ?
           ORDER BY c.id ASC`,
        )
        .all(focus.entityId) as ContactDbRow[];
      for (const row of contacts) {
        const node = mapContactNode(row);
        addNode(collection, node);
        addEdge(collection, 'project_contact', focusKey, node.key);
      }
      break;
    }

    case 'file': {
      const projects = db
        .prepare(
          `SELECT p.id, p.name, p.status,
                  (SELECT COUNT(*) FROM project_files x WHERE x.project_id = p.id) AS file_count
           FROM projects p
           JOIN project_files pf ON pf.project_id = p.id
           WHERE pf.file_id = ?
           ORDER BY p.id ASC`,
        )
        .all(focus.entityId) as ProjectDbRow[];
      for (const row of projects) {
        const node = mapProjectNode(row);
        addNode(collection, node);
        addEdge(collection, 'project_file', node.key, focusKey);
      }

      const contacts = db
        .prepare(
          `SELECT c.id, c.name, c.org, c.department, c.title
           FROM contacts c
           JOIN file_contacts fc ON fc.contact_id = c.id
           WHERE fc.file_id = ?
           ORDER BY c.id ASC`,
        )
        .all(focus.entityId) as ContactDbRow[];
      for (const row of contacts) {
        const node = mapContactNode(row);
        addNode(collection, node);
        addEdge(collection, 'file_contact', focusKey, node.key);
      }

      const topics = db
        .prepare(
          `SELECT t.id, t.name,
                  (SELECT COUNT(*) FROM resource_topic_links x WHERE x.topic_id = t.id) AS file_count
           FROM resource_topics t
           JOIN resource_topic_links l ON l.topic_id = t.id
           WHERE l.file_id = ?
           ORDER BY t.id ASC`,
        )
        .all(focus.entityId) as TopicDbRow[];
      for (const row of topics) {
        const node = mapTopicNode(row);
        addNode(collection, node);
        addEdge(collection, 'file_topic', focusKey, node.key);
      }

      const areas = db
        .prepare(
          `SELECT a.id, a.name
           FROM areas a
           JOIN area_files af ON af.area_id = a.id
           WHERE af.file_id = ?
           ORDER BY a.id ASC`,
        )
        .all(focus.entityId) as { id: number; name: string }[];
      for (const row of areas) {
        const node = mapAreaNode(row);
        addNode(collection, node);
        addEdge(collection, 'area_file', node.key, focusKey);
      }
      break;
    }

    case 'contact': {
      const files = db
        .prepare(
          `SELECT f.id, f.name, f.alias, f.ext, f.size
           FROM files f
           JOIN file_contacts fc ON fc.file_id = f.id
           WHERE fc.contact_id = ?
           ORDER BY f.id ASC`,
        )
        .all(focus.entityId) as FileDbRow[];
      for (const row of files) {
        const node = addFileRow(collection, row);
        addEdge(collection, 'file_contact', node.key, focusKey);
      }

      const projects = db
        .prepare(
          `SELECT p.id, p.name, p.status,
                  (SELECT COUNT(*) FROM project_files x WHERE x.project_id = p.id) AS file_count
           FROM projects p
           JOIN project_contacts pc ON pc.project_id = p.id
           WHERE pc.contact_id = ?
           ORDER BY p.id ASC`,
        )
        .all(focus.entityId) as ProjectDbRow[];
      for (const row of projects) {
        const node = mapProjectNode(row);
        addNode(collection, node);
        addEdge(collection, 'project_contact', node.key, focusKey);
      }
      break;
    }

    case 'topic': {
      const files = db
        .prepare(
          `SELECT f.id, f.name, f.alias, f.ext, f.size
           FROM files f
           JOIN resource_topic_links l ON l.file_id = f.id
           WHERE l.topic_id = ?
           ORDER BY f.id ASC`,
        )
        .all(focus.entityId) as FileDbRow[];
      for (const row of files) {
        const node = addFileRow(collection, row);
        addEdge(collection, 'file_topic', node.key, focusKey);
      }
      break;
    }

    case 'area': {
      const files = db
        .prepare(
          `SELECT f.id, f.name, f.alias, f.ext, f.size
           FROM files f
           JOIN area_files af ON af.file_id = f.id
           WHERE af.area_id = ?
           ORDER BY f.id ASC`,
        )
        .all(focus.entityId) as FileDbRow[];
      for (const row of files) {
        const node = addFileRow(collection, row);
        addEdge(collection, 'area_file', focusKey, node.key);
      }
      break;
    }
  }

  // 邻居文件牵出的专题（专题统一排在其他类型之后）
  if (collection.neighborFileIds.size > 0) {
    const fileIds = Array.from(collection.neighborFileIds);
    const placeholders = fileIds.map(() => '?').join(',');
    const topicLinks = db
      .prepare(
        `SELECT l.file_id AS file_id, t.id, t.name,
                (SELECT COUNT(*) FROM resource_topic_links x WHERE x.topic_id = t.id) AS file_count
         FROM resource_topic_links l
         JOIN resource_topics t ON t.id = l.topic_id
         WHERE l.file_id IN (${placeholders})
         ORDER BY l.file_id ASC, t.id ASC`,
      )
      .all(...fileIds) as (TopicDbRow & { file_id: number })[];

    for (const row of topicLinks) {
      if (focus.type === 'topic' && row.id === focus.entityId) continue;
      const topic = mapTopicNode(row);
      addNode(collection, topic);
      addEdge(collection, 'file_topic', graphNodeKey('file', row.file_id), topic.key);
    }
  }

  // 按类型优先级 + ID 稳定排序，焦点始终第一
  const sorted = Array.from(collection.nodes.values()).sort((a, b) => {
    const priorityA = a.isFocus ? 0 : TYPE_PRIORITY[a.type];
    const priorityB = b.isFocus ? 0 : TYPE_PRIORITY[b.type];
    if (priorityA !== priorityB) return priorityA - priorityB;
    if (a.entityId !== b.entityId) return a.entityId - b.entityId;
    return a.key.localeCompare(b.key);
  });

  const requestedLimit = input.limit;
  const limit =
    typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(GRAPH_NODE_LIMIT_MAX, Math.floor(requestedLimit)))
      : GRAPH_NODE_LIMIT_DEFAULT;

  const kept = sorted.slice(0, limit);
  const keptKeys = new Set(kept.map((node) => node.key));
  const truncated = sorted.length > kept.length;

  const edges = Array.from(collection.edges.values())
    .filter((edge) => keptKeys.has(edge.source) && keptKeys.has(edge.target))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.key.localeCompare(b.key);
    });

  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = kept.map((node) => ({
    ...node,
    degree: degree.get(node.key) ?? 0,
  }));

  return {
    focus: focusKey,
    nodes,
    edges,
    truncated,
  };
}

export function getGraphData(input: GraphQueryInput): GraphData {
  return getGraphDataFrom(getDb(), input);
}

// ---------- 取消关联与 10 分钟撤销 ----------

interface UnlinkRecord {
  batchId: string;
  relation: GraphRelationType;
  ids: [number, number];
  expiresAt: number;
}

const unlinkStores = new WeakMap<Db, Map<string, UnlinkRecord>>();

function storeOf(db: Db): Map<string, UnlinkRecord> {
  let store = unlinkStores.get(db);
  if (!store) {
    store = new Map();
    unlinkStores.set(db, store);
  }
  return store;
}

function pruneUnlinkStore(store: Map<string, UnlinkRecord>): void {
  const now = Date.now();
  for (const [batchId, record] of store) {
    if (record.expiresAt <= now) store.delete(batchId);
  }
}

function resolveRelationIds(
  relation: GraphRelationType,
  source: string,
  target: string,
): [number, number] | null {
  const left = parseGraphNodeKey(source);
  const right = parseGraphNodeKey(target);
  if (!left || !right) return null;

  const [typeA, typeB] = RELATION_TYPES[relation];
  if (left.type === typeA && right.type === typeB) return [left.id, right.id];
  if (left.type === typeB && right.type === typeA) return [right.id, left.id];
  return null;
}

function deleteRelation(db: Db, relation: GraphRelationType, ids: [number, number]): boolean {
  let changes = 0;
  switch (relation) {
    case 'project_file':
      changes = db
        .prepare('DELETE FROM project_files WHERE project_id = ? AND file_id = ?')
        .run(ids[0], ids[1]).changes;
      break;
    case 'project_contact':
      changes = db
        .prepare('DELETE FROM project_contacts WHERE project_id = ? AND contact_id = ?')
        .run(ids[0], ids[1]).changes;
      break;
    case 'file_contact':
      changes = db
        .prepare('DELETE FROM file_contacts WHERE file_id = ? AND contact_id = ?')
        .run(ids[0], ids[1]).changes;
      break;
    case 'file_topic':
      changes = db
        .prepare('DELETE FROM resource_topic_links WHERE file_id = ? AND topic_id = ?')
        .run(ids[0], ids[1]).changes;
      break;
    case 'area_file':
      changes = db
        .prepare('DELETE FROM area_files WHERE area_id = ? AND file_id = ?')
        .run(ids[0], ids[1]).changes;
      break;
  }
  return changes > 0;
}

function restoreRelation(db: Db, relation: GraphRelationType, ids: [number, number]): void {
  const now = Date.now();
  switch (relation) {
    case 'project_file':
      db.prepare(
        'INSERT OR IGNORE INTO project_files (project_id, file_id, added_at) VALUES (?, ?, ?)',
      ).run(ids[0], ids[1], now);
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, ids[0]);
      break;
    case 'project_contact':
      db.prepare(
        'INSERT OR IGNORE INTO project_contacts (project_id, contact_id, added_at) VALUES (?, ?, ?)',
      ).run(ids[0], ids[1], now);
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, ids[0]);
      break;
    case 'file_contact':
      db.prepare(
        'INSERT OR IGNORE INTO file_contacts (file_id, contact_id, added_at) VALUES (?, ?, ?)',
      ).run(ids[0], ids[1], now);
      break;
    case 'file_topic':
      db.prepare(
        'INSERT OR IGNORE INTO resource_topic_links (topic_id, file_id, added_at) VALUES (?, ?, ?)',
      ).run(ids[1], ids[0], now);
      break;
    case 'area_file':
      db.prepare(
        'INSERT OR IGNORE INTO area_files (area_id, file_id, added_at) VALUES (?, ?, ?)',
      ).run(ids[0], ids[1], now);
      break;
  }
}

/** 取消一条关联，并记录 10 分钟内可撤销的批次 */
export function unlinkGraphEdgeFrom(db: Db, input: GraphUnlinkInput): GraphUnlinkResult {
  if (!isGraphRelationType(input?.relation)) throw new Error('无效的关联类型');
  const ids = resolveRelationIds(input.relation, input.source, input.target);
  if (!ids) throw new Error('关联两端类型不匹配');

  const removed = deleteRelation(db, input.relation, ids);
  if (!removed) throw new Error('关联不存在或已解除');

  const batchId = randomUUID();
  const expiresAt = Date.now() + GRAPH_UNLINK_UNDO_WINDOW_MS;
  const store = storeOf(db);
  pruneUnlinkStore(store);
  store.set(batchId, { batchId, relation: input.relation, ids, expiresAt });
  return { batchId, expiresAt };
}

/** 查询取消关联批次是否仍在撤销窗口内 */
export function getGraphUnlinkUndoFrom(
  db: Db,
  batchId: string,
): { batchId: string; expiresAt: number } | null {
  const store = storeOf(db);
  pruneUnlinkStore(store);
  const record = store.get(batchId);
  return record ? { batchId: record.batchId, expiresAt: record.expiresAt } : null;
}

/** 撤销取消关联，恢复原关联记录 */
export function undoGraphUnlinkFrom(
  db: Db,
  batchId: string,
): { batchId: string; expiresAt: number } {
  const store = storeOf(db);
  pruneUnlinkStore(store);
  const record = store.get(batchId);
  if (!record) throw new Error('没有可撤销的取消关联记录（可能已超过 10 分钟）');

  try {
    restoreRelation(db, record.relation, record.ids);
  } catch {
    throw new Error('关联对象已不存在，无法撤销');
  }

  store.delete(batchId);
  return { batchId: record.batchId, expiresAt: record.expiresAt };
}

export function unlinkGraphEdge(input: GraphUnlinkInput): GraphUnlinkResult {
  return unlinkGraphEdgeFrom(getDb(), input);
}

export function getGraphUnlinkUndo(batchId: string): { batchId: string; expiresAt: number } | null {
  return getGraphUnlinkUndoFrom(getDb(), batchId);
}

export function undoGraphUnlink(batchId: string): { batchId: string; expiresAt: number } {
  return undoGraphUnlinkFrom(getDb(), batchId);
}
