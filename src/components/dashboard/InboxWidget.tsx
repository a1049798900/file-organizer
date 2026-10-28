// 收件箱（占 1 列）— 未读数徽标 + 最新待收件文件
import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { FileRow } from '@shared/types';
import { fileApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatShortDate } from '@/lib/format';
import { DashboardCard } from './DashboardCard';

export function InboxWidget() {
  const inboxCount = useDataStore((s) => s.inboxCount);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setPreviewFileId = useUiStore((s) => s.setPreviewFileId);
  const [files, setFiles] = useState<FileRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fileApi
      .list({ kind: 'inbox' }, { key: 'mtime', dir: 'desc' })
      .then((list) => {
        if (!cancelled) setFiles(list.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inboxCount]);

  const handleOpen = (id: number) => {
    setPreviewFileId(id);
    setActiveView('inbox');
  };

  return (
    <DashboardCard
      title="收件箱"
      icon={<Inbox size={16} className="text-purple-500" />}
      className="col-span-1"
      action={
        inboxCount > 0 ? (
          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
            {inboxCount > 99 ? '99+' : inboxCount} 条未读
          </span>
        ) : undefined
      }
    >
      {files.length === 0 ? (
        <p className="text-sm text-gray-400">收件箱已清空。</p>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => handleOpen(f.id)}
              className="w-full text-left text-sm rounded-lg hover:bg-gray-50 p-1.5 -mx-1.5 transition-colors"
            >
              <p className="text-gray-800 truncate">
                <span className="font-medium">新文件：</span>
                {f.alias ?? f.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatShortDate(f.mtime)}</p>
            </button>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
