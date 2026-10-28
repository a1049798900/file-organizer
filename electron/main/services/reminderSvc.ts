// 日历提醒调度 — 每 30 秒检查一次提醒时刻已到的日程并发送桌面通知
// 应用锁定时只显示笼统内容，不暴露日程标题与地点
import { BrowserWindow, Notification, shell } from 'electron';
import { getDb } from '../db';
import { getSetting } from './settingsSvc';
import { getAppLocked } from './lockSvc';
import { CH } from '../../../src/shared/ipc-contract';
import {
  CALENDAR_REMIND_MINUTES_KEY,
  parseRemindMinutes,
} from '../../../src/shared/reminder';

const CHECK_INTERVAL_MS = 30_000;
/** 触发提前量：提醒时刻到达前最多提前 60s 触发（配合 30s 轮询保证不遗漏） */
const LOOKAHEAD_MS = 60_000;
/** 宽限：事件刚开始不久（如应用刚启动、或创建时提醒时刻已过）仍补提醒一次 */
const GRACE_MS = 5 * 60_000;
const MAX_REMEMBERED = 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let notifiedKeys = new Set<string>();
let warnedUnsupported = false;

interface TaskDueRow {
  id: number;
  title: string;
  due_at: number;
}

interface TaskRemindRow {
  id: number;
  title: string;
  remind_at: number;
}

interface MeetingRow {
  id: number;
  title: string;
  start_at: number;
  location: string | null;
}

function formatAt(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function remember(key: string): boolean {
  if (notifiedKeys.has(key)) return false;

  notifiedKeys.add(key);
  if (notifiedKeys.size > MAX_REMEMBERED) {
    // 保留最近一半，避免长时间运行时无限增长
    const keys = Array.from(notifiedKeys);
    notifiedKeys = new Set(keys.slice(Math.floor(keys.length / 2)));
  }
  return true;
}

function sendNotification(key: string, title: string, body: string, at: number): void {
  if (!remember(key)) return;
  if (!Notification.isSupported()) {
    if (!warnedUnsupported) {
      warnedUnsupported = true;
      console.warn('[reminder] 当前系统不支持桌面通知（Notification.isSupported() = false）');
    }
    return;
  }

  // 系统提示音：Windows 蜂鸣 / macOS 系统音
  shell.beep();

  const locked = getAppLocked();
  const notification = new Notification({
    title: locked ? 'Weave 工作台' : title,
    body: locked ? '有一条日程提醒，解锁后查看详情。' : body,
  });

  notification.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    // 通知渲染进程跳转到对应日期的日历
    win.webContents.send(CH.CALENDAR_REMINDER_OPEN, { at });
  });

  notification.show();
}

function checkReminders(): void {
  const now = Date.now();
  const offsetMs = parseRemindMinutes(getSetting(CALENDAR_REMIND_MINUTES_KEY)) * 60_000;
  const db = getDb();

  // 统一规则：提醒时刻（事件时间 − 提前量）已到（容许 60s 提前触发），
  // 且事件尚未结束太久（5 分钟宽限），配合去重 key 保证只提醒一次。
  // 这样「创建时距开始不足提前量」的日程也会在下一轮轮询立即提醒。
  const graceStart = now - GRACE_MS;

  const dueTasks = db
    .prepare(
      `
      SELECT id, title, due_at
      FROM tasks
      WHERE status <> 'done'
        AND due_at IS NOT NULL
        AND due_at > ? AND due_at <= ?
      `,
    )
    .all(graceStart, now + offsetMs + LOOKAHEAD_MS) as TaskDueRow[];

  for (const row of dueTasks) {
    // key 带上时间戳：编辑截止时间后可重新触发提醒
    sendNotification(
      `task:${row.id}:due:${row.due_at}`,
      `任务截止：${row.title}`,
      `截止时间 ${formatAt(row.due_at)}`,
      row.due_at,
    );
  }

  const remindTasks = db
    .prepare(
      `
      SELECT id, title, remind_at
      FROM tasks
      WHERE status <> 'done'
        AND remind_at IS NOT NULL
        AND remind_at > ? AND remind_at <= ?
      `,
    )
    .all(graceStart, now + LOOKAHEAD_MS) as TaskRemindRow[];

  for (const row of remindTasks) {
    sendNotification(
      `task:${row.id}:remind:${row.remind_at}`,
      `待办提醒：${row.title}`,
      `提醒时间 ${formatAt(row.remind_at)}`,
      row.remind_at,
    );
  }

  const meetings = db
    .prepare(
      `
      SELECT id, title, start_at, location
      FROM project_meetings
      WHERE start_at > ? AND start_at <= ?
      `,
    )
    .all(graceStart, now + offsetMs + LOOKAHEAD_MS) as MeetingRow[];

  for (const row of meetings) {
    sendNotification(
      `meeting:${row.id}:${row.start_at}`,
      `会议提醒：${row.title}`,
      `${formatAt(row.start_at)}${row.location ? ` · ${row.location}` : ''}`,
      row.start_at,
    );
  }
}

export function startReminderScheduler(): void {
  if (timer) return;

  const tick = () => {
    try {
      checkReminders();
    } catch (error) {
      console.error('[reminder] 检查日历提醒失败', error);
    }
  };

  tick();
  timer = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopReminderScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
