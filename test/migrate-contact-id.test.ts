import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name,
  );
}

describe('contact_id column migration', () => {
  it('backfills contact_id on legacy tasks/project_meetings without losing data', () => {
    const db = new Database(':memory:');

    // 模拟旧库：tasks / project_meetings 还没有 contact_id 列
    // （contacts/projects/areas 是外键父表，旧库中已存在）
    db.exec(`
      CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        project_id INTEGER NULL,
        area_id INTEGER NULL,
        due_at INTEGER NULL,
        remind_at INTEGER NULL,
        is_all_day INTEGER NOT NULL DEFAULT 0,
        is_important INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE project_meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NULL,
        area_id INTEGER NULL,
        title TEXT NOT NULL,
        start_at INTEGER NOT NULL,
        end_at INTEGER NULL,
        is_all_day INTEGER NOT NULL DEFAULT 0,
        location TEXT NULL,
        level TEXT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    db.prepare(
      'INSERT INTO tasks (title, due_at, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('遗留任务', 1000, 1000, 1000);

    // 迁移前这里会因 CREATE INDEX 引用缺列而抛 no such column: contact_id
    migrate(db);

    expect(columnNames(db, 'tasks')).toContain('contact_id');
    expect(columnNames(db, 'project_meetings')).toContain('contact_id');

    // 旧数据保留，新列默认 NULL
    const row = db.prepare('SELECT title, contact_id FROM tasks').get() as {
      title: string;
      contact_id: number | null;
    };
    expect(row.title).toBe('遗留任务');
    expect(row.contact_id).toBeNull();

    // 新列可正常写入并参与外键约束
    db.prepare('INSERT INTO contacts (name, created_at, updated_at) VALUES (?, ?, ?)').run(
      '张三',
      1,
      1,
    );
    db.prepare(
      'INSERT INTO tasks (title, contact_id, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run('联系人任务', 1, 1000, 1000, 1000);
    const linked = db
      .prepare('SELECT contact_id FROM tasks WHERE title = ?')
      .get('联系人任务') as { contact_id: number };
    expect(linked.contact_id).toBe(1);

    db.close();
  });

  it('creates contact_id columns on a fresh database', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(columnNames(db, 'tasks')).toContain('contact_id');
    expect(columnNames(db, 'project_meetings')).toContain('contact_id');

    db.close();
  });
});
