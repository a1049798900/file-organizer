import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';
import {
  addContactsToFilesFrom,
  addContactsToProjectsFrom,
  createContactFrom,
  deleteContactFrom,
  deleteContactsFrom,
  getContactDetailFrom,
  listContactsByFileFrom,
  listContactsByProjectFrom,
  listContactsFrom,
  setContactFilesFrom,
  setContactProjectsFrom,
  setFileContactsFrom,
  setProjectContactsFrom,
  updateContactFrom,
} from '../electron/main/services/contactSvc';

interface SeedResult {
  projectId: number;
  fileId: number;
}

function seedFileAndProject(db: Database.Database): SeedResult {
  const now = Date.now();
  db.prepare(
    'INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)',
  ).run('测试项目', 'active', now, now);
  const project = db.prepare('SELECT id FROM projects WHERE name = ?').get('测试项目') as {
    id: number;
  };

  db.prepare(
    'INSERT INTO files (name, path, size, ext, mtime, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run('测试文件.pdf', 'D:\\资料\\测试文件.pdf', 1024, 'pdf', now, 'filed', now);
  const file = db.prepare('SELECT id FROM files WHERE name = ?').get('测试文件.pdf') as {
    id: number;
  };

  return { projectId: project.id, fileId: file.id };
}

function count(db: Database.Database, sql: string, ...params: unknown[]): number {
  return (db.prepare(sql).get(...params) as { c: number }).c;
}

describe('contact service', () => {
  it('requires a non-empty name', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(() => createContactFrom(db, { name: '   ' })).toThrow('姓名不能为空');
    expect(() => createContactFrom(db, { name: '张三', org: 'x'.repeat(101) })).toThrow(
      '单位长度不能超过 100 字',
    );

    db.close();
  });

  it('creates contacts and searches metadata plus pinyin initials', () => {
    const db = new Database(':memory:');
    migrate(db);

    const contact = createContactFrom(db, {
      name: '张三',
      org: '招商局',
      department: '办公室',
      title: '主任',
      phone: '13800138000',
      email: 'zhang@example.com',
      note: '重点联系人',
    });

    const ids = (query: string) => listContactsFrom(db, query).map((c) => c.id);
    expect(ids('张三')).toContain(contact.id);
    expect(ids('招商')).toContain(contact.id);
    expect(ids('办公室')).toContain(contact.id);
    expect(ids('主任')).toContain(contact.id);
    expect(ids('1380013')).toContain(contact.id);
    expect(ids('zhang@')).toContain(contact.id);
    expect(ids('zs')).toContain(contact.id);
    expect(ids('不存在')).not.toContain(contact.id);

    db.close();
  });

  it('updates contacts and refreshes pinyin', () => {
    const db = new Database(':memory:');
    migrate(db);

    const contact = createContactFrom(db, { name: '张三' });
    expect(listContactsFrom(db, 'zs').map((c) => c.id)).toContain(contact.id);

    const updated = updateContactFrom(db, contact.id, { name: '李四', org: '新单位' });
    expect(updated.name).toBe('李四');
    expect(listContactsFrom(db, 'ls').map((c) => c.id)).toContain(contact.id);
    expect(listContactsFrom(db, 'zs').map((c) => c.id)).not.toContain(contact.id);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(contact.updatedAt);

    db.close();
  });

  it('replaces file contacts and project contacts without touching files', () => {
    const db = new Database(':memory:');
    migrate(db);
    const { projectId, fileId } = seedFileAndProject(db);

    const first = createContactFrom(db, { name: '张三' });
    const second = createContactFrom(db, { name: '李四' });

    const beforeFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

    setFileContactsFrom(db, fileId, [first.id, second.id]);
    expect(listContactsByFileFrom(db, fileId).map((c) => c.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    setFileContactsFrom(db, fileId, [second.id]);
    expect(listContactsByFileFrom(db, fileId).map((c) => c.id)).toEqual([second.id]);

    setProjectContactsFrom(db, projectId, [first.id]);
    expect(listContactsByProjectFrom(db, projectId).map((c) => c.id)).toEqual([first.id]);

    const afterFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    expect(afterFile).toEqual(beforeFile);

    db.close();
  });

  it('manages associations from the contact side and returns detail', () => {
    const db = new Database(':memory:');
    migrate(db);
    const { projectId, fileId } = seedFileAndProject(db);

    const contact = createContactFrom(db, { name: '张三' });
    setContactFilesFrom(db, contact.id, [fileId]);
    setContactProjectsFrom(db, contact.id, [projectId]);

    const detail = getContactDetailFrom(db, contact.id);
    expect(detail).not.toBeNull();
    expect(detail?.projects.map((p) => p.id)).toEqual([projectId]);
    expect(detail?.files.map((f) => f.id)).toEqual([fileId]);

    // 接触一侧解除全部关联
    setContactFilesFrom(db, contact.id, []);
    setContactProjectsFrom(db, contact.id, []);
    expect(getContactDetailFrom(db, contact.id)?.files).toEqual([]);
    expect(getContactDetailFrom(db, contact.id)?.projects).toEqual([]);

    db.close();
  });

  it('deleting a contact clears links but keeps files and projects', () => {
    const db = new Database(':memory:');
    migrate(db);
    const { projectId, fileId } = seedFileAndProject(db);

    const contact = createContactFrom(db, { name: '张三' });
    setFileContactsFrom(db, fileId, [contact.id]);
    setProjectContactsFrom(db, projectId, [contact.id]);

    deleteContactFrom(db, contact.id);

    expect(getContactDetailFrom(db, contact.id)).toBeNull();
    expect(count(db, 'SELECT COUNT(*) AS c FROM contacts')).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS c FROM file_contacts')).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS c FROM project_contacts')).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS c FROM files')).toBe(1);
    expect(count(db, 'SELECT COUNT(*) AS c FROM projects')).toBe(1);

    db.close();
  });

  it('batch adds links without removing existing ones and batch deletes contacts', () => {
    const db = new Database(':memory:');
    migrate(db);
    const { projectId, fileId } = seedFileAndProject(db);

    const first = createContactFrom(db, { name: '张三' });
    const second = createContactFrom(db, { name: '李四' });

    // 预先存在的关联不应被批量追加覆盖
    setFileContactsFrom(db, fileId, [first.id]);
    setProjectContactsFrom(db, projectId, [first.id]);

    const fileResult = addContactsToFilesFrom(db, [fileId], [first.id, second.id]);
    expect(fileResult).toEqual({ ok: 2, fail: 0 });
    expect(listContactsByFileFrom(db, fileId).map((c) => c.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    const projectResult = addContactsToProjectsFrom(db, [projectId], [first.id, second.id]);
    expect(projectResult).toEqual({ ok: 2, fail: 0 });
    expect(listContactsByProjectFrom(db, projectId).map((c) => c.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    // 不存在的文件 → 计入失败，不抛错
    const invalid = addContactsToFilesFrom(db, [999999], [first.id]);
    expect(invalid).toEqual({ ok: 0, fail: 1 });

    const deleted = deleteContactsFrom(db, [first.id, second.id]);
    expect(deleted).toEqual({ ok: 2, fail: 0 });
    expect(count(db, 'SELECT COUNT(*) AS c FROM contacts')).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS c FROM file_contacts')).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS c FROM project_contacts')).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS c FROM files')).toBe(1);
    expect(count(db, 'SELECT COUNT(*) AS c FROM projects')).toBe(1);

    db.close();
  });
});
