import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, indeterminate, ...props },
  ref,
) {
  return (
    <div className="relative inline-flex items-center justify-center w-4 h-4">
      <input
        ref={(el) => {
          if (el) {
            el.indeterminate = indeterminate ?? false;
          }
          if (typeof ref === 'function') {
            ref(el);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }
        }}
        type="checkbox"
        className={cn(
          'w-4 h-4 rounded border border-line bg-white',
          'text-accent accent-accent',
          'cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          className,
        )}
        {...props}
      />
    </div>
  );
});
