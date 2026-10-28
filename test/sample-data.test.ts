import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';
import {
  clearSampleDataFrom,
  seedSampleDataInto,
} from '../electron/main/services/sampleDataSvc';

function count(db: Database.Database, sql: string, ...params: unknown[]): number {
  return (db.prepare(sql).get(...params) as { count: number }).count;
}

describe('sample calendar data', () => {
  it('seeds and clears prefixed rows without touching real data', () => {
    const db = new Database(':memory:');
    migrate(db);

    const now = Date.now();
    db.prepare('INSERT INTO areas (name, created_at, updated_at) VALUES (?, ?, ?)').run(
      '真实领域',
      now,
      now,
    );
    const realArea = db.prepare('SELECT id FROM areas WHERE name = ?').get('真实领域') as {
      id: number;
    };
    db.prepare(
      `INSERT INTO tasks (title, area_id, due_at, is_all_day, is_important, status, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, 'open', ?, ?)`,
    ).run('真实任务', realArea.id, now, now, now);

    expect(seedSampleDataInto(db)).toEqual({ areas: 1, tasks: 5, meetings: 3 });
    // 重复填充不会累积
    expect(seedSampleDataInto(db)).toEqual({ areas: 1, tasks: 5, meetings: 3 });

    expect(count(db, "SELECT COUNT(*) AS count FROM tasks WHERE title LIKE '【示例】%'")).toBe(5);
    expect(
      count(db, "SELECT COUNT(*) AS count FROM project_meetings WHERE title LIKE '【示例】%'"),
    ).toBe(3);

    clearSampleDataFrom(db);

    expect(count(db, "SELECT COUNT(*) AS count FROM tasks WHERE title LIKE '【示例】%'")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS count FROM areas WHERE name LIKE '【示例】%'")).toBe(0);
    expect(count(db, 'SELECT COUNT(*) AS count FROM tasks WHERE title = ?', '真实任务')).toBe(1);

    db.close();
  });
});
