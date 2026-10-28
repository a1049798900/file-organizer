// 月视图 — 6 周网格，每天最多展示 3 条事件，其余折叠为「还有 N 项」
import { Plus } from 'lucide-react';
import type { CalendarEvent } from '@shared/calendar';
import {
  WEEKDAY_LABELS,
  getMonthGridDays,
  isSameDay,
  toDateKey,
} from '@/lib/date';
import { cn } from '@/lib/cn';
import { CalendarEventChip } from './CalendarEventChip';

const MAX_VISIBLE_EVENTS = 3;

interface MonthViewProps {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onDrillDown: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onCreateAt: (date: Date) => void;
}

export function MonthView({
  anchor,
  eventsByDay,
  onDrillDown,
  onEventClick,
  onCreateAt,
}: MonthViewProps) {
  const today = new Date();
  const days = getMonthGridDays(anchor);
  const currentMonth = anchor.getMonth();

  return (
    <div className="flex flex-col flex-1 min-h-0" role="grid" aria-label="月视图日历">
      <div className="grid grid-cols-7 border-b border-line flex-shrink-0" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="h-8 flex items-center justify-center text-xs text-ink-3"
            role="columnheader"
          >
            周{label}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const overflow = dayEvents.length - MAX_VISIBLE_EVENTS;
          const isToday = isSameDay(day, today);
          const outside = day.getMonth() !== currentMonth;

          return (
            <div
              key={key}
              role="gridcell"
              aria-label={`${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日，${dayEvents.length} 项日程`}
              onClick={() => onCreateAt(day)}
              className={cn(
                'group relative flex flex-col min-h-0 p-1 border-r border-b border-line overflow-hidden cursor-pointer',
                outside ? 'bg-bg-panel/40' : 'bg-white',
                'hover:bg-accent-weak/20',
              )}
            >
              <div className="flex items-center justify-between flex-shrink-0 mb-0.5">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 text-xs rounded-full',
                    isToday ? 'bg-accent text-white font-medium' : '',
                    !isToday && (outside ? 'text-ink-3' : 'text-ink-2'),
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-ink-3 group-hover:hidden">
                      {dayEvents.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateAt(day);
                    }}
                    title={`在 ${day.getMonth() + 1}月${day.getDate()}日 新建日程`}
                    aria-label={`在 ${day.getMonth() + 1}月${day.getDate()}日 新建日程`}
                    className={cn(
                      'w-5 h-5 rounded flex items-center justify-center text-accent',
                      'hover:bg-accent hover:text-white transition-colors',
                      'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
                      'focus-visible:opacity-100 focus-visible:pointer-events-auto',
                    )}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-0.5 min-h-0">
                {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                  <div key={event.id} onClick={(e) => e.stopPropagation()}>
                    <CalendarEventChip event={event} onClick={onEventClick} />
                  </div>
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrillDown(day);
                    }}
                    className="text-left text-xs text-ink-2 hover:text-accent px-1 rounded hover:bg-bg-hover"
                    aria-label={`查看 ${day.getMonth() + 1}月${day.getDate()}日 的更多日程`}
                  >
                    还有 {overflow} 项
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
