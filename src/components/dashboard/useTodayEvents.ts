// 拉取今日日历事件（任务截止/提醒 + 会议），供总览页各卡片共享
import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@shared/calendar';
import { calendarApi } from '@/lib/ipc';

function todayRange(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useTodayEvents(): CalendarEvent[] {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    calendarApi
      .listEvents(todayRange())
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return events;
}
