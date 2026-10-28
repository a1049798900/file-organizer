// Web 辅助侧屏 —— 右侧滑入覆盖层（side 形态）
// 支持快捷方式切换：点击工具栏下拉切换不同快捷方式
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Maximize2, RefreshCw, X, ChevronDown } from 'lucide-react';
import { Resizer } from '../ui/Resizer';
import { IconButton } from '../ui/IconButton';
import { WebPlaceholder } from './WebPlaceholder';
import { useWebShortcutsStore } from '@/stores/useWebShortcutsStore';
import { webApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { WEB_SIDEPANEL_LAYOUT } from '@/lib/layout';

export function WebWorkspaceSidePanel() {
  const width = useUiStore((s) => s.webSidePanelWidth);
  const setWidth = useUiStore((s) => s.setWebSidePanelWidth);
  const setSidePanelOpen = useUiStore((s) => s.setWebSidePanelOpen);
  const setForm = useUiStore((s) => s.setWebForm);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const activeWebShortcutId = useUiStore((s) => s.activeWebShortcutId);
  const setActiveWebShortcutId = useUiStore((s) => s.setActiveWebShortcutId);
  const appLocked = useUiStore((s) => s.appLocked);

  const { shortcuts, loading, loaded, load } = useWebShortcutsStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 初次加载快捷方式
  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  // 自动选中第一个
  useEffect(() => {
    if (activeWebShortcutId == null && shortcuts.length > 0) {
      setActiveWebShortcutId(shortcuts[0].id);
    }
  }, [shortcuts, activeWebShortcutId, setActiveWebShortcutId]);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const activeShortcut =
    shortcuts.find((s) => s.id === activeWebShortcutId) ?? null;

  const openMainView = () => {
    setForm('main');
    setActiveView('web');
    setSidePanelOpen(false);
  };

  const closeSidePanel = () => {
    setSidePanelOpen(false);
  };

  return (
    <div
      className="h-full flex flex-col bg-white border-l border-line flex-shrink-0 relative"
      style={{ width }}
    >
      {/* 工具栏 */}
      <div className="h-10 flex items-center px-2 gap-0.5 border-b border-line flex-shrink-0">
        {/* 快捷方式下拉 */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-ink hover:bg-bg-hover rounded px-2 py-1 transition-colors max-w-[120px]"
            title={activeShortcut?.name ?? ''}
          >
            <span className="truncate">{activeShortcut?.name ?? '网页'}</span>
            <ChevronDown size={12} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-0.5 w-44 max-h-60 overflow-y-auto bg-white border border-line rounded-md shadow-lg z-50 py-1">
              {loading && !loaded ? (
                <div className="px-3 py-2 text-xs text-ink-3">加载中...</div>
              ) : (
                shortcuts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveWebShortcutId(s.id);
                      setDropdownOpen(false);
                    }}
                    className={
                      'w-full text-left px-3 py-1.5 text-xs transition-colors ' +
                      (s.id === activeWebShortcutId
                        ? 'bg-accent-weak text-accent font-medium'
                        : 'text-ink hover:bg-bg-hover')
                    }
                  >
                    🌐 {s.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {activeShortcut && (
          <>
            <IconButton
              size={24}
              onClick={() => void webApi.navigate({ shortcutId: activeShortcut.id, action: 'back' })}
              aria-label="后退"
            >
              <ArrowLeft size={14} />
            </IconButton>
            <IconButton
              size={24}
              onClick={() => void webApi.navigate({ shortcutId: activeShortcut.id, action: 'forward' })}
              aria-label="前进"
            >
              <ArrowRight size={14} />
            </IconButton>
            <IconButton
              size={24}
              onClick={() => void webApi.navigate({ shortcutId: activeShortcut.id, action: 'refresh' })}
              aria-label="刷新"
            >
              <RefreshCw size={14} />
            </IconButton>
            <div className="flex-1" />
            <IconButton
              size={24}
              onClick={() => void webApi.openExternal(activeShortcut.id)}
              aria-label="在系统浏览器中打开"
              title="在系统浏览器中打开"
            >
              <ExternalLink size={14} />
            </IconButton>
            <IconButton
              size={24}
              onClick={openMainView}
              aria-label="切换到主视图"
              title="切换到主视图"
            >
              <Maximize2 size={14} />
            </IconButton>
          </>
        )}
        <IconButton size={24} onClick={closeSidePanel} aria-label="关闭">
          <X size={14} />
        </IconButton>
      </div>

      {/* 占位符 */}
      <div className="relative flex-1 min-h-0 bg-white">
        {activeShortcut && !appLocked ? (
          <WebPlaceholder
            shortcutId={activeShortcut.id}
            url={activeShortcut.url}
            key={activeShortcut.id}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-ink-3">
            {appLocked ? '应用已锁定' : '请选择快捷方式'}
          </div>
        )}
      </div>

      {/* 左侧 Resizer（从侧屏左侧边缘拖拽） */}
      <Resizer
        direction="right"
        value={width}
        onChange={setWidth}
        min={WEB_SIDEPANEL_LAYOUT.min}
        max={WEB_SIDEPANEL_LAYOUT.max}
        maxPct={WEB_SIDEPANEL_LAYOUT.maxPct}
        defaultSize={WEB_SIDEPANEL_LAYOUT.defaultSize}
      />
    </div>
  );
}
