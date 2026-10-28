// 选择状态管理 — 按列表实例 key 隔离
import { create } from 'zustand';

interface SelectionInstance {
  ids: Set<number>;
  anchor: number | null;
  focus: number | null;
}

interface SelectionState {
  byKey: Record<string, SelectionInstance>;

  getIds(key: string): number[];
  getFocus(key: string): number | null;
  getAnchor(key: string): number | null;
  isSelected(key: string, id: number): boolean;
  clear(key: string): void;
  single(key: string, id: number): void;
  toggle(key: string, id: number): void;
  range(key: string, id: number, allIds: number[]): void;
  selectAll(key: string, allIds: number[]): void;
  setFocus(key: string, id: number): void;
}

function getInstance(state: SelectionState, key: string): SelectionInstance {
  if (!state.byKey[key]) {
    return { ids: new Set(), anchor: null, focus: null };
  }
  return state.byKey[key];
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  byKey: {},

  getIds: (key) => Array.from(getInstance(get(), key).ids),
  getFocus: (key) => getInstance(get(), key).focus,
  getAnchor: (key) => getInstance(get(), key).anchor,
  isSelected: (key, id) => getInstance(get(), key).ids.has(id),

  clear: (key) => {
    set((state) => ({
      byKey: {
        ...state.byKey,
        [key]: { ids: new Set(), anchor: null, focus: null },
      },
    }));
  },

  single: (key, id) => {
    set((state) => ({
      byKey: {
        ...state.byKey,
        [key]: { ids: new Set([id]), anchor: id, focus: id },
      },
    }));
  },

  toggle: (key, id) => {
    set((state) => {
      const inst = getInstance(state, key);
      const newIds = new Set(inst.ids);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return {
        byKey: {
          ...state.byKey,
          [key]: { ids: newIds, anchor: id, focus: id },
        },
      };
    });
  },

  range: (key, id, allIds) => {
    set((state) => {
      const inst = getInstance(state, key);
      const anchorId = inst.anchor ?? id;
      const anchorIdx = allIds.indexOf(anchorId);
      const targetIdx = allIds.indexOf(id);

      if (anchorIdx === -1 || targetIdx === -1) {
        return state;
      }

      const start = Math.min(anchorIdx, targetIdx);
      const end = Math.max(anchorIdx, targetIdx);
      const rangeIds = new Set(allIds.slice(start, end + 1));

      return {
        byKey: {
          ...state.byKey,
          // Shift+单击不更新 anchor
          [key]: { ...inst, ids: rangeIds, focus: id },
        },
      };
    });
  },

  selectAll: (key, allIds) => {
    set((state) => {
      const inst = getInstance(state, key);
      return {
        byKey: {
          ...state.byKey,
          [key]: { ids: new Set(allIds), anchor: inst.anchor, focus: inst.focus },
        },
      };
    });
  },

  setFocus: (key, id) => {
    set((state) => {
      const inst = getInstance(state, key);
      return {
        byKey: {
          ...state.byKey,
          [key]: { ...inst, focus: id },
        },
      };
    });
  },
}));
