// 周/日视图 — 24 小时时间轴，全天事件单独成条
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '@shared/calendar';
import {
  WEEKDAY_LABELS,
  addDays,
  getWeekDays,
  isSameDay,
  startOfDay,
  toDateKey,
} from '@/lib/date';
import { cn } from '@/lib/cn';
import { CalendarEventChip } from './CalendarEventChip';
import type { CalendarViewMode } from '@/lib/date';

const HOUR_HEIGHT = 48;
const MIN_EVENT_HEIGHT = 22;
/** 卡片高度低于该值（约 30 分钟）时切换为单行紧凑布局，防止第二行被裁切 */
const BLOCK_DENSE_HEIGHT = 32;
const DEFAULT_EVENT_MINUTES = 30;
/** 时间网格内容总高：24 格 * 48px = 1152px，写死以保证滚动范围明确 */
const GRID_HEIGHT = 24 * HOUR_HEIGHT;

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

interface TimeSlice {
  event: CalendarEvent;
  start: number;
  end: number;
}

function toTimeSlices(events: CalendarEvent[], dayStartMs: number, dayEndMs: number): TimeSlice[] {
  return events
    .filter((event) => !event.allDay)
    .map((event) => {
      const rawStart = Date.parse(event.startAt);
      const start = Math.max(rawStart, dayStartMs);
      const rawEnd = event.endAt
        ? Date.parse(event.endAt)
        : rawStart + DEFAULT_EVENT_MINUTES * 60_000;
      const end = Math.min(Math.max(rawEnd, start + 15 * 60_000), dayEndMs);
      return { event, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** 计算重叠事件的列布局，避免同一时段内互相遮挡 */
function positionEvents(events: CalendarEvent[], dayStartMs: number, dayEndMs: number): PositionedEvent[] {
  const slices = toTimeSlices(events, dayStartMs, dayEndMs);
  const positioned: PositionedEvent[] = [];
  let index = 0;

  while (index < slices.length) {
    let clusterEnd = slices[index].end;
    let next = index + 1;
    while (next < slices.length && slices[next].start < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, slices[next].end);
      next += 1;
    }

    const cluster = slices.slice(index, next);
    const columnEnds: number[] = [];
    const assignments: { slice: TimeSlice; column: number }[] = [];

    for (const slice of cluster) {
      let column = columnEnds.findIndex((end) => slice.start >= end);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(slice.end);
      } else {
        columnEnds[column] = slice.end;
      }
      assignments.push({ slice, column });
    }

    const totalColumns = columnEnds.length;
    for (const { slice, column } of assignments) {
      const startMinutes = (slice.start - dayStartMs) / 60_000;
      const durationMinutes = (slice.end - slice.start) / 60_000;
      positioned.push({
        event: slice.event,
        top: (startMinutes / 60) * HOUR_HEIGHT,
        height: Math.max(MIN_EVENT_HEIGHT, (durationMinutes / 60) * HOUR_HEIGHT),
        left: column / totalColumns,
        width: 1 / totalColumns,
      });
    }

    index = next;
  }

  return positioned;
}

interface TimeGridViewProps {
  mode: Exclude<CalendarViewMode, 'month'>;
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onEventClick: (event: CalendarEvent) => void;
  onCreateSlot: (start: Date, end: Date) => void;
}

export function TimeGridView({
  mode,
  anchor,
  eventsByDay,
  onEventClick,
  onCreateSlot,
}: TimeGridViewProps) {
  const days = useMemo(
    () => (mode === 'day' ? [startOfDay(anchor)] : getWeekDays(anchor)),
    [mode, anchor],
  );
  const today = new Date();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // 挂载后定位到当前时间附近（当前小时顶部再上移 60px 缓冲），不写死在顶部
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      scrollRef.current.scrollTop = Math.max(0, now.getHours() * HOUR_HEIGHT - 60);
    }
  }, []);

  // 日期表头固定在滚动区外，需测量纵向滚动条宽度做右侧补偿，保持表头列与时间列对齐
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dayData = useMemo(
    () =>
      days.map((day) => {
        const key = toDateKey(day);
        const events = eventsByDay.get(key) ?? [];
        const dayStart = startOfDay(day).getTime();
        const dayEnd = addDays(startOfDay(day), 1).getTime();
        return {
          day,
          key,
          allDay: events.filter((event) => event.allDay),
          timed: positionEvents(events, dayStart, dayEnd),
        };
      }),
    [days, eventsByDay],
  );

  const hasAllDay = dayData.some((item) => item.allDay.length > 0);
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 固定区：日期表头 + 全天事件条，移出滚动区不随内容滚动；右侧补偿滚动条宽度保持列对齐 */}
      <div className="shrink-0" style={{ paddingRight: scrollbarWidth }}>
        {/* 日期表头 */}
        <div className="flex w-full bg-white border-b border-line">
          <div className="w-14 flex-shrink-0" />
          {dayData.map(({ day }) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toDateString()}
                className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 h-12 border-l border-line"
              >
                <span className="text-xs text-ink-3">
                  周{WEEKDAY_LABELS[(day.getDay() + 6) % 7]}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 text-sm rounded-full',
                    isToday ? 'bg-accent text-white font-medium' : 'text-ink',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* 全天事件条 */}
        {hasAllDay && (
          <div className="flex w-full bg-white border-b border-line min-h-[30px]">
            <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2 text-[11px] text-ink-3">
              全天
            </div>
            {dayData.map(({ day, allDay }) => (
              <div
                key={day.toDateString()}
                className="flex-1 min-w-0 flex flex-wrap items-center gap-0.5 p-1 border-l border-line"
              >
                {allDay.map((event) => (
                  <CalendarEventChip
                    key={event.id}
                    event={event}
                    className="max-w-full bg-bg-panel"
                    onClick={onEventClick}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 唯一滚动区：仅纵向滚动，内容高度固定为 24 格 = 1152px，00:00 在 top:0，可滚到 24:00 */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex w-full" style={{ height: GRID_HEIGHT }}>
          {/* 小时刻度：top 直接 hour * HOUR_HEIGHT，无任何起点偏移 */}
          <div className="w-14 flex-shrink-0 relative h-full">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className={cn(
                  'absolute right-2 text-[11px] text-ink-3',
                  // 00:00 贴顶显示，不做上移，避免上半截被滚动区裁掉
                  hour === 0 ? 'translate-y-0' : '-translate-y-1/2',
                )}
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* 每天一列，flex-1 均分自适应宽度 */}
          {dayData.map(({ day, key, timed }) => (
            <div
              key={key}
              className="flex-1 min-w-0 relative h-full border-l border-line bg-white"
            >
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-line/70 pointer-events-none"
                  style={{ top: hour * HOUR_HEIGHT }}
                />
              ))}

              {/* 空白时段点击新建：浅蓝高亮提示可点击 */}
              {Array.from({ length: 24 }).map((_, hour) => {
                const slotStart = new Date(day);
                slotStart.setHours(hour, 0, 0, 0);
                const slotEnd = new Date(slotStart);
                slotEnd.setHours(hour + 1, 0, 0, 0);
                return (
                  <button
                    key={`slot-${hour}`}
                    type="button"
                    onClick={() => onCreateSlot(slotStart, slotEnd)}
                    className={cn(
                      'group/slot absolute left-0 right-0 z-0',
                      'hover:bg-accent-weak/50 focus-visible:bg-accent-weak/50',
                      'transition-colors cursor-pointer',
                    )}
                    style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    title={`${String(hour).padStart(2, '0')}:00 – ${String(hour + 1).padStart(2, '0')}:00 新建日程`}
                    aria-label={`在 ${day.getMonth() + 1}月${day.getDate()}日 ${String(hour).padStart(2, '0')}:00 新建日程`}
                  >
                    <span className="absolute left-1 top-1 text-[10px] text-accent opacity-0 group-hover/slot:opacity-100 pointer-events-none">
                      + 新建
                    </span>
                  </button>
                );
              })}

              {/* 当前时间红线：DOM 在卡片之前且 z-0，压在卡片下层不遮挡 */}
              {isSameDay(day, today) && (
                <div
                  className="absolute left-0 right-0 z-0 pointer-events-none"
                  style={{ top: nowTop }}
                  aria-hidden="true"
                >
                  <div className="h-px bg-danger" />
                  <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-danger" />
                </div>
              )}

              {timed.map(({ event, top, height, left, width }) => (
                <CalendarEventChip
                  key={event.id}
                  event={event}
                  variant="block"
                  dense={height < BLOCK_DENSE_HEIGHT}
                  onClick={onEventClick}
                  style={{
                    top,
                    height,
                    left: `calc(${left * 100}% + 2px)`,
                    width: `calc(${width * 100}% - 4px)`,
                    zIndex: 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
