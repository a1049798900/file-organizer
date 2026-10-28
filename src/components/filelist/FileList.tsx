import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileRow as FileRowType, FileSortKey, FileSort, FileListScene } from '@shared/types';
import { FileListHeader } from './FileListHeader';
import { FileRow } from './FileRow';
import { SkeletonRow } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { useSelectionStore } from '@/stores/useSelectionStore';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { useHotkeys } from '@/hooks/useHotkeys';
import { fileApi, projectApi } from '@/lib/ipc';
import { setFileDragData } from '@/lib/drag';
import { cn } from '@/lib/cn';
import {
  type ColumnKey,
  type ColumnWidths,
  contentWidth,
  loadColumnWidths,
  saveColumnWidths,
} from './fileColumns';

export interface FileListProps {
  listKey: string;
  rows: FileRowType[];
  loading: boolean;
  sort: FileSort;
  sortActive?: boolean;
  onSortChange: (key: FileSortKey) => void;
  showSourceBadge?: boolean;
  scene: FileListScene;
  currentProjectId?: number;
  onRefresh?: () => void;
  emptyText: string;
  emptyIcon?: 'inbox' | 'folder' | 'search' | 'kb' | 'file';
}

const ROW_HEIGHT = 36;

export function FileList({
  listKey,
  rows: rowsProp,
  loading,
  sort,
  sortActive = false,
  onSortChange,
  showSourceBadge = false,
  scene,
  currentProjectId,
  onRefresh,
  emptyText,
  emptyIcon = 'file',
}: FileListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 列宽：从 localStorage 读取，拖拽时实时更新，松开时持久化
  const [widths, setWidths] = useState<ColumnWidths>(() => loadColumnWidths());
  // 滚动容器可视宽度（用于 name 列吸收富余空间）
  const [containerWidth, setContainerWidth] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 合并 ref：同时供虚拟滚动/快捷键与宽度测量使用
  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    resizeObserverRef.current?.disconnect();
    if (el) {
      setContainerWidth(el.clientWidth);
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      ro.observe(el);
      resizeObserverRef.current = ro;
    }
  }, []);

  useEffect(() => {
    return () => resizeObserverRef.current?.disconnect();
  }, []);

  const handleResize = useCallback((key: ColumnKey, width: number) => {
    setWidths((prev) => ({ ...prev, [key]: width }));
  }, []);

  const handleResizeCommit = useCallback(() => {
    setWidths((prev) => {
      saveColumnWidths(prev);
      return prev;
    });
  }, []);
  // 兜底：上游异常时 rows 可能为 undefined/null，统一归为空数组
  const rows = useMemo(() => (Array.isArray(rowsProp) ? rowsProp : []), [rowsProp]);
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const selection = useSelectionStore();
  const openContextMenu = useUiStore((s) => s.openContextMenu);
  const showToast = useUiStore((s) => s.showToast);
  const openModal = useUiStore((s) => s.openModal);
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen);
  const setPreviewFileId = useUiStore((s) => s.setPreviewFileId);
  const bumpFilesRevision = useDataStore((s) => s.bumpFilesRevision);

  const selectedIds = selection.getIds(listKey);
  const focusId = selection.getFocus(listKey);

  /** 单选时加载预览，多选/清空时收起右侧面板 */
  const syncPreviewWithSelection = useCallback(() => {
    const ids = useSelectionStore.getState().getIds(listKey);
    if (ids.length === 1) {
      setPreviewFileId(ids[0]);
      setPreviewOpen(true);
    } else {
      setPreviewOpen(false);
    }
  }, [listKey, setPreviewFileId, setPreviewOpen]);

  // 虚拟滚动（@tanstack/react-virtual v3 通过方法获取，实例上无 virtualItems/totalSize 属性）
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems() ?? [];
  const totalSize = virtualizer.getTotalSize();

  // 滚动到焦点行
  useEffect(() => {
    if (focusId != null) {
      const idx = allIds.indexOf(focusId);
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: 'auto' });
      }
    }
  }, [focusId, allIds, virtualizer]);

  // 行点击处理
  const handleRowClick = useCallback(
    (e: React.MouseEvent, fileId: number) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlOrCmd) {
        selection.toggle(listKey, fileId);
      } else if (e.shiftKey) {
        selection.range(listKey, fileId, allIds);
      } else {
        selection.single(listKey, fileId);
      }

      // 单选打开预览，多选则收起右侧面板
      syncPreviewWithSelection();
    },
    [listKey, allIds, selection, syncPreviewWithSelection],
  );

  const handleToggleSelect = useCallback(
    (fileId: number) => {
      selection.toggle(listKey, fileId);
      syncPreviewWithSelection();
    },
    [listKey, selection, syncPreviewWithSelection],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === allIds.length && allIds.length > 0) {
      selection.clear(listKey);
    } else {
      selection.selectAll(listKey, allIds);
    }
    syncPreviewWithSelection();
  }, [listKey, allIds, selectedIds.length, selection, syncPreviewWithSelection]);

  // 拖拽文件到联系人：选中行按多选集合拖出，未选中行先单选
  const handleRowDragStart = useCallback(
    (e: React.DragEvent, fileId: number) => {
      const selIds = selection.getIds(listKey);
      if (!selIds.includes(fileId)) {
        selection.single(listKey, fileId);
        setFileDragData(e, [fileId]);
        return;
      }
      setFileDragData(e, selIds);
    },
    [listKey, selection],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, fileId: number) => {
      e.preventDefault();

      // 如果右键行不在选中集合中，先清空选中再选这行
      if (!selection.isSelected(listKey, fileId)) {
        selection.single(listKey, fileId);
      }

      const selIds = selection.getIds(listKey);
      const ids = selIds.length > 0 ? selIds : [fileId];

      // 右键单行时同步选中并加载预览；多选时收起面板
      if (ids.length === 1) {
        setPreviewFileId(fileId);
        setPreviewOpen(true);
      } else {
        setPreviewOpen(false);
      }

      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        fileIds: ids,
        scene,
        currentProjectId,
      });
    },
    [listKey, selection, openContextMenu, scene, currentProjectId, setPreviewFileId, setPreviewOpen],
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // 点击空白区域清空选择
      if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.spacer === 'true') {
        selection.clear(listKey);
      }
    },
    [listKey, selection],
  );

  // 双击用系统程序打开
  const handleRowDoubleClick = useCallback(
    async (fileId: number) => {
      const file = rows.find((r) => r.id === fileId);
      if (!file || file.pathMissing) return;
      await fileApi.open(fileId);
    },
    [rows],
  );

  // 快捷键
  const handleMoveUp = useCallback(() => {
    const currentFocus = selection.getFocus(listKey);
    const currentIdx = currentFocus != null ? allIds.indexOf(currentFocus) : -1;
    const newIdx = currentIdx > 0 ? currentIdx - 1 : 0;
    if (allIds[newIdx] != null) {
      selection.setFocus(listKey, allIds[newIdx]);
      setPreviewFileId(allIds[newIdx]);
      setPreviewOpen(true);
    }
  }, [listKey, allIds, selection, setPreviewFileId, setPreviewOpen]);

  const handleMoveDown = useCallback(() => {
    const currentFocus = selection.getFocus(listKey);
    const currentIdx = currentFocus != null ? allIds.indexOf(currentFocus) : -1;
    const newIdx = currentIdx < allIds.length - 1 ? currentIdx + 1 : 0;
    if (allIds[newIdx] != null) {
      selection.setFocus(listKey, allIds[newIdx]);
      setPreviewFileId(allIds[newIdx]);
      setPreviewOpen(true);
    }
  }, [listKey, allIds, selection, setPreviewFileId, setPreviewOpen]);

  const handleDelete = useCallback(() => {
    const selIds = selection.getIds(listKey);
    const targetIds = selIds.length > 0 ? selIds : (focusId != null ? [focusId] : []);
    if (targetIds.length === 0) return;

    // 根据 scene 决定是"取消与项目的关联（不动全局索引）"还是"从软件移除"
    const isProjectScene = scene === 'project' && currentProjectId != null;

    const title = isProjectScene
      ? `取消与项目的关联 ${targetIds.length} 项？`
      : `从软件移除 ${targetIds.length} 项？`;

    const message = isProjectScene
      ? '文件将从当前项目的关联中移除，磁盘文件不受影响。'
      : '文件仍在磁盘原位置，只是不再显示在 Weave 中。';

    const confirmText = isProjectScene ? '取消关联' : '从软件移除';

    openModal({
      type: 'confirm',
      config: {
        title,
        message,
        confirmText,
        onConfirm: async () => {
          try {
            if (isProjectScene && currentProjectId != null) {
              // 取消与项目的关联（单 API 不支持批量，循环调用）
              for (const fid of targetIds) {
                await projectApi.removeFile(currentProjectId, fid);
              }
              showToast(`已取消 ${targetIds.length} 个文件的项目关联`);
            } else {
              // 从软件移除
              const result = await fileApi.remove(targetIds);
              if (result.fail > 0) {
                openModal({ type: 'batch-result', config: result });
              }
            }
            selection.clear(listKey);
            setPreviewOpen(false);   // 被删文件的预览面板必须关闭
            bumpFilesRevision();     // 触发全项目 useFileList 重拉
            onRefresh?.();
          } catch (e) {
            showToast('操作失败', 'error');
          }
        },
      },
    });
  }, [listKey, focusId, selection, openModal, scene, currentProjectId, bumpFilesRevision, setPreviewOpen, onRefresh, showToast]);

  const handleEsc = useCallback(() => {
    selection.clear(listKey);
  }, [listKey, selection]);

  const handleEnter = useCallback(() => {
    const targetId = focusId ?? selectedIds[0];
    if (targetId == null) return;
    const file = rows.find((r) => r.id === targetId);
    if (!file || file.pathMissing) return;
    fileApi.open(targetId);
  }, [focusId, selectedIds, rows]);

  const handleSelectAllHotkey = useCallback(() => {
    selection.selectAll(listKey, allIds);
  }, [listKey, allIds, selection]);

  useHotkeys({
    containerRef,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onDelete: handleDelete,
    onEsc: handleEsc,
    onEnter: handleEnter,
    onSelectAll: handleSelectAllHotkey,
    enabled: rows.length > 0,
  });

  // 内容总宽：各列设定宽之和；name 列吸收容器富余空间
  const cw = contentWidth(widths, containerWidth);

  const headerProps = {
    sort,
    sortActive,
    onSortChange,
    showSourceBadge,
    widths,
    containerWidth,
    onResize: handleResize,
    onResizeCommit: handleResizeCommit,
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div ref={setContainer} className="flex-1 min-h-0 overflow-auto">
          <div style={{ width: cw, minWidth: '100%' }}>
            <FileListHeader {...headerProps} allIds={[]} selectedCount={0} onToggleSelectAll={() => {}} />
            <div className="p-1">
              <SkeletonRow count={5} height={ROW_HEIGHT} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div
          ref={setContainer}
          className="flex-1 min-h-0 overflow-auto"
          onClick={handleContainerClick}
        >
          <div style={{ width: cw, minWidth: '100%', minHeight: '100%' }} data-spacer="true">
            <FileListHeader {...headerProps} allIds={[]} selectedCount={0} onToggleSelectAll={() => {}} />
            <EmptyState text={emptyText} icon={emptyIcon} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={setContainer}
        className={cn('flex-1 min-h-0 overflow-auto', 'focus:outline-none')}
        tabIndex={0}
        onClick={handleContainerClick}
      >
        <div style={{ width: cw, minWidth: '100%' }}>
          <FileListHeader
            {...headerProps}
            allIds={allIds}
            selectedCount={selectedIds.length}
            onToggleSelectAll={handleSelectAll}
          />
          <div style={{ height: totalSize, position: 'relative' }} data-spacer="true">
            {virtualItems.map((virtualItem) => {
              const file = rows[virtualItem.index];
              if (!file) return null;
              return (
                <FileRow
                  key={file.id}
                  file={file}
                  isSelected={selection.isSelected(listKey, file.id)}
                  isFocused={focusId === file.id}
                  onToggleSelect={() => handleToggleSelect(file.id)}
                  onRowClick={(e) => handleRowClick(e, file.id)}
                  onRowDoubleClick={() => handleRowDoubleClick(file.id)}
                  onContextMenu={(e) => handleContextMenu(e, file.id)}
                  draggable
                  onDragStart={(e) => handleRowDragStart(e, file.id)}
                  showSourceBadge={showSourceBadge}
                  showKbBadge={scene === 'project'}
                  widths={widths}
                  containerWidth={containerWidth}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
