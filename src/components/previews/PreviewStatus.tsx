// 预览通用状态 — 骨架屏 / 失败态
import { FileQuestionMark } from 'lucide-react';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { fileApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';

export function PreviewSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

interface PreviewErrorStateProps {
  fileId: number;
  message?: string;
}

export function PreviewErrorState({ fileId, message = '预览失败' }: PreviewErrorStateProps) {
  const showToast = useUiStore((s) => s.showToast);

  const handleOpen = async () => {
    const result = await fileApi.open(fileId);
    if (!result.ok && result.reason) showToast(result.reason, 'error');
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileQuestionMark size={44} className="text-ink-3 opacity-70" strokeWidth={1.25} />
      <div className="text-sm font-medium text-ink">{message}</div>
      <div className="text-sm text-ink-3">可以改用系统程序查看该文件</div>
      <Button variant="primary" size="sm" onClick={handleOpen}>
        用系统程序打开
      </Button>
    </div>
  );
}
