import { useState, useMemo, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileList } from '../filelist/FileList';
import { useFileList } from '@/hooks/useFileList';
import { useSelectionStore } from '@/stores/useSelectionStore';
import { projectApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';

interface AddFilesToProjectDialogProps {
  projectId: number;
  onClose: () => void;
}

export function AddFilesToProjectDialog({ projectId, onClose }: AddFilesToProjectDialogProps) {
  const listKey = `add-files-project-${projectId}`;
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ⚠️ 关键修复：
  // 只订阅 length（原始 number），避免 getIds() 每次返回新数组引用导致
  // useSyncExternalStore 检测到"状态一直在变"→ Maximum update depth exceeded。
  // 需要完整数组时用 getState().getIds(listKey) 取一次性快照。
  const selectedCount = useSelectionStore((s) => s.getIds(listKey).length);

  const refreshProjects = useDataStore((s) => s.refreshProjects);
  const bumpFilesRevision = useDataStore((s) => s.bumpFilesRevision);
  const showToast = useUiStore((s) => s.showToast);

  // 关闭弹窗 / 组件卸载时清空 selection，防止下次打开残留
  useEffect(() => {
    return () => useSelectionStore.getState().clear(listKey);
  }, [listKey]);

  const source = useMemo(() => {
    if (searchQuery.trim()) {
      return { kind: 'search' as const, query: searchQuery };
    }
    return { kind: 'kb-all' as const };
  }, [searchQuery]);

  const { rows, loading, sort, sortActive, toggleSortDir, refresh } = useFileList({
    listKey,
    source,
    defaultSort: { key: 'mtime', dir: 'desc' },
  });

  const handleConfirm = useCallback(async () => {
    if (selectedCount === 0) return;
    // 取一次性快照，避免闭包中捕获的旧 selectedIds
    const ids = useSelectionStore.getState().getIds(listKey);
    if (ids.length === 0) return;

    setSubmitting(true);
    try {
      await projectApi.addFiles(projectId, ids);
      useSelectionStore.getState().clear(listKey);
      bumpFilesRevision();                 // ← 触发全局所有 useFileList 重拉
      await refreshProjects();             // ← 刷新项目列表元数据（名称/计数等）
      showToast(`成功添加 ${ids.length} 个文件`);
      onClose();
    } catch (e) {
      showToast('添加失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [selectedCount, projectId, listKey, bumpFilesRevision, refreshProjects, showToast, onClose]);

  return (
    <Modal open onClose={onClose} title="添加文件到项目" width={760}>
      <div className="p-3 border-b border-line">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件（为空时显示全部资料）"
            className="w-full h-8 pl-8 pr-3 bg-bg-panel rounded-md text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">🔍</span>
        </div>
      </div>

      <div style={{ height: 400 }} className="flex flex-col">
        <FileList
          listKey={listKey}
          rows={rows}
          loading={loading}
          sort={sort}
          sortActive={sortActive}
          onSortChange={(key) => toggleSortDir(key)}
          scene="project"
          emptyText="没有找到匹配的文件"
          emptyIcon="search"
          onRefresh={refresh}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <span className="text-sm text-ink-2">已选 {selectedCount} 项</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0 || submitting}
          >
            {submitting ? '添加中…' : '确认添加'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
