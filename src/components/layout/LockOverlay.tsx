// 应用锁遮罩 — 手动锁定后覆盖全部内容，解锁时同步主进程状态
import { Lock } from 'lucide-react';
import { useUiStore } from '@/stores/useUiStore';
import { lockApi } from '@/lib/ipc';
import { Button } from '../ui/Button';

export function LockOverlay() {
  const appLocked = useUiStore((s) => s.appLocked);
  const setAppLocked = useUiStore((s) => s.setAppLocked);

  if (!appLocked) return null;

  const handleUnlock = async () => {
    try {
      await lockApi.set(false);
    } catch {
      // 主进程不可用时仍允许本地解锁，避免锁死界面
    }
    setAppLocked(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="应用已锁定"
    >
      <div className="w-16 h-16 rounded-full bg-bg-panel flex items-center justify-center mb-4">
        <Lock size={28} className="text-ink-2" />
      </div>
      <div className="text-xl font-semibold text-ink">Weave 工作台已锁定</div>
      <div className="text-sm text-ink-3 mt-1">
        内容与桌面通知标题已隐藏
      </div>
      <Button variant="primary" size="md" className="mt-5" onClick={handleUnlock}>
        解锁
      </Button>
    </div>
  );
}
