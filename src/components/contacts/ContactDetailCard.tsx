import { useCallback, useEffect, useState } from 'react';
import {
  Pencil,
  Trash2,
  Plus,
  X,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  CalendarDays,
  AlarmClock,
} from 'lucide-react';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';
import { calendarApi, contactApi, fileApi } from '@/lib/ipc';
import { formatSize } from '@/lib/format';
import { formatTime, toDateKey } from '@/lib/date';
import { cn } from '@/lib/cn';
import { ContactFilePickerDialog } from '../dialogs/ContactFilePickerDialog';
import { ScheduleEditorDialog } from '../calendar/ScheduleEditorDialog';
import { Button } from '../ui/Button';
import type { AreaMeetingItem, AreaTaskItem, ProjectSchedule } from '@shared/calendar';
import type { ContactDetail } from '@shared/types';

interface ContactDetailCardProps {
  detail: ContactDetail;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh: () => Promise<void> | void;
  onSelectProject: (projectId: number) => void;
  onClose?: () => void;
  onViewGraph?: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 shrink-0 text-ink-3">{label}</span>
      <span className={value ? 'text-ink whitespace-pre-wrap break-words' : 'text-ink-3'}>
        {value || '未填写'}
      </span>
    </div>
  );
}

/** 文件类型图标（按扩展名着色） */
function extStyle(ext: string): { Icon: typeof FileText; cls: string } {
  if (['doc', 'docx', 'md', 'txt'].includes(ext)) {
    return { Icon: FileText, cls: 'text-accent' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { Icon: FileSpreadsheet, cls: 'text-[#2e7d32]' };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return { Icon: FileIcon, cls: 'text-[#9c27b0]' };
  }
  if (ext === 'pdf') {
    return { Icon: FileText, cls: 'text-danger' };
  }
  return { Icon: FileIcon, cls: 'text-ink-3' };
}

/** 截止/提醒时间文案：今天 HH:mm / M月D日 HH:mm */
function formatWhen(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  const day =
    toDateKey(d) === toDateKey(new Date())
      ? '今天'
      : `${d.getMonth() + 1}月${d.getDate()}日`;
  return allDay ? `${day} 全天` : `${day} ${formatTime(iso)}`;
}

export function ContactDetailCard({
  detail,
  readOnly = false,
  onEdit,
  onDelete,
  onRefresh,
  onSelectProject,
  onClose,
  onViewGraph,
}: ContactDetailCardProps) {
  const projects = useDataStore((s) => s.projects);
  const showToast = useUiStore((s) => s.showToast);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [schedule, setSchedule] = useState<ProjectSchedule>({ tasks: [], meetings: [] });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);

  useEffect(() => {
    setShowProjectPicker(false);
    setScheduleEditorOpen(false);
  }, [detail.id]);

  // 加载联系人关联的任务与日程
  useEffect(() => {
    let cancelled = false;
    setScheduleLoading(true);
    calendarApi
      .listContactSchedule(detail.id)
      .then((result) => {
        if (cancelled) return;
        setSchedule(result);
        setScheduleLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSchedule({ tasks: [], meetings: [] });
        setScheduleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail.id, scheduleReloadKey]);

  const reloadSchedule = useCallback(() => setScheduleReloadKey((key) => key + 1), []);

  // 任务勾选：乐观更新，失败回滚
  const handleToggleTask = useCallback(
    async (task: AreaTaskItem) => {
      const next = task.status === 'done' ? 'open' : 'done';
      setSchedule((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
      }));
      try {
        await calendarApi.setTaskStatus(task.id, next);
        reloadSchedule();
      } catch {
        setSchedule((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
        }));
        showToast('更新任务状态失败', 'error');
      }
    },
    [reloadSchedule, showToast],
  );

  const projectIds = detail.projects.map((p) => p.id);
  const availableProjects = projects.filter((p) => !projectIds.includes(p.id));

  const saveProjectIds = async (ids: number[]) => {
    try {
      await contactApi.setContactProjects(detail.id, ids);
      await onRefresh();
      setShowProjectPicker(false);
    } catch {
      showToast('更新关联项目失败', 'error');
    }
  };

  const removeFile = async (fileId: number) => {
    try {
      await contactApi.setContactFiles(
        detail.id,
        detail.files.map((f) => f.id).filter((id) => id !== fileId),
      );
      await onRefresh();
    } catch {
      showToast('移除关联文件失败', 'error');
    }
  };

  const openFile = async (fileId: number) => {
    const result = await fileApi.open(fileId);
    if (!result.ok) showToast(result.reason || '无法打开文件', 'error');
  };

  const revealFile = async (fileId: number) => {
    const ok = await fileApi.reveal(fileId);
    if (!ok) showToast('文件路径已失效', 'error');
  };

  const avatarText = detail.name.trim().slice(0, 1) || '?';
  const subtitle = [detail.org, detail.department].filter(Boolean).join(' · ');

  const meetingMeta = (m: AreaMeetingItem): string => {
    const day = formatWhen(m.startAt, m.allDay);
    const range =
      !m.allDay && m.endAt ? `${day} - ${formatTime(m.endAt)}` : day;
    return m.location ? `${range} · ${m.location}` : range;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 详情头部 */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-line flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-accent-weak text-accent flex items-center justify-center text-xl font-semibold shrink-0">
            {avatarText}
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold text-ink truncate">{detail.name}</div>
            <div className="text-sm text-ink-3 truncate mt-0.5">
              {subtitle || '未填写单位信息'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={onEdit}
                title="编辑"
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-2 hover:bg-bg-hover hover:text-accent"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="删除"
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-2 hover:bg-bg-hover hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {readOnly && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="关闭"
              className="w-8 h-8 rounded-md flex items-center justify-center text-ink-2 hover:bg-bg-hover"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 详情内容区 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* 基础信息 */}
        <section className="px-6 py-5 space-y-3">
          <InfoRow label="单位" value={detail.org} />
          <InfoRow label="部门" value={detail.department} />
          <InfoRow label="职务" value={detail.title} />
          <InfoRow label="电话" value={detail.phone} />
          <InfoRow label="邮箱" value={detail.email} />
          <InfoRow label="备注" value={detail.note} />
          <div className="pt-2 text-xs text-ink-3/80">
            创建于 {new Date(detail.createdAt).toLocaleString('zh-CN')} · 更新于{' '}
            {new Date(detail.updatedAt).toLocaleString('zh-CN')}
          </div>
        </section>

        {/* 任务与日程 */}
        <section className="px-6 py-5 border-t border-line">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-ink">任务与日程</h3>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setScheduleEditorOpen(true)}
                className="text-sm text-accent hover:text-accent-hover"
              >
                + 新建关联任务
              </button>
            )}
          </div>

          {scheduleLoading ? (
            <div className="text-sm text-ink-3">加载中…</div>
          ) : schedule.tasks.length === 0 && schedule.meetings.length === 0 ? (
            <div className="text-sm text-ink-3">暂无关联任务或日程</div>
          ) : (
            <div className="bg-[#fafafa] border border-line/60 rounded-lg p-4 space-y-2.5">
              {schedule.tasks.map((task) => {
                const done = task.status === 'done';
                return (
                  <div
                    key={`task-${task.id}`}
                    className={cn(
                      'bg-white border border-line rounded-md px-4 py-3 flex items-start gap-3 shadow-sm',
                      !done && task.important && 'border-l-[3px] border-l-[#f44336] bg-[#fffdfd]',
                      !done && !task.important && 'border-l-[3px] border-l-accent',
                      done && 'opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => handleToggleTask(task)}
                      className="mt-0.5 w-4 h-4 rounded border-line accent-accent cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span
                          className={cn(
                            'font-medium text-sm truncate',
                            done ? 'text-ink-3 line-through' : 'text-ink',
                          )}
                        >
                          {task.title}
                        </span>
                        {done ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-bg-panel text-ink-3 flex-shrink-0">
                            已完成
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'text-[11px] px-1.5 py-0.5 rounded flex-shrink-0',
                              task.important
                                ? 'bg-[#ffebee] text-[#c62828]'
                                : 'bg-accent-weak text-accent',
                            )}
                          >
                            {task.important ? '重要任务' : '任务'}
                          </span>
                        )}
                      </div>
                      {!done && (task.dueAt || task.remindAt) && (
                        <div className="text-xs text-ink-2 flex items-center gap-3">
                          {task.dueAt && (
                            <span className="text-[#d32f2f] font-medium flex items-center gap-1">
                              <AlarmClock size={12} />
                              {formatWhen(task.dueAt, task.allDay)}
                            </span>
                          )}
                          {task.remindAt && (
                            <span>（{formatWhen(task.remindAt, task.allDay)} 系统提醒）</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {schedule.meetings.map((meeting) => (
                <div
                  key={`meeting-${meeting.id}`}
                  className="bg-white border border-line border-l-[3px] border-l-accent rounded-md px-4 py-3 flex items-start gap-3 shadow-sm"
                >
                  <CalendarDays size={16} className="text-ink-3 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="font-medium text-sm text-ink truncate">
                        {meeting.title}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent-weak text-accent flex-shrink-0">
                        日程
                      </span>
                    </div>
                    <div className="text-xs text-ink-2">{meetingMeta(meeting)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 关联项目 */}
        <section className="px-6 py-5 border-t border-line">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-ink">
              关联项目 <span className="text-sm font-normal text-ink-3">({detail.projects.length})</span>
            </h3>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowProjectPicker((v) => !v)}
                className="text-sm text-accent hover:text-accent-hover"
              >
                + 关联项目
              </button>
            )}
          </div>

          {showProjectPicker && (
            <div className="mb-3 border border-line rounded-md max-h-44 overflow-auto">
              {availableProjects.length === 0 ? (
                <div className="px-3 py-2 text-sm text-ink-3">没有可关联的项目</div>
              ) : (
                availableProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => saveProjectIds([...projectIds, project.id])}
                    className="w-full flex items-center justify-between px-3 h-9 text-sm text-left hover:bg-bg-hover border-b border-line/50 last:border-b-0"
                  >
                    <span className="truncate">{project.name}</span>
                    <Plus size={14} className="text-accent shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {detail.projects.length === 0 ? (
            <div className="text-sm text-ink-3">暂无关联项目</div>
          ) : (
            <div className="space-y-1">
              {detail.projects.map((project) => (
                <div
                  key={project.id}
                  className="group flex items-center gap-2 h-9 px-2 rounded-md hover:bg-bg-hover"
                >
                  <button
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className="flex-1 text-left text-sm text-ink truncate hover:text-accent"
                  >
                    {project.name}
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => saveProjectIds(projectIds.filter((id) => id !== project.id))}
                      title="移除关联"
                      className="w-6 h-6 rounded flex items-center justify-center text-ink-3 opacity-0 group-hover:opacity-100 hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 相关文件 */}
        <section className="px-6 py-5 border-t border-line">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-ink">
              相关文件 <span className="text-sm font-normal text-ink-3">({detail.files.length})</span>
            </h3>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setFilePickerOpen(true)}
                className="text-sm text-accent hover:text-accent-hover"
              >
                + 添加关联文件
              </button>
            )}
          </div>

          {detail.files.length === 0 ? (
            <div className="text-sm text-ink-3">暂无相关文件</div>
          ) : (
            <div className="space-y-2">
              {detail.files.map((file) => {
                const { Icon, cls } = extStyle(file.ext);
                return (
                  <div
                    key={file.id}
                    className="group flex items-center gap-2.5 px-1 py-1 rounded-md hover:bg-bg-hover"
                  >
                    <Icon size={18} className={cn('shrink-0', cls)} />
                    <button
                      type="button"
                      onClick={() => openFile(file.id)}
                      className="flex-1 min-w-0 text-left"
                      title="打开文件"
                    >
                      <div className="text-sm text-ink truncate">{file.name}</div>
                      <div className="text-[11px] text-ink-3 mt-0.5">
                        {file.ext.toUpperCase()} · {formatSize(file.size)}
                        {file.pathMissing && <span className="text-danger"> · 路径失效</span>}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => revealFile(file.id)}
                      title="打开所在文件夹"
                      className="w-6 h-6 rounded flex items-center justify-center text-ink-3 opacity-0 group-hover:opacity-100 hover:text-accent"
                    >
                      <FolderOpen size={14} />
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        title="移除关联"
                        className="w-6 h-6 rounded flex items-center justify-center text-ink-3 opacity-0 group-hover:opacity-100 hover:text-danger"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 底部操作 */}
      {onViewGraph && (
        <div className="flex-shrink-0 border-t border-line p-4 text-center">
          <Button variant="secondary" className="px-6" onClick={onViewGraph}>
            查看关系网
          </Button>
        </div>
      )}

      {filePickerOpen && (
        <ContactFilePickerDialog
          contactIds={[detail.id]}
          initialFileIds={detail.files.map((f) => f.id)}
          onSaved={onRefresh}
          onClose={() => setFilePickerOpen(false)}
        />
      )}

      {scheduleEditorOpen && (
        <ScheduleEditorDialog
          mode="create"
          defaultType="task"
          defaultContactId={detail.id}
          onClose={() => setScheduleEditorOpen(false)}
          onSaved={() => {
            setScheduleEditorOpen(false);
            reloadSchedule();
          }}
        />
      )}
    </div>
  );
}
