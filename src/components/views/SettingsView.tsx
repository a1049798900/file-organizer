import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { scanApi, settingsApi, calendarApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import type { ScanProgress, ScanResult } from '@shared/types';
import {
  CALENDAR_REMIND_MINUTE_OPTIONS,
  CALENDAR_REMIND_MINUTES_KEY,
  DEFAULT_CALENDAR_REMIND_MINUTES,
  parseRemindMinutes,
} from '@shared/reminder';
import { formatMtime } from '@/lib/format';

export function SettingsView() {
  const [scanRoot, setScanRoot] = useState<string>('');
  const [dbPath, setDbPath] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [lastScanAt, setLastScanAt] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [remindMinutes, setRemindMinutes] = useState(
    String(DEFAULT_CALENDAR_REMIND_MINUTES),
  );
  const [sampleBusy, setSampleBusy] = useState(false);
  const showToast = useUiStore((s) => s.showToast);
  const refreshAll = useDataStore((s) => s.refreshAll);

  // 加载设置
  useEffect(() => {
    (async () => {
      const settings = await settingsApi.get();
      setScanRoot(settings.scan_root || '');
      setLastScanAt(settings.last_scan_at || '');
      setRemindMinutes(String(parseRemindMinutes(settings[CALENDAR_REMIND_MINUTES_KEY])));
      const path = await settingsApi.getDbPath();
      setDbPath(path);
      const ver = await settingsApi.getVersion();
      setVersion(ver);
    })();
  }, []);

  // 监听扫描进度
  useEffect(() => {
    const unsubscribe = scanApi.onProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const handlePickRoot = async () => {
    const path = await settingsApi.pickRoot();
    if (path) {
      setScanRoot(path);
      await settingsApi.set('scan_root', path);
    }
  };

  const handleStartScan = async () => {
    if (!scanRoot) {
      showToast('请先设置扫描根目录', 'error');
      return;
    }
    if (scanning) return;

    setScanning(true);
    setScanResult(null);
    setProgress(null);

    try {
      const result = await scanApi.start();
      setScanResult(result);
      await refreshAll();
      // 刷新上次扫描时间
      const settings = await settingsApi.get();
      setLastScanAt(settings.last_scan_at || '');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '扫描失败', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleCancelScan = async () => {
    await scanApi.cancel();
  };

  const handleRemindChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setRemindMinutes(value);
    try {
      await settingsApi.set(CALENDAR_REMIND_MINUTES_KEY, value);
      showToast('提醒提前量已保存');
    } catch {
      showToast('提醒设置保存失败，请重试', 'error');
    }
  };

  const handleSeedSample = async () => {
    if (sampleBusy) return;
    setSampleBusy(true);
    try {
      const result = await calendarApi.seedSampleData();
      showToast(
        `已填充示例数据：${result.areas} 个领域、${result.tasks} 个任务、${result.meetings} 个会议`,
      );
    } catch {
      showToast('示例数据填充失败，请重试', 'error');
    } finally {
      setSampleBusy(false);
    }
  };

  const handleClearSample = async () => {
    if (sampleBusy) return;
    setSampleBusy(true);
    try {
      await calendarApi.clearSampleData();
      showToast('示例数据已清除');
    } catch {
      showToast('示例数据清除失败，请重试', 'error');
    } finally {
      setSampleBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6">
      <div className="max-w-[720px] mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-ink">设置</h1>

        {/* 扫描根目录 */}
        <div className="rounded-card border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink mb-3">扫描根目录</h2>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 px-3 py-2 bg-bg-panel rounded-md text-sm text-ink truncate">
              {scanRoot || '未设置'}
            </div>
            <Button variant="secondary" size="sm" onClick={handlePickRoot} disabled={scanning}>
              更换
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartScan}
              disabled={scanning || !scanRoot}
            >
              {scanning ? '扫描中...' : '开始扫描'}
            </Button>
            {scanning && (
              <Button variant="secondary" size="sm" onClick={handleCancelScan}>
                取消
              </Button>
            )}
          </div>

          {/* 扫描进度 */}
          {scanning && progress && (
            <div className="mt-3 space-y-2">
              <div className="h-2 bg-bg-panel rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{
                    width: progress.total > 0 ? `${(progress.processed / progress.total) * 100}%` : '0%',
                  }}
                />
              </div>
              <div className="text-xs text-ink-3 truncate">
                {progress.currentPath}
              </div>
              <div className="text-xs text-ink-2">
                已处理 {progress.processed} / {progress.total || '?'}
              </div>
            </div>
          )}

          {/* 扫描结果 */}
          {scanResult && !scanning && (
            <div className="mt-3 p-3 bg-bg-panel rounded-md text-sm">
              <div className="text-ink">
                扫描完成：扫描 {scanResult.scanned} 个文件，新增 {scanResult.added} 个
              </div>
            </div>
          )}

          {lastScanAt && lastScanAt !== '0' && (
            <div className="text-xs text-ink-3 mt-3">
              上次扫描时间：{formatMtime(Number(lastScanAt))}
            </div>
          )}
        </div>

        {/* 日历提醒 */}
        <div className="rounded-card border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink mb-3">日历提醒</h2>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-ink">提醒提前量</div>
              <div className="text-xs text-ink-3 mt-0.5 leading-5">
                桌面通知会在任务截止或会议开始前提醒。任务自身的提醒时间不受影响；仅在应用运行时生效，锁定时通知不显示日程标题。
              </div>
            </div>
            <select
              value={remindMinutes}
              onChange={handleRemindChange}
              aria-label="日历提醒提前量"
              className="h-8 px-2 rounded-md border border-line bg-white text-sm text-ink flex-shrink-0"
            >
              {CALENDAR_REMIND_MINUTE_OPTIONS.map((minutes) => (
                <option key={minutes} value={String(minutes)}>
                  {minutes === 0 ? '事件开始时' : `提前 ${minutes} 分钟`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 示例数据 */}
        <div className="rounded-card border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink mb-3">示例数据</h2>
          <div className="text-xs text-ink-3 leading-5 mb-3">
            仅用于验收：插入带「【示例】」前缀的领域、任务与会议，其中包含一条约 2 分钟后提醒的任务和一条跨天会议；不会改动真实数据，可随时清除。
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSeedSample}
              disabled={sampleBusy}
            >
              填充示例数据
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSample}
              disabled={sampleBusy}
            >
              清除示例数据
            </Button>
          </div>
        </div>

        {/* 数据位置 */}
        <div className="rounded-card border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink mb-3">数据位置</h2>
          <div className="px-3 py-2 bg-bg-panel rounded-md text-sm text-ink-2 break-all">
            {dbPath}
          </div>
        </div>

        {/* 关于 */}
        <div className="rounded-card border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink mb-3">关于</h2>
          <div className="text-sm text-ink-2">Weave 工作台 v{version}</div>
        </div>
      </div>
    </div>
  );
}
