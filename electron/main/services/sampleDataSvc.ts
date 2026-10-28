// 示例日历数据 — 仅用于手工验收
// 所有记录统一带「【示例】」前缀，可一键清除，不影响真实任务与会议
import { getDb } from '../db';
import type { SampleDataResult } from '@shared/calendar';

const PREFIX = '【示例】';

type Db = ReturnType<typeof getDb>;

function at(dayOffset: number, hour: number, minute = 0): number {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function deleteSamples(db: Db): void {
  db.prepare('DELETE FROM tasks WHERE title LIKE ?').run(`${PREFIX}%`);
  db.prepare('DELETE FROM project_meetings WHERE title LIKE ?').run(`${PREFIX}%`);
  db.prepare('DELETE FROM areas WHERE name LIKE ?').run(`${PREFIX}%`);
}

export function clearSampleData(): void {
  clearSampleDataFrom(getDb());
}

export function clearSampleDataFrom(db: Db): void {
  db.transaction(() => deleteSamples(db))();
}

export function seedSampleData(): SampleDataResult {
  return seedSampleDataInto(getDb());
}

export function seedSampleDataInto(db: Db): SampleDataResult {
  const now = Date.now();

  return db.transaction(() => {
    deleteSamples(db);

    const area = db
      .prepare('INSERT INTO areas (name, created_at, updated_at) VALUES (?, ?, ?)')
      .run(`${PREFIX}内容运营`, now, now);
    const areaId = Number(area.lastInsertRowid);

    const insertTask = db.prepare(
      `
      INSERT INTO tasks
        (title, area_id, due_at, remind_at, is_all_day, is_important, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    insertTask.run(`${PREFIX}提交周报`, areaId, at(0, 18), at(0, 17), 0, 1, 'open', now, now);
    insertTask.run(`${PREFIX}整理素材`, areaId, at(1, 12), null, 0, 0, 'open', now, now);
    // 提醒演示：2 分钟后提醒，未标记重要，用于验证提醒不再受重要性限制
    insertTask.run(
      `${PREFIX}提醒演示`,
      areaId,
      at(0, 20),
      now + 2 * 60_000,
      0,
      0,
      'open',
      now,
      now,
    );
    // 截止演示：20 分钟后截止，默认提前 15 分钟触发通知
    insertTask.run(
      `${PREFIX}截止演示`,
      areaId,
      now + 20 * 60_000,
      null,
      0,
      0,
      'open',
      now,
      now,
    );
    insertTask.run(`${PREFIX}已完成的复盘`, areaId, at(-1, 18), null, 0, 0, 'done', now, now);

    const insertMeeting = db.prepare(
      `
      INSERT INTO project_meetings
        (area_id, title, start_at, end_at, is_all_day, location, level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    insertMeeting.run(areaId, `${PREFIX}项目周会`, at(0, 10), at(0, 11), 0, '3 楼会议室', '重要', now, now);
    insertMeeting.run(areaId, `${PREFIX}跨天评审`, at(-1, 22), at(0, 9), 0, '线上', '重要', now, now);
    insertMeeting.run(areaId, `${PREFIX}月度复盘`, at(1, 0), at(2, 0), 1, null, null, now, now);

    return { areas: 1, tasks: 5, meetings: 3 };
  })();
}
