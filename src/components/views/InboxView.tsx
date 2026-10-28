import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { FileList } from '../filelist/FileList';
import { useFileList } from '@/hooks/useFileList';
import { useSelectionStore } from '@/stores/useSelectionStore';
import { Button } from '../ui/Button';
import { fileApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';

export function InboxView() {
  const source = useMemo(() => ({ kind: 'inbox' as const }), []);
  const [dragOver, setDragOver] = useState(false);

  const { rows, loading, refresh, sort, sortActive, setSortKey } = useFileList({
    listKey: 'inbox',
    source,
  });

  const selection = useSelectionStore();
  const refreshInboxCount = useDataStore((s) => s.refreshInboxCount);
  const showToast = useUiStore((s) => s.showToast);
  const selectedIds = selection.getIds('inbox');

  const handleMarkFiled = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : [];
    if (ids.length === 0) return;
    await fileApi.markFiled(ids);
    selection.clear('inbox');
    await refresh();
    await refreshInboxCount();
  };

  // 从系统拖入文件建立索引
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOver(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const paths = files
      .map((file) => {
        try {
          return fileApi.pathForFile(file);
        } catch {
          return '';
        }
      })
      .filter((p) => p.length > 0);

    if (paths.length === 0) {
      showToast('无法读取拖入的文件路径', 'error');
      return;
    }

    try {
      const result = await fileApi.indexPaths(paths);
      await refresh();
      await refreshInboxCount();
      if (result.ok > 0) {
        showToast(
          result.fail > 0
            ? `已索引 ${result.ok} 个文件，跳过 ${result.fail} 个`
            : `已索引 ${result.ok} 个文件`,
        );
      } else {
        showToast('仅支持拖入文件，文件夹请通过扫描根目录导入', 'error');
      }
    } catch {
      showToast('索引失败，请重试', 'error');
    }
  };

  const count = rows.length;

  return (
    <div
      className="relative flex flex-col flex-1 min-h-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 标题栏 */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-line flex-shrink-0">
        <div className="text-xl font-semibold text-ink">收件箱 ({count})</div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarkFiled}>
              标记已处理 ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      <FileList
        listKey="inbox"
        rows={rows}
        loading={loading}
        sort={sort}
        sortActive={sortActive}
        onSortChange={setSortKey}
        scene="inbox"
        emptyText="收件箱是空的，可直接把文件拖进来建立索引。"
        emptyIcon="inbox"
        onRefresh={async () => {
          await refresh();
          await refreshInboxCount();
        }}
      />

      {/* 拖拽提示遮罩 */}
      {dragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-accent bg-accent-weak pointer-events-none">
          <div className="px-4 py-2 bg-white rounded-md shadow-lg text-sm font-medium text-accent">
            松开鼠标，将文件加入收件箱
          </div>
        </div>
      )}
    </div>
  );
}
