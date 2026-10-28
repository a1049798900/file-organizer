import { useMemo, useState, useCallback, useEffect } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';
import { EmptyState } from '../ui/EmptyState';
import { ContextMenu, MenuItem, MenuSeparator } from '../ui/ContextMenu';
import { contactApi, projectApi } from '@/lib/ipc';
import { isContactDrag, readContactDragIds } from '@/lib/drag';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const filters = [
  { key: 'all' as const, label: '全部' },
  { key: 'active' as const, label: '进行中' },
  { key: 'done' as const, label: '已完成' },
] as const;

export function ProjectsView() {
  const projects = useDataStore((s) => s.projects);
  const projectFilter = useDataStore((s) => s.projectFilter);
  const setProjectFilter = useDataStore((s) => s.setProjectFilter);
  const refreshProjects = useDataStore((s) => s.refreshProjects);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const openModal = useUiStore((s) => s.openModal);
  const showToast = useUiStore((s) => s.showToast);

  const [dragOverProjectId, setDragOverProjectId] = useState<number | null>(null);

  // 拖拽结束（无论在何处松手）时清除卡片高亮
  useEffect(() => {
    const clear = () => setDragOverProjectId(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    projectId: number;
    projectName: string;
  } | null>(null);

  const handleNewProject = () => {
    openModal({ type: 'new-project' });
  };

  const handleProjectClick = (id: number) => {
    setActiveProjectId(id);
    setActiveView('project-detail');
  };

  const handleProjectContextMenu = useCallback(
    (e: React.MouseEvent, projectId: number, projectName: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, projectId, projectName });
    },
    [],
  );

  const handleRename = () => {
    if (!contextMenu) return;
    openModal({
      type: 'rename',
      target: 'project',
      id: contextMenu.projectId,
      name: contextMenu.projectName,
    });
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    const { projectId, projectName } = contextMenu;
    setContextMenu(null);
    openModal({
      type: 'confirm',
      config: {
        title: `删除项目「${projectName}」？`,
        message: '文件本身不受影响，仅解除关联。',
        confirmText: '删除',
        onConfirm: async () => {
          await projectApi.delete(projectId);
          await refreshProjects();
        },
      },
    });
  };

  const filteredProjects = projects; // 已在 store 中按 filter 过滤

  // 从通讯录拖入联系人 → 关联到该项目
  const handleCardDragOver = (e: React.DragEvent, projectId: number) => {
    if (!isContactDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverProjectId !== projectId) setDragOverProjectId(projectId);
  };

  const handleCardDragLeave = (e: React.DragEvent, projectId: number) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverProjectId((current) => (current === projectId ? null : current));
  };

  const handleCardDrop = (e: React.DragEvent, projectId: number) => {
    if (!isContactDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverProjectId(null);

    const contactIds = readContactDragIds(e);
    if (contactIds.length === 0) return;

    contactApi
      .addToProjects([projectId], contactIds)
      .then((result) => {
        showToast(
          result.fail > 0
            ? `已关联 ${result.ok} 项，失败 ${result.fail} 项`
            : `已关联 ${contactIds.length} 位联系人`,
        );
      })
      .catch(() => showToast('关联联系人失败', 'error'));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 标题栏 */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-line flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold text-ink">项目 ({projects.length})</div>

          {/* 筛选胶囊 */}
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setProjectFilter(f.key)}
                className={cn(
                  'h-7 px-3 text-sm rounded-md transition-colors',
                  projectFilter === f.key
                    ? 'bg-accent text-white'
                    : 'bg-bg-panel text-ink-2 hover:bg-bg-hover',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Button variant="primary" onClick={handleNewProject}>
          <Plus size={16} className="mr-1" />
          新建项目
        </Button>
      </div>

      {/* 项目卡片网格 */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {projects.length === 0 ? (
          <EmptyState text="还没有项目。点「+ 新建项目」开始。" icon="folder" />
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {projects.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-card border border-line bg-white p-4 h-[120px] flex flex-col cursor-pointer hover:border-accent/40 hover:shadow-md transition-all',
                  dragOverProjectId === p.id && 'border-accent ring-2 ring-accent/40',
                )}
                onClick={() => handleProjectClick(p.id)}
                onContextMenu={(e) => handleProjectContextMenu(e, p.id, p.name)}
                onDragOver={(e) => handleCardDragOver(e, p.id)}
                onDragLeave={(e) => handleCardDragLeave(e, p.id)}
                onDrop={(e) => handleCardDrop(e, p.id)}
              >
                <div className="text-lg font-semibold text-ink truncate">{p.name}</div>
                <div
                  className={cn(
                    'text-sm flex items-center gap-1.5 mt-1',
                    p.status === 'active' ? 'text-accent' : 'text-ink-3',
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {p.status === 'active' ? '进行中' : '已完成'}
                </div>
                <div className="text-sm text-ink-2 mt-auto">文件 {p.fileCount}</div>
                <div className="text-xs text-ink-3">{formatShortDate(p.updatedAt)} 更新</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <MenuItem onClick={handleRename}>重命名</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={handleDelete} danger>
            删除项目
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  );
}
