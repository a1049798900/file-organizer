// 文件服务 — M2/M5/M8
import type Database from 'better-sqlite3';
import { getDb } from '../db';
import { getTagsForFiles, getTagsForFilesFrom } from './tagSvc';
import type {
  FileRow,
  FileListSource,
  FileSort,
  BatchResult,
  FileAssociations,
  MoveTargetInfo,
} from '@shared/types';
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog, shell } from 'electron';
import { getNamePinyin } from '../util/pinyin';

type Db = Database.Database;

/**
 * 构建文件列表查询
 * 统一入口：所有文件列表（收件箱、项目、知识库、搜索）都通过此函数获取
 */
export function listFiles(source: FileListSource, sort: FileSort): FileRow[] {
  return listFilesFrom(getDb(), source, sort);
}

/** 可注入 db 的实现，便于单元测试 */
export function listFilesFrom(
  db: Db,
  source: FileListSource,
  sort: FileSort,
): FileRow[] {
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
    case 'all':
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
      return enrichFileRows(db, rows);
    }
  }

  // 排序
  sql += `ORDER BY ${sortColumn(sort)} ${sort.dir === 'desc' ? 'DESC' : 'ASC'} `;

  const rows = db.prepare(sql).all(...params) as Omit<FileRow, 'tags' | 'pathMissing'>[];
  return enrichFileRows(db, rows);
}

function sortColumn(sort: FileSort): string {
  switch (sort.key) {
    case 'name':
      return 'f.name COLLATE NOCASE';
    case 'ext':
      return 'f.ext COLLATE NOCASE';
    case 'size':
      return 'f.size';
    case 'tags':
      // 按首个标签名排序（无标签的文件排在最后/最前由方向决定）
      return `(SELECT GROUP_CONCAT(t.name, '、') FROM tag_links tl JOIN tags t ON t.id = tl.tag_id WHERE tl.file_id = f.id) COLLATE NOCASE`;
    default:
      return 'f.mtime';
  }
}

/**
 * 构建搜索查询 — 使用 LIKE 子串匹配
 * 排序权重：文件名前缀 > 拼音前缀 > 文件名包含 > 拼音包含 > 别名 > 标签
 *
 * 历史说明：曾使用 FTS5 unicode61 + "term"* 前缀匹配，但 unicode61 不切分中文，
 * 整段中文文件名是一个 token，导致「博白」这类中间子串永远无法命中，故改为 LIKE。
 */
function buildSearchQuery(query: string): {
  searchSql: string;
  searchParams: string[];
  sort: FileSort;
} {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  // LIKE 通配符转义，防止用户输入 % 或 _ 被当作通配符
  const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

  // 多词查询：每个词都必须在 文件名/别名/拼音首字母 中子串命中（AND 语义）
  const fileMatchCond = (alias: string) =>
    terms
      .map(
        () =>
          `(LOWER(${alias}.name) LIKE ? ESCAPE '\\' OR LOWER(IFNULL(${alias}.alias, '')) LIKE ? ESCAPE '\\' OR ${alias}.pinyin LIKE ? ESCAPE '\\')`,
      )
      .join(' AND ');

  const searchSql = `
    SELECT
      f.id AS rowid,
      CASE
        WHEN LOWER(f.name) LIKE ? ESCAPE '\\' THEN 1
        WHEN f.pinyin LIKE ? ESCAPE '\\' THEN 1.5
        WHEN LOWER(f.name) LIKE ? ESCAPE '\\' THEN 2
        WHEN f.pinyin LIKE ? ESCAPE '\\' THEN 2.5
        WHEN LOWER(IFNULL(f.alias, '')) LIKE ? ESCAPE '\\' THEN 4
        ELSE 3
      END AS rank
    FROM files f
    WHERE ${fileMatchCond('f')}
    UNION
    SELECT
      tf.id AS rowid,
      5 AS rank
    FROM files tf
    JOIN tag_links tl ON tl.file_id = tf.id
    JOIN tags t ON t.id = tl.tag_id
    WHERE LOWER(t.name) LIKE ? ESCAPE '\\'
      AND tf.id NOT IN (
        SELECT f2.id FROM files f2 WHERE ${fileMatchCond('f2')}
      )
  `;

  const prefixPattern = `${esc(q)}%`;
  const containsPattern = `%${esc(q)}%`;

  const termParams = terms.flatMap((t) => {
    const p = `%${esc(t)}%`;
    return [p, p, p];
  });

  const searchParams = [
    prefixPattern,   // name prefix
    prefixPattern,   // pinyin prefix
    containsPattern, // name contains
    containsPattern, // pinyin contains
    containsPattern, // alias contains
    ...termParams,   // 主查询 WHERE
    containsPattern, // tag name contains
    ...termParams,   // 排除子查询 WHERE
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
function enrichFileRows(db: Db, rows: Omit<FileRow, 'tags' | 'pathMissing'>[]): FileRow[] {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tagsMap = getTagsForFilesFrom(db, ids);

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
 * 将外部拖入的文件加入索引（直接进入收件箱）
 * 已在索引中的文件会更新大小/时间并重新置为 inbox
 */
export function indexPaths(paths: string[]): BatchResult {
  const uniquePaths = Array.from(
    new Set(paths.filter((p) => typeof p === 'string' && p.trim().length > 0)),
  );
  if (uniquePaths.length === 0) return { ok: 0, fail: 0 };

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO files (name, alias, path, size, ext, mtime, status, in_knowledge, pinyin, created_at)
    VALUES (?, NULL, ?, ?, ?, ?, 'inbox', 0, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size,
      mtime = excluded.mtime,
      status = 'inbox'
  `);

  const now = Date.now();
  let ok = 0;
  let fail = 0;

  const transaction = db.transaction(() => {
    for (const filePath of uniquePaths) {
      try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          fail++;
          continue;
        }
        const name = path.basename(filePath);
        const ext = path.extname(name).slice(1).toLowerCase();
        insert.run(
          name,
          filePath,
          stats.size,
          ext || 'none',
          Math.round(stats.mtimeMs),
          getNamePinyin(name, null),
          now,
        );
        ok++;
      } catch {
        fail++;
      }
    }
  });
  transaction();

  return { ok, fail };
}

/**
 * 用系统程序打开文件
 */
export async function openFile(id: number): Promise<{ ok: boolean; reason?: string }> {
  const file = getFile(id);
  if (!file) return { ok: false, reason: '文件不存在' };
  if (file.pathMissing) return { ok: false, reason: '路径失效' };

  const errorMessage = await shell.openPath(file.path);
  if (errorMessage) {
    return { ok: false, reason: errorMessage };
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

/** 预览读取上限 50MB，超过则走兜底图标 */
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

/**
 * 只读读取文件二进制，用于渲染进程内渲染预览
 * 不做文本提取、不写入数据库
 */
export function readFileBytes(id: number): Uint8Array {
  const file = getFile(id);
  if (!file) throw new Error('文件不存在');
  if (file.pathMissing) throw new Error('文件已不在原路径');
  if (file.size > MAX_PREVIEW_BYTES) throw new Error('文件过大，无法预览');
  return new Uint8Array(fs.readFileSync(file.path));
}

/**
 * 获取文件的标签 / 专题 / 项目关联（只读）
 */
export function getFileAssociationsFrom(
  db: ReturnType<typeof getDb>,
  id: number,
): FileAssociations {
  const tags = db
    .prepare(
      `SELECT t.id, t.name
       FROM tags t
       JOIN tag_links tl ON tl.tag_id = t.id
       WHERE tl.file_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(id) as { id: number; name: string }[];

  const topics = db
    .prepare(
      `SELECT t.id, t.name
       FROM resource_topics t
       JOIN resource_topic_links l ON l.topic_id = t.id
       WHERE l.file_id = ?
       ORDER BY t.sort_order ASC, t.name COLLATE NOCASE`,
    )
    .all(id) as { id: number; name: string }[];

  const projects = db
    .prepare(
      `SELECT p.id, p.name
       FROM projects p
       JOIN project_files pf ON pf.project_id = p.id
       WHERE pf.file_id = ?
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all(id) as { id: number; name: string }[];

  return { tags, topics, projects };
}

export function getFileAssociations(id: number): FileAssociations {
  return getFileAssociationsFrom(getDb(), id);
}

/**
 * 弹窗选择移动目标文件夹，并返回移动后的完整路径
 */
export function pickMoveTarget(id: number): MoveTargetInfo | null {
  const file = getFile(id);
  if (!file) throw new Error('文件不存在');
  if (file.pathMissing) throw new Error('文件已不在原路径');

  const focused = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogSyncOptions = {
    title: '选择目标文件夹',
    buttonLabel: '移动到此处',
    properties: ['openDirectory', 'createDirectory'],
  };
  const result = focused
    ? dialog.showOpenDialogSync(focused, options)
    : dialog.showOpenDialogSync(options);

  if (!result || result.length === 0) return null;
  const dir = result[0];
  return {
    dir,
    targetPath: path.join(dir, path.basename(file.path)),
    sourcePath: file.path,
  };
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
