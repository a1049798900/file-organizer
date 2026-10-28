// 日历日期工具 — 使用原生 Date，按本地时区计算视图范围与展示文本

export type CalendarViewMode = 'month' | 'week' | 'day';

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
export const WEEKDAY_LABELS_SUN_FIRST = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** 当天 00:00:00.000 */
export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return next;
}

/** 周一为一周起点 */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function startOfMonth(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 本地日期键 YYYY-MM-DD */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateTitle(date: Date): string {
  const weekday = WEEKDAY_LABELS_SUN_FIRST[date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 周${weekday}`;
}

export interface DateRange {
  /** 包含 */
  start: Date;
  /** 不包含 */
  end: Date;
}

/** 月视图取 6 周网格（周一开头），保证跨月日期与固定行数 */
export function getMonthGridRange(anchor: Date): DateRange {
  const start = startOfWeek(startOfMonth(anchor));
  return { start, end: addDays(start, 42) };
}

export function getViewRange(mode: CalendarViewMode, anchor: Date): DateRange {
  if (mode === 'month') return getMonthGridRange(anchor);
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfDay(anchor);
  return { start, end: addDays(start, 1) };
}

/** 月视图网格中的 42 天 */
export function getMonthGridDays(anchor: Date): Date[] {
  const { start } = getMonthGridRange(anchor);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function formatRangeLabel(mode: CalendarViewMode, anchor: Date): string {
  if (mode === 'month') {
    return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
  }
  if (mode === 'day') {
    return formatDateTitle(anchor);
  }

  const days = getWeekDays(anchor);
  const first = days[0];
  const last = days[6];
  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.getFullYear()}年${first.getMonth() + 1}月${first.getDate()}日 – ${last.getFullYear()}年${last.getMonth() + 1}月${last.getDate()}日`;
  }
  return `${first.getFullYear()}年${first.getMonth() + 1}月${first.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`;
}

export function shiftAnchor(mode: CalendarViewMode, anchor: Date, step: number): Date {
  if (mode === 'month') return addMonths(anchor, step);
  if (mode === 'week') return addDays(anchor, step * 7);
  return addDays(anchor, step);
}
