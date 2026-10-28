import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';

function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((row) => row.name);
}

describe('calendar schema migration', () => {
  it('creates calendar tables on a fresh database', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['areas', 'tasks', 'project_meetings']),
    );

    const version = db
      .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(version.value).toBe('5');

    db.close();
  });

  it('upgrades an existing v1 database without losing settings', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'schema_version',
      '1',
    );
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('scan_root', 'D:\\资料');

    migrate(db);

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['areas', 'tasks', 'project_meetings']),
    );

    const version = db
      .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value: string };
    const scanRoot = db
      .prepare("SELECT value FROM settings WHERE key = 'scan_root'")
      .get() as { value: string };
    expect(version.value).toBe('5');
    expect(scanRoot.value).toBe('D:\\资料');

    db.close();
  });
});
