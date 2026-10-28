import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-bg-panel rounded animate-pulse',
        className,
      )}
      style={style}
    />
  );
}

export function SkeletonRow({ count = 3, height = 36 }: { count?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="w-full" style={{ height }} />
      ))}
    </div>
  );
}
