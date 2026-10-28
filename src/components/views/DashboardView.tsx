// 每日总览 — Bento Box 网格布局聚合各功能模块
import { useMemo } from 'react';
import { sortCalendarEvents } from '@shared/calendar';
import { useTodayEvents } from '../dashboard/useTodayEvents';
import { DashboardHeader } from '../dashboard/DashboardHeader';
import { ActiveProjects } from '../dashboard/ActiveProjects';
import { TodayTasks } from '../dashboard/TodayTasks';
import { TodaySchedule } from '../dashboard/TodaySchedule';
import { InboxWidget } from '../dashboard/InboxWidget';
import { RecentFiles } from '../dashboard/RecentFiles';

export function DashboardView() {
  const events = useTodayEvents();

  const tasks = useMemo(
    () => events.filter((e) => e.type === 'task_due' || e.type === 'todo_reminder'),
    [events],
  );
  const meetings = useMemo(
    () => sortCalendarEvents(events.filter((e) => e.type === 'meeting')),
    [events],
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-panel">
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        <DashboardHeader taskCount={tasks.length} meetingCount={meetings.length} />

        {/* Bento 网格：活跃项目占 2 列，其余各占 1 列 */}
        <div className="grid grid-cols-3 gap-6">
          <ActiveProjects />
          <TodayTasks tasks={tasks} />
          <TodaySchedule meetings={meetings} />
          <InboxWidget />
          <RecentFiles />
        </div>
      </div>
    </div>
  );
}
