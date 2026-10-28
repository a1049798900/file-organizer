// 今日待办（占 1 列）— 带 Checkbox 的任务列表，数据来自今日日历事件中的任务
import { useMemo, useState } from 'react';
import { SquareCheck, Plus, Clock } from 'lucide-react';
import type { CalendarEvent } from '@shared/calendar';
import { useUiStore } from '@/stores/useUiStore';
import { cn } from '@/lib/cn';
import { DashboardCard } from './DashboardCard';

interface TodayTasksProps {
  tasks: CalendarEvent[];
}

function formatDue(iso: string, allDay?: boolean): string {
  if (allDay) return '今天截止';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `今天 ${hh}:${mm} 前`;
}

export function TodayTasks({ tasks }: TodayTasksProps) {
  const setActiveView = useUiStore((s) => s.setActiveView);
  // 勾选状态为本地展示态（现有任务 API 不修改完成状态）
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // 同一任务可能同时产生截止/提醒两条事件，按来源去重
  const items = useMemo(() => {
    const seen = new Set<string>();
    const list: CalendarEvent[] = [];
    for (const e of tasks) {
      const key = `${e.sourceTable}:${e.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(e);
    }
    return list;
  }, [tasks]);

  const toggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <DashboardCard
      title="今日待办"
      icon={<SquareCheck size={16} className="text-green-500" />}
      className="col-span-1 flex flex-col"
      action={
        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {items.length} 项
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 flex-1">今天暂无待办任务。</p>
      ) : (
        <div className="flex-1 space-y-1">
          {items.map((e) => {
            const done = checkedIds.has(e.id);
            const dueIso = e.meta?.dueAt ?? e.startAt;
            return (
              <label
                key={e.id}
                className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(e.id)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-accent cursor-pointer flex-shrink-0"
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm leading-tight',
                      done ? 'text-gray-400 line-through' : 'text-gray-700',
                    )}
                  >
                    {e.title}
                  </p>
                  {dueIso && !done && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <Clock size={12} />
                      {formatDue(dueIso, e.allDay)}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setActiveView('calendar')}
        className="w-full mt-4 py-2 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={14} />
        添加任务
      </button>
    </DashboardCard>
  );
}
