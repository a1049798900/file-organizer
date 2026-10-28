import { useEffect, useRef } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { PreviewPane } from './PreviewPane';
import { Resizer } from '../ui/Resizer';
import { InboxView } from '../views/InboxView';
import { DashboardView } from '../views/DashboardView';
import { CalendarView } from '../calendar/CalendarView';
import { ProjectsView } from '../views/ProjectsView';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { AreaDetailView } from '../views/AreaDetailView';
import { KnowledgeBaseView } from '../views/KnowledgeBaseView';
import { ContactsView } from '../views/ContactsView';
import { SearchResultsView } from '../views/SearchResultsView';
import { SettingsView } from '../views/SettingsView';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { NewProjectDialog } from '../dialogs/NewProjectDialog';
import { SaveToKbDialog } from '../dialogs/SaveToKbDialog';
import { RemoveFromKbDialog } from '../dialogs/RemoveFromKbDialog';
import { AddFilesToProjectDialog } from '../dialogs/AddFilesToProjectDialog';
import { ContactPickerDialog } from '../dialogs/ContactPickerDialog';
import { RenameDialog } from '../dialogs/RenameDialog';
import { LockOverlay } from './LockOverlay';
import { GlobalContextMenu } from './GlobalContextMenu';
import { GraphView } from '../views/GraphView';
import { WebWorkspaceView } from '../deepseek/WebWorkspaceView';
import { WebWorkspaceSidePanel } from '../deepseek/WebWorkspaceSidePanel';
import { calendarApi, contactApi, lockApi } from '@/lib/ipc';
import {
  SIDEBAR_LAYOUT,
  KB_SIDEBAR_LAYOUT,
  PREVIEW_LAYOUT,
  WEB_SIDEPANEL_LAYOUT,
  clampPanelWidth,
} from '@/lib/layout';

export function AppShell() {
  const activeView = useUiStore((s) => s.activeView);
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const toast = useUiStore((s) => s.toast);
  const hideToast = useUiStore((s) => s.hideToast);
  const setAppLocked = useUiStore((s) => s.setAppLocked);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setCalendarAnchorMs = useUiStore((s) => s.setCalendarAnchorMs);
  const refreshAll = useDataStore((s) => s.refreshAll);

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const kbSidebarWidth = useUiStore((s) => s.kbSidebarWidth);
  const setKbSidebarWidth = useUiStore((s) => s.setKbSidebarWidth);
  const previewOpen = useUiStore((s) => s.previewOpen);
  const previewWidth = useUiStore((s) => s.previewWidth);
  const setPreviewWidth = useUiStore((s) => s.setPreviewWidth);
  const webSidePanelOpen = useUiStore((s) => s.webSidePanelOpen);
  const setWebSidePanelOpen = useUiStore((s) => s.setWebSidePanelOpen);
  const setWebForm = useUiStore((s) => s.setWebForm);
  const webForm = useUiStore((s) => s.webForm);

  // 用 ref 存当前宽度，resize handler 读 ref 避免依赖数组抖动
  const widthsRef = useRef({
    sidebar: sidebarWidth,
    kb: kbSidebarWidth,
    preview: previewWidth,
  });
  widthsRef.current.sidebar = sidebarWidth;
  widthsRef.current.kb = kbSidebarWidth;
  widthsRef.current.preview = previewWidth;

  // 初始化加载数据
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // 与主进程同步应用锁状态（通知内容脱敏依赖此状态）
  useEffect(() => {
    lockApi
      .get()
      .then((locked) => setAppLocked(locked))
      .catch(() => {});
  }, [setAppLocked]);

  // 点击系统提醒通知：跳转到对应日期的日历
  useEffect(() => {
    return calendarApi.onReminderOpen(({ at }) => {
      setActiveView('calendar');
      setCalendarAnchorMs(at);
    });
  }, [setActiveView, setCalendarAnchorMs]);

  // Toast 自动隐藏
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => hideToast(), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  // 窗口缩放时自动 clamp 各面板宽度，防止超出 40% 视口。
  // 用 ref 读当前宽度，空 deps 避免拖拽时高频重绑。
  useEffect(() => {
    const handleResize = () => {
      const w = widthsRef.current;
      setSidebarWidth(clampPanelWidth(w.sidebar, SIDEBAR_LAYOUT));
      setKbSidebarWidth(clampPanelWidth(w.kb, KB_SIDEBAR_LAYOUT));
      setPreviewWidth(clampPanelWidth(w.preview, PREVIEW_LAYOUT));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl+Shift+D 全局快捷键：切换 Web 侧屏
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        if (webSidePanelOpen) {
          setWebSidePanelOpen(false);
        } else {
          // 切到 web 主视图时不触发侧屏快捷键
          if (activeView === 'web') return;
          setWebForm('side');
          setWebSidePanelOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [webSidePanelOpen, activeView, setWebSidePanelOpen, setWebForm]);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'inbox':
        return <InboxView />;
      case 'calendar':
        return <CalendarView />;
      case 'contacts':
        return <ContactsView />;
      case 'projects':
        return <ProjectsView />;
      case 'project-detail':
        return <ProjectDetailView />;
      case 'area-detail':
        return <AreaDetailView />;
      case 'kb':
        return <KnowledgeBaseView />;
      case 'search':
        return <SearchResultsView />;
      case 'web':
        return <WebWorkspaceView />;
      case 'graph':
        return <GraphView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <InboxView />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {/* 左侧导航 Resizer：折叠时隐藏 */}
        <Resizer
          direction="left"
          value={sidebarWidth}
          onChange={setSidebarWidth}
          min={SIDEBAR_LAYOUT.min}
          max={SIDEBAR_LAYOUT.max}
          maxPct={SIDEBAR_LAYOUT.maxPct}
          defaultSize={SIDEBAR_LAYOUT.defaultSize}
          disabled={sidebarCollapsed}
        />

        {/* 主内容区 */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {renderView()}
        </main>

        {/* 日历、通讯录、关系网络、Web 工作区为内嵌布局，不显示全局文件预览面板；
            Web 辅助侧屏打开时也互斥 */}
        {activeView !== 'dashboard' &&
          activeView !== 'calendar' &&
          activeView !== 'contacts' &&
          activeView !== 'graph' &&
          activeView !== 'web' &&
          !webSidePanelOpen &&
          previewOpen && (
            <>
              <Resizer
                direction="right"
                value={previewWidth}
                onChange={setPreviewWidth}
                min={PREVIEW_LAYOUT.min}
                max={PREVIEW_LAYOUT.max}
                maxPct={PREVIEW_LAYOUT.maxPct}
                defaultSize={PREVIEW_LAYOUT.defaultSize}
              />
              <PreviewPane />
            </>
          )}

        {/* Web 辅助侧屏（side 形态）：在主内容区右侧滑入 */}
        {webSidePanelOpen && activeView !== 'web' && <WebWorkspaceSidePanel />}
      </div>
      {/* 全局右键菜单 */}
      <GlobalContextMenu />

      {/* 全局模态 */}
      {modal?.type === 'new-project' && (
        <NewProjectDialog open onClose={closeModal} />
      )}

      {modal?.type === 'rename' && (
        <RenameDialog
          open
          target={modal.target}
          id={modal.id}
          initialName={modal.name}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'save-to-kb' && (
        <SaveToKbDialog fileIds={modal.fileIds} onClose={closeModal} />
      )}

      {modal?.type === 'remove-from-kb' && (
        <RemoveFromKbDialog fileIds={modal.fileIds} onClose={closeModal} />
      )}

      {modal?.type === 'add-files-to-project' && (
        <AddFilesToProjectDialog projectId={modal.projectId} onClose={closeModal} />
      )}

      {modal?.type === 'contact-picker' && (
        <ContactPickerDialog
          preselect={
            modal.fileIds.length === 1
              ? { kind: 'file', id: modal.fileIds[0] }
              : undefined
          }
          title={
            modal.fileIds.length > 1
              ? `关联联系人（${modal.fileIds.length} 个文件）`
              : '关联联系人'
          }
          hint={
            modal.fileIds.length > 1
              ? '将为选中的文件批量追加所选联系人，不移除已有关系。'
              : undefined
          }
          onConfirm={async (contactIds) => {
            if (modal.fileIds.length === 1) {
              await contactApi.setFileContacts(modal.fileIds[0], contactIds);
            } else {
              await contactApi.addToFiles(modal.fileIds, contactIds);
            }
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'confirm' && (
        <ConfirmDialog
          open
          title={modal.config.title}
          message={modal.config.message}
          confirmText={modal.config.confirmText ?? '确定'}
          onConfirm={modal.config.onConfirm}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'batch-result' && (
        <Modal open onClose={closeModal} width={320} hideClose>
          <div className="p-5 text-center">
            <div className="text-lg font-semibold text-ink mb-2">批量操作结果</div>
            <div className="text-sm text-ink-2">
              成功 {modal.config.ok} 项，失败 {modal.config.fail} 项。
            </div>
          </div>
          <div className="flex justify-center pb-4">
            <button
              className="h-8 px-4 bg-accent text-white rounded-md text-base font-medium hover:bg-accent-hover"
              onClick={closeModal}
            >
              确定
            </button>
          </div>
        </Modal>
      )}

      {/* 应用锁遮罩 */}
      <LockOverlay />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md shadow-lg text-sm text-white ${
            toast.type === 'error' ? 'bg-danger' : 'bg-ink'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
