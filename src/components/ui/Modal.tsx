import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number | string;
  className?: string;
  hideClose?: boolean;
}

export function Modal({ open, onClose, title, children, width = 480, className, hideClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        className={cn(
          'relative bg-white rounded-card shadow-xl border border-line',
          'flex flex-col max-h-[80vh]',
          className,
        )}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between h-12 px-4 border-b border-line flex-shrink-0">
            <div className="text-lg font-semibold text-ink">{title}</div>
            {!hideClose && (
              <IconButton size={28} onClick={onClose} aria-label="关闭">
                <X size={16} />
              </IconButton>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
