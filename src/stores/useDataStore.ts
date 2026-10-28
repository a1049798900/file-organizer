// 数据状态管理 — 项目、专题、标签、计数等
import { create } from 'zustand';
import type { ProjectRow, TopicRow, TagRef } from '@shared/types';
import { projectApi, kbApi, tagApi, fileApi } from '@/lib/ipc';

interface DataState {
  inboxCount: number;
  projects: ProjectRow[];
  projectFilter: 'all' | 'active' | 'done';
  topics: TopicRow[];
  kbCounts: { all: number; uncategorized: number };
  tags: TagRef[];
  loading: boolean;
  /** 文件物理状态版本号，移动/撤销后自增以刷新所有列表 */
  filesRevision: number;

  bumpFilesRevision(): void;
  refreshInboxCount(): Promise<void>;
  refreshProjects(): Promise<void>;
  setProjectFilter(filter: 'all' | 'active' | 'done'): void;
  refreshTopics(): Promise<void>;
  refreshKbCounts(): Promise<void>;
  refreshTags(): Promise<void>;
  refreshAll(): Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  inboxCount: 0,
  projects: [],
  projectFilter: 'all',
  topics: [],
  kbCounts: { all: 0, uncategorized: 0 },
  tags: [],
  loading: false,
  filesRevision: 0,

  bumpFilesRevision: () => set((s) => ({ filesRevision: s.filesRevision + 1 })),

  refreshInboxCount: async () => {
    try {
      const files = await fileApi.list({ kind: 'inbox' }, { key: 'mtime', dir: 'desc' });
      set({ inboxCount: files.length });
    } catch (e) {
      console.error('refreshInboxCount error:', e);
    }
  },

  refreshProjects: async () => {
    try {
      const projects = await projectApi.list(get().projectFilter);
      set({ projects });
    } catch (e) {
      console.error('refreshProjects error:', e);
    }
  },

  setProjectFilter: (filter) => {
    set({ projectFilter: filter });
    get().refreshProjects();
  },

  refreshTopics: async () => {
    try {
      const topics = await kbApi.listTopics();
      set({ topics });
    } catch (e) {
      console.error('refreshTopics error:', e);
    }
  },

  refreshKbCounts: async () => {
    try {
      const allFiles = await fileApi.list({ kind: 'kb-all' }, { key: 'mtime', dir: 'desc' });
      const uncategorizedFiles = await fileApi.list(
        { kind: 'kb-uncategorized' },
        { key: 'mtime', dir: 'desc' },
      );
      set({
        kbCounts: {
          all: allFiles.length,
          uncategorized: uncategorizedFiles.length,
        },
      });
    } catch (e) {
      console.error('refreshKbCounts error:', e);
    }
  },

  refreshTags: async () => {
    try {
      const tags = await tagApi.list();
      set({ tags });
    } catch (e) {
      console.error('refreshTags error:', e);
    }
  },

  refreshAll: async () => {
    set({ loading: true });
    try {
      await Promise.all([
        get().refreshInboxCount(),
        get().refreshProjects(),
        get().refreshTopics(),
        get().refreshKbCounts(),
        get().refreshTags(),
      ]);
    } finally {
      set({ loading: false });
    }
  },
}));
