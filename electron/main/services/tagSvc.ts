// 标签服务 — M7
import { getDb } from '../db';
import type { TagRef } from '@shared/types';

type Db = ReturnType<typeof getDb>;

export function listTags(): TagRef[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE').all() as TagRef[];
  return rows;
}

export function createTag(name: string): TagRef {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 20) {
    throw new Error('标签名长度必须为 1-20 字');
  }
  if (trimmed.includes(',')) {
    throw new Error('标签名不可包含逗号');
  }

  const now = Date.now();
  const info = db
    .prepare('INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)')
    .run(trimmed, now);

  if (info.changes === 0) {
    // 已存在
    const existing = db.prepare('SELECT id, name FROM tags WHERE name = ?').get(trimmed) as TagRef;
    return existing;
  }

  return { id: Number(info.lastInsertRowid), name: trimmed };
}

/**
 * 批量给文件打标签（追加语义，不覆盖已有）
 */
export function addToFiles(fileIds: number[], tagIds: number[]): void {
  if (fileIds.length === 0 || tagIds.length === 0) return;

  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO tag_links (tag_id, file_id) VALUES (?, ?)',
  );

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      for (const tagId of tagIds) {
        insert.run(tagId, fileId);
      }
    }
  });

  transaction();
}

/**
 * 批量从文件移除标签
 */
export function removeFromFiles(fileIds: number[], tagIds: number[]): void {
  if (fileIds.length === 0 || tagIds.length === 0) return;

  const db = getDb();
  const del = db.prepare(
    'DELETE FROM tag_links WHERE tag_id = ? AND file_id = ?',
  );

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      for (const tagId of tagIds) {
        del.run(tagId, fileId);
      }
    }
  });

  transaction();
}

/**
 * 获取文件的标签列表
 */
export function getTagsForFile(fileId: number): TagRef[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.id, t.name FROM tags t
       JOIN tag_links tl ON tl.tag_id = t.id
       WHERE tl.file_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(fileId) as TagRef[];
  return rows;
}

/**
 * 批量获取多个文件的标签（按 fileId 分组返回）
 */
export function getTagsForFiles(fileIds: number[]): Map<number, TagRef[]> {
  return getTagsForFilesFrom(getDb(), fileIds);
}

/** 可注入 db 的实现，便于单元测试 */
export function getTagsForFilesFrom(
  db: Db,
  fileIds: number[],
): Map<number, TagRef[]> {
  const result = new Map<number, TagRef[]>();
  if (fileIds.length === 0) return result;

  const placeholders = fileIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT tl.file_id, t.id, t.name FROM tags t
       JOIN tag_links tl ON tl.tag_id = t.id
       WHERE tl.file_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(...fileIds) as { file_id: number; id: number; name: string }[];

  for (const row of rows) {
    if (!result.has(row.file_id)) {
      result.set(row.file_id, []);
    }
    result.get(row.file_id)!.push({ id: row.id, name: row.name });
  }

  return result;
}
