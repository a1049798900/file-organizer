// PDF 预览 — pdfjs-dist 只读渲染，不提取正文
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { FileRow } from '@shared/types';
import { fileApi } from '@/lib/ipc';
import { IconButton } from '../ui/IconButton';
import { PreviewErrorState, PreviewSkeleton } from './PreviewStatus';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

interface PdfPreviewProps {
  file: FileRow;
}

export function PdfPreview({ file }: PdfPreviewProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [firstRender, setFirstRender] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // 载入文档
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    setDoc(null);
    setPageNum(1);
    setZoom(1);
    setError(null);
    setFirstRender(true);

    (async () => {
      try {
        const bytes = await fileApi.readBytes(file.id);
        if (cancelled) return;
        task = pdfjsLib.getDocument({ data: bytes });
        const loadingTask = task;
        const loaded = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        setDoc(loaded);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error && e.message ? e.message : '预览失败');
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      void task?.destroy();
    };
  }, [file.id]);

  // 渲染当前页
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;

    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const available = Math.max(180, (wrapRef.current?.clientWidth ?? 400) - 24);
        const fitScale = available / base.width;
        const viewport = page.getViewport({ scale: fitScale * zoom });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const task = page.render({
          canvas,
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setFirstRender(false);
      } catch (e) {
        // 渲染被取消属于正常流程，不视为错误
        if (cancelled) return;
        if (e instanceof Error && e.name === 'RenderingCancelledException') return;
        setError(e instanceof Error && e.message ? e.message : '预览失败');
        setFirstRender(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, pageNum, zoom]);

  if (error) {
    return <PreviewErrorState fileId={file.id} message="预览失败" />;
  }

  if (!doc && firstRender) {
    return <PreviewSkeleton />;
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={wrapRef}
        className="flex flex-1 items-start justify-center overflow-auto bg-bg-panel/40 p-3"
      >
        <div className="relative">
          <canvas ref={canvasRef} className="block rounded-sm bg-white shadow-sm" />
          {firstRender && (
            <div className="absolute inset-0 flex items-center justify-center">
              <PreviewSkeleton />
            </div>
          )}
        </div>
      </div>

      <div className="flex h-9 flex-shrink-0 items-center justify-center gap-1 border-t border-line bg-white px-2">
        <IconButton
          size={26}
          aria-label="上一页"
          disabled={pageNum <= 1}
          onClick={() => setPageNum((n) => Math.max(1, n - 1))}
        >
          <ChevronLeft size={15} />
        </IconButton>
        <span className="min-w-[56px] text-center text-xs tabular-nums text-ink-2">
          {pageNum} / {doc?.numPages ?? 0}
        </span>
        <IconButton
          size={26}
          aria-label="下一页"
          disabled={!doc || pageNum >= doc.numPages}
          onClick={() => setPageNum((n) => Math.min(doc?.numPages ?? n, n + 1))}
        >
          <ChevronRight size={15} />
        </IconButton>

        <span className="mx-1 h-4 w-px bg-line" />

        <IconButton
          size={26}
          aria-label="缩小"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z / 1.2).toFixed(2))))}
        >
          <Minus size={14} />
        </IconButton>
        <span className="min-w-[42px] text-center text-xs tabular-nums text-ink-2">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton
          size={26}
          aria-label="放大"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z * 1.2).toFixed(2))))}
        >
          <Plus size={14} />
        </IconButton>
        <IconButton size={26} aria-label="复位缩放" onClick={() => setZoom(1)}>
          <RotateCcw size={13} />
        </IconButton>
      </div>
    </div>
  );
}
