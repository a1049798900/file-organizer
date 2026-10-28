// 通用网页工作区主视图 —— 左侧快捷方式列表 + 右侧 WebPlaceholder
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Minimize2, Plus, RefreshCw, Pencil, Trash2, Globe } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Modal } from '../ui/Modal';
import { useUiStore } from '@/stores/useUiStore';
import { useWebShortcutsStore } from '@/stores/useWebShortcutsStore';
import { WebPlaceholder } from './WebPlaceholder';
import { webApi } from '@/lib/ipc';

const LEFT_SIDEBAR_WIDTH = 200;

interface ShortcutModalState {
  mode: 'create' | 'edit';
  shortcutId?: number;
  initialName?: string;
  initialUrl?: string;
}

export function WebWorkspaceView() {
  const { shortcuts, loading, loaded, load, create, update, remove } = useWebShortcutsStore();
  const activeWebShortcutId = useUiStore((s) => s.activeWebShortcutId);
  const setActiveWebShortcutId = useUiStore((s) => s.setActiveWebShortcutId);
  const webSidePanelOpen = useUiStore((s) => s.webSidePanelOpen);
  const setWebSidePanelOpen = useUiStore((s) => s.setWebSidePanelOpen);
  const setWebForm = useUiStore((s) => s.setWebForm);

  const [modal, setModal] = useState<ShortcutModalState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // 初次加载快捷方式（只加载一次，loaded 守卫避免重复）
  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  // 自动选中第一个（只在 shortcuts 变化且当前没有选中时触发一次）
  useEffect(() => {
    if (activeWebShortcutId == null && shortcuts.length > 0) {
      setActiveWebShortcutId(shortcuts[0].id);
    }
    // 选中项被删除时切到第一个
    if (
      activeWebShortcutId != null &&
      shortcuts.length > 0 &&
      !shortcuts.find((s) => s.id === activeWebShortcutId)
    ) {
      setActiveWebShortcutId(shortcuts[0].id);
    }
  }, [shortcuts, activeWebShortcutId, setActiveWebShortcutId]);

  const activeShortcut =
    shortcuts.find((s) => s.id === activeWebShortcutId) ?? null;

  const collapseToSidePanel = () => {
    setWebForm('side');
    setWebSidePanelOpen(true);
  };

  const openCreateModal = () => {
    setNameInput('');
    setUrlInput('https://');
    setModalError(null);
    setModal({ mode: 'create' });
  };

  const openEditModal = (id: number, name: string, url: string) => {
    setNameInput(name);
    setUrlInput(url);
    setModalError(null);
    setModal({ mode: 'edit', shortcutId: id, initialName: name, initialUrl: url });
  };

  const handleModalConfirm = async () => {
    if (!modal) return;
    try {
      if (modal.mode === 'create') {
        const created = await create(nameInput.trim(), urlInput.trim());
        setActiveWebShortcutId(created.id);
      } else if (modal.mode === 'edit' && modal.shortcutId != null) {
        await update(modal.shortcutId, nameInput.trim(), urlInput.trim());
      }
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    const shortcut = shortcuts.find((s) => s.id === id);
    if (!shortcut) return;
    if (!confirm(`确定要删除快捷方式「${shortcut.name}」吗？`)) return;
    await remove(id);
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-white">
      {/* 左侧快捷方式列表区 */}
      <div
        className="flex-shrink-0 border-r border-line bg-bg-panel flex flex-col min-h-0"
        style={{ width: LEFT_SIDEBAR_WIDTH }}
      >
        {/* 标题 */}
        <div className="px-4 py-3 border-b border-line flex-shrink-0">
          <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <Globe size={14} />
            <span>网页工作区</span>
          </div>
          <div className="mt-1 text-[11px] text-ink-3 leading-snug">
            独立会话，登录态不会丢失
          </div>
        </div>

        {/* 快捷方式列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2">
          {loading && !loaded ? (
            <div className="px-3 py-2 text-xs text-ink-3">加载中...</div>
          ) : shortcuts.length === 0 ? (
            <div className="px-3 py-2 text-xs text-ink-3">暂无快捷方式</div>
          ) : (
            shortcuts.map((s) => {
              const active = activeWebShortcutId === s.id;
              return (
                <div key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setActiveWebShortcutId(s.id)}
                    className={
                      'w-full text-left px-3 py-1.5 text-sm transition-colors border-l-2 ' +
                      (active
                        ? 'bg-accent-weak text-accent border-accent font-medium'
                        : 'text-ink hover:bg-bg-hover border-transparent')
                    }
                  >
                    <span className="mr-1.5">🌐</span>
                    <span className="truncate">{s.name}</span>
                  </button>
                  {/* 悬浮操作按钮 */}
                  <div
                    className={
                      'absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 ' +
                      (active || 'group-hover:opacity-100 opacity-0 transition-opacity')
                    }
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(s.id, s.name, s.url);
                      }}
                      className="p-0.5 rounded hover:bg-bg-hover text-ink-3 hover:text-ink"
                      title="编辑"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(s.id);
                      }}
                      className="p-0.5 rounded hover:bg-bg-hover text-ink-3 hover:text-danger"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部：+ 新建快捷方式 */}
        <div className="p-2 border-t border-line flex-shrink-0">
          <button
            type="button"
            onClick={openCreateModal}
            className="w-full text-xs text-ink-3 hover:text-accent hover:bg-accent-weak rounded px-2 py-1.5 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={14} />
            <span>新建快捷方式</span>
          </button>
        </div>
      </div>

      {/* 右侧：工具栏 + 网页 */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
        {/* 工具栏 */}
        <div className="h-10 flex items-center px-2 gap-0.5 border-b border-line flex-shrink-0 bg-white">
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
              <span className="px-2 text-xs text-ink-2 truncate max-w-[200px]">
                {activeShortcut.name}
              </span>
              <div className="flex-1" />
              <IconButton
                size={24}
                onClick={() => void webApi.openExternal(activeShortcut.id)}
                aria-label="在系统浏览器中打开"
                title="在系统浏览器中打开"
              >
                <ExternalLink size={14} />
              </IconButton>
              {!webSidePanelOpen && (
                <IconButton
                  size={24}
                  onClick={collapseToSidePanel}
                  aria-label="收起至侧屏"
                  title="收起至侧屏"
                >
                  <Minimize2 size={14} />
                </IconButton>
              )}
            </>
          )}
        </div>

        {/* 网页占位符区域 */}
        <div className="relative flex-1 min-h-0 bg-white">
          {activeShortcut ? (
            <WebPlaceholder
              shortcutId={activeShortcut.id}
              url={activeShortcut.url}
              key={activeShortcut.id}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-ink-3">
              {loading ? '加载中...' : '请在左侧选择或新建快捷方式'}
            </div>
          )}
        </div>
      </div>

      {/* 新建/编辑快捷方式弹窗 */}
      {modal && (
        <Modal open onClose={() => setModal(null)} width={400} hideClose={false}>
          <div className="p-5">
            <div className="text-base font-semibold text-ink mb-4">
              {modal.mode === 'create' ? '新建快捷方式' : '编辑快捷方式'}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ink-2 mb-1">名称</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="如：DeepSeek、GitHub"
                  className="w-full h-8 px-2 rounded-md border border-line bg-white text-base text-ink outline-none focus:border-accent"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-xs text-ink-2 mb-1">网址 (URL)</label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-8 px-2 rounded-md border border-line bg-white text-base text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="text-[11px] text-ink-3 leading-snug bg-bg-panel rounded p-2">
                ⚠️ 请确保所添加网页的安全性。内嵌网页具有独立会话（persist:deepseek），
                登录态自动保留。所有硬件权限请求（摄像头、麦克风、通知等）已被拒绝。
                文件拖入会被拦截。
              </div>

              {modalError && (
                <div className="text-xs text-danger">{modalError}</div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pb-4 px-5">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="h-8 px-4 rounded-md text-sm text-ink hover:bg-bg-hover transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleModalConfirm}
              className="h-8 px-4 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              {modal.mode === 'create' ? '创建' : '保存'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
