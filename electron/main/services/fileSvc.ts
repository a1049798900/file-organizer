// 文件服务 — M2/M5/M8
import { getDb } from '../db';
import { getTagsForFiles } from './tagSvc';
import type { FileRow, FileListSource, FileSort, BatchResult } from '@shared/types';
import fs from 'node:fs';
import { shell } from 'electron';

/**
 * 构建文件列表查询
 * 统一入口：所有文件列表（收件箱、项目、知识库、搜索）都通过此函数获取
 */
export function listFiles(source: FileListSource, sort: FileSort): FileRow[] {
  const db = getDb();

  let sql = `
    SELECT DISTINCT f.id, f.name, f.alias, f.path, f.size, f.ext, f.mtime,
           f.status, f.in_knowledge, f.created_at
    FROM files f
  `;
  const params: (string | number)[] = [];

  switch (source.kind) {
    case 'inbox':
      sql += `WHERE f.status = 'inbox' `;
      break;
    case 'project':
      sql += `
        JOIN project_files pf ON pf.file_id = f.id
        WHERE pf.project_id = ?
      `;
      params.push(source.projectId);
      break;
    case 'kb-all':
      sql += `WHERE f.in_knowledge = 1 `;
      break;
    case 'kb-uncategorized':
      sql += `
        LEFT JOIN resource_topic_links rtl ON rtl.file_id = f.id
        WHERE f.in_knowledge = 1 AND rtl.topic_id IS NULL
      `;
      break;
    case 'kb-topic':
      sql += `
        JOIN resource_topic_links rtl ON rtl.file_id = f.id
        WHERE rtl.topic_id = ?
      `;
      params.push(source.topicId);
      break;
    case 'search': {
      if (!source.query.trim()) {
        // 空查询返回空
        return [];
      }
      const { searchSql, searchParams, sort: searchSort } = buildSearchQuery(source.query);
      sql += `JOIN (${searchSql}) AS s ON s.rowid = f.id `;
      params.push(...searchParams);
      // 搜索使用自己的排序权重
      sql += `ORDER BY s.rank ASC, ${sortColumn(searchSort)} ${searchSort.dir === 'desc' ? 'DESC' : 'ASC'} `;
      const rows = db.prepare(sql).all(...params) as Omit<FileRow, 'tags' | 'pathMissing'>[];
      return enrichFileRows(rows);
    }
  }

  // 排序
  sql += `ORDER BY ${sortColumn(sort)} ${sort.dir === 'desc' ? 'DESC' : 'ASC'} `;

  const rows = db.prepare(sql).all(...params) as Omit<FileRow, 'tags' | 'pathMissing'>[];
  return enrichFileRows(rows);
}

function sortColumn(sort: FileSort): string {
  switch (sort.key) {
    case 'name':
      return 'f.name COLLATE NOCASE';
    case 'ext':
      return 'f.ext COLLATE NOCASE';
    case 'size':
      return 'f.size';
    case 'mtime':
      return 'f.mtime';
  }
}

/**
 * 构建搜索查询 — 使用 FTS5 + 子串匹配
 * 排序权重：文件名前缀 > 文件名内部子串 > 标签 > 别名
 */
function buildSearchQuery(query: string): {
  searchSql: string;
  searchParams: string[];
  sort: FileSort;
} {
  const q = query.trim().toLowerCase();

  // FTS5 查询：前缀匹配
  // 按空格分词，每个词加前缀匹配 *
  const ftsTerms = q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' ');

  const searchSql = `
    SELECT
      files_fts.rowid,
      CASE
        WHEN files_fts.name LIKE ? THEN 1
        WHEN files_fts.pinyin LIKE ? THEN 1.5
        WHEN files_fts.name LIKE ? THEN 2
        WHEN files_fts.pinyin LIKE ? THEN 2.5
        WHEN files_fts.alias LIKE ? THEN 4
        ELSE 3
      END as rank
    FROM files_fts
    WHERE files_fts MATCH ?
    UNION
    SELECT
      f.id as rowid,
      5 as rank
    FROM files f
    JOIN tag_links tl ON tl.file_id = f.id
    JOIN tags t ON t.id = tl.tag_id
    WHERE LOWER(t.name) LIKE ?
    AND f.id NOT IN (SELECT rowid FROM files_fts WHERE files_fts MATCH ?)
  `;

  const prefixPattern = `${q}%`;
  const containsPattern = `%${q}%`;

  const searchParams = [
    prefixPattern,   // name prefix
    prefixPattern,   // pinyin prefix
    containsPattern, // name contains
    containsPattern, // pinyin contains
    containsPattern, // alias contains
    ftsTerms,        // FTS5 match
    containsPattern, // tag name contains
    ftsTerms,        // FTS5 match for exclusion
  ];

  return {
    searchSql,
    searchParams,
    sort: { key: 'mtime', dir: 'desc' },
  };
}

/**
 * 为文件行补充 tags 和 pathMissing
 */
function enrichFileRows(rows: Omit<FileRow, 'tags' | 'pathMissing'>[]): FileRow[] {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tagsMap = getTagsForFiles(ids);

  return rows.map((row) => ({
    ...row,
    tags: tagsMap.get(row.id) || [],
    pathMissing: !fs.existsSync(row.path),
  }));
}

/**
 * 按 ID 获取单个文件
 */
export function getFile(id: number): FileRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, alias, path, size, ext, mtime, status, in_knowledge, created_at
       FROM files WHERE id = ?`,
    )
    .get(id) as Omit<FileRow, 'tags' | 'pathMissing'> | undefined;

  if (!row) return null;

  const tagsMap = getTagsForFiles([id]);
  return {
    ...row,
    tags: tagsMap.get(id) || [],
    pathMissing: !fs.existsSync(row.path),
  };
}

/**
 * 批量移出索引（只删除数据库记录，不触碰磁盘文件）
 */
export function removeFiles(ids: number[]): BatchResult {
  if (ids.length === 0) return { ok: 0, fail: 0 };

  const db = getDb();
  let ok = 0;
  let fail = 0;

  const del = db.prepare('DELETE FROM files WHERE id = ?');

  const transaction = db.transaction(() => {
    for (const id of ids) {
      const result = del.run(id);
      if (result.changes > 0) {
        ok++;
      } else {
        fail++;
      }
    }
  });

  transaction();
  return { ok, fail };
}

/**
 * 批量标记为已处理（inbox → filed）
 */
export function markFiled(ids: number[]): void {
  if (ids.length === 0) return;

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE files SET status = 'filed' WHERE id IN (${placeholders}) AND status = 'inbox'`).run(
    ...ids,
  );
}

/**
 * 用系统程序打开文件
 */
export function openFile(id: number): { ok: boolean; reason?: string } {
  const file = getFile(id);
  if (!file) return { ok: false, reason: '文件不存在' };
  if (file.pathMissing) return { ok: false, reason: '路径失效' };

  const result = shell.openPath(file.path);
  if (result) {
    return { ok: false, reason: result };
  }
  return { ok: true };
}

/**
 * 在文件夹中定位文件
 */
export function revealFile(id: number): boolean {
  const file = getFile(id);
  if (!file || file.pathMissing) return false;

  shell.showItemInFolder(file.path);
  return true;
}

/**
 * 获取预览元数据
 */
export function getPreviewMeta(id: number): FileRow | null {
  return getFile(id);
}

/**
 * 获取收件箱数量
 */
export function getInboxCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM files WHERE status = 'inbox'").get() as {
    count: number;
  };
  return row.count;
}

/**
 * 检查文件是否属于某个项目
 */
export function isFileInProject(fileId: number, projectId: number): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM project_files WHERE file_id = ? AND project_id = ?')
    .get(fileId, projectId);
  return !!row;
}

/**
 * 获取文件所属的第一个项目（用于搜索结果来源徽章）
 */
export function getFirstProjectForFile(fileId: number): { id: number; name: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.id, p.name FROM projects p
       JOIN project_files pf ON pf.project_id = p.id
       WHERE pf.file_id = ?
       ORDER BY pf.added_at ASC
       LIMIT 1`,
    )
    .get(fileId) as { id: number; name: string } | undefined;
  return row || null;
}
