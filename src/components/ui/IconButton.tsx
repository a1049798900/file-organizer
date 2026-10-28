import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, size = 32, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-ink-2',
        'hover:bg-bg-hover hover:text-ink',
        'active:bg-bg-panel',
        'transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
});
