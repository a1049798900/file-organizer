// 通讯录服务 — 联系人 CRUD、搜索、文件/项目关联
// 纯函数接受 DB 实例，便于内存库单元测试；导出包装函数供 IPC 调用
import fs from 'node:fs';
import { getDb } from '../db';
import { getPinyinInitials } from '../util/pinyin';
import type {
  ContactRow,
  ContactInput,
  ContactDetail,
  ContactProjectRef,
  ContactFileRef,
  BatchResult,
} from '@shared/types';

type Db = ReturnType<typeof getDb>;

interface ContactDbRow {
  id: number;
  name: string;
  org: string | null;
  department: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  pinyin: string;
  created_at: number;
  updated_at: number;
}

const CONTACT_COLUMNS = `id, name, org, department, title, phone, email, note, pinyin, created_at, updated_at`;

function mapContact(row: ContactDbRow): ContactRow {
  return {
    id: row.id,
    name: row.name,
    org: row.org,
    department: row.department,
    title: row.title,
    phone: row.phone,
    email: row.email,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptional(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${field}长度不能超过 ${maxLength} 字`);
  }
  return trimmed;
}

interface NormalizedContactInput {
  name: string;
  org: string | null;
  department: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
}

function normalizeInput(input: ContactInput): NormalizedContactInput {
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('姓名不能为空');
  if (name.length > 50) throw new Error('姓名长度不能超过 50 字');

  return {
    name,
    org: normalizeOptional(input.org, '单位', 100),
    department: normalizeOptional(input.department, '部门', 100),
    title: normalizeOptional(input.title, '职务', 100),
    phone: normalizeOptional(input.phone, '电话', 100),
    email: normalizeOptional(input.email, '邮箱', 100),
    note: normalizeOptional(input.note, '备注', 1000),
  };
}

function tableColumns(db: Db, table: string): string[] {
  try {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (c) => c.name,
    );
  } catch {
    return [];
  }
}

// --------- 查询 ---------

export function listContactsFrom(db: Db, query = ''): ContactRow[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const rows = db
      .prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts ORDER BY updated_at DESC, name COLLATE NOCASE`)
      .all() as ContactDbRow[];
    return rows.map(mapContact);
  }

  const pattern = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT ${CONTACT_COLUMNS} FROM contacts
       WHERE LOWER(name) LIKE ?
          OR LOWER(IFNULL(org, '')) LIKE ?
          OR LOWER(IFNULL(department, '')) LIKE ?
          OR LOWER(IFNULL(title, '')) LIKE ?
          OR LOWER(IFNULL(phone, '')) LIKE ?
          OR LOWER(IFNULL(email, '')) LIKE ?
          OR pinyin LIKE ?
       ORDER BY updated_at DESC, name COLLATE NOCASE`,
    )
    .all(pattern, pattern, pattern, pattern, pattern, pattern, pattern) as ContactDbRow[];
  return rows.map(mapContact);
}

export function getContactFrom(db: Db, id: number): ContactRow | null {
  const row = db
    .prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ?`)
    .get(id) as ContactDbRow | undefined;
  return row ? mapContact(row) : null;
}

export function getContactDetailFrom(db: Db, id: number): ContactDetail | null {
  const contact = getContactFrom(db, id);
  if (!contact) return null;

  const projects = db
    .prepare(
      `SELECT p.id, p.name, p.status
       FROM projects p
       JOIN project_contacts pc ON pc.project_id = p.id
       WHERE pc.contact_id = ?
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all(id) as ContactProjectRef[];

  const fileRows = db
    .prepare(
      `SELECT f.id, f.name, f.ext, f.size, f.mtime, f.path
       FROM files f
       JOIN file_contacts fc ON fc.file_id = f.id
       WHERE fc.contact_id = ?
       ORDER BY fc.added_at DESC`,
    )
    .all(id) as {
    id: number;
    name: string;
    ext: string;
    size: number;
    mtime: number;
    path: string;
  }[];

  const files: ContactFileRef[] = fileRows.map((row) => ({
    id: row.id,
    name: row.name,
    ext: row.ext,
    size: row.size,
    mtime: row.mtime,
    pathMissing: !fs.existsSync(row.path),
  }));

  return { ...contact, projects, files };
}

export function listContactsByFileFrom(db: Db, fileId: number): ContactRow[] {
  const rows = db
    .prepare(
      `SELECT ${CONTACT_COLUMNS
        .split(',')
        .map((c) => `c.${c.trim()}`)
        .join(', ')}
       FROM contacts c
       JOIN file_contacts fc ON fc.contact_id = c.id
       WHERE fc.file_id = ?
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(fileId) as ContactDbRow[];
  return rows.map(mapContact);
}

export function listContactsByProjectFrom(db: Db, projectId: number): ContactRow[] {
  const rows = db
    .prepare(
      `SELECT ${CONTACT_COLUMNS
        .split(',')
        .map((c) => `c.${c.trim()}`)
        .join(', ')}
       FROM contacts c
       JOIN project_contacts pc ON pc.contact_id = c.id
       WHERE pc.project_id = ?
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(projectId) as ContactDbRow[];
  return rows.map(mapContact);
}

// --------- 写入 ---------

export function createContactFrom(db: Db, input: ContactInput): ContactRow {
  const value = normalizeInput(input);
  const now = Date.now();
  const pinyin = getPinyinInitials(value.name);

  const info = db
    .prepare(
      `INSERT INTO contacts (name, org, department, title, phone, email, note, pinyin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.name,
      value.org,
      value.department,
      value.title,
      value.phone,
      value.email,
      value.note,
      pinyin,
      now,
      now,
    );

  const row = db
    .prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as ContactDbRow;
  return mapContact(row);
}

export function updateContactFrom(db: Db, id: number, input: ContactInput): ContactRow {
  const existing = getContactFrom(db, id);
  if (!existing) throw new Error('联系人不存在');

  const value = normalizeInput(input);
  const now = Date.now();
  const pinyin = getPinyinInitials(value.name);

  db.prepare(
    `UPDATE contacts
     SET name = ?, org = ?, department = ?, title = ?, phone = ?, email = ?, note = ?, pinyin = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    value.name,
    value.org,
    value.department,
    value.title,
    value.phone,
    value.email,
    value.note,
    pinyin,
    now,
    id,
  );

  const row = db
    .prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ?`)
    .get(id) as ContactDbRow;
  return mapContact(row);
}

/**
 * 删除联系人：只删本地记录与关联，不触碰磁盘文件、项目、知识库。
 */
export function deleteContactFrom(db: Db, id: number): void {
  const favoriteColumns = tableColumns(db, 'favorite_items');
  const canCleanFavorites =
    favoriteColumns.includes('entity_type') && favoriteColumns.includes('entity_id');

  db.transaction(() => {
    db.prepare('DELETE FROM file_contacts WHERE contact_id = ?').run(id);
    db.prepare('DELETE FROM project_contacts WHERE contact_id = ?').run(id);
    if (canCleanFavorites) {
      db.prepare(
        "DELETE FROM favorite_items WHERE entity_type = 'contact' AND entity_id = ?",
      ).run(id);
    }
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  })();
}

export function setFileContactsFrom(db: Db, fileId: number, contactIds: number[]): void {
  const uniqueIds = Array.from(new Set(contactIds.filter((id) => Number.isInteger(id) && id > 0)));
  const now = Date.now();

  db.transaction(() => {
    db.prepare('DELETE FROM file_contacts WHERE file_id = ?').run(fileId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO file_contacts (file_id, contact_id, added_at) VALUES (?, ?, ?)',
    );
    for (const contactId of uniqueIds) {
      insert.run(fileId, contactId, now);
    }
  })();
}

export function setProjectContactsFrom(db: Db, projectId: number, contactIds: number[]): void {
  const uniqueIds = Array.from(new Set(contactIds.filter((id) => Number.isInteger(id) && id > 0)));
  const now = Date.now();

  db.transaction(() => {
    db.prepare('DELETE FROM project_contacts WHERE project_id = ?').run(projectId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO project_contacts (project_id, contact_id, added_at) VALUES (?, ?, ?)',
    );
    for (const contactId of uniqueIds) {
      insert.run(projectId, contactId, now);
    }
  })();
}

export function setContactFilesFrom(db: Db, contactId: number, fileIds: number[]): void {
  const uniqueIds = Array.from(new Set(fileIds.filter((id) => Number.isInteger(id) && id > 0)));
  const now = Date.now();

  db.transaction(() => {
    db.prepare('DELETE FROM file_contacts WHERE contact_id = ?').run(contactId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO file_contacts (file_id, contact_id, added_at) VALUES (?, ?, ?)',
    );
    for (const fileId of uniqueIds) {
      insert.run(fileId, contactId, now);
    }
  })();
}

export function setContactProjectsFrom(db: Db, contactId: number, projectIds: number[]): void {
  const uniqueIds = Array.from(
    new Set(projectIds.filter((id) => Number.isInteger(id) && id > 0)),
  );
  const now = Date.now();

  db.transaction(() => {
    db.prepare('DELETE FROM project_contacts WHERE contact_id = ?').run(contactId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO project_contacts (contact_id, project_id, added_at) VALUES (?, ?, ?)',
    );
    for (const projectId of uniqueIds) {
      insert.run(contactId, projectId, now);
    }
  })();
}

function uniquePositiveIds(ids: number[] | null | undefined): number[] {
  return Array.from(new Set((ids ?? []).filter((id) => Number.isInteger(id) && id > 0)));
}

/**
 * 批量追加「文件 ↔ 联系人」关联：只新增，不删除已有关系。
 */
export function addContactsToFilesFrom(
  db: Db,
  fileIds: number[],
  contactIds: number[],
): BatchResult {
  const files = uniquePositiveIds(fileIds);
  const contacts = uniquePositiveIds(contactIds);
  if (files.length === 0 || contacts.length === 0) return { ok: 0, fail: 0 };

  const now = Date.now();
  let ok = 0;
  let fail = 0;

  db.transaction(() => {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO file_contacts (file_id, contact_id, added_at) VALUES (?, ?, ?)',
    );
    for (const fileId of files) {
      for (const contactId of contacts) {
        try {
          insert.run(fileId, contactId, now);
          ok++;
        } catch {
          fail++;
        }
      }
    }
  })();

  return { ok, fail };
}

/**
 * 批量追加「项目 ↔ 联系人」关联：只新增，不删除已有关系。
 */
export function addContactsToProjectsFrom(
  db: Db,
  projectIds: number[],
  contactIds: number[],
): BatchResult {
  const projects = uniquePositiveIds(projectIds);
  const contacts = uniquePositiveIds(contactIds);
  if (projects.length === 0 || contacts.length === 0) return { ok: 0, fail: 0 };

  const now = Date.now();
  let ok = 0;
  let fail = 0;

  db.transaction(() => {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO project_contacts (project_id, contact_id, added_at) VALUES (?, ?, ?)',
    );
    for (const projectId of projects) {
      for (const contactId of contacts) {
        try {
          insert.run(projectId, contactId, now);
          ok++;
        } catch {
          fail++;
        }
      }
    }
  })();

  return { ok, fail };
}

/**
 * 批量删除联系人：仅删除本地记录与关联，不触碰文件本身。
 */
export function deleteContactsFrom(db: Db, ids: number[]): BatchResult {
  const targets = uniquePositiveIds(ids);
  let ok = 0;
  let fail = 0;

  for (const id of targets) {
    try {
      deleteContactFrom(db, id);
      ok++;
    } catch {
      fail++;
    }
  }

  return { ok, fail };
}

// --------- 包装函数（IPC 使用） ---------

export function listContacts(query = ''): ContactRow[] {
  return listContactsFrom(getDb(), query);
}

export function getContactDetail(id: number): ContactDetail | null {
  return getContactDetailFrom(getDb(), id);
}

export function createContact(input: ContactInput): ContactRow {
  return createContactFrom(getDb(), input);
}

export function updateContact(id: number, input: ContactInput): ContactRow {
  return updateContactFrom(getDb(), id, input);
}

export function deleteContact(id: number): void {
  deleteContactFrom(getDb(), id);
}

export function listContactsByFile(fileId: number): ContactRow[] {
  return listContactsByFileFrom(getDb(), fileId);
}

export function listContactsByProject(projectId: number): ContactRow[] {
  return listContactsByProjectFrom(getDb(), projectId);
}

export function setFileContacts(fileId: number, contactIds: number[]): void {
  setFileContactsFrom(getDb(), fileId, contactIds);
}

export function setProjectContacts(projectId: number, contactIds: number[]): void {
  setProjectContactsFrom(getDb(), projectId, contactIds);
}

export function setContactFiles(contactId: number, fileIds: number[]): void {
  setContactFilesFrom(getDb(), contactId, fileIds);
}

export function setContactProjects(contactId: number, projectIds: number[]): void {
  setContactProjectsFrom(getDb(), contactId, projectIds);
}

export function addContactsToFiles(fileIds: number[], contactIds: number[]): BatchResult {
  return addContactsToFilesFrom(getDb(), fileIds, contactIds);
}

export function addContactsToProjects(projectIds: number[], contactIds: number[]): BatchResult {
  return addContactsToProjectsFrom(getDb(), projectIds, contactIds);
}

export function deleteContacts(ids: number[]): BatchResult {
  return deleteContactsFrom(getDb(), ids);
}
