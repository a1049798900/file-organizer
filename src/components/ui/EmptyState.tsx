import { cn } from '@/lib/cn';
import { FileText, Search, FolderOpen, Inbox, BookOpen } from 'lucide-react';

interface EmptyStateProps {
  text: string;
  subtext?: string;
  icon?: 'inbox' | 'folder' | 'search' | 'kb' | 'file';
  className?: string;
}

const iconMap = {
  inbox: Inbox,
  folder: FolderOpen,
  search: Search,
  kb: BookOpen,
  file: FileText,
};

export function EmptyState({ text, subtext, icon = 'file', className }: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'text-ink-3 py-16',
        className,
      )}
    >
      <Icon size={40} strokeWidth={1.5} className="mb-3 opacity-60" />
      <div className="text-base text-ink-2">{text}</div>
      {subtext && <div className="text-sm text-ink-3 mt-1">{subtext}</div>}
    </div>
  );
}
