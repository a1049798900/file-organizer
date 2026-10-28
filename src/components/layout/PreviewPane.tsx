// 右侧预览面板 — 预览区 / 基础信息 / 关联数据 / 底部操作
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { FileAssociations, FileRow } from '@shared/types';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { fileApi } from '@/lib/ipc';
import { startMoveFile } from '@/lib/moveFile';
import { openGraphFromFile } from '@/lib/graphEntry';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { FilePreview } from '../previews/FilePreview';
import { PreviewInfo } from '../previews/PreviewInfo';
import { NotFoundPreview } from '../previews/UnsupportedPreview';
import { cn } from '@/lib/cn';

const EMPTY_ASSOCIATIONS: FileAssociations = { tags: [], topics: [], projects: [] };

/** 键盘快速切换时只加载最后停住的那一行 */
const PREVIEW_DEBOUNCE_MS = 150;

export interface PreviewPaneProps {
  /** 嵌入模式：图谱抽屉内部使用，不读取全局预览状态 */
  embedded?: boolean;
  /** 嵌入模式下的文件 ID */
  fileId?: number | null;
  /** 只读模式：隐藏打开 / 定位 / 移动等写操作 */
  readOnly?: boolean;
  onClose?: () => void;
  /** 覆盖「查看关系网」的行为（图谱内部用于切换焦点） */
  onViewGraph?: (fileId: number, label: string) => void;
}

export function PreviewPane({
  embedded = false,
  fileId,
  readOnly = false,
  onClose,
  onViewGraph,
}: PreviewPaneProps = {}) {
  const previewOpen = useUiStore((s) => s.previewOpen);
  const previewWidth = useUiStore((s) => s.previewWidth);
  const storePreviewFileId = useUiStore((s) => s.previewFileId);
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen);
  const setPreviewFileId = useUiStore((s) => s.setPreviewFileId);
  const openGraph = useUiStore((s) => s.openGraph);
  const showToast = useUiStore((s) => s.showToast);
  const filesRevision = useDataStore((s) => s.filesRevision);

  const previewFileId = embedded ? (fileId ?? null) : storePreviewFileId;

  const [activeId, setActiveId] = useState<number | null>(null);
  const [file, setFile] = useState<FileRow | null>(null);
  const [associations, setAssociations] = useState<FileAssociations>(EMPTY_ASSOCIATIONS);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // 防抖：连续快速切行时只请求最后停住的文件
  useEffect(() => {
    if (previewFileId == null) {
      setActiveId(null);
      return;
    }
    const timer = setTimeout(() => setActiveId(previewFileId), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [previewFileId]);

  // 并行加载元数据与关联数据；移动/撤销后按版本号重新加载
  useEffect(() => {
    if (activeId == null) {
      setFile(null);
      setAssociations(EMPTY_ASSOCIATIONS);
      setLoading(false);
      setNotFound(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([fileApi.previewMeta(activeId), fileApi.associations(activeId)])
      .then(([meta, links]) => {
        if (cancelled) return;
        if (!meta) {
          setFile(null);
          setNotFound(true);
        } else {
          setFile(meta);
          setAssociations(links);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFile(null);
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, filesRevision]);

  if (!embedded && !previewOpen) return null;

  const hasTarget = previewFileId != null;
  const showSkeleton = hasTarget && !file && !notFound;

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    setPreviewOpen(false);
    setPreviewFileId(null);
  };

  const handleViewGraph = () => {
    if (!file) return;
    const label = file.alias || file.name;
    if (onViewGraph) {
      onViewGraph(file.id, label);
    } else {
      openGraphFromFile(file.id, label);
    }
  };

  const handleOpen = async () => {
    if (!file) return;
    const result = await fileApi.open(file.id);
    if (!result.ok && result.reason) showToast(result.reason, 'error');
  };

  const handleReveal = async () => {
    if (!file) return;
    await fileApi.reveal(file.id);
  };

  const handleMove = async () => {
    if (!file) return;
    await startMoveFile(file.id);
  };

  const actionsDisabled = !file || file.pathMissing;

  return (
    <div
      className={cn(
        'flex flex-col bg-white border-l border-line flex-shrink-0',
        embedded && 'h-full w-full border-l-0',
      )}
      style={embedded ? undefined : { width: previewWidth }}
    >
        {/* 头部 */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-line flex-shrink-0">
          <div className="text-sm font-medium text-ink truncate flex-1">
            {file ? file.alias || file.name : hasTarget ? '加载中…' : '选择文件预览'}
          </div>
          <IconButton size={28} onClick={handleClose} aria-label="关闭预览">
            <X size={16} />
          </IconButton>
        </div>

        {/* 加载骨架屏 */}
        {showSkeleton && (
          <div className="flex-1 min-h-0 overflow-hidden p-4 space-y-3">
            <Skeleton className="h-[260px] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {/* 文件不存在 */}
        {!showSkeleton && notFound && (
          <div className="flex-1">
            <NotFoundPreview />
          </div>
        )}

        {/* 空状态 */}
        {!showSkeleton && !notFound && !file && (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-3">
            选择文件以预览
          </div>
        )}

        {/* 预览内容 */}
        {!showSkeleton && file && (
          <>
            <div className="h-[300px] flex-shrink-0 border-b border-line bg-bg-panel/20">
              <FilePreview file={file} />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <PreviewInfo file={file} associations={associations} />
            </div>

            <div className="flex flex-shrink-0 flex-col gap-2 border-t border-line p-3">
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    className="flex-1"
                    disabled={actionsDisabled}
                    onClick={handleOpen}
                  >
                    用系统程序打开
                  </Button>
                  <Button variant="secondary" disabled={actionsDisabled} onClick={handleReveal}>
                    定位
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionsDisabled}
                    onClick={handleMove}
                    title="移动到文件夹"
                  >
                    📁 移动…
                  </Button>
                </div>
              )}
              <Button
                variant="secondary"
                className="w-full"
                disabled={actionsDisabled}
                onClick={handleViewGraph}
              >
                查看关系网
              </Button>
            </div>
          </>
        )}
      </div>
  );
}
