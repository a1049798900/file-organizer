import { describe, expect, it } from 'vitest';
import {
  groupEventsByDay,
  mapMeetingToEvent,
  mapTaskToEvents,
  parseCalendarRange,
  sortCalendarEvents,
  toLocalDateKey,
} from '../src/shared/calendar';
import type { CalendarMeetingRow, CalendarTaskRow } from '../src/shared/calendar';

function localMs(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const startMs = localMs(2026, 10, 25);
const endMs = localMs(2026, 10, 26);

const baseTask: CalendarTaskRow = {
  id: 1,
  title: '写材料',
  projectId: null,
  areaId: null,
  dueAt: null,
  remindAt: null,
  isAllDay: 0,
  isImportant: 0,
  status: 'open',
};

const baseMeeting: CalendarMeetingRow = {
  id: 9,
  projectId: null,
  areaId: null,
  title: '项目评审',
  startAt: localMs(2026, 10, 25, 10),
  endAt: localMs(2026, 10, 25, 11),
  isAllDay: 0,
  location: null,
  level: null,
};

describe('calendar task mapping', () => {
  it('maps a task due date to task_due', () => {
    const dueAt = localMs(2026, 10, 25, 18);
    const events = mapTaskToEvents({ ...baseTask, dueAt }, startMs, endMs);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'task:1:due',
      type: 'task_due',
      title: '写材料',
      startAt: new Date(dueAt).toISOString(),
      sourceTable: 'tasks',
      sourceId: '1',
    });
  });

  it('maps an important reminder to todo_reminder', () => {
    const remindAt = localMs(2026, 10, 25, 9);
    const events = mapTaskToEvents(
      { ...baseTask, remindAt, isImportant: 1 },
      startMs,
      endMs,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'task:1:reminder',
      type: 'todo_reminder',
      startAt: new Date(remindAt).toISOString(),
      meta: { remindAt: new Date(remindAt).toISOString() },
    });
  });

  it('includes reminders regardless of importance', () => {
    const remindAt = localMs(2026, 10, 25, 9);
    const events = mapTaskToEvents({ ...baseTask, remindAt }, startMs, endMs);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('todo_reminder');
  });

  it('merges due and reminder on the same local day', () => {
    const dueAt = localMs(2026, 10, 25, 18);
    const remindAt = localMs(2026, 10, 25, 9);
    const events = mapTaskToEvents(
      { ...baseTask, dueAt, remindAt, isImportant: 1 },
      startMs,
      endMs,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task_due');
    expect(events[0].title).toBe('写材料（截止 + 提醒）');
    expect(events[0].startAt).toBe(new Date(dueAt).toISOString());
    expect(events[0].meta?.merged).toBe(true);
    expect(events[0].meta?.remindAt).toBe(new Date(remindAt).toISOString());
  });

  it('keeps due and reminder separate on different local days', () => {
    const dueAt = localMs(2026, 10, 25, 18);
    const remindAt = localMs(2026, 10, 24, 9);
    const rangeStart = localMs(2026, 10, 24);
    const events = mapTaskToEvents(
      { ...baseTask, dueAt, remindAt, isImportant: 1 },
      rangeStart,
      endMs,
    );

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.type).sort()).toEqual(['task_due', 'todo_reminder']);
    expect(events.every((event) => !event.meta?.merged)).toBe(true);
  });

  it('excludes done tasks', () => {
    const dueAt = localMs(2026, 10, 25, 18);
    const events = mapTaskToEvents(
      { ...baseTask, dueAt, status: 'done' },
      startMs,
      endMs,
    );
    expect(events).toHaveLength(0);
  });

  it('keeps all-day and ownership fields', () => {
    const dueAt = localMs(2026, 10, 25, 18);
    const events = mapTaskToEvents(
      { ...baseTask, dueAt, isAllDay: 1, projectId: 7, areaId: 3 },
      startMs,
      endMs,
    );

    expect(events[0]).toMatchObject({
      allDay: true,
      projectId: '7',
      areaId: '3',
    });
  });

  it('uses an inclusive start and exclusive end', () => {
    expect(mapTaskToEvents({ ...baseTask, dueAt: startMs }, startMs, endMs)).toHaveLength(1);
    expect(mapTaskToEvents({ ...baseTask, dueAt: endMs }, startMs, endMs)).toHaveLength(0);
  });
});

describe('calendar meeting mapping', () => {
  it('maps a meeting with time, location and level', () => {
    const event = mapMeetingToEvent(
      {
        ...baseMeeting,
        projectId: 2,
        location: '3 楼会议室',
        level: '重要',
      },
      startMs,
      endMs,
    );

    expect(event).toMatchObject({
      id: 'meeting:9',
      type: 'meeting',
      title: '项目评审',
      projectId: '2',
      startAt: new Date(baseMeeting.startAt).toISOString(),
      endAt: new Date(baseMeeting.endAt as number).toISOString(),
      sourceTable: 'project_meetings',
      sourceId: '9',
      meta: { location: '3 楼会议室', level: '重要' },
    });
  });

  it('excludes meetings outside the range', () => {
    expect(
      mapMeetingToEvent(
        {
          ...baseMeeting,
          startAt: localMs(2026, 10, 24, 10),
          endAt: localMs(2026, 10, 24, 11),
        },
        startMs,
        endMs,
      ),
    ).toBeNull();
  });

  it('includes a cross-day meeting that overlaps the range', () => {
    const event = mapMeetingToEvent(
      {
        ...baseMeeting,
        startAt: localMs(2026, 10, 24, 22),
        endAt: localMs(2026, 10, 25, 9),
      },
      startMs,
      endMs,
    );

    expect(event).not.toBeNull();
    expect(event?.startAt).toBe(new Date(localMs(2026, 10, 24, 22)).toISOString());
    expect(event?.endAt).toBe(new Date(localMs(2026, 10, 25, 9)).toISOString());
  });

  it('excludes meetings that end before the range starts', () => {
    expect(
      mapMeetingToEvent(
        {
          ...baseMeeting,
          startAt: localMs(2026, 10, 24, 20),
          endAt: localMs(2026, 10, 24, 21),
        },
        startMs,
        endMs,
      ),
    ).toBeNull();

    // 结束时间正好等于范围起点也视为不重叠
    expect(
      mapMeetingToEvent(
        {
          ...baseMeeting,
          startAt: localMs(2026, 10, 24, 20),
          endAt: startMs,
        },
        startMs,
        endMs,
      ),
    ).toBeNull();
  });
});

describe('calendar range and sorting', () => {
  it('rejects invalid ranges', () => {
    expect(() => parseCalendarRange({ start: 'bad', end: 'bad' })).toThrow('无效的日历时间范围');
    expect(() =>
      parseCalendarRange({
        start: new Date(endMs).toISOString(),
        end: new Date(startMs).toISOString(),
      }),
    ).toThrow('无效的日历时间范围');
  });

  it('sorts by start time', () => {
    const later = mapTaskToEvents(
      { ...baseTask, id: 2, dueAt: localMs(2026, 10, 25, 18) },
      startMs,
      endMs,
    )[0];
    const earlier = mapTaskToEvents(
      { ...baseTask, id: 3, dueAt: localMs(2026, 10, 25, 9) },
      startMs,
      endMs,
    )[0];

    expect(sortCalendarEvents([later, earlier])[0].id).toBe('task:3:due');
  });

  it('uses local date keys to avoid UTC day shifts', () => {
    expect(toLocalDateKey(localMs(2026, 10, 25, 23, 59))).toBe('2026-10-25');
  });
});

describe('calendar day grouping', () => {
  it('expands a cross-day meeting to every covered day', () => {
    const event = mapMeetingToEvent(
      {
        ...baseMeeting,
        startAt: localMs(2026, 10, 24, 22),
        endAt: localMs(2026, 10, 25, 9),
      },
      localMs(2026, 10, 24),
      endMs,
    )!;

    const grouped = groupEventsByDay([event], localMs(2026, 10, 24), endMs);

    expect([...grouped.keys()]).toEqual(['2026-10-24', '2026-10-25']);
    expect(grouped.get('2026-10-25')).toEqual([event]);
  });

  it('keeps an event ending at midnight on its start day only', () => {
    const event = mapMeetingToEvent(
      {
        ...baseMeeting,
        startAt: localMs(2026, 10, 25, 20),
        endAt: localMs(2026, 10, 26, 0),
      },
      startMs,
      endMs,
    )!;

    const grouped = groupEventsByDay([event], startMs, endMs);

    expect([...grouped.keys()]).toEqual(['2026-10-25']);
  });

  it('clamps expanded days to the requested range', () => {
    const event = mapMeetingToEvent(
      {
        ...baseMeeting,
        startAt: localMs(2026, 10, 24, 22),
        endAt: localMs(2026, 10, 27, 9),
      },
      localMs(2026, 10, 24),
      localMs(2026, 10, 27),
    )!;

    const grouped = groupEventsByDay([event], startMs, endMs);

    expect([...grouped.keys()]).toEqual(['2026-10-25']);
  });
});
