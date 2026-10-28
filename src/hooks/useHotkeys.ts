// useHotkeys — 列表快捷键（↑↓/Delete/Esc/Enter/Ctrl+A）
import { useEffect, useRef } from 'react';

interface UseHotkeysOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onEsc: () => void;
  onEnter: () => void;
  onSelectAll: () => void;
  enabled?: boolean;
}

export function useHotkeys({
  containerRef,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEsc,
  onEnter,
  onSelectAll,
  enabled = true,
}: UseHotkeysOptions): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      const target = e.target as HTMLElement;
      // 忽略输入框内的快捷键
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onMoveUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onMoveDown();
          break;
        case 'Delete':
        case 'Backspace':
          if (!ctrlOrCmd) {
            e.preventDefault();
            onDelete();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onEsc();
          break;
        case 'Enter':
          e.preventDefault();
          onEnter();
          break;
        case 'a':
        case 'A':
          if (ctrlOrCmd) {
            e.preventDefault();
            onSelectAll();
          }
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, onMoveUp, onMoveDown, onDelete, onEsc, onEnter, onSelectAll]);
}
