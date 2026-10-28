// 项目详情 — 按样式2重构：标题区 / 工具栏 / 任务与日程面板（阶段步骤+任务列表）/ 文件列表 / 右侧联系人
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  X,
  Share2,
  CalendarDays,
  Check,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { FileList } from '../filelist/FileList';
import { ContactPickerDialog } from '../dialogs/ContactPickerDialog';
import { ContactDetailCard } from '../contacts/ContactDetailCard';
import { ScheduleEditorDialog } from '../calendar/ScheduleEditorDialog';
import { useFileList } from '@/hooks/useFileList';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { calendarApi, contactApi, projectApi } from '@/lib/ipc';
import { openGraphFromFocus } from '@/lib/graphEntry';
import { isContactDrag, readContactDragIds } from '@/lib/drag';
import { formatTime, toDateKey } from '@/lib/date';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AreaTaskItem, ProjectSchedule } from '@shared/calendar';
import type { ContactDetail, ContactRow, FileSortKey, ProjectStatus } from '@shared/types';
import { EmptyState } from '../ui/EmptyState';

/** 头像底色按联系人 id 稳定取色 */
const AVATAR_COLORS = [
  'bg-[#1976d2]',
  'bg-[#4caf50]',
  'bg-[#ff9800]',
  'bg-[#9c27b0]',
  'bg-[#009688]',
  'bg-[#e91e63]',
];

function formatRemind(iso: string): string {
  const d = new Date(iso);
  const hm = formatTime(iso);
  return toDateKey(d) === toDateKey(new Date())
    ? `今天 ${hm} 提醒`
    : `${d.getMonth() + 1}月${d.getDate()}日 ${hm} 提醒`;
}

export function ProjectDetailView() {
  const activeProjectId = useUiStore((s) => s.activeProjectId);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const openModal = useUiStore((s) => s.openModal);
  const showToast = useUiStore((s) => s.showToast);
  const projects = useDataStore((s) => s.projects);
  const refreshProjects = useDataStore((s) => s.refreshProjects);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactReloadKey, setContactReloadKey] = useState(0);
  const [peekContactId, setPeekContactId] = useState<number | null>(null);
  const [peekDetail, setPeekDetail] = useState<ContactDetail | null>(null);
  const [dragOverContacts, setDragOverContacts] = useState(false);
  const [schedule, setSchedule] = useState<ProjectSchedule>({ tasks: [], meetings: [] });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);

  // 拖拽结束（无论在何处松手）时清除高亮
  useEffect(() => {
    const clear = () => setDragOverContacts(false);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  const project = projects.find((p) => p.id === activeProjectId);

  const source = useMemo(() => {
    if (activeProjectId == null) return { kind: 'inbox' as const };
    return { kind: 'project' as const, projectId: activeProjectId };
  }, [activeProjectId]);

  const { rows, loading, refresh, sort, sortActive, setSortKey } = useFileList({
    listKey: `project-${activeProjectId}`,
    source,
    enabled: activeProjectId != null,
  });

  // 加载项目关联联系人
  useEffect(() => {
    if (activeProjectId == null) {
      setContacts([]);
      return;
    }

    let cancelled = false;
    contactApi
      .listByProject(activeProjectId)
      .then((list) => {
        if (!cancelled) setContacts(list);
      })
      .catch(() => {
        if (!cancelled) showToast('加载关联联系人失败', 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, contactReloadKey, showToast]);

  // 加载项目关联的任务与会议
  useEffect(() => {
    if (activeProjectId == null) {
      setSchedule({ tasks: [], meetings: [] });
      return;
    }

    let cancelled = false;
    setScheduleLoading(true);
    calendarApi
      .listProjectSchedule(activeProjectId)
      .then((result) => {
        if (cancelled) return;
        setSchedule(result);
        setScheduleLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSchedule({ tasks: [], meetings: [] });
        setScheduleLoading(false);
        showToast('加载任务与日程失败', 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, scheduleReloadKey, showToast]);

  // 滑出联系人卡详情
  useEffect(() => {
    if (peekContactId == null) {
      setPeekDetail(null);
      return;
    }

    let cancelled = false;
    contactApi
      .getDetail(peekContactId)
      .then((detail) => {
        if (!cancelled) setPeekDetail(detail);
      })
      .catch(() => {
        if (!cancelled) showToast('加载联系人失败', 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [peekContactId, contactReloadKey, showToast]);

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

  const openTasks = useMemo(
    () => schedule.tasks.filter((t) => t.status !== 'done'),
    [schedule.tasks],
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-ink-3">
        项目不存在
      </div>
    );
  }

  const handleBack = () => {
    setActiveView('projects');
  };

  const handleSortChange = (key: FileSortKey) => {
    setSortKey(key);
  };

  const handleSetStatus = async (status: ProjectStatus) => {
    if (activeProjectId == null) return;
    await projectApi.setStatus(activeProjectId, status);
    await refreshProjects();
  };

  const handleAddFiles = () => {
    if (activeProjectId == null) return;
    openModal({ type: 'add-files-to-project', projectId: activeProjectId });
  };

  const handleRemoveContact = async (contactId: number) => {
    if (activeProjectId == null) return;
    try {
      await contactApi.setProjectContacts(
        activeProjectId,
        contacts.map((c) => c.id).filter((id) => id !== contactId),
      );
      setContactReloadKey((key) => key + 1);
    } catch {
      showToast('移除关联联系人失败', 'error');
    }
  };

  // 从通讯录拖入联系人 → 关联到当前项目
  const handleContactsDragOver = (e: React.DragEvent) => {
    if (!isContactDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOverContacts) setDragOverContacts(true);
  };

  const handleContactsDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverContacts(false);
  };

  const handleContactsDrop = (e: React.DragEvent) => {
    if (!isContactDrag(e.dataTransfer)) return;
    e.preventDefault();
    setDragOverContacts(false);

    const contactIds = readContactDragIds(e);
    if (contactIds.length === 0 || activeProjectId == null) return;

    contactApi
      .addToProjects([activeProjectId], contactIds)
      .then((result) => {
        setContactReloadKey((key) => key + 1);
        showToast(
          result.fail > 0
            ? `已关联 ${result.ok} 项，失败 ${result.fail} 项`
            : `已关联 ${contactIds.length} 位联系人`,
        );
      })
      .catch(() => showToast('关联联系人失败', 'error'));
  };

  const isActive = project.status === 'active';

  // 阶段步骤由真实数据派生：创建 → 执行跟进（待办任务）→ 收尾归档
  const steps = [
    {
      title: '1. 项目准备',
      desc: '创建项目并归集资料',
      meta: `创建于 ${formatShortDate(project.createdAt)}`,
      state: 'done' as const,
    },
    {
      title: '2. 执行跟进',
      desc: '推进任务与日程安排',
      meta: `${openTasks.length} 项任务待完成`,
      state: isActive ? ('active' as const) : ('done' as const),
    },
    {
      title: '3. 收尾归档',
      desc: '任务清零，项目归档',
      meta: isActive ? '改状态后完成' : '项目已归档',
      state: isActive ? ('todo' as const) : ('done' as const),
    },
  ];

  return (
    <div
      className={cn(
        'relative flex flex-1 min-h-0',
        dragOverContacts && 'ring-2 ring-inset ring-accent/40',
      )}
      onDragOver={handleContactsDragOver}
      onDragLeave={handleContactsDragLeave}
      onDrop={handleContactsDrop}
    >
      {/* 中间主内容区 */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-white">
        {/* 头部标题区 */}
        <header className="px-6 py-4 border-b border-line flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-hover text-ink-3 hover:text-ink flex-shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-lg font-semibold text-ink flex items-center gap-2 min-w-0">
              <span className="truncate">{project.name}</span>
              <span
                className={cn(
                  'flex-shrink-0 text-xs font-normal px-2 py-0.5 rounded-full',
                  isActive ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-bg-panel text-ink-3',
                )}
              >
                {isActive ? '进行中' : '已完成'}
              </span>
            </h1>
          </div>

          <button
            className="h-8 px-3 flex items-center gap-1 text-sm text-ink-2 border border-line rounded hover:bg-bg-hover flex-shrink-0"
            onClick={() => handleSetStatus(isActive ? 'done' : 'active')}
          >
            改状态
            <ChevronDown size={14} />
          </button>
        </header>

        {/* 工具栏 */}
        <div className="px-6 py-3 border-b border-line flex items-center gap-2.5 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={handleAddFiles}>
            <Plus size={14} className="mr-1" />
            添加文件
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openGraphFromFocus('project', project.id, project.name)}
          >
            <Share2 size={14} className="mr-1" />
            查看关系网
          </Button>
          <span className="text-sm text-ink-3">相关文件 {rows.length}</span>
          <div className="flex-1" />
          <Button variant="primary" size="sm" onClick={() => setScheduleEditorOpen(true)}>
            <Plus size={14} className="mr-1" />
            新建任务/日程
          </Button>
        </div>

        {/* 任务与日程面板 */}
        <section className="px-6 py-5 bg-[#fafafa] border-b border-line flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-semibold text-ink">任务与日程</div>
            <span className="text-xs text-ink-3">
              {scheduleLoading
                ? '加载中…'
                : `${openTasks.length} 项待办 · ${schedule.meetings.length} 个日程`}
            </span>
          </div>

          {/* 阶段进度 */}
          <div className="flex gap-3 mb-4">
            {steps.map((step) => (
              <div
                key={step.title}
                className={cn(
                  'flex-1 bg-white border border-line rounded-md p-3',
                  step.state === 'active' && 'border-accent shadow-sm',
                )}
              >
                <div className="font-semibold text-sm text-ink mb-0.5">{step.title}</div>
                <div className="text-xs text-ink-2 mb-2">{step.desc}</div>
                <div className="text-xs flex items-center justify-between text-ink-3">
                  <span>{step.meta}</span>
                  {step.state === 'done' && (
                    <span className="text-[#2e7d32] flex items-center gap-0.5">
                      <Check size={12} />
                      已完成
                    </span>
                  )}
                  {step.state === 'active' && <span className="text-accent">进行中</span>}
                  {step.state === 'todo' && <span>未开始</span>}
                </div>
              </div>
            ))}
          </div>

          {/* 具体任务列表 */}
          {scheduleLoading ? (
            <div className="text-sm text-ink-3">加载中…</div>
          ) : schedule.tasks.length === 0 && schedule.meetings.length === 0 ? (
            <div className="text-sm text-ink-3">
              暂无任务或日程。点右上角「+ 新建任务/日程」创建并关联本项目。
            </div>
          ) : (
            <div className="max-h-[220px] overflow-auto flex flex-col gap-2 pr-1">
              {schedule.tasks.map((task) => {
                const done = task.status === 'done';
                const remindIso = task.remindAt ?? task.dueAt;
                return (
                  <div
                    key={`task-${task.id}`}
                    className={cn(
                      'bg-white border border-line rounded-md px-3.5 py-2.5 flex items-center gap-3',
                      task.important && !done && 'border-l-[3px] border-l-danger',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => handleToggleTask(task)}
                      className="w-4 h-4 rounded border-line accent-accent cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          'text-sm truncate',
                          done ? 'text-ink-3 line-through' : 'text-ink',
                        )}
                      >
                        {task.title}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {done ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-bg-panel text-ink-3">
                            已完成
                          </span>
                        ) : (
                          <>
                            <span
                              className={cn(
                                'text-[11px] px-1.5 py-0.5 rounded',
                                task.important
                                  ? 'bg-[#ffebee] text-[#c62828]'
                                  : 'bg-accent-weak text-accent',
                              )}
                            >
                              {task.important ? '重要任务' : '任务'}
                            </span>
                            {remindIso && (
                              <span className="text-xs text-[#d32f2f] bg-[#fff3e0] px-2 py-0.5 rounded border border-[#ffe0b2]">
                                {formatRemind(remindIso)}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}

              {schedule.meetings.map((meeting) => (
                <div
                  key={`meeting-${meeting.id}`}
                  className="bg-white border border-line rounded-md px-3.5 py-2.5 flex items-center gap-3"
                >
                  <CalendarDays size={16} className="text-ink-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                    <span className="text-sm text-ink truncate">{meeting.title}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent-weak text-accent">
                        日程
                      </span>
                      <span className="text-xs text-ink-3">
                        {meeting.allDay ? '全天' : formatTime(meeting.startAt)}
                        {meeting.endAt && !meeting.allDay
                          ? ` - ${formatTime(meeting.endAt)}`
                          : ''}
                        {meeting.location ? ` · ${meeting.location}` : ''}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 文件列表区 */}
        <div className="flex flex-col flex-1 min-h-0">
          <FileList
            listKey={`project-${activeProjectId}`}
            rows={rows}
            loading={loading}
            sort={sort}
            sortActive={sortActive}
            onSortChange={handleSortChange}
            scene="project"
            currentProjectId={activeProjectId ?? undefined}
            emptyText="还没有相关文件。点「+ 添加文件」从全局文件中选择。"
            emptyIcon="folder"
            onRefresh={async () => {
              await refresh();
              await refreshProjects();
            }}
          />
        </div>
      </div>

      {/* 右侧相关联系人 */}
      <aside className="w-[260px] shrink-0 border-l border-line flex flex-col min-h-0 bg-white p-5">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="text-sm font-semibold text-ink">
            相关联系人 ({contacts.length})
          </span>
          <button
            type="button"
            onClick={() => setContactPickerOpen(true)}
            className="flex items-center gap-0.5 text-sm text-accent hover:text-accent-hover"
          >
            <Plus size={14} /> 添加
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {contacts.length === 0 ? (
            <EmptyState icon="folder" text="暂无相关联系人" className="py-10 px-3" />
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.id}
                className="group flex items-center gap-3 py-2.5 border-b border-[#f0f0f0] last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => setPeekContactId(contact.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-full text-white flex items-center justify-center text-sm shrink-0',
                      AVATAR_COLORS[contact.id % AVATAR_COLORS.length],
                    )}
                  >
                    {contact.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">
                      {contact.name}
                    </span>
                    <span className="block text-xs text-ink-3 truncate">
                      {contact.title ||
                        [contact.org, contact.department].filter(Boolean).join(' · ') ||
                        '未填写单位信息'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveContact(contact.id)}
                  title="移除关联"
                  className="w-6 h-6 rounded flex items-center justify-center text-ink-3 opacity-0 group-hover:opacity-100 hover:text-danger flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {contactPickerOpen && activeProjectId != null && (
        <ContactPickerDialog
          preselect={{ kind: 'project', id: activeProjectId }}
          onConfirm={async (contactIds) => {
            await contactApi.setProjectContacts(activeProjectId, contactIds);
            setContactReloadKey((key) => key + 1);
          }}
          onClose={() => setContactPickerOpen(false)}
        />
      )}

      {scheduleEditorOpen && activeProjectId != null && (
        <ScheduleEditorDialog
          mode="create"
          defaultType="task"
          defaultProjectId={activeProjectId}
          onClose={() => setScheduleEditorOpen(false)}
          onSaved={() => {
            setScheduleEditorOpen(false);
            reloadSchedule();
          }}
        />
      )}

      {/* 点击联系人从右侧滑出档案卡 */}
      {peekContactId != null && (
        <div className="absolute inset-y-0 right-0 w-[380px] bg-white border-l border-line shadow-2xl z-30">
          {peekDetail ? (
            <ContactDetailCard
              detail={peekDetail}
              readOnly
              onRefresh={() => setContactReloadKey((key) => key + 1)}
              onSelectProject={(projectId) => {
                setPeekContactId(null);
                setActiveProjectId(projectId);
              }}
              onClose={() => setPeekContactId(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-ink-3">
              加载中…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
