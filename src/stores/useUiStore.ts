// UI 状态管理 — 视图切换、侧栏、预览、模态、右键菜单
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarViewMode } from '@/lib/date';
import type { GraphFocus, GraphHistoryItem } from '@shared/graph';

export type ActiveView =
  | 'dashboard'
  | 'inbox'
  | 'calendar'
  | 'contacts'
  | 'projects'
  | 'project-detail'
  | 'area-detail'
  | 'kb'
  | 'web'
  | 'graph'
  | 'settings'
  | 'search';

export type KbSelected =
  | { kind: 'all' }
  | { kind: 'uncategorized' }
  | { kind: 'topic'; id: number };

export type FileListScene = 'inbox' | 'project' | 'kb' | 'search';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export interface BatchResultDialogConfig {
  ok: number;
  fail: number;
}

export type ModalState =
  | { type: 'new-project' }
  | { type: 'new-topic' }
  | { type: 'rename'; target: 'project' | 'topic'; id: number; name: string }
  | { type: 'save-to-kb'; fileIds: number[] }
  | { type: 'remove-from-kb'; fileIds: number[] }
  | { type: 'add-files-to-project'; projectId: number }
  | { type: 'contact-picker'; fileIds: number[] }
  | { type: 'confirm'; config: ConfirmDialogConfig }
  | { type: 'batch-result'; config: BatchResultDialogConfig }
  | null;

export interface ContextMenuState {
  x: number;
  y: number;
  fileIds: number[];
  scene: FileListScene;
  currentProjectId?: number;
}

export type NavKey = 'inbox' | 'calendar' | 'contacts' | 'projects' | 'kb' | 'web' | 'graph';

/** 侧边栏一级导航默认顺序 */
export const DEFAULT_SIDEBAR_ORDER: NavKey[] = [
  'inbox',
  'calendar',
  'contacts',
  'projects',
  'kb',
  'web',
  'graph',
];

interface UiState {
  activeView: ActiveView;
  activeProjectId: number | null;
  activeAreaId: number | null;
  selectedContactId: number | null;
  calendarMode: CalendarViewMode;
  calendarAnchorMs: number;
  kbSelected: KbSelected;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  kbSidebarWidth: number;
  graphSidebarWidth: number;
  sidebarOrder: NavKey[];
  previewOpen: boolean;
  previewWidth: number;
  previewFileId: number | null;
  searchQuery: string;
  contextMenu: ContextMenuState | null;
  modal: ModalState;
  toast: { message: string; type: 'error' | 'info' } | null;
  appLocked: boolean;
  graphOpen: boolean;
  graphHistory: GraphHistoryItem[];
  /** 打开图谱前所在的视图，关闭图谱后返回；null 表示无记录 */
  graphReturnView: ActiveView | null;
  /** ---- 通用网页工作区（Web Workspace）---- */
  /** Web 辅助侧屏是否打开 */
  webSidePanelOpen: boolean;
  /** Web 当前形态：侧屏或主视图 */
  webForm: 'side' | 'main';
  /** Web 辅助侧屏宽度（默认 480，范围 360-800） */
  webSidePanelWidth: number;
  /** Web 当前选中的快捷方式 ID */
  activeWebShortcutId: number | null;

  setActiveView(view: ActiveView): void;
  setActiveProjectId(id: number | null): void;
  setActiveAreaId(id: number | null): void;
  setSelectedContactId(id: number | null): void;
  setCalendarMode(mode: CalendarViewMode): void;
  setCalendarAnchorMs(ms: number): void;
  setKbSelected(selected: KbSelected): void;
  toggleSidebar(): void;
  setSidebarWidth(width: number): void;
  setKbSidebarWidth(width: number): void;
  setGraphSidebarWidth(width: number): void;
  setSidebarOrder(order: NavKey[]): void;
  setPreviewOpen(open: boolean): void;
  setPreviewWidth(width: number): void;
  setPreviewFileId(id: number | null): void;
  setSearchQuery(query: string): void;
  openContextMenu(menu: ContextMenuState): void;
  closeContextMenu(): void;
  openModal(modal: Exclude<ModalState, null>): void;
  closeModal(): void;
  showToast(message: string, type?: 'error' | 'info'): void;
  hideToast(): void;
  setAppLocked(locked: boolean): void;
  openGraph(focus: GraphFocus, label?: string): void;
  pushGraphFocus(focus: GraphFocus, label: string): void;
  popGraphFocus(): void;
  rewindGraphHistory(length: number): void;
  setCurrentGraphLabel(label: string): void;
  closeGraph(): void;
  setWebSidePanelOpen(open: boolean): void;
  setWebForm(form: 'side' | 'main'): void;
  setWebSidePanelWidth(width: number): void;
  setActiveWebShortcutId(id: number | null): void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeView: 'dashboard',
      activeProjectId: null,
      activeAreaId: null,
      selectedContactId: null,
      calendarMode: 'month',
      calendarAnchorMs: Date.now(),
      kbSelected: { kind: 'all' },
      sidebarCollapsed: false,
      sidebarWidth: 220,
      kbSidebarWidth: 220,
      graphSidebarWidth: 240,
      sidebarOrder: DEFAULT_SIDEBAR_ORDER,
      previewOpen: true,
      previewWidth: 400,
      previewFileId: null,
      searchQuery: '',
      contextMenu: null,
      modal: null,
      toast: null,
      appLocked: false,
      graphOpen: false,
      graphHistory: [],
      graphReturnView: null,
      // Web Workspace
      webSidePanelOpen: false,
      webForm: 'side',
      webSidePanelWidth: 480,
      activeWebShortcutId: null,

      setActiveView: (view) =>
        set((state) => ({
          activeView: view,
          contextMenu: null,
          previewFileId: null,
          // 进入 graph 视图时自动激活图谱（无历史则等左侧列表自动选第一项）
          graphOpen: view === 'graph' ? true : state.graphOpen,
          graphReturnView:
            view === 'graph' && state.activeView !== 'graph'
              ? state.activeView
              : state.graphReturnView,
        })),
      setActiveProjectId: (id) => set({ activeProjectId: id }),
      setActiveAreaId: (id) => set({ activeAreaId: id }),
      setSelectedContactId: (id) => set({ selectedContactId: id }),
      setCalendarMode: (mode) => set({ calendarMode: mode }),
      setCalendarAnchorMs: (ms) => set({ calendarAnchorMs: ms }),
      setKbSelected: (selected) => set({ kbSelected: selected }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setKbSidebarWidth: (width) => set({ kbSidebarWidth: width }),
      setGraphSidebarWidth: (width) => set({ graphSidebarWidth: width }),
      setSidebarOrder: (order) => set({ sidebarOrder: order }),
      setPreviewOpen: (open) => set({ previewOpen: open }),
      setPreviewFileId: (id) => set({ previewFileId: id }),
      setPreviewWidth: (width) => set({ previewWidth: width }),
      setSearchQuery: (query) => {
        set({ searchQuery: query, activeView: query.trim() ? 'search' : 'inbox' });
      },
      openContextMenu: (menu) => set({ contextMenu: menu }),
      closeContextMenu: () => set({ contextMenu: null }),
      openModal: (modal) => set({ modal, contextMenu: null }),
      closeModal: () => set({ modal: null }),
      showToast: (message, type = 'info') => set({ toast: { message, type } }),
      hideToast: () => set({ toast: null }),
      setAppLocked: (locked) => set({ appLocked: locked }),
      openGraph: (focus, label = '') =>
        set((state) => ({
          graphOpen: true,
          graphHistory: [{ type: focus.type, id: focus.id, label }],
          contextMenu: null,
          // 图谱改为内嵌主视图：打开即切换到 graph 视图，并记录来源视图供关闭时返回
          activeView: 'graph',
          graphReturnView: state.activeView === 'graph' ? state.graphReturnView : state.activeView,
        })),
      pushGraphFocus: (focus, label) =>
        set((state) => ({
          graphHistory: [...state.graphHistory, { type: focus.type, id: focus.id, label }],
        })),
      popGraphFocus: () =>
        set((state) => {
          if (state.graphHistory.length <= 1) return {};
          return { graphHistory: state.graphHistory.slice(0, -1) };
        }),
      rewindGraphHistory: (length) =>
        set((state) => ({
          graphHistory: state.graphHistory.slice(0, Math.max(1, length)),
        })),
      setCurrentGraphLabel: (label) =>
        set((state) => {
          if (state.graphHistory.length === 0) return {};
          const current = state.graphHistory[state.graphHistory.length - 1];
          if (current.label === label) return {};
          return {
            graphHistory: [
              ...state.graphHistory.slice(0, -1),
              { ...current, label },
            ],
          };
        }),
      closeGraph: () =>
        set((state) => ({
          graphOpen: false,
          graphHistory: [],
          // 关闭内嵌图谱时返回打开前的视图，避免停留在空白的 graph 视图
          activeView:
            state.activeView === 'graph' ? (state.graphReturnView ?? 'inbox') : state.activeView,
          graphReturnView: null,
        })),
      // Web Workspace
      setWebSidePanelOpen: (open) => set({ webSidePanelOpen: open }),
      setWebForm: (form) => set({ webForm: form }),
      setWebSidePanelWidth: (width) => set({ webSidePanelWidth: width }),
      setActiveWebShortcutId: (id) => set({ activeWebShortcutId: id }),
    }),
    {
      name: 'weave-ui-panel-widths',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        kbSidebarWidth: state.kbSidebarWidth,
        graphSidebarWidth: state.graphSidebarWidth,
        previewWidth: state.previewWidth,
        previewOpen: state.previewOpen,
        sidebarOrder: state.sidebarOrder,
        // Web Workspace
        webSidePanelOpen: state.webSidePanelOpen,
        webForm: state.webForm,
        webSidePanelWidth: state.webSidePanelWidth,
        activeWebShortcutId: state.activeWebShortcutId,
      }),
    },
  ),
);
