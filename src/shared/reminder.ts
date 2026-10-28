// 日历提醒共享常量 — 主进程调度与设置界面共用

export const CALENDAR_REMIND_MINUTES_KEY = 'calendar_remind_minutes';

export const DEFAULT_CALENDAR_REMIND_MINUTES = 15;

export const CALENDAR_REMIND_MINUTE_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

/** 点击提醒通知后跳转日历的负载：at 为事件时间（Unix ms） */
export interface ReminderOpenPayload {
  at: number;
}

/** 解析设置值；非法或缺失时回退到默认 15 分钟 */
export function parseRemindMinutes(raw: string | null | undefined): number {
  const value = raw == null ? Number.NaN : Number.parseInt(raw, 10);
  return (CALENDAR_REMIND_MINUTE_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_CALENDAR_REMIND_MINUTES;
}
