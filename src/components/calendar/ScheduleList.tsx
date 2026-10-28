// 任务/会议行 — 领域详情与项目详情共用，避免重复渲染逻辑
import { MapPin } from 'lucide-react';
import type { AreaMeetingItem, AreaTaskItem } from '@shared/calendar';
import { formatTime, toDateKey } from '@/lib/date';
import { cn } from '@/lib/cn';

function formatDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatSlot(iso: string, allDay: boolean): string {
  return allDay ? `${formatDay(iso)} 全天` : `${formatDay(iso)} ${formatTime(iso)}`;
}

function formatMeetingTime(meeting: AreaMeetingItem): string {
  if (meeting.allDay) return `${formatDay(meeting.startAt)} 全天`;

  const start = formatTime(meeting.startAt);
  const sameDayEnd =
    meeting.endAt && toDateKey(new Date(meeting.endAt)) === toDateKey(new Date(meeting.startAt))
      ? formatTime(meeting.endAt)
      : '';
  return `${formatDay(meeting.startAt)} ${start}${sameDayEnd ? ` – ${sameDayEnd}` : ''}`;
}

export function TaskScheduleRow({ task }: { task: AreaTaskItem }) {
  const done = task.status === 'done';
  const dueText = task.dueAt ? `截止 ${formatSlot(task.dueAt, task.allDay)}` : '未设置截止时间';
  const remindText = task.remindAt ? ` · 提醒 ${formatSlot(task.remindAt, false)}` : '';

  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-line/70 last:border-b-0">
      <span
        className={cn(
          'mt-1.5 w-2 h-2 rounded-full flex-shrink-0',
          done ? 'bg-ink-3' : 'bg-accent',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className={cn('text-base truncate', done ? 'text-ink-3 line-through' : 'text-ink')}>
          {task.title}
        </div>
        <div className="text-xs text-ink-3 mt-0.5">
          {dueText}
          {remindText}
        </div>
      </div>
      {task.important && !done && (
        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#FF9500]/10 text-[#FF9500]">
          重要
        </span>
      )}
      {done && (
        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-bg-panel text-ink-3">
          已完成
        </span>
      )}
    </div>
  );
}

export function MeetingScheduleRow({ meeting }: { meeting: AreaMeetingItem }) {
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-line/70 last:border-b-0">
      <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-[#5856D6]" />
      <div className="flex-1 min-w-0">
        <div className="text-base text-ink truncate">{meeting.title}</div>
        <div className="text-xs text-ink-3 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{formatMeetingTime(meeting)}</span>
          {meeting.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin size={10} />
              {meeting.location}
            </span>
          )}
        </div>
      </div>
      {meeting.allDay && (
        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-bg-panel text-ink-3">
          全天
        </span>
      )}
    </div>
  );
}
