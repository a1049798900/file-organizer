// 活跃项目（占 2 列）— 复用项目卡片逻辑，展示最近更新的 4 个项目
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronRight } from 'lucide-react';
import type { ProjectRow } from '@shared/types';
import { projectApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DashboardCard } from './DashboardCard';

export function ActiveProjects() {
  // 独立拉取全量项目（不受项目页筛选影响）；store.projects 变化时跟随刷新
  const storeProjects = useDataStore((s) => s.projects);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    projectApi
      .list('all')
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storeProjects]);

  const recent = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4),
    [projects],
  );

  const handleOpen = (id: number) => {
    setActiveProjectId(id);
    setActiveView('project-detail');
  };

  return (
    <DashboardCard
      title="活跃项目"
      icon={<Briefcase size={16} className="text-accent" />}
      className="col-span-2"
      action={
        <button
          onClick={() => setActiveView('projects')}
          className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1"
        >
          查看全部
          <ChevronRight size={12} />
        </button>
      }
    >
      {recent.length === 0 ? (
        <p className="text-sm text-gray-400">还没有项目，点击右上角「新建项目」开始。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {recent.map((p) => {
            const active = p.status === 'active';
            return (
              <button
                key={p.id}
                onClick={() => handleOpen(p.id)}
                className={cn(
                  'text-left border border-gray-200 rounded-lg p-4 transition-all cursor-pointer group',
                  'hover:border-accent/40 hover:shadow-md',
                  active ? 'bg-white' : 'bg-gray-50/50',
                )}
              >
                <h3
                  className={cn(
                    'font-medium mb-1.5 truncate transition-colors',
                    active
                      ? 'text-gray-900 group-hover:text-accent'
                      : 'text-gray-700',
                  )}
                >
                  {p.name}
                </h3>
                <div className="flex items-center gap-1.5 mb-4">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      active ? 'bg-accent' : 'bg-gray-400',
                    )}
                  />
                  <span className={cn('text-xs', active ? 'text-gray-500' : 'text-gray-400')}>
                    {active ? '进行中' : '已完成'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>文件 {p.fileCount}</span>
                  <span>{formatShortDate(p.updatedAt)} 更新</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
