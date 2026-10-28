import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';

function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((row) => row.name);
}

describe('contact schema migration', () => {
  it('creates contact tables on a fresh database', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['contacts', 'file_contacts', 'project_contacts']),
    );

    const version = db
      .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(version.value).toBe('5');

    db.close();
  });

  it('upgrades a v2 database without losing existing project and file data', () => {
    const db = new Database(':memory:');
    migrate(db);

    db.prepare('INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      '测试项目',
      'active',
      1000,
      1000,
    );
    db.prepare(
      'INSERT INTO files (name, path, size, ext, mtime, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('测试文件.pdf', 'D:\\资料\\测试文件.pdf', 1024, 'pdf', 1000, 'filed', 1000);

    // 模拟 v2 数据库：联系人表尚未建立
    db.exec('DROP TABLE file_contacts; DROP TABLE project_contacts; DROP TABLE contacts;');
    db.prepare("UPDATE settings SET value = '2' WHERE key = 'schema_version'").run();

    migrate(db);

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['contacts', 'file_contacts', 'project_contacts']),
    );

    const version = db
      .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value: string };
    const projectCount = db.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number };
    const fileCount = db.prepare('SELECT COUNT(*) AS c FROM files').get() as { c: number };

    expect(version.value).toBe('5');
    expect(projectCount.c).toBe(1);
    expect(fileCount.c).toBe(1);

    db.close();
  });
});
