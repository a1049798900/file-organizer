// Bento 卡片外壳 — 统一标题栏与容器样式
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DashboardCardProps {
  title: string;
  icon: ReactNode;
  /** 标题栏右侧操作区（链接/徽标等） */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function DashboardCard({ title, icon, action, className, children }: DashboardCardProps) {
  return (
    <section
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm p-5',
        'hover:border-gray-300 hover:shadow-md transition-all',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
