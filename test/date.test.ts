import { describe, expect, it } from 'vitest';
import {
  formatDateTitle,
  formatRangeLabel,
  formatTime,
  getMonthGridDays,
  getMonthGridRange,
  getViewRange,
  isSameDay,
  shiftAnchor,
  startOfWeek,
  toDateKey,
} from '../src/lib/date';

function local(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const anchor = local(2026, 10, 25); // 周日

describe('calendar date helpers', () => {
  it('starts weeks on Monday', () => {
    expect(toDateKey(startOfWeek(anchor))).toBe('2026-10-19');
  });

  it('builds a fixed six-week month grid', () => {
    const days = getMonthGridDays(anchor);

    expect(days).toHaveLength(42);
    expect(toDateKey(days[0])).toBe('2026-09-28');
    expect(toDateKey(days[41])).toBe('2026-11-08');

    const range = getMonthGridRange(anchor);
    expect(toDateKey(range.start)).toBe('2026-09-28');
    expect(toDateKey(range.end)).toBe('2026-11-09');
  });

  it('returns exclusive ranges for each view mode', () => {
    const month = getViewRange('month', anchor);
    const week = getViewRange('week', anchor);
    const day = getViewRange('day', anchor);

    expect(toDateKey(month.end)).toBe('2026-11-09');
    expect(toDateKey(week.start)).toBe('2026-10-19');
    expect(toDateKey(week.end)).toBe('2026-10-26');
    expect(toDateKey(day.start)).toBe('2026-10-25');
    expect(toDateKey(day.end)).toBe('2026-10-26');
  });

  it('shifts anchors by month, week and day', () => {
    expect(toDateKey(shiftAnchor('month', local(2026, 1, 31), 1))).toBe('2026-02-01');
    expect(toDateKey(shiftAnchor('week', anchor, 1))).toBe('2026-11-01');
    expect(toDateKey(shiftAnchor('week', anchor, -1))).toBe('2026-10-18');
    expect(toDateKey(shiftAnchor('day', anchor, -1))).toBe('2026-10-24');
  });

  it('uses local date keys and same-day comparison', () => {
    expect(toDateKey(local(2026, 10, 25, 23, 59))).toBe('2026-10-25');
    expect(isSameDay(local(2026, 10, 25, 0, 1), local(2026, 10, 25, 23, 59))).toBe(true);
    expect(isSameDay(anchor, local(2026, 10, 26))).toBe(false);
  });

  it('formats titles and range labels', () => {
    expect(formatDateTitle(anchor)).toBe('2026年10月25日 周日');
    expect(formatRangeLabel('month', anchor)).toBe('2026年10月');
    expect(formatRangeLabel('week', anchor)).toBe('2026年10月19日 – 10月25日');
    expect(formatRangeLabel('day', anchor)).toBe('2026年10月25日 周日');

    // 跨年周显示完整年份
    const crossYear = local(2027, 1, 1);
    expect(toDateKey(startOfWeek(crossYear))).toBe('2026-12-28');
    expect(formatRangeLabel('week', crossYear)).toBe('2026年12月28日 – 2027年1月3日');
  });

  it('formats ISO time in local timezone', () => {
    expect(formatTime(local(2026, 10, 25, 9, 5).toISOString())).toBe('09:05');
  });
});
