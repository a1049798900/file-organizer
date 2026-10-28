// 项目服务 — M3
import { getDb } from '../db';
import type { ProjectRow, ProjectStatus } from '@shared/types';

export function listProjects(filter: 'all' | 'active' | 'done' = 'all'): ProjectRow[] {
  const db = getDb();
  let sql = `
    SELECT
      p.id, p.name, p.status, p.created_at, p.updated_at,
      COUNT(pf.file_id) as file_count
    FROM projects p
    LEFT JOIN project_files pf ON pf.project_id = p.id
  `;
  const params: string[] = [];

  if (filter !== 'all') {
    sql += `WHERE p.status = ? `;
    params.push(filter);
  }

  sql += `GROUP BY p.id ORDER BY p.updated_at DESC`;

  const rows = db.prepare(sql).all(...params) as {
    id: number;
    name: string;
    status: ProjectStatus;
    created_at: number;
    updated_at: number;
    file_count: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    fileCount: r.file_count,
  }));
}

export function getProject(id: number): ProjectRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        p.id, p.name, p.status, p.created_at, p.updated_at,
        COUNT(pf.file_id) as file_count
       FROM projects p
       LEFT JOIN project_files pf ON pf.project_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`,
    )
    .get(id) as {
    id: number;
    name: string;
    status: ProjectStatus;
    created_at: number;
    updated_at: number;
    file_count: number;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fileCount: row.file_count,
  };
}

export function createProject(name: string): ProjectRow {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 50) {
    throw new Error('项目名长度必须为 1-50 字');
  }

  const db = getDb();
  const now = Date.now();

  // 检查重名
  const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(trimmed);
  if (existing) {
    throw new Error('已有同名项目');
  }

  const info = db
    .prepare('INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(trimmed, 'active', now, now);

  return {
    id: Number(info.lastInsertRowid),
    name: trimmed,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    fileCount: 0,
  };
}

export function renameProject(id: number, newName: string): void {
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 50) {
    throw new Error('项目名长度必须为 1-50 字');
  }

  const db = getDb();
  // 检查重名（排除自己）
  const existing = db.prepare('SELECT id FROM projects WHERE name = ? AND id != ?').get(trimmed, id);
  if (existing) {
    throw new Error('已有同名项目');
  }

  const now = Date.now();
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(trimmed, now, id);
}

export function deleteProject(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function setProjectStatus(id: number, status: ProjectStatus): void {
  const db = getDb();
  const now = Date.now();
  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
}

/**
 * 批量添加文件到项目。同时把文件 status 置为 filed。
 */
export function addFilesToProject(projectId: number, fileIds: number[]): void {
  if (fileIds.length === 0) return;

  const db = getDb();
  const now = Date.now();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO project_files (project_id, file_id, added_at) VALUES (?, ?, ?)',
  );
  const markFiled = db.prepare("UPDATE files SET status = 'filed' WHERE id = ? AND status = 'inbox'");

  const transaction = db.transaction(() => {
    for (const fileId of fileIds) {
      insert.run(projectId, fileId, now);
      markFiled.run(fileId);
    }
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
  });

  transaction();
}

export function removeFileFromProject(projectId: number, fileId: number): void {
  const db = getDb();
  const now = Date.now();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM project_files WHERE project_id = ? AND file_id = ?').run(projectId, fileId);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
  });

  transaction();
}

/**
 * 获取文件所属的所有项目 ID
 */
export function getProjectIdsForFile(fileId: number): number[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT project_id FROM project_files WHERE file_id = ?')
    .all(fileId) as { project_id: number }[];
  return rows.map((r) => r.project_id);
}
