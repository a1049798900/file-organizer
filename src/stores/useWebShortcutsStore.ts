// 网页快捷方式数据 store —— 单一数据源，WebWorkspaceView 和 WebWorkspaceSidePanel 共享
import { create } from 'zustand';
import { webApi } from '@/lib/ipc';
import type { WebShortcutRow } from '@shared/types';

interface WebShortcutsState {
  shortcuts: WebShortcutRow[];
  loading: boolean;
  loaded: boolean;

  load(): Promise<void>;
  create(name: string, url: string): Promise<WebShortcutRow>;
  update(id: number, name: string, url: string): Promise<void>;
  remove(id: number): Promise<void>;
  reorder(ids: number[]): Promise<void>;
}

export const useWebShortcutsStore = create<WebShortcutsState>((set, get) => ({
  shortcuts: [],
  loading: false,
  loaded: false,

  async load() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const list = await webApi.listShortcuts();
      set({ shortcuts: list, loaded: true });
    } catch (err) {
      console.error('[web] listShortcuts 失败:', err);
    } finally {
      set({ loading: false });
    }
  },

  async create(name, url) {
    const created = await webApi.createShortcut({ name, url });
    set((state) => ({ shortcuts: [...state.shortcuts, created] }));
    return created;
  },

  async update(id, name, url) {
    await webApi.updateShortcut({ id, name, url });
    set((state) => ({
      shortcuts: state.shortcuts.map((s) =>
        s.id === id ? { ...s, name, url } : s,
      ),
    }));
  },

  async remove(id) {
    await webApi.deleteShortcut(id);
    // 清理主进程缓存
    void webApi.destroy(id);
    set((state) => ({
      shortcuts: state.shortcuts.filter((s) => s.id !== id),
    }));
  },

  async reorder(ids) {
    await webApi.reorderShortcuts(ids);
    set((state) => {
      const map = new Map(state.shortcuts.map((s) => [s.id, s]));
      return {
        shortcuts: ids
          .map((id, idx) => {
            const s = map.get(id);
            return s ? { ...s, sortOrder: idx } : null;
          })
          .filter(Boolean) as WebShortcutRow[],
      };
    });
  },
}));
