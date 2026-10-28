// 日历服务：聚合任务截止、会议与需关注的待办提醒
import { getDb } from '../db';
import {
  mapMeetingToEvent,
  mapTaskToEvents,
  parseCalendarRange,
  sortCalendarEvents,
} from '../../../src/shared/calendar';
import type {
  AreaDetail,
  AreaMeetingItem,
  AreaTaskItem,
  CalendarEvent,
  CalendarMeetingRow,
  CalendarRange,
  CalendarTaskRow,
} from '@shared/calendar';

interface TaskDbRow {
  id: number;
  title: string;
  project_id: number | null;
  area_id: number | null;
  due_at: number | null;
  remind_at: number | null;
  is_all_day: number;
  is_important: number;
  status: string;
}

interface MeetingDbRow {
  id: number;
  project_id: number | null;
  area_id: number | null;
  title: string;
  start_at: number;
  end_at: number | null;
  is_all_day: number;
  location: string | null;
  level: string | null;
}

export function listEvents(range: CalendarRange): CalendarEvent[] {
  const { startMs, endMs } = parseCalendarRange(range);
  const db = getDb();

  const taskRows = db
    .prepare(
      `
      SELECT id, title, project_id, area_id, due_at, remind_at, is_all_day, is_important, status
      FROM tasks
      WHERE status <> 'done'
        AND (
          (due_at IS NOT NULL AND due_at >= ? AND due_at < ?)
          OR (remind_at IS NOT NULL AND remind_at >= ? AND remind_at < ?)
        )
      `,
    )
    .all(startMs, endMs, startMs, endMs) as TaskDbRow[];

  const meetingRows = db
    .prepare(
      `
      SELECT id, project_id, area_id, title, start_at, end_at, is_all_day, location, level
      FROM project_meetings
      WHERE start_at < ?
        AND (
          (end_at IS NOT NULL AND end_at > ?)
          OR (end_at IS NULL AND start_at >= ?)
        )
      `,
    )
    .all(endMs, startMs, startMs) as MeetingDbRow[];

  const events: CalendarEvent[] = [];

  for (const row of taskRows) {
    const task: CalendarTaskRow = {
      id: row.id,
      title: row.title,
      projectId: row.project_id,
      areaId: row.area_id,
      dueAt: row.due_at,
      remindAt: row.remind_at,
      isAllDay: row.is_all_day === 1 ? 1 : 0,
      isImportant: row.is_important === 1 ? 1 : 0,
      status: row.status,
    };
    events.push(...mapTaskToEvents(task, startMs, endMs));
  }

  for (const row of meetingRows) {
    const meeting: CalendarMeetingRow = {
      id: row.id,
      projectId: row.project_id,
      areaId: row.area_id,
      title: row.title,
      startAt: row.start_at,
      endAt: row.end_at,
      isAllDay: row.is_all_day === 1 ? 1 : 0,
      location: row.location,
      level: row.level,
    };
    const event = mapMeetingToEvent(meeting, startMs, endMs);
    if (event) events.push(event);
  }

  return sortCalendarEvents(events);
}

interface AreaDbRow {
  id: number;
  name: string;
}

interface AreaTaskDbRow {
  id: number;
  title: string;
  due_at: number | null;
  remind_at: number | null;
  is_all_day: number;
  is_important: number;
  status: string;
}

interface AreaMeetingDbRow {
  id: number;
  title: string;
  start_at: number;
  end_at: number | null;
  is_all_day: number;
  location: string | null;
  level: string | null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** 领域详情 — 只读聚合，供日历事件跳转后的最小页面使用 */
export function getAreaDetail(areaId: number): AreaDetail {
  if (!Number.isInteger(areaId) || areaId <= 0) {
    return { area: null, tasks: [], meetings: [] };
  }

  const db = getDb();
  const area = db
    .prepare('SELECT id, name FROM areas WHERE id = ?')
    .get(areaId) as AreaDbRow | undefined;

  if (!area) {
    return { area: null, tasks: [], meetings: [] };
  }

  const taskRows = db
    .prepare(
      `
      SELECT id, title, due_at, remind_at, is_all_day, is_important, status
      FROM tasks
      WHERE area_id = ?
      ORDER BY CASE WHEN status = 'done' THEN 1 ELSE 0 END,
               CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
               due_at ASC, id ASC
      `,
    )
    .all(areaId) as AreaTaskDbRow[];

  const meetingRows = db
    .prepare(
      `
      SELECT id, title, start_at, end_at, is_all_day, location, level
      FROM project_meetings
      WHERE area_id = ?
      ORDER BY start_at ASC, id ASC
      `,
    )
    .all(areaId) as AreaMeetingDbRow[];

  const tasks: AreaTaskItem[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: row.due_at == null ? undefined : toIso(row.due_at),
    remindAt: row.remind_at == null ? undefined : toIso(row.remind_at),
    allDay: row.is_all_day === 1,
    important: row.is_important === 1,
    status: row.status,
  }));

  const meetings: AreaMeetingItem[] = meetingRows.map((row) => ({
    id: row.id,
    title: row.title,
    startAt: toIso(row.start_at),
    endAt: row.end_at == null ? undefined : toIso(row.end_at),
    allDay: row.is_all_day === 1,
    location: row.location ?? undefined,
    level: row.level ?? undefined,
  }));

  return {
    area: { id: area.id, name: area.name },
    tasks,
    meetings,
  };
}
