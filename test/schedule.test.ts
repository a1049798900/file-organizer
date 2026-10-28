import Database from 'better-sqlite3';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';
import {
  createMeetingFrom,
  createTaskFrom,
  deleteMeetingFrom,
  deleteTaskFrom,
  listProjectScheduleFrom,
  updateMeetingFrom,
  updateTaskFrom,
} from '../electron/main/services/scheduleSvc';
import type { MeetingScheduleInput, TaskScheduleInput } from '../src/shared/calendar';

function localIso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function createProject(db: Database.Database, name = '测试项目'): number {
  const now = Date.now();
  const info = db
    .prepare('INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(name, 'active', now, now);
  return Number(info.lastInsertRowid);
}

const baseTask: TaskScheduleInput = {
  title: '写材料',
  projectId: null,
  dueAt: localIso(2026, 10, 25, 18),
  remindAt: null,
  allDay: false,
  important: false,
};

const baseMeeting: MeetingScheduleInput = {
  title: '项目评审',
  projectId: null,
  startAt: localIso(2026, 10, 25, 10),
  endAt: localIso(2026, 10, 25, 11),
  allDay: false,
  location: '3 楼会议室',
  level: '重要',
};

describe('schedule service', () => {
  let db: Database.Database;
  let projectId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    projectId = createProject(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('tasks', () => {
    it('creates a task linked to a project and lists it', () => {
      const id = createTaskFrom(db, {
        ...baseTask,
        projectId,
        remindAt: localIso(2026, 10, 25, 9),
        allDay: true,
        important: true,
      });

      const { tasks } = listProjectScheduleFrom(db, projectId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id,
        title: '写材料',
        dueAt: baseTask.dueAt,
        remindAt: localIso(2026, 10, 25, 9),
        allDay: true,
        important: true,
        status: 'open',
      });
    });

    it('requires a due time or a reminder time', () => {
      expect(() =>
        createTaskFrom(db, { ...baseTask, dueAt: null, remindAt: null }),
      ).toThrow('请至少设置截止时间或提醒时间');
    });

    it('rejects an unknown project', () => {
      expect(() => createTaskFrom(db, { ...baseTask, projectId: 9999 })).toThrow(
        '关联项目不存在',
      );
    });

    it('rejects an empty title', () => {
      expect(() => createTaskFrom(db, { ...baseTask, title: '   ' })).toThrow(
        '标题不能为空',
      );
    });

    it('updates editable fields but keeps status', () => {
      const id = createTaskFrom(db, { ...baseTask, projectId });
      db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(id);

      updateTaskFrom(db, id, {
        title: '写材料（修订）',
        projectId: null,
        dueAt: null,
        remindAt: localIso(2026, 10, 26, 9),
        allDay: false,
        important: true,
      });

      const row = db
        .prepare(
          'SELECT title, project_id, due_at, remind_at, status, is_important FROM tasks WHERE id = ?',
        )
        .get(id) as {
        title: string;
        project_id: number | null;
        due_at: number | null;
        remind_at: number | null;
        status: string;
        is_important: number;
      };

      expect(row.title).toBe('写材料（修订）');
      expect(row.project_id).toBeNull();
      expect(row.due_at).toBeNull();
      expect(row.remind_at).toBe(Date.parse(localIso(2026, 10, 26, 9)));
      expect(row.status).toBe('done');
      expect(row.is_important).toBe(1);
    });

    it('throws when updating or deleting a missing task', () => {
      expect(() => updateTaskFrom(db, 9999, baseTask)).toThrow('任务不存在');
      expect(() => deleteTaskFrom(db, 9999)).toThrow('任务不存在');
    });

    it('deletes a task', () => {
      const id = createTaskFrom(db, { ...baseTask, projectId });
      deleteTaskFrom(db, id);
      expect(listProjectScheduleFrom(db, projectId).tasks).toHaveLength(0);
    });
  });

  describe('meetings', () => {
    it('creates an all-day meeting without an end time', () => {
      const id = createMeetingFrom(db, {
        ...baseMeeting,
        projectId,
        endAt: null,
        allDay: true,
      });

      const { meetings } = listProjectScheduleFrom(db, projectId);
      expect(meetings).toHaveLength(1);
      expect(meetings[0]).toMatchObject({
        id,
        title: '项目评审',
        startAt: baseMeeting.startAt,
        endAt: undefined,
        allDay: true,
        location: '3 楼会议室',
        level: '重要',
      });
    });

    it('rejects an end time earlier than the start time', () => {
      expect(() =>
        createMeetingFrom(db, {
          ...baseMeeting,
          startAt: localIso(2026, 10, 25, 11),
          endAt: localIso(2026, 10, 25, 10),
        }),
      ).toThrow('结束时间必须晚于开始时间');
    });

    it('requires a start time', () => {
      expect(() => createMeetingFrom(db, { ...baseMeeting, startAt: '' })).toThrow(
        '请选择会议开始时间',
      );
    });

    it('updates a meeting and keeps other projects untouched', () => {
      const otherProjectId = createProject(db, '另一个项目');
      const id = createMeetingFrom(db, { ...baseMeeting, projectId });

      updateMeetingFrom(db, id, {
        ...baseMeeting,
        projectId: otherProjectId,
        title: '项目评审（改期）',
        startAt: localIso(2026, 10, 26, 14),
        endAt: localIso(2026, 10, 26, 15),
      });

      expect(listProjectScheduleFrom(db, projectId).meetings).toHaveLength(0);
      const { meetings } = listProjectScheduleFrom(db, otherProjectId);
      expect(meetings).toHaveLength(1);
      expect(meetings[0]).toMatchObject({
        id,
        title: '项目评审（改期）',
        startAt: localIso(2026, 10, 26, 14),
        endAt: localIso(2026, 10, 26, 15),
      });
    });

    it('throws when updating or deleting a missing meeting', () => {
      expect(() => updateMeetingFrom(db, 9999, baseMeeting)).toThrow('会议不存在');
      expect(() => deleteMeetingFrom(db, 9999)).toThrow('会议不存在');
    });

    it('deletes a meeting', () => {
      const id = createMeetingFrom(db, { ...baseMeeting, projectId });
      deleteMeetingFrom(db, id);
      expect(listProjectScheduleFrom(db, projectId).meetings).toHaveLength(0);
    });
  });

  describe('project schedule aggregation', () => {
    it('returns only the requested project and sorts open tasks by due time', () => {
      const otherProjectId = createProject(db, '另一个项目');
      createTaskFrom(db, {
        ...baseTask,
        title: '晚任务',
        projectId,
        dueAt: localIso(2026, 10, 27, 18),
      });
      createTaskFrom(db, {
        ...baseTask,
        title: '早任务',
        projectId,
        dueAt: localIso(2026, 10, 26, 9),
      });
      createTaskFrom(db, { ...baseTask, title: '其他项目任务', projectId: otherProjectId });
      createMeetingFrom(db, { ...baseMeeting, projectId });
      createMeetingFrom(db, {
        ...baseMeeting,
        title: '其他项目会议',
        projectId: otherProjectId,
      });

      const schedule = listProjectScheduleFrom(db, projectId);
      expect(schedule.tasks.map((task) => task.title)).toEqual(['早任务', '晚任务']);
      expect(schedule.meetings.map((meeting) => meeting.title)).toEqual(['项目评审']);
    });

    it('returns an empty schedule for an invalid project id', () => {
      expect(listProjectScheduleFrom(db, 0)).toEqual({ tasks: [], meetings: [] });
      expect(listProjectScheduleFrom(db, 9999)).toEqual({ tasks: [], meetings: [] });
    });
  });
});
