// 知识库服务 — M4
import { getDb } from '../db';
import type { TopicRow } from '@shared/types';

export function listTopics(): TopicRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
        rt.id, rt.name, rt.sort_order,
        COUNT(rtl.file_id) as file_count
       FROM resource_topics rt
       LEFT JOIN resource_topic_links rtl ON rtl.topic_id = rt.id
       GROUP BY rt.id
       ORDER BY rt.sort_order ASC, rt.created_at ASC`,
    )
    .all() as {
    id: number;
    name: string;
    sort_order: number;
    file_count: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    fileCount: r.file_count,
  }));
}

export function createTopic(name: string): TopicRow {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 30) {
    throw new Error('专题名长度必须为 1-30 字');
  }

  const db = getDb();
  const now = Date.now();

  // 检查重名
  const existing = db.prepare('SELECT id FROM resource_topics WHERE name = ?').get(trimmed);
  if (existing) {
    throw new Error('已有同名专题');
  }

  // 新专题排到最后
  const maxRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM resource_topics')
    .get() as { max_sort: number };
  const sortOrder = maxRow.max_sort + 1;

  const info = db
    .prepare('INSERT INTO resource_topics (name, sort_order, created_at) VALUES (?, ?, ?)')
    .run(trimmed, sortOrder, now);

  return {
    id: Number(info.lastInsertRowid),
    name: trimmed,
    sortOrder,
    fileCount: 0,
  };
}

export function renameTopic(id: number, newName: string): void {
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 30) {
    throw new Error('专题名长度必须为 1-30 字');
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM resource_topics WHERE name = ? AND id != ?')
    .get(trimmed, id);
  if (existing) {
    throw new Error('已有同名专题');
  }

  db.prepare('UPDATE resource_topics SET name = ? WHERE id = ?').run(trimmed, id);
}

export function deleteTopic(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM resource_topics WHERE id = ?').run(id);
  // 文件回到「未分类」：in_knowledge 仍为 1，但不在任何专题中
}

export function reorderTopics(topicIds: number[]): void {
  if (topicIds.length === 0) return;

  const db = getDb();
  const updateStmt = db.prepare('UPDATE resource_topics SET sort_order = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    topicIds.forEach((id, index) => {
      updateStmt.run(index, id);
    });
  });

  transaction();
}

/**
 * 存入知识库：设置 in_knowledge=1，可选关联专题，可选移出收件箱
 */
export function addToKnowledge(
  fileIds: number[],
  topicIds: number[],
  moveOutOfInbox: boolean,
): void {
  if (fileIds.length === 0) return;

  const db = getDb();
  const now = Date.now();

  const setKnowledge = db.prepare('UPDATE files SET in_knowledge = 1 WHERE id = ?');
  const addTopic = db.prepare(
    'INSERT OR IGNORE INTO resource_topic_links (topic_id, file_id, added_at) VALUES (?, ?, ?)',
  );
  const markFiled = db.prepare("UPDATE files SET status = 'filed' WHERE id = ? AND status = 'inbox'");

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      setKnowledge.run(fileId);
      for (const topicId of topicIds) {
        addTopic.run(topicId, fileId, now);
      }
      if (moveOutOfInbox) {
        markFiled.run(fileId);
      }
    }
  });

  transaction();
}

/**
 * 移出知识库：in_knowledge=0，删除全部专题关联，可选放回收件箱
 */
export function removeFromKnowledge(fileIds: number[], toInbox: boolean): void {
  if (fileIds.length === 0) return;

  const db = getDb();

  const setNotKnowledge = db.prepare('UPDATE files SET in_knowledge = 0 WHERE id = ?');
  const removeTopics = db.prepare('DELETE FROM resource_topic_links WHERE file_id = ?');
  const setInbox = db.prepare("UPDATE files SET status = 'inbox' WHERE id = ?");

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      setNotKnowledge.run(fileId);
      removeTopics.run(fileId);
      if (toInbox) {
        setInbox.run(fileId);
      }
    }
  });

  transaction();
}

/**
 * 将文件加入专题
 */
export function addToTopic(fileIds: number[], topicId: number): void {
  if (fileIds.length === 0) return;

  const db = getDb();
  const now = Date.now();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO resource_topic_links (topic_id, file_id, added_at) VALUES (?, ?, ?)',
  );

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      insert.run(topicId, fileId, now);
    }
  });

  transaction();
}

/**
 * 将文件移出专题
 */
export function removeFromTopic(fileIds: number[], topicId: number): void {
  if (fileIds.length === 0) return;

  const db = getDb();
  const del = db.prepare('DELETE FROM resource_topic_links WHERE topic_id = ? AND file_id = ?');

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      del.run(topicId, fileId);
    }
  });

  transaction();
}

/**
 * 获取知识库总数和未分类数
 */
export function getKbCounts(): { all: number; uncategorized: number } {
  const db = getDb();

  const allRow = db
    .prepare('SELECT COUNT(*) as count FROM files WHERE in_knowledge = 1')
    .get() as { count: number };

  const uncategorizedRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM files f
       WHERE f.in_knowledge = 1
       AND NOT EXISTS (
         SELECT 1 FROM resource_topic_links rtl WHERE rtl.file_id = f.id
       )`,
    )
    .get() as { count: number };

  return {
    all: allRow.count,
    uncategorized: uncategorizedRow.count,
  };
}

/**
 * 检查文件是否在专题中
 */
export function isFileInTopic(fileId: number, topicId: number): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM resource_topic_links WHERE file_id = ? AND topic_id = ?')
    .get(fileId, topicId);
  return !!row;
}

/**
 * 获取文件所属的专题 ID 列表
 */
export function getTopicIdsForFile(fileId: number): number[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT topic_id FROM resource_topic_links WHERE file_id = ?')
    .all(fileId) as { topic_id: number }[];
  return rows.map((r) => r.topic_id);
}
