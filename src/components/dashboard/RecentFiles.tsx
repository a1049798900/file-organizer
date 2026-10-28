// 最近文件（占 1 列）— 最近修改的 3 个文件，按扩展名区分图标
import { useEffect, useState } from 'react';
import { Files, FileText, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import type { FileRow } from '@shared/types';
import { fileApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatShortDate } from '@/lib/format';
import { DashboardCard } from './DashboardCard';

function extStyle(ext: string): { Icon: typeof FileText; cls: string } {
  if (['doc', 'docx', 'md', 'txt'].includes(ext)) {
    return { Icon: FileText, cls: 'bg-indigo-50 text-indigo-500' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { Icon: FileSpreadsheet, cls: 'bg-green-50 text-green-500' };
  }
  if (ext === 'pdf') {
    return { Icon: FileText, cls: 'bg-red-50 text-red-500' };
  }
  return { Icon: FileIcon, cls: 'bg-gray-100 text-gray-500' };
}

export function RecentFiles() {
  const filesRevision = useDataStore((s) => s.filesRevision);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const showToast = useUiStore((s) => s.showToast);
  const [files, setFiles] = useState<FileRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fileApi
      .list({ kind: 'all' }, { key: 'mtime', dir: 'desc' })
      .then((list) => {
        if (!cancelled) setFiles(list.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filesRevision]);

  const handleOpen = (id: number) => {
    fileApi
      .open(id)
      .then((r) => {
        if (!r.ok) showToast(r.reason ?? '打开文件失败', 'error');
      })
      .catch(() => showToast('打开文件失败', 'error'));
  };

  return (
    <DashboardCard
      title="最近文件"
      icon={<Files size={16} className="text-indigo-500" />}
      className="col-span-1"
      action={
        <button
          onClick={() => setActiveView('kb')}
          className="text-xs text-gray-400 hover:text-blue-500"
        >
          资料库
        </button>
      }
    >
      {files.length === 0 ? (
        <p className="text-sm text-gray-400">暂无文件。</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => {
            const { Icon, cls } = extStyle(f.ext);
            return (
              <button
                key={f.id}
                onClick={() => handleOpen(f.id)}
                className="w-full flex items-center gap-3 p-1.5 -mx-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${cls}`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{f.alias ?? f.name}</p>
                  <p className="text-xs text-gray-400">{formatShortDate(f.mtime)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
