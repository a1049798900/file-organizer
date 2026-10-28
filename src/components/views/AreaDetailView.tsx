// 领域详情 — 最小只读视图，仅展示任务与会议，不提供编辑能力
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Share2 } from 'lucide-react';
import type { AreaDetail } from '@shared/calendar';
import { calendarApi } from '@/lib/ipc';
import { openGraphFromFocus } from '@/lib/graphEntry';
import { useUiStore } from '@/stores/useUiStore';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { MeetingScheduleRow, TaskScheduleRow } from '../calendar/ScheduleList';

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        <span className="text-xs text-ink-3">{count}</span>
      </div>
      <div className="rounded-card border border-line bg-white px-3">{children}</div>
    </section>
  );
}

export function AreaDetailView() {
  const activeAreaId = useUiStore((s) => s.activeAreaId);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const [detail, setDetail] = useState<AreaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (activeAreaId == null) {
      setDetail(null);
      setError('领域不存在或已被删除');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    calendarApi
      .getAreaDetail(activeAreaId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setLoading(false);
        if (!result.area) setError('领域不存在或已被删除');
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setError('领域详情加载失败，请重试');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAreaId, reloadToken]);

  const handleBack = useCallback(() => setActiveView('calendar'), [setActiveView]);

  const totalCount = detail ? detail.tasks.length + detail.meetings.length : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-line flex-shrink-0">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-hover text-ink-2 flex-shrink-0"
          aria-label="返回日历"
          title="返回日历"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="text-xl font-semibold text-ink truncate">
          {detail?.area?.name ?? '领域'}
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-panel text-ink-3 flex-shrink-0">
          只读
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto flex-shrink-0"
          disabled={!detail?.area}
          onClick={() => {
            const area = detail?.area;
            if (area) openGraphFromFocus('area', area.id, area.name);
          }}
        >
          <Share2 size={14} className="mr-1" />
          查看关系网
        </Button>
        {!loading && !error && (
          <span className="text-xs text-ink-3 flex-shrink-0">共 {totalCount} 项</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {loading ? (
          <div className="max-w-[820px] space-y-2" aria-busy="true" aria-label="领域详情加载中">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-1 px-4 text-center">
            <AlertCircle size={36} strokeWidth={1.5} className="text-danger mb-1" />
            <div className="text-base text-ink-2">{error}</div>
            <div className="flex items-center gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => setReloadToken((t) => t + 1)}>
                重试
              </Button>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                返回日历
              </Button>
            </div>
          </div>
        ) : totalCount === 0 ? (
          <EmptyState text="该领域还没有任务或会议。" icon="folder" />
        ) : (
          <div className="max-w-[820px]">
            {detail && detail.tasks.length > 0 && (
              <Section title="任务" count={detail.tasks.length}>
                {detail.tasks.map((task) => (
                  <TaskScheduleRow key={task.id} task={task} />
                ))}
              </Section>
            )}

            {detail && detail.meetings.length > 0 && (
              <Section title="会议" count={detail.meetings.length}>
                {detail.meetings.map((meeting) => (
                  <MeetingScheduleRow key={meeting.id} meeting={meeting} />
                ))}
              </Section>
            )}

            <p className="text-xs text-ink-3">
              此页面仅用于查看，不会修改任务或会议的标题、时间与归属。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
