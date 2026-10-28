// 日历事件共享类型与纯映射逻辑
// 只处理任务/会议数据，不涉及文件内容与时间线状态事件

export type CalendarEventType = 'task_due' | 'meeting' | 'todo_reminder';

export interface CalendarEventMeta {
  location?: string;
  level?: string;
  remindAt?: string;
  dueAt?: string;
  merged?: boolean;
  important?: boolean;
  status?: string;
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  projectId?: string;
  areaId?: string;
  sourceTable: 'tasks' | 'project_meetings';
  sourceId: string;
  meta?: CalendarEventMeta;
}

export interface CalendarRange {
  /** ISO 时间，包含 */
  start: string;
  /** ISO 时间，不包含 */
  end: string;
}

/** 领域详情 — 只读，供日历事件跳转后的最小页面使用 */
export interface CalendarArea {
  id: number;
  name: string;
}

export interface AreaTaskItem {
  id: number;
  title: string;
  dueAt?: string;
  remindAt?: string;
  allDay: boolean;
  important: boolean;
  status: string;
}

export interface AreaMeetingItem {
  id: number;
  title: string;
  startAt: string;
  endAt?: string;
  allDay: boolean;
  location?: string;
  level?: string;
}

export interface AreaDetail {
  area: CalendarArea | null;
  tasks: AreaTaskItem[];
  meetings: AreaMeetingItem[];
}

/** 示例数据填充结果，供设置页反馈 */
export interface SampleDataResult {
  areas: number;
  tasks: number;
  meetings: number;
}

/** 新建/编辑任务表单数据 */
export interface TaskScheduleInput {
  title: string;
  projectId: number | null;
  /** 关联联系人（从联系人详情页创建时带入；编辑时保留原值） */
  contactId?: number | null;
  dueAt: string | null;
  remindAt: string | null;
  allDay: boolean;
  important: boolean;
}

/** 新建/编辑会议表单数据 */
export interface MeetingScheduleInput {
  title: string;
  projectId: number | null;
  /** 关联联系人（从联系人详情页创建时带入；编辑时保留原值） */
  contactId?: number | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
  level: string | null;
}

/** 项目详情页的任务/会议聚合结果 */
export interface ProjectSchedule {
  tasks: AreaTaskItem[];
  meetings: AreaMeetingItem[];
}

export interface CalendarTaskRow {
  id: number;
  title: string;
  projectId: number | null;
  areaId: number | null;
  dueAt: number | null;
  remindAt: number | null;
  isAllDay: 0 | 1;
  isImportant: 0 | 1;
  status: string;
}

export interface CalendarMeetingRow {
  id: number;
  projectId: number | null;
  areaId: number | null;
  title: string;
  startAt: number;
  endAt: number | null;
  isAllDay: 0 | 1;
  location: string | null;
  level: string | null;
}

export function parseCalendarRange(range: CalendarRange): { startMs: number; endMs: number } {
  if (!range || typeof range.start !== 'string' || typeof range.end !== 'string') {
    throw new Error('无效的日历时间范围');
  }
  const startMs = Date.parse(range.start);
  const endMs = Date.parse(range.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('无效的日历时间范围');
  }
  return { startMs, endMs };
}

export function toLocalDateKey(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function toOptionalId(value: number | null): string | undefined {
  return value == null ? undefined : String(value);
}

export function mapTaskToEvents(
  task: CalendarTaskRow,
  startMs: number,
  endMs: number,
): CalendarEvent[] {
  if (task.status === 'done') return [];

  const events: CalendarEvent[] = [];

  // 两类事件都带上完整的截止/提醒/重要信息，编辑任一条都不会丢失另一半数据
  const commonMeta = {
    dueAt: task.dueAt == null ? undefined : toIso(task.dueAt),
    remindAt: task.remindAt == null ? undefined : toIso(task.remindAt),
    important: task.isImportant === 1,
    status: task.status,
  };

  if (task.dueAt != null && task.dueAt >= startMs && task.dueAt < endMs) {
    events.push({
      id: `task:${task.id}:due`,
      type: 'task_due',
      title: task.title,
      startAt: toIso(task.dueAt),
      allDay: task.isAllDay === 1,
      projectId: toOptionalId(task.projectId),
      areaId: toOptionalId(task.areaId),
      sourceTable: 'tasks',
      sourceId: String(task.id),
      meta: { ...commonMeta },
    });
  }

  if (task.remindAt != null && task.remindAt >= startMs && task.remindAt < endMs) {
    events.push({
      id: `task:${task.id}:reminder`,
      type: 'todo_reminder',
      title: task.title,
      startAt: toIso(task.remindAt),
      allDay: task.isAllDay === 1,
      projectId: toOptionalId(task.projectId),
      areaId: toOptionalId(task.areaId),
      sourceTable: 'tasks',
      sourceId: String(task.id),
      meta: { ...commonMeta },
    });
  }

  return mergeSameDayTaskEvents(task, events);
}

function mergeSameDayTaskEvents(
  task: CalendarTaskRow,
  events: CalendarEvent[],
): CalendarEvent[] {
  if (events.length < 2) return events;

  const dueEvent = events.find((event) => event.type === 'task_due');
  const reminderEvent = events.find((event) => event.type === 'todo_reminder');
  if (!dueEvent || !reminderEvent) return events;

  const dueDateKey = toLocalDateKey(Date.parse(dueEvent.startAt));
  const reminderDateKey = toLocalDateKey(Date.parse(reminderEvent.startAt));
  if (dueDateKey !== reminderDateKey) return events;

  return [
    {
      ...dueEvent,
      title: `${task.title}（截止 + 提醒）`,
      meta: { ...dueEvent.meta, remindAt: reminderEvent.startAt, merged: true },
    },
  ];
}

export function mapMeetingToEvent(
  meeting: CalendarMeetingRow,
  startMs: number,
  endMs: number,
): CalendarEvent | null {
  const hasSpan = meeting.endAt != null && meeting.endAt > meeting.startAt;
  // 有跨度的会议按区间重叠判定，单点会议仍要求开始时间落在范围内
  if (hasSpan) {
    if (meeting.startAt >= endMs || meeting.endAt! <= startMs) return null;
  } else if (meeting.startAt < startMs || meeting.startAt >= endMs) {
    return null;
  }

  return {
    id: `meeting:${meeting.id}`,
    type: 'meeting',
    title: meeting.title,
    startAt: toIso(meeting.startAt),
    endAt: meeting.endAt == null ? undefined : toIso(meeting.endAt),
    allDay: meeting.isAllDay === 1,
    projectId: toOptionalId(meeting.projectId),
    areaId: toOptionalId(meeting.areaId),
    sourceTable: 'project_meetings',
    sourceId: String(meeting.id),
    meta: {
      location: meeting.location ?? undefined,
      level: meeting.level ?? undefined,
    },
  };
}

export function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const diff = Date.parse(a.startAt) - Date.parse(b.startAt);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/**
 * 将事件展开到它覆盖的每个本地日期，供日历按天渲染。
 * end 为不包含：结束时间正好是次日 00:00 时只计入开始日。
 */
export function groupEventsByDay(
  events: CalendarEvent[],
  rangeStartMs: number,
  rangeEndMs: number,
): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const start = Date.parse(event.startAt);
    if (!Number.isFinite(start)) continue;

    const rawEnd = event.endAt ? Date.parse(event.endAt) : start;
    const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start;
    const visibleStart = Math.max(start, rangeStartMs);
    const visibleEnd = Math.min(end, rangeEndMs);
    if (visibleEnd < visibleStart) continue;

    let cursor = startOfLocalDay(visibleStart);
    const lastDay = startOfLocalDay(Math.max(visibleEnd - 1, visibleStart));
    while (cursor <= lastDay) {
      const key = toLocalDateKey(cursor);
      const list = grouped.get(key);
      if (list) {
        list.push(event);
      } else {
        grouped.set(key, [event]);
      }
      cursor = addLocalDays(cursor, 1);
    }
  }

  return grouped;
}
