// 网页快捷方式 CRUD 服务 —— 对应 web_shortcuts 表
import { getDb } from '../db';
import type { WebShortcutRow } from '../../../src/shared/types';

/**
 * 校验 URL：必须以 http:// 或 https:// 开头
 */
function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function listShortcuts(): WebShortcutRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, url, sort_order, created_at
       FROM web_shortcuts
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as {
    id: number;
    name: string;
    url: string;
    sort_order: number;
    created_at: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}

export function createShortcut(name: string, url: string): WebShortcutRow {
  const trimmedName = name.trim();
  const trimmedUrl = url.trim();

  if (!trimmedName || trimmedName.length === 0) {
    throw new Error('快捷方式名称不能为空');
  }
  if (trimmedName.length > 50) {
    throw new Error('快捷方式名称不能超过 50 字');
  }
  if (!isValidUrl(trimmedUrl)) {
    throw new Error('网址格式不正确，必须以 http:// 或 https:// 开头');
  }

  const db = getDb();

  // 新快捷方式排到最后
  const maxRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM web_shortcuts')
    .get() as { max_sort: number };
  const sortOrder = maxRow.max_sort + 1;

  const now = Date.now();
  const info = db
    .prepare(
      'INSERT INTO web_shortcuts (name, url, sort_order, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(trimmedName, trimmedUrl, sortOrder, now);

  return {
    id: Number(info.lastInsertRowid),
    name: trimmedName,
    url: trimmedUrl,
    sortOrder,
    createdAt: now,
  };
}

export function updateShortcut(id: number, name: string, url: string): void {
  const trimmedName = name.trim();
  const trimmedUrl = url.trim();

  if (!trimmedName || trimmedName.length === 0) {
    throw new Error('快捷方式名称不能为空');
  }
  if (!isValidUrl(trimmedUrl)) {
    throw new Error('网址格式不正确，必须以 http:// 或 https:// 开头');
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM web_shortcuts WHERE id = ?').get(id);
  if (!existing) {
    throw new Error('快捷方式不存在');
  }

  db.prepare('UPDATE web_shortcuts SET name = ?, url = ? WHERE id = ?').run(
    trimmedName,
    trimmedUrl,
    id,
  );
}

export function deleteShortcut(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM web_shortcuts WHERE id = ?').run(id);
}

export function reorderShortcuts(ids: number[]): void {
  if (ids.length === 0) return;

  const db = getDb();
  const updateStmt = db.prepare('UPDATE web_shortcuts SET sort_order = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    ids.forEach((id, index) => {
      updateStmt.run(index, id);
    });
  });

  transaction();
}
