// 图片预览 — 居中自适应、滚轮缩放、拖拽平移
import { useEffect, useRef, useState } from 'react';
import { ImageOff, RotateCcw } from 'lucide-react';
import type { FileRow } from '@shared/types';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { fileApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.15;

interface ImagePreviewProps {
  file: FileRow;
}

export function ImagePreview({ file }: ImagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const showToast = useUiStore((s) => s.showToast);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dragging, setDragging] = useState(false);

  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // 切换文件时重置视图状态
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setStatus('loading');
    setDragging(false);
  }, [file.id]);

  // 滚轮缩放 — 以鼠标位置为中心
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      const prev = scaleRef.current;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      if (next === prev) return;

      const ratio = next / prev;
      const current = offsetRef.current;
      setOffset({
        x: cx - (cx - current.x) * ratio,
        y: cy - (cy - current.y) * ratio,
      });
      setScale(next);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (status !== 'ready' || e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({ x: drag.ox + (e.clientX - drag.x), y: drag.oy + (e.clientY - drag.y) });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleOpen = async () => {
    const result = await fileApi.open(file.id);
    if (!result.ok && result.reason) showToast(result.reason, 'error');
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-panel/40"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img
        src={`weave-asset://file/${file.id}`}
        alt={file.alias || file.name}
        draggable={false}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        className="max-h-full max-w-full select-none object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: dragging ? 'none' : 'transform 80ms ease-out',
          cursor: status === 'ready' ? (dragging ? 'grabbing' : 'grab') : 'default',
        }}
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Skeleton className="h-full w-full" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-panel/80 p-6 text-center">
          <ImageOff size={44} className="text-ink-3 opacity-70" strokeWidth={1.25} />
          <div className="text-sm font-medium text-ink">预览失败</div>
          <Button variant="primary" size="sm" onClick={handleOpen}>
            用系统程序打开
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-line bg-white/90 px-1.5 py-0.5 text-xs text-ink-2">
          <span className="tabular-nums">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={resetView}
            className="flex items-center gap-0.5 rounded px-1 hover:bg-bg-hover hover:text-ink"
            title="复位"
          >
            <RotateCcw size={12} />
            复位
          </button>
        </div>
      )}
    </div>
  );
}
