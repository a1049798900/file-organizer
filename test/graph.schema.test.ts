import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';

function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((row) => row.name);
}

function columnsOf(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (row) => row.name,
  );
}

function versionOf(db: Database.Database): string {
  return (
    db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as {
      value: string;
    }
  ).value;
}

describe('graph schema migration', () => {
  it('creates area_files and project_contacts.role on a fresh database', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(tableNames(db)).toContain('area_files');
    expect(columnsOf(db, 'project_contacts')).toEqual(
      expect.arrayContaining(['project_id', 'contact_id', 'role', 'added_at']),
    );
    expect(versionOf(db)).toBe('5');

    // 双向外键索引：按 file_id 反查领域
    const indexes = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'area_files'").all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    expect(indexes).toContain('idx_area_files_file_id');

    db.close();
  });

  it('upgrades a v3 database, adding area_files and the role column without losing data', () => {
    const db = new Database(':memory:');
    migrate(db);

    const now = Date.now();
    db.prepare('INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      '测试项目',
      'active',
      now,
      now,
    );
    db.prepare('INSERT INTO contacts (name, created_at, updated_at) VALUES (?, ?, ?)').run(
      '张三',
      now,
      now,
    );

    // 把结构退回 v3：project_contacts 无 role 列，且不存在 area_files
    db.exec(`
      DROP TABLE area_files;
      DROP TABLE project_contacts;
      CREATE TABLE project_contacts (
        project_id INTEGER NOT NULL,
        contact_id INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (project_id, contact_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );
    `);
    db.prepare(
      'INSERT INTO project_contacts (project_id, contact_id, added_at) VALUES (1, 1, ?)',
    ).run(now);
    db.prepare("UPDATE settings SET value = '3' WHERE key = 'schema_version'").run();

    migrate(db);

    expect(tableNames(db)).toContain('area_files');
    expect(columnsOf(db, 'project_contacts')).toContain('role');
    expect(versionOf(db)).toBe('5');

    const links = db.prepare('SELECT project_id, contact_id, role FROM project_contacts').all() as {
      project_id: number;
      contact_id: number;
      role: string | null;
    }[];
    expect(links).toEqual([{ project_id: 1, contact_id: 1, role: null }]);

    db.close();
  });
});
