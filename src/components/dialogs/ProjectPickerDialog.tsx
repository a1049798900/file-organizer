import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { contactApi, projectApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import type { ProjectRow } from '@shared/types';

interface ProjectPickerDialogProps {
  contactIds: number[];
  onClose: () => void;
  onSaved: (linked: number) => void;
}

export function ProjectPickerDialog({
  contactIds,
  onClose,
  onSaved,
}: ProjectPickerDialogProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    let cancelled = false;
    projectApi
      .list('all')
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) showToast('加载项目失败', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await contactApi.addToProjects(Array.from(selected), contactIds);
      onSaved(result.ok);
      onClose();
    } catch {
      showToast('关联项目失败，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const keyword = query.trim().toLowerCase();
  const visibleProjects = keyword
    ? projects.filter((p) => p.name.toLowerCase().includes(keyword))
    : projects;

  return (
    <Modal
      open
      onClose={onClose}
      title={`批量关联项目（${contactIds.length} 位联系人）`}
      width={520}
    >
      <div className="p-3 border-b border-line">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索项目名称"
            className="w-full h-8 pl-8 pr-3 bg-bg-panel rounded-md text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">🔍</span>
        </div>
      </div>

      <div className="px-4 py-2 text-xs text-ink-3 border-b border-line bg-bg-panel/50">
        将为所选联系人追加项目关联，不移除已有关系。
      </div>

      <div style={{ height: 380 }} className="overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-3">
            加载中…
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-3">
            {query.trim() ? '没有找到匹配的项目' : '还没有项目，请先在项目页新建。'}
          </div>
        ) : (
          visibleProjects.map((project) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              className="w-full flex items-center gap-3 px-3 h-11 text-left border-b border-line/50 hover:bg-bg-hover cursor-pointer"
              onClick={() => toggle(project.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(project.id);
                }
              }}
            >
              <Checkbox
                checked={selected.has(project.id)}
                onChange={() => toggle(project.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="flex-1 min-w-0 text-base text-ink truncate">
                {project.name}
              </span>
              <span
                className={
                  project.status === 'active'
                    ? 'text-xs text-accent shrink-0'
                    : 'text-xs text-ink-3 shrink-0'
                }
              >
                {project.status === 'active' ? '进行中' : '已完成'}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <span className="text-sm text-ink-2">已选 {selected.size} 个项目</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={submitting || selected.size === 0}
          >
            确认关联
          </Button>
        </div>
      </div>
    </Modal>
  );
}
