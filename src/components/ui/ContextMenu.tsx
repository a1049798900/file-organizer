import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function ContextMenu({ x, y, onClose, children, className }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleScroll = () => onClose();
    const handleBlur = () => onClose();

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onClose]);

  // 调整位置避免超出视口
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[200px] py-1',
        'rounded-lg border border-line bg-white shadow-lg',
        'text-base',
        className,
      )}
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps {
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
  icon?: ReactNode;
}

export function MenuItem({ onClick, disabled, danger, children, icon }: MenuItemProps) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left',
        'hover:bg-accent-weak hover:text-accent',
        disabled ? 'text-ink-3 cursor-not-allowed hover:bg-transparent hover:text-ink-3' : '',
        danger ? 'text-danger hover:bg-red-50 hover:text-danger' : '',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div className="h-px bg-line my-1" />;
}

export interface MenuSubmenuProps {
  label: string;
  children: ReactNode;
}

export function MenuSubmenu({ label, children }: MenuSubmenuProps) {
  return (
    <div className="relative group">
      <button
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 text-left',
          'hover:bg-accent-weak hover:text-accent',
        )}
      >
        <span>{label}</span>
        <span className="text-ink-3">▸</span>
      </button>
      <div
        className={cn(
          'absolute left-full top-0 ml-0.5 min-w-[180px]',
          'py-1 rounded-lg border border-line bg-white shadow-lg',
          'hidden group-hover:block',
        )}
      >
        {children}
      </div>
    </div>
  );
}
