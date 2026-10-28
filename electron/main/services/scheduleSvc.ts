// 日程服务 — 任务/会议的增删改与项目日程聚合
import { getDb } from '../db';
import type {
  AreaMeetingItem,
  AreaTaskItem,
  MeetingScheduleInput,
  ProjectSchedule,
  TaskScheduleInput,
} from '@shared/calendar';

type Db = ReturnType<typeof getDb>;

function normalizeTitle(raw: string): string {
  const title = typeof raw === 'string' ? raw.trim() : '';
  if (!title) throw new Error('标题不能为空');
  if (title.length > 100) throw new Error('标题不能超过 100 字');
  return title;
}

function parseTime(value: string | null | undefined, field: string): number | null {
  if (value == null || value === '') return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${field}格式不正确`);
  return ms;
}

function normalizeProjectId(db: Db, projectId: number | null): number | null {
  if (projectId == null) return null;
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error('关联项目无效');
  }
  const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!exists) throw new Error('关联项目不存在');
  return projectId;
}

function normalizeContactId(db: Db, contactId: number | null | undefined): number | null {
  if (contactId == null) return null;
  if (!Number.isInteger(contactId) || contactId <= 0) {
    throw new Error('关联联系人无效');
  }
  const exists = db.prepare('SELECT id FROM contacts WHERE id = ?').get(contactId);
  if (!exists) throw new Error('关联联系人不存在');
  return contactId;
}

function toIso(ms: number | null): string | undefined {
  return ms == null ? undefined : new Date(ms).toISOString();
}

// ---------- 任务 ----------

export function createTaskFrom(db: Db, input: TaskScheduleInput): number {
  const title = normalizeTitle(input.title);
  const projectId = normalizeProjectId(db, input.projectId);
  const contactId = normalizeContactId(db, input.contactId);
  const dueAt = parseTime(input.dueAt, '截止时间');
  const remindAt = parseTime(input.remindAt, '提醒时间');
  if (dueAt == null && remindAt == null) {
    throw new Error('请至少设置截止时间或提醒时间');
  }

  const now = Date.now();
  const info = db
    .prepare(
      `
      INSERT INTO tasks
        (title, project_id, contact_id, due_at, remind_at, is_all_day, is_important, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
      `,
    )
    .run(
      title,
      projectId,
      contactId,
      dueAt,
      remindAt,
      input.allDay ? 1 : 0,
      input.important ? 1 : 0,
      now,
      now,
    );

  return Number(info.lastInsertRowid);
}

export function updateTaskFrom(db: Db, id: number, input: TaskScheduleInput): void {
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!existing) throw new Error('任务不存在');

  const title = normalizeTitle(input.title);
  const projectId = normalizeProjectId(db, input.projectId);
  const dueAt = parseTime(input.dueAt, '截止时间');
  const remindAt = parseTime(input.remindAt, '提醒时间');
  if (dueAt == null && remindAt == null) {
    throw new Error('请至少设置截止时间或提醒时间');
  }

  // 只更新日历可编辑字段，保留领域归属与完成状态
  db.prepare(
    `
    UPDATE tasks
    SET title = ?, project_id = ?, due_at = ?, remind_at = ?,
        is_all_day = ?, is_important = ?, updated_at = ?
    WHERE id = ?
    `,
  ).run(
    title,
    projectId,
    dueAt,
    remindAt,
    input.allDay ? 1 : 0,
    input.important ? 1 : 0,
    Date.now(),
    id,
  );
}

export function deleteTaskFrom(db: Db, id: number): void {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('任务不存在');
}

export function setTaskStatusFrom(db: Db, id: number, status: 'done' | 'open'): void {
  const result = db
    .prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, Date.now(), id);
  if (result.changes === 0) throw new Error('任务不存在');
}

// ---------- 会议 ----------

export function createMeetingFrom(db: Db, input: MeetingScheduleInput): number {
  const title = normalizeTitle(input.title);
  const projectId = normalizeProjectId(db, input.projectId);
  const contactId = normalizeContactId(db, input.contactId);
  const startAt = parseTime(input.startAt, '开始时间');
  const endAt = parseTime(input.endAt, '结束时间');
  if (startAt == null) throw new Error('请选择会议开始时间');
  if (endAt != null && endAt <= startAt) throw new Error('结束时间必须晚于开始时间');

  const now = Date.now();
  const info = db
    .prepare(
      `
      INSERT INTO project_meetings
        (project_id, contact_id, title, start_at, end_at, is_all_day, location, level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      projectId,
      contactId,
      title,
      startAt,
      endAt,
      input.allDay ? 1 : 0,
      input.location?.trim() || null,
      input.level?.trim() || null,
      now,
      now,
    );

  return Number(info.lastInsertRowid);
}

export function updateMeetingFrom(db: Db, id: number, input: MeetingScheduleInput): void {
  const existing = db.prepare('SELECT id FROM project_meetings WHERE id = ?').get(id);
  if (!existing) throw new Error('会议不存在');

  const title = normalizeTitle(input.title);
  const projectId = normalizeProjectId(db, input.projectId);
  const startAt = parseTime(input.startAt, '开始时间');
  const endAt = parseTime(input.endAt, '结束时间');
  if (startAt == null) throw new Error('请选择会议开始时间');
  if (endAt != null && endAt <= startAt) throw new Error('结束时间必须晚于开始时间');

  // 只更新日历可编辑字段，保留领域归属
  db.prepare(
    `
    UPDATE project_meetings
    SET title = ?, project_id = ?, start_at = ?, end_at = ?,
        is_all_day = ?, location = ?, level = ?, updated_at = ?
    WHERE id = ?
    `,
  ).run(
    title,
    projectId,
    startAt,
    endAt,
    input.allDay ? 1 : 0,
    input.location?.trim() || null,
    input.level?.trim() || null,
    Date.now(),
    id,
  );
}

export function deleteMeetingFrom(db: Db, id: number): void {
  const result = db.prepare('DELETE FROM project_meetings WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('会议不存在');
}

// ---------- 项目日程聚合 ----------

export function listProjectScheduleFrom(db: Db, projectId: number): ProjectSchedule {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { tasks: [], meetings: [] };
  }

  const taskRows = db
    .prepare(
      `
      SELECT id, title, due_at, remind_at, is_all_day, is_important, status
      FROM tasks
      WHERE project_id = ?
      ORDER BY CASE WHEN status = 'done' THEN 1 ELSE 0 END,
               CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
               due_at ASC, id ASC
      `,
    )
    .all(projectId) as {
    id: number;
    title: string;
    due_at: number | null;
    remind_at: number | null;
    is_all_day: number;
    is_important: number;
    status: string;
  }[];

  const meetingRows = db
    .prepare(
      `
      SELECT id, title, start_at, end_at, is_all_day, location, level
      FROM project_meetings
      WHERE project_id = ?
      ORDER BY start_at ASC, id ASC
      `,
    )
    .all(projectId) as {
    id: number;
    title: string;
    start_at: number;
    end_at: number | null;
    is_all_day: number;
    location: string | null;
    level: string | null;
  }[];

  const tasks: AreaTaskItem[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: toIso(row.due_at),
    remindAt: toIso(row.remind_at),
    allDay: row.is_all_day === 1,
    important: row.is_important === 1,
    status: row.status,
  }));

  const meetings: AreaMeetingItem[] = meetingRows.map((row) => ({
    id: row.id,
    title: row.title,
    startAt: new Date(row.start_at).toISOString(),
    endAt: row.end_at == null ? undefined : new Date(row.end_at).toISOString(),
    allDay: row.is_all_day === 1,
    location: row.location ?? undefined,
    level: row.level ?? undefined,
  }));

  return { tasks, meetings };
}

// ---------- 联系人日程聚合 ----------

export function listContactScheduleFrom(db: Db, contactId: number): ProjectSchedule {
  if (!Number.isInteger(contactId) || contactId <= 0) {
    return { tasks: [], meetings: [] };
  }

  const taskRows = db
    .prepare(
      `
      SELECT id, title, due_at, remind_at, is_all_day, is_important, status
      FROM tasks
      WHERE contact_id = ?
      ORDER BY CASE WHEN status = 'done' THEN 1 ELSE 0 END,
               CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
               due_at ASC, id ASC
      `,
    )
    .all(contactId) as {
    id: number;
    title: string;
    due_at: number | null;
    remind_at: number | null;
    is_all_day: number;
    is_important: number;
    status: string;
  }[];

  const meetingRows = db
    .prepare(
      `
      SELECT id, title, start_at, end_at, is_all_day, location, level
      FROM project_meetings
      WHERE contact_id = ?
      ORDER BY start_at ASC, id ASC
      `,
    )
    .all(contactId) as {
    id: number;
    title: string;
    start_at: number;
    end_at: number | null;
    is_all_day: number;
    location: string | null;
    level: string | null;
  }[];

  const tasks: AreaTaskItem[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: toIso(row.due_at),
    remindAt: toIso(row.remind_at),
    allDay: row.is_all_day === 1,
    important: row.is_important === 1,
    status: row.status,
  }));

  const meetings: AreaMeetingItem[] = meetingRows.map((row) => ({
    id: row.id,
    title: row.title,
    startAt: new Date(row.start_at).toISOString(),
    endAt: row.end_at == null ? undefined : new Date(row.end_at).toISOString(),
    allDay: row.is_all_day === 1,
    location: row.location ?? undefined,
    level: row.level ?? undefined,
  }));

  return { tasks, meetings };
}

// ---------- IPC 包装 ----------

export function createTask(input: TaskScheduleInput): number {
  return createTaskFrom(getDb(), input);
}

export function updateTask(id: number, input: TaskScheduleInput): void {
  updateTaskFrom(getDb(), id, input);
}

export function deleteTask(id: number): void {
  deleteTaskFrom(getDb(), id);
}

export function setTaskStatus(id: number, status: 'done' | 'open'): void {
  setTaskStatusFrom(getDb(), id, status);
}

export function createMeeting(input: MeetingScheduleInput): number {
  return createMeetingFrom(getDb(), input);
}

export function updateMeeting(id: number, input: MeetingScheduleInput): void {
  updateMeetingFrom(getDb(), id, input);
}

export function deleteMeeting(id: number): void {
  deleteMeetingFrom(getDb(), id);
}

export function listProjectSchedule(projectId: number): ProjectSchedule {
  return listProjectScheduleFrom(getDb(), projectId);
}

export function listContactSchedule(contactId: number): ProjectSchedule {
  return listContactScheduleFrom(getDb(), contactId);
}
