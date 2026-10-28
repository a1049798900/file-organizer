// 今日日程（占 1 列）— 垂直时间轴展示当天会议
import { CalendarDays } from 'lucide-react';
import type { CalendarEvent } from '@shared/calendar';
import { useUiStore } from '@/stores/useUiStore';
import { cn } from '@/lib/cn';
import { DashboardCard } from './DashboardCard';

interface TodayScheduleProps {
  meetings: CalendarEvent[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRange(m: CalendarEvent): string {
  if (m.allDay) return '全天';
  const start = formatTime(m.startAt);
  return m.endAt ? `${start} - ${formatTime(m.endAt)}` : start;
}

/** 当前进行中或下一场会议高亮 */
function isUpcoming(m: CalendarEvent, nowMs: number): boolean {
  const end = m.endAt ? Date.parse(m.endAt) : Date.parse(m.startAt);
  return end >= nowMs;
}

export function TodaySchedule({ meetings }: TodayScheduleProps) {
  const setActiveView = useUiStore((s) => s.setActiveView);
  const nowMs = Date.now();
  const nextIdx = meetings.findIndex((m) => isUpcoming(m, nowMs));

  return (
    <DashboardCard
      title="今日日程"
      icon={<CalendarDays size={16} className="text-orange-500" />}
      className="col-span-1"
      action={
        <button
          onClick={() => setActiveView('calendar')}
          className="text-xs text-gray-400 hover:text-blue-500"
        >
          日历视图
        </button>
      }
    >
      {meetings.length === 0 ? (
        <p className="text-sm text-gray-400">今天暂无日程安排。</p>
      ) : (
        <div className="relative border-l-2 border-gray-100 ml-2 space-y-5 pb-2">
          {meetings.map((m, i) => {
            const highlight = i === (nextIdx === -1 ? meetings.length - 1 : nextIdx);
            return (
              <div key={m.id} className="relative pl-4">
                <div
                  className={cn(
                    'absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white',
                    highlight ? 'bg-orange-400' : 'bg-gray-300',
                  )}
                />
                <p className="text-xs text-gray-500 mb-0.5">{formatRange(m)}</p>
                <p
                  className={cn(
                    'text-sm font-medium',
                    highlight ? 'text-gray-800' : 'text-gray-500',
                  )}
                >
                  {m.title}
                </p>
                {m.meta?.location && (
                  <p className="text-xs text-gray-400 mt-0.5">{m.meta.location}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
