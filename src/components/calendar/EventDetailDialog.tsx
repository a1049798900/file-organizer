// 日程详情弹层 — 展示完整信息，并提供编辑、删除与打开所属项目/领域
import type { CalendarEvent } from '@shared/calendar';
import { formatDateTitle, formatTime } from '@/lib/date';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EVENT_TYPE_LABELS } from './CalendarEventChip';

interface EventDetailDialogProps {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onOpenProject?: (projectId: number) => void;
  onOpenArea?: (areaId: number) => void;
}

function stripMergedSuffix(title: string): string {
  return title.replace('（截止 + 提醒）', '');
}

function formatSlot(iso: string, allDay?: boolean): string {
  const date = formatDateTitle(new Date(iso));
  return allDay ? `${date}（全天）` : `${date} ${formatTime(iso)}`;
}

function formatMeetingTime(event: CalendarEvent): string {
  const date = formatDateTitle(new Date(event.startAt));
  if (event.allDay) return `${date}（全天）`;

  const start = formatTime(event.startAt);
  const end = event.endAt ? formatTime(event.endAt) : '';
  return end ? `${date} ${start} – ${end}` : `${date} ${start}`;
}

export function EventDetailDialog({
  event,
  onClose,
  onEdit,
  onDelete,
  onOpenProject,
  onOpenArea,
}: EventDetailDialogProps) {
  const location = event.meta?.location;
  const level = event.meta?.level;
  const dueAt = event.meta?.dueAt;
  const remindAt = event.meta?.remindAt;
  const projectId = event.projectId ? Number(event.projectId) : null;
  const areaId = event.areaId ? Number(event.areaId) : null;
  const hasOwner = projectId != null || areaId != null;

  return (
    <Modal open onClose={onClose} title="日程详情" width={400}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-ink-3">{EVENT_TYPE_LABELS[event.type]}</span>
          {event.meta?.important && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF9500]/10 text-[#FF9500]">
              重要
            </span>
          )}
          {event.meta?.status === 'done' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-panel text-ink-3">
              已完成
            </span>
          )}
        </div>
        <div className="text-lg font-semibold text-ink break-words">
          {stripMergedSuffix(event.title)}
        </div>

        <div className="mt-3 space-y-2 text-sm">
          {event.type === 'meeting' ? (
            <div className="flex gap-2">
              <span className="w-12 flex-shrink-0 text-ink-3">时间</span>
              <span className="text-ink-2">{formatMeetingTime(event)}</span>
            </div>
          ) : (
            <>
              {dueAt && (
                <div className="flex gap-2">
                  <span className="w-12 flex-shrink-0 text-ink-3">截止</span>
                  <span className="text-ink-2">{formatSlot(dueAt, event.allDay)}</span>
                </div>
              )}
              {remindAt && (
                <div className="flex gap-2">
                  <span className="w-12 flex-shrink-0 text-ink-3">提醒</span>
                  <span className="text-ink-2">{formatSlot(remindAt)}</span>
                </div>
              )}
              {!dueAt && !remindAt && (
                <div className="flex gap-2">
                  <span className="w-12 flex-shrink-0 text-ink-3">时间</span>
                  <span className="text-ink-2">{formatSlot(event.startAt, event.allDay)}</span>
                </div>
              )}
            </>
          )}

          {location && (
            <div className="flex gap-2">
              <span className="w-12 flex-shrink-0 text-ink-3">地点</span>
              <span className="text-ink-2 break-words">{location}</span>
            </div>
          )}
          {level && (
            <div className="flex gap-2">
              <span className="w-12 flex-shrink-0 text-ink-3">级别</span>
              <span className="text-ink-2">{level}</span>
            </div>
          )}
        </div>

        {hasOwner ? (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-3">所属：</span>
            {projectId != null && onOpenProject && (
              <button
                type="button"
                onClick={() => onOpenProject(projectId)}
                className="h-7 px-2 rounded-md text-sm text-accent hover:bg-accent-weak"
              >
                打开项目
              </button>
            )}
            {areaId != null && onOpenArea && (
              <button
                type="button"
                onClick={() => onOpenArea(areaId)}
                className="h-7 px-2 rounded-md text-sm text-accent hover:bg-accent-weak"
              >
                打开领域
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 px-3 py-2 rounded-md bg-bg-panel text-xs text-ink-2 leading-5">
            该日程未关联项目或领域，可直接在下方编辑或删除。
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-4 gap-2">
        <Button variant="danger" size="sm" onClick={() => onDelete(event)}>
          删除
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button variant="primary" size="sm" onClick={() => onEdit(event)}>
            编辑
          </Button>
        </div>
      </div>
    </Modal>
  );
}
