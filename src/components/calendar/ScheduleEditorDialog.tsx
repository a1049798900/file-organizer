// 日程编辑器 — 创建/编辑任务与会议的统一表单
// 项目内此前没有现成的新建表单，这里作为唯一入口，供日历与顶部按钮复用
import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@shared/calendar';
import type { ProjectRow } from '@shared/types';
import { calendarApi, projectApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { cn } from '@/lib/cn';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export type ScheduleType = 'task' | 'meeting';

interface ScheduleEditorDialogProps {
  mode: 'create' | 'edit';
  defaultType?: ScheduleType;
  /** 创建时带入的起始时间 */
  defaultStart?: Date;
  /** 创建时预选的所属项目（项目详情页入口） */
  defaultProjectId?: number;
  /** 创建时关联的联系人（联系人详情页入口；编辑时保留原有关联） */
  defaultContactId?: number;
  /** 编辑时传入当前事件 */
  event?: CalendarEvent;
  onClose: () => void;
  onSaved: () => void;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function splitIso(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function combineDateTime(
  dateValue: string,
  timeValue: string,
  fallbackTime = '00:00',
): string | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = (timeValue || fallbackTime).split(':').map(Number);
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function stripMergedSuffix(title: string): string {
  return title.replace('（截止 + 提醒）', '');
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60_000).toISOString();
}

export function ScheduleEditorDialog({
  mode,
  defaultType = 'meeting',
  defaultStart,
  defaultProjectId,
  defaultContactId,
  event,
  onClose,
  onSaved,
}: ScheduleEditorDialogProps) {
  const showToast = useUiStore((s) => s.showToast);
  const isEdit = mode === 'edit' && !!event;

  const initialType: ScheduleType = isEdit
    ? event!.type === 'meeting'
      ? 'meeting'
      : 'task'
    : defaultType;

  const baseStartIso = isEdit ? event!.startAt : (defaultStart ?? new Date()).toISOString();
  const taskDueIso = isEdit
    ? event!.meta?.dueAt ?? (event!.type === 'task_due' ? event!.startAt : null)
    : baseStartIso;
  const taskRemindIso = isEdit
    ? event!.meta?.remindAt ?? (event!.type === 'todo_reminder' ? event!.startAt : null)
    : null;
  const meetingEndIso = isEdit ? event!.endAt ?? addHours(event!.startAt, 1) : addHours(baseStartIso, 1);

  const due = splitIso(taskDueIso);
  const remind = splitIso(taskRemindIso);
  const start = splitIso(baseStartIso);
  const end = splitIso(meetingEndIso);

  const [type, setType] = useState<ScheduleType>(initialType);
  const [title, setTitle] = useState(isEdit ? stripMergedSuffix(event!.title) : '');
  const [projectId, setProjectId] = useState(
    isEdit && event!.projectId
      ? String(event!.projectId)
      : defaultProjectId != null
        ? String(defaultProjectId)
        : '',
  );
  const [allDay, setAllDay] = useState(isEdit ? !!event!.allDay : false);
  const [important, setImportant] = useState(
    isEdit ? !!event!.meta?.important : false,
  );
  const [dueDate, setDueDate] = useState(due.date);
  const [dueTime, setDueTime] = useState(due.time);
  const [remindDate, setRemindDate] = useState(remind.date);
  const [remindTime, setRemindTime] = useState(remind.time);
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);
  const [location, setLocation] = useState(
    isEdit ? event!.meta?.location ?? '' : '',
  );
  const [level, setLevel] = useState(isEdit ? event!.meta?.level ?? '' : '');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectApi
      .list('all')
      .then(setProjects)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (saving) return;

    const trimmed = title.trim();
    if (!trimmed) {
      showToast('请填写标题', 'error');
      return;
    }
    if (trimmed.length > 100) {
      showToast('标题不能超过 100 字', 'error');
      return;
    }

    const pid = projectId ? Number(projectId) : null;
    setSaving(true);

    try {
      if (type === 'task') {
        const dueAt = combineDateTime(dueDate, allDay ? '' : dueTime);
        const remindAt = combineDateTime(remindDate, allDay ? '' : remindTime, '09:00');
        if (!dueAt && !remindAt) {
          showToast('请至少设置截止时间或提醒时间', 'error');
          setSaving(false);
          return;
        }

        const input = {
          title: trimmed,
          projectId: pid,
          contactId: isEdit ? undefined : (defaultContactId ?? null),
          dueAt,
          remindAt,
          allDay,
          important,
        };

        if (isEdit) {
          await calendarApi.updateTask(Number(event!.sourceId), input);
        } else {
          await calendarApi.createTask(input);
        }
      } else {
        const startAt = combineDateTime(startDate, allDay ? '' : startTime);
        if (!startAt) {
          showToast('请选择会议开始时间', 'error');
          setSaving(false);
          return;
        }
        // 全天会议只选同一天时按单日处理，避免结束时间等于开始时间
        const endAt =
          allDay && endDate === startDate
            ? null
            : combineDateTime(endDate, allDay ? '' : endTime);
        if (endAt && Date.parse(endAt) <= Date.parse(startAt)) {
          showToast('结束时间必须晚于开始时间', 'error');
          setSaving(false);
          return;
        }

        const input = {
          title: trimmed,
          projectId: pid,
          contactId: isEdit ? undefined : (defaultContactId ?? null),
          startAt,
          endAt,
          allDay,
          location: location.trim() || null,
          level: level.trim() || null,
        };

        if (isEdit) {
          await calendarApi.updateMeeting(Number(event!.sourceId), input);
        } else {
          await calendarApi.createMeeting(input);
        }
      }

      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'h-8 px-2 rounded-md border border-line bg-white text-sm text-ink';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? '编辑日程' : '新建日程'}
      width={460}
    >
      <div className="p-4 space-y-3">
        {!isEdit ? (
          <>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-bg-panel rounded-md">
              {(['task', 'meeting'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  aria-pressed={type === item}
                  className={cn(
                    'h-7 rounded text-sm transition-colors',
                    type === item
                      ? 'bg-white text-ink font-medium shadow-sm'
                      : 'text-ink-2 hover:text-ink',
                  )}
                >
                  {item === 'task' ? '任务' : '会议'}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-ink-3 pt-1 leading-4">
              任务 · 有截止日期的事　|　会议 · 有时间地点的活动
            </div>
          </>
        ) : (
          <div className="text-xs text-ink-3">
            {type === 'task' ? '任务' : '会议'}
          </div>
        )}

        <label className="block">
          <span className="block text-xs text-ink-3 mb-1">标题</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            maxLength={100}
            placeholder={type === 'task' ? '例如：提交周报' : '例如：项目周会'}
            className={cn(fieldClass, 'w-full')}
          />
        </label>

        <label className="block">
          <span className="block text-xs text-ink-3 mb-1">关联项目</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={cn(fieldClass, 'w-full')}
          >
            <option value="">无归属</option>
            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        {isEdit && event?.areaId && (
          <div className="text-xs text-ink-3">
            该日程当前关联领域，保存后领域归属保持不变。
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          全天
        </label>

        {type === 'task' ? (
          <>
            <div>
              <span className="block text-xs text-ink-3 mb-1">截止时间</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={cn(fieldClass, 'flex-1 min-w-0')}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className={cn(fieldClass, 'w-28 flex-shrink-0')}
                  />
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs text-ink-3 mb-1">提醒时间（可选）</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={remindDate}
                  onChange={(e) => setRemindDate(e.target.value)}
                  className={cn(fieldClass, 'flex-1 min-w-0')}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={remindTime}
                    onChange={(e) => setRemindTime(e.target.value)}
                    className={cn(fieldClass, 'w-28 flex-shrink-0')}
                  />
                )}
                {(remindDate || remindTime) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRemindDate('');
                      setRemindTime('');
                    }}
                    className="h-8 px-2 text-xs text-ink-3 hover:text-danger flex-shrink-0"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
              />
              标记为重要
            </label>
          </>
        ) : (
          <>
            <div>
              <span className="block text-xs text-ink-3 mb-1">开始时间</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={cn(fieldClass, 'flex-1 min-w-0')}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={cn(fieldClass, 'w-28 flex-shrink-0')}
                  />
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs text-ink-3 mb-1">结束时间（可选）</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={cn(fieldClass, 'flex-1 min-w-0')}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={cn(fieldClass, 'w-28 flex-shrink-0')}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-xs text-ink-3 mb-1">地点</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="可选"
                  className={cn(fieldClass, 'w-full')}
                />
              </label>
              <label className="block">
                <span className="block text-xs text-ink-3 mb-1">级别</span>
                <input
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="可选"
                  className={cn(fieldClass, 'w-full')}
                />
              </label>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 px-4 pb-4">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </div>
    </Modal>
  );
}
