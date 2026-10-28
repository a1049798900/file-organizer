import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { clampPanelWidth } from '@/lib/layout';

export interface ResizerProps {
  /** 控制方向：
   *  - 'left'  → 拖拽调整 Resizer **左侧** 的面板宽度（鼠标向右 → 左面板变宽）
   *  - 'right' → 拖拽调整 Resizer **右侧** 的面板宽度（鼠标向左 → 右面板变宽）
   */
  direction: 'left' | 'right';
  /** 当前面板宽度（受控，px） */
  value: number;
  /** 实时变更回调（调用方写回 store 或本地状态） */
  onChange: (width: number) => void;
  /** 面板最小宽度，默认 160 */
  min?: number;
  /** 面板最大宽度 px，默认 600；实际最大不超过窗口宽度的 maxPct */
  max?: number;
  /** 窗口占比上限（0~1），默认 0.4，防止面板挤压主内容区 */
  maxPct?: number;
  /** 双击时恢复的默认宽度 */
  defaultSize?: number;
  /** 禁用时完全隐藏（不占位） */
  disabled?: boolean;
  /** 是否在 Resizer 与面板交界处显示辅助参考线（拖拽中才显示） */
  showGuide?: boolean;
  /** 额外 className */
  className?: string;
}

/** Resizer 统一委托给 layout.ts 共享钳制函数 */
function clampWidth(next: number, min: number, max: number, maxPct: number): number {
  return clampPanelWidth(next, { min, max, maxPct, defaultSize: max });
}

export function Resizer({
  direction,
  value,
  onChange,
  min = 160,
  max = 600,
  maxPct = 0.4,
  defaultSize,
  disabled = false,
  showGuide = true,
  className,
}: ResizerProps) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const latestWidthRef = useRef(value);
  const rafIdRef = useRef<number | null>(null);

  // 保持 ref 与受控值同步，供 mouseup 时读最终值
  useEffect(() => {
    latestWidthRef.current = value;
  }, [value]);

  const handleDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      // 防止冒泡到父容器的点击/拖拽事件
      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      startWidthRef.current = value;
      latestWidthRef.current = value;
      setDragging(true);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [disabled, value],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      // 只记录到 ref，rAF 节流后再 setState
      const delta =
        direction === 'left'
          ? e.clientX - startXRef.current // 鼠标右拖 → 左侧面板变宽
          : startXRef.current - e.clientX; // 鼠标左拖 → 右侧面板变宽

      const candidate = clampWidth(
        startWidthRef.current + delta,
        min,
        max,
        maxPct,
      );

      latestWidthRef.current = candidate;

      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          onChange(latestWidthRef.current);
        });
      }
    };

    const handleUp = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        // 最后 flush 一次，保证最终值写回
        onChange(latestWidthRef.current);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('blur', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('blur', handleUp);

      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [dragging, direction, min, max, maxPct, onChange]);

  const handleDoubleClick = useCallback(() => {
    if (disabled || defaultSize == null) return;
    onChange(clampWidth(defaultSize, min, max, maxPct));
  }, [disabled, defaultSize, min, max, maxPct, onChange]);

  if (disabled) return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="调整面板宽度"
      className={cn(
        'relative flex-shrink-0 w-1 cursor-col-resize',
        'transition-colors',
        'hover:bg-accent/30',
        dragging && 'bg-accent/40',
        className,
      )}
      onMouseDown={handleDown}
      onDoubleClick={handleDoubleClick}
      title={
        defaultSize != null
          ? '双击恢复默认宽度'
          : undefined
      }
    >
      {/* 拖拽中的蓝色辅助线（画在 Resizer 自身两侧外） */}
      {dragging && showGuide && (
        <div
          className={cn(
            'absolute top-0 bottom-0 w-px bg-accent pointer-events-none',
            direction === 'left' ? '-left-px' : '-right-px',
            'shadow-[0_0_8px_rgba(10,132,255,0.4)]',
          )}
        />
      )}
    </div>
  );
}
