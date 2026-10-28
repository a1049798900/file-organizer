// 日历主视图 — 数据加载、三视图切换、键盘导航与状态处理
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays } from 'lucide-react';
import type { CalendarEvent } from '@shared/calendar';
import { groupEventsByDay } from '@shared/calendar';
import { calendarApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { getViewRange, shiftAnchor } from '@/lib/date';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { CalendarToolbar } from './CalendarToolbar';
import { EventDetailDialog } from './EventDetailDialog';
import { MonthView } from './MonthView';
import { ScheduleEditorDialog, type ScheduleType } from './ScheduleEditorDialog';
import { TimeGridView } from './TimeGridView';

type EditorState =
  | { mode: 'create'; type: ScheduleType; start: Date }
  | { mode: 'edit'; event: CalendarEvent };

function dateAtNine(date: Date): Date {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return next;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable
  );
}

function CalendarSkeleton() {
  return (
    <div
      className="flex-1 min-h-0 p-3 overflow-hidden"
      aria-busy="true"
      aria-label="日历加载中"
    >
      <div className="grid grid-cols-7 gap-1.5 h-full">
        {Array.from({ length: 42 }).map((_, index) => (
          <Skeleton key={index} className="h-full min-h-[56px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function CalendarView() {
  // 视图模式与锚点存入全局 UI 状态，从领域详情返回时可恢复
  const mode = useUiStore((s) => s.calendarMode);
  const anchorMs = useUiStore((s) => s.calendarAnchorMs);
  const setCalendarMode = useUiStore((s) => s.setCalendarMode);
  const setCalendarAnchorMs = useUiStore((s) => s.setCalendarAnchorMs);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const setActiveAreaId = useUiStore((s) => s.setActiveAreaId);
  const openModal = useUiStore((s) => s.openModal);
  const showToast = useUiStore((s) => s.showToast);

  const anchor = useMemo(() => new Date(anchorMs), [anchorMs]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const range = useMemo(() => getViewRange(mode, anchor), [mode, anchor]);
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    calendarApi
      .listEvents({
        start: new Date(rangeStart).toISOString(),
        end: new Date(rangeEnd).toISOString(),
      })
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setError('日历加载失败，请重试');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, reloadToken]);

  const eventsByDay = useMemo(
    () => groupEventsByDay(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd],
  );

  const handlePrev = useCallback(() => {
    setCalendarAnchorMs(shiftAnchor(mode, new Date(anchorMs), -1).getTime());
  }, [mode, anchorMs, setCalendarAnchorMs]);

  const handleNext = useCallback(() => {
    setCalendarAnchorMs(shiftAnchor(mode, new Date(anchorMs), 1).getTime());
  }, [mode, anchorMs, setCalendarAnchorMs]);

  const handleToday = useCallback(() => setCalendarAnchorMs(Date.now()), [setCalendarAnchorMs]);

  const handleDrillDown = useCallback(
    (date: Date) => {
      setCalendarAnchorMs(date.getTime());
      setCalendarMode('day');
    },
    [setCalendarAnchorMs, setCalendarMode],
  );

  const handleEventClick = useCallback((event: CalendarEvent) => {
    // 默认打开可编辑详情；跳转项目/领域改为详情内按钮
    setDetailEvent(event);
  }, []);

  const handleOpenProject = useCallback(
    (projectId: number) => {
      setDetailEvent(null);
      setActiveProjectId(projectId);
      setActiveView('project-detail');
    },
    [setActiveProjectId, setActiveView],
  );

  const handleOpenArea = useCallback(
    (areaId: number) => {
      setDetailEvent(null);
      setActiveAreaId(areaId);
      setActiveView('area-detail');
    },
    [setActiveAreaId, setActiveView],
  );

  const handleCreateAt = useCallback((date: Date) => {
    setEditor({ mode: 'create', type: 'meeting', start: dateAtNine(date) });
  }, []);

  const handleCreateSlot = useCallback((start: Date) => {
    setEditor({ mode: 'create', type: 'meeting', start });
  }, []);

  const handleCreateToolbar = useCallback(() => {
    setEditor({ mode: 'create', type: 'meeting', start: dateAtNine(anchor) });
  }, [anchor]);

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setDetailEvent(null);
    setEditor({ mode: 'edit', event });
  }, []);

  const handleDeleteEvent = useCallback(
    (event: CalendarEvent) => {
      const label = event.type === 'meeting' ? '会议' : '任务';
      const title = event.title.replace('（截止 + 提醒）', '');

      openModal({
        type: 'confirm',
        config: {
          title: `删除${label}`,
          message: `确定删除「${title}」？此操作不可撤销，仅删除该记录，不影响关联项目与文件。`,
          confirmText: '删除',
          onConfirm: () => {
            const deleting =
              event.sourceTable === 'project_meetings'
                ? calendarApi.deleteMeeting(Number(event.sourceId))
                : calendarApi.deleteTask(Number(event.sourceId));

            deleting
              .then(() => {
                setDetailEvent(null);
                setReloadToken((token) => token + 1);
                showToast('已删除');
              })
              .catch(() => showToast('删除失败，请重试', 'error'));
          },
        },
      });
    },
    [openModal, showToast],
  );

  const handleEditorSaved = useCallback(() => {
    setEditor(null);
    setReloadToken((token) => token + 1);
    showToast('日程已保存');
  }, [showToast]);

  // 键盘导航：M/W/D 切换视图，T 回到今天，←/→ 前后翻页
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // 详情或编辑器打开时不响应日历快捷键
      if (detailEvent || editor) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key.toLowerCase()) {
        case 'm':
          event.preventDefault();
          setCalendarMode('month');
          break;
        case 'w':
          event.preventDefault();
          setCalendarMode('week');
          break;
        case 'd':
          event.preventDefault();
          setCalendarMode('day');
          break;
        case 't':
          event.preventDefault();
          setCalendarAnchorMs(Date.now());
          break;
        case 'arrowleft':
          event.preventDefault();
          handlePrev();
          break;
        case 'arrowright':
          event.preventDefault();
          handleNext();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, setCalendarMode, setCalendarAnchorMs, detailEvent, editor]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CalendarToolbar
        mode={mode}
        anchor={anchor}
        onModeChange={setCalendarMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onCreate={handleCreateToolbar}
      />

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4 text-center">
          <AlertCircle size={36} strokeWidth={1.5} className="text-danger mb-1" />
          <div className="text-base text-ink-2">{error}</div>
          <div className="text-sm text-ink-3">任务与会议数据仍安全保存在本地</div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setReloadToken((token) => token + 1)}
          >
            重试
          </Button>
        </div>
      ) : loading ? (
        <CalendarSkeleton />
      ) : (
        <>
          {events.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-bg-panel/60 text-sm text-ink-2 flex-shrink-0">
              <CalendarDays size={14} className="text-ink-3" />
              这段时间还没有日程。任务截止、待办提醒和会议会显示在这里。
            </div>
          )}

          {mode === 'month' ? (
            <MonthView
              anchor={anchor}
              eventsByDay={eventsByDay}
              onDrillDown={handleDrillDown}
              onEventClick={handleEventClick}
              onCreateAt={handleCreateAt}
            />
          ) : (
            <TimeGridView
              mode={mode}
              anchor={anchor}
              eventsByDay={eventsByDay}
              onEventClick={handleEventClick}
              onCreateSlot={handleCreateSlot}
            />
          )}
        </>
      )}

      {detailEvent && (
        <EventDetailDialog
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
          onOpenProject={handleOpenProject}
          onOpenArea={handleOpenArea}
        />
      )}

      {editor && (
        <ScheduleEditorDialog
          mode={editor.mode}
          defaultType={editor.mode === 'create' ? editor.type : undefined}
          defaultStart={editor.mode === 'create' ? editor.start : undefined}
          event={editor.mode === 'edit' ? editor.event : undefined}
          onClose={() => setEditor(null)}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
}
