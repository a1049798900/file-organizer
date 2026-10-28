// 日历事件色块 — 月视图紧凑样式与时间轴块样式，支持点击跳转
import type { CalendarEvent, CalendarEventType } from '@shared/calendar';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/date';

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  task_due: '任务截止',
  meeting: '会议',
  todo_reminder: '待办提醒',
};

const dotClasses: Record<CalendarEventType, string> = {
  task_due: 'bg-accent',
  meeting: 'bg-[#5856D6]',
  todo_reminder: 'bg-[#FF9500]',
};

const blockClasses: Record<CalendarEventType, string> = {
  task_due: 'bg-accent-weak border-accent',
  meeting: 'bg-[#5856D6]/10 border-[#5856D6]',
  todo_reminder: 'bg-[#FF9500]/10 border-[#FF9500]',
};

interface CalendarEventChipProps {
  event: CalendarEvent;
  variant?: 'compact' | 'block';
  /** block 变体高度不足（<32px）时启用：单行显示「标题 · 时间」，去掉纵向 padding */
  dense?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: CalendarEvent) => void;
}

export function CalendarEventChip({
  event,
  variant = 'compact',
  dense = false,
  className,
  style,
  onClick,
}: CalendarEventChipProps) {
  const time = event.allDay ? '' : formatTime(event.startAt);
  const location = event.meta?.location;
  const label = [
    EVENT_TYPE_LABELS[event.type],
    event.title,
    time,
    location ? `地点 ${location}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const interactiveClassName = onClick
    ? 'cursor-pointer transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
    : 'cursor-default';

  if (variant === 'block') {
    // 高度不足（约 30 分钟及以下）时只渲染单行「标题 · 时间」，
    // 避免两行内容在 22px 高度内被 overflow 裁成 2px 细条
    const content = dense ? (
      <div className="shrink-0 text-[11px] font-medium leading-4 truncate">
        {event.title}
        {time ? <span className="font-normal text-ink-2"> · {time}</span> : null}
      </div>
    ) : (
      <>
        <div className="shrink-0 text-[11px] font-medium leading-4 truncate">{event.title}</div>
        <div className="shrink-0 text-[10px] leading-4 text-ink-2 truncate">
          {event.allDay ? '全天' : time}
          {location ? ` · ${location}` : ''}
        </div>
      </>
    );

    const classes = cn(
      'absolute flex flex-col justify-center rounded-md border-l-2 overflow-hidden box-border text-left',
      'select-none w-auto',
      // 紧凑模式去掉纵向 padding，让单行内容垂直居中贴边显示
      dense ? 'px-1.5' : 'px-1.5 py-1',
      blockClasses[event.type],
      interactiveClassName,
      className,
    );

    if (onClick) {
      return (
        <button
          type="button"
          className={classes}
          style={style}
          title={label}
          aria-label={label}
          onClick={() => onClick(event)}
        >
          {content}
        </button>
      );
    }

    return (
      <div className={classes} style={style} title={label} aria-label={label}>
        {content}
      </div>
    );
  }

  const content = (
    <>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotClasses[event.type])} />
      {time && <span className="text-[10px] text-ink-2 flex-shrink-0">{time}</span>}
      <span className="truncate text-ink">{event.title}</span>
    </>
  );

  const classes = cn(
    'flex items-center gap-1 h-[18px] px-1 rounded text-xs w-full',
    'select-none overflow-hidden text-left',
    interactiveClassName,
    onClick ? 'hover:bg-bg-hover' : '',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        title={label}
        aria-label={label}
        onClick={() => onClick(event)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classes} style={style} title={label} aria-label={label}>
      {content}
    </div>
  );
}
