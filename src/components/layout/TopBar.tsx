import { useState, useRef, useEffect } from 'react';
import { Search, Globe, Menu, Settings, Lock } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { useUiStore } from '@/stores/useUiStore';
import { lockApi } from '@/lib/ipc';
import { cn } from '@/lib/cn';

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const activeView = useUiStore((s) => s.activeView);
  const setAppLocked = useUiStore((s) => s.setAppLocked);
  const webSidePanelOpen = useUiStore((s) => s.webSidePanelOpen);
  const setWebSidePanelOpen = useUiStore((s) => s.setWebSidePanelOpen);
  const webForm = useUiStore((s) => s.webForm);
  const setWebForm = useUiStore((s) => s.setWebForm);
  const previewOpen = useUiStore((s) => s.previewOpen);
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen);

  const [inputValue, setInputValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 同步外部状态到输入框
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 200);
  };

  const handleSettingsClick = () => {
    setActiveView('settings');
  };

  const handleLock = () => {
    setAppLocked(true);
    void lockApi.set(true).catch(() => {});
  };

  // TopBar 的 Globe 按钮 click handler 直接切侧屏（AppShell 有全局 Ctrl+Shift+D 快捷键）
  const toggleDeepseekSidePanel = () => {
    if (webSidePanelOpen) {
      setWebSidePanelOpen(false);
    } else {
      if (activeView === 'web') {
        setActiveView('inbox');
      }
      if (previewOpen) setPreviewOpen(false);
      setWebForm('side');
      setWebSidePanelOpen(true);
    }
  };

  const isSearchActive = activeView === 'search';

  return (
    <div className="h-12 flex items-center px-3 border-b border-line bg-white flex-shrink-0">
      {/* 左侧：折叠按钮 */}
      <IconButton onClick={toggleSidebar} aria-label="折叠侧栏">
        <Menu size={18} />
      </IconButton>

      {/* 中间：搜索框 */}
      <div className="flex-1 flex justify-center">
        <div
          className={cn(
            'relative w-full max-w-[480px] h-8',
            'flex items-center',
            'bg-bg-panel rounded-md px-3',
            'transition-shadow',
            isSearchActive ? 'ring-2 ring-accent/30' : '',
          )}
        >
          <Search size={14} className="text-ink-3 flex-shrink-0 mr-2" />
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            placeholder="搜索文件名、标签、联系人、拼音首字母"
            className="flex-1 bg-transparent outline-none text-base text-ink placeholder:text-ink-3"
          />
        </div>
      </div>

      {/* 右侧：DeepSeek · 锁定 · 设置 */}
      <div className="flex items-center gap-1">
        <IconButton
          onClick={toggleDeepseekSidePanel}
          aria-label="DeepSeek 网页版"
          title="DeepSeek 网页版 (Ctrl+Shift+D)"
          className={webSidePanelOpen ? 'bg-bg-hover text-accent' : ''}
        >
          <Globe size={18} />
        </IconButton>
        <IconButton onClick={handleLock} aria-label="锁定应用" title="锁定应用">
          <Lock size={18} />
        </IconButton>
        <IconButton
          onClick={handleSettingsClick}
          aria-label="设置"
          className={activeView === 'settings' ? 'bg-bg-hover text-accent' : ''}
        >
          <Settings size={18} />
        </IconButton>
      </div>
    </div>
  );
}
