import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  locked: false,
  supported: true,
  now: 0,
  beeps: 0,
  tasks: [] as { id: number; title: string; due_at: number }[],
  reminders: [] as { id: number; title: string; remind_at: number }[],
  meetings: [] as { id: number; title: string; start_at: number; location: string | null }[],
  notifications: [] as { title: string; body: string }[],
}));

vi.mock('electron', () => {
  class MockNotification {
    static isSupported(): boolean {
      return state.supported;
    }

    constructor(options: { title: string; body: string }) {
      state.notifications.push({ title: options.title, body: options.body });
    }

    on(): void {}

    show(): void {}
  }

  return {
    Notification: MockNotification,
    BrowserWindow: { getAllWindows: () => [] },
    shell: {
      beep: () => {
        state.beeps += 1;
      },
    },
  };
});

vi.mock('../electron/main/db', () => ({
  // 按真实 SQL 的时间范围参数过滤，保证漏报/误报用例有效
  getDb: () => ({
    prepare: (sql: string) => ({
      all: (lo: number, hi: number) => {
        if (sql.includes('remind_at')) {
          return state.reminders.filter((r) => r.remind_at > lo && r.remind_at <= hi);
        }
        if (sql.includes('due_at')) {
          return state.tasks.filter((t) => t.due_at > lo && t.due_at <= hi);
        }
        return state.meetings.filter((m) => m.start_at > lo && m.start_at <= hi);
      },
    }),
  }),
}));

vi.mock('../electron/main/services/settingsSvc', () => ({
  getSetting: () => '15',
}));

vi.mock('../electron/main/services/lockSvc', () => ({
  getAppLocked: () => state.locked,
}));

import { startReminderScheduler, stopReminderScheduler } from '../electron/main/services/reminderSvc';
import { CALENDAR_REMIND_MINUTE_OPTIONS, DEFAULT_CALENDAR_REMIND_MINUTES, parseRemindMinutes } from '../src/shared/reminder';

describe('remind minutes parsing', () => {
  it('falls back to 15 for missing or invalid values', () => {
    expect(parseRemindMinutes(null)).toBe(DEFAULT_CALENDAR_REMIND_MINUTES);
    expect(parseRemindMinutes(undefined)).toBe(DEFAULT_CALENDAR_REMIND_MINUTES);
    expect(parseRemindMinutes('')).toBe(DEFAULT_CALENDAR_REMIND_MINUTES);
    expect(parseRemindMinutes('abc')).toBe(DEFAULT_CALENDAR_REMIND_MINUTES);
    expect(parseRemindMinutes('7')).toBe(DEFAULT_CALENDAR_REMIND_MINUTES);
  });

  it('accepts every configured option', () => {
    for (const minutes of CALENDAR_REMIND_MINUTE_OPTIONS) {
      expect(parseRemindMinutes(String(minutes))).toBe(minutes);
    }
  });
});

describe('reminder scheduler', () => {
  const MINUTE = 60_000;

  beforeEach(() => {
    state.locked = false;
    state.supported = true;
    state.beeps = 0;
    state.tasks = [];
    state.reminders = [];
    state.meetings = [];
    state.notifications = [];
    state.now = new Date(2026, 9, 25, 10, 0, 0).getTime();
    vi.useFakeTimers();
    vi.setSystemTime(state.now);
  });

  afterEach(() => {
    stopReminderScheduler();
    vi.useRealTimers();
  });

  it('notifies tasks due after the configured lead time', () => {
    state.tasks = [{ id: 11, title: '写材料', due_at: state.now + 15 * MINUTE }];

    startReminderScheduler();

    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toEqual({
      title: '任务截止：写材料',
      body: '截止时间 10-25 10:15',
    });
  });

  it('notifies meetings and important reminders', () => {
    state.meetings = [
      { id: 12, title: '项目评审', start_at: state.now + 15 * MINUTE, location: '3 楼会议室' },
    ];
    state.reminders = [{ id: 13, title: '跟进合同', remind_at: state.now + 30_000 }];

    startReminderScheduler();

    expect(state.notifications.map((item) => item.title)).toEqual([
      '待办提醒：跟进合同',
      '会议提醒：项目评审',
    ]);
    expect(state.notifications.some((item) => item.body.includes('3 楼会议室'))).toBe(true);
  });

  it('plays a beep together with the notification', () => {
    state.tasks = [{ id: 21, title: '写材料', due_at: state.now + 15 * MINUTE }];

    startReminderScheduler();

    expect(state.beeps).toBe(1);
  });

  it('notifies a meeting created less than the lead time before its start', () => {
    // 提前量 15 分钟，会议 1 分钟后开始：提醒时刻已过，应立即补提醒
    state.meetings = [
      { id: 22, title: '临时站会', start_at: state.now + 1 * MINUTE, location: null },
    ];

    startReminderScheduler();

    expect(state.notifications.map((item) => item.title)).toEqual(['会议提醒：临时站会']);
    expect(state.beeps).toBe(1);
  });

  it('does not notify events beyond the grace window', () => {
    // 10 分钟前已开始，超出 5 分钟宽限
    state.meetings = [
      { id: 23, title: '已开始的会议', start_at: state.now - 10 * MINUTE, location: null },
    ];

    startReminderScheduler();

    expect(state.notifications).toHaveLength(0);
  });

  it('does not notify events whose reminder time has not arrived', () => {
    // 2 小时后开始，提醒时刻在 1 小时 45 分之后，不应触发
    state.meetings = [
      { id: 24, title: '远期会议', start_at: state.now + 2 * 60 * MINUTE, location: null },
    ];

    startReminderScheduler();

    expect(state.notifications).toHaveLength(0);
  });

  it('hides schedule details when the app is locked', () => {
    state.locked = true;
    state.tasks = [{ id: 14, title: '写材料', due_at: state.now + 15 * MINUTE }];

    startReminderScheduler();

    expect(state.notifications).toEqual([
      { title: 'Weave 工作台', body: '有一条日程提醒，解锁后查看详情。' },
    ]);
  });

  it('does not send the same reminder twice', () => {
    state.tasks = [{ id: 15, title: '写材料', due_at: state.now + 15 * MINUTE }];

    startReminderScheduler();
    expect(state.notifications).toHaveLength(1);

    // 重新启动调度器会立即再次检查，同一 key 不应重复通知
    stopReminderScheduler();
    startReminderScheduler();

    expect(state.notifications).toHaveLength(1);
  });

  it('skips notification gracefully when the system does not support it', () => {
    state.supported = false;
    state.tasks = [{ id: 16, title: '写材料', due_at: state.now + 15 * MINUTE }];

    expect(() => startReminderScheduler()).not.toThrow();
    expect(state.notifications).toHaveLength(0);
    // isSupported 为 false 时也不应播放提示音
    expect(state.beeps).toBe(0);
  });
});
