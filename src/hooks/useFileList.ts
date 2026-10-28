// useFileList — 列表数据 + 排序 + 刷新
// 所有文件列表视图（收件箱、项目、资料库、搜索）复用此 hook
import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileRow, FileListSource, FileSort, FileSortKey, SortDir } from '@shared/types';
import { fileApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';

interface UseFileListOptions {
  listKey: string;
  source: FileListSource;
  defaultSort?: FileSort;
  enabled?: boolean;
}

interface UseFileListResult {
  rows: FileRow[];
  loading: boolean;
  error: boolean;
  /** 当前生效的排序（用户排序优先，否则默认排序） */
  sort: FileSort;
  /** 用户是否处于主动排序状态（用于表头箭头显隐） */
  sortActive: boolean;
  /** 三态循环：未激活→升序，升序→降序，降序→取消（恢复默认） */
  setSortKey: (key: FileSortKey) => void;
  toggleSortDir: (key: FileSortKey) => void;
  refresh: () => Promise<void>;
}

const SORT_STORAGE_KEY = 'weave:fileSort';
const VALID_SORT_KEYS: FileSortKey[] = ['name', 'ext', 'size', 'mtime', 'tags'];

/** 读取持久化的排序状态（全局共享，重启后保留） */
function loadPersistedSort(): FileSort | null {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FileSort>;
    if (
      parsed &&
      VALID_SORT_KEYS.includes(parsed.key as FileSortKey) &&
      (parsed.dir === 'asc' || parsed.dir === 'desc')
    ) {
      return { key: parsed.key as FileSortKey, dir: parsed.dir };
    }
    return null;
  } catch {
    return null;
  }
}

function persistSort(sort: FileSort | null): void {
  try {
    if (sort) {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
    } else {
      localStorage.removeItem(SORT_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function useFileList({
  source,
  defaultSort = { key: 'mtime', dir: 'desc' },
  enabled = true,
}: UseFileListOptions): UseFileListResult {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // 用户主动选择的排序；null 表示使用 defaultSort。初始值从 localStorage 恢复
  const [userSort, setUserSort] = useState<FileSort | null>(() => loadPersistedSort());
  const abortRef = useRef<boolean>(false);
  const sourceKey = JSON.stringify(source);
  const filesRevision = useDataStore((s) => s.filesRevision);

  const sort = userSort ?? defaultSort;
  const sortActive = userSort !== null;

  const load = useCallback(async () => {
    if (!enabled) return;
    abortRef.current = false;
    setLoading(true);
    setError(false);
    try {
      const result = await fileApi.list(source, sort);
      if (!abortRef.current) {
        // IPC 返回值异常时兜底为空数组，避免下游 .map/.length 崩溃
        setRows(Array.isArray(result) ? result : []);
      }
    } catch (e) {
      console.error('useFileList load error:', e);
      if (!abortRef.current) {
        setRows([]);
        setError(true);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [sourceKey, sort.key, sort.dir, enabled, filesRevision]);

  useEffect(() => {
    abortRef.current = true;
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  // 三态循环：未激活/他列 → 升序；升序 → 降序；降序 → 取消
  const setSortKey = useCallback(
    (key: FileSortKey) => {
      setUserSort((prev) => {
        let next: FileSort | null;
        if (!prev || prev.key !== key) {
          next = { key, dir: 'asc' };
        } else if (prev.dir === 'asc') {
          next = { key, dir: 'desc' };
        } else {
          next = null;
        }
        persistSort(next);
        return next;
      });
    },
    [],
  );

  const toggleSortDir = useCallback(
    (key: FileSortKey) => {
      setUserSort((prev) => {
        const next: FileSort =
          prev && prev.key === key
            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: 'desc' };
        persistSort(next);
        return next;
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { rows, loading, error, sort, sortActive, setSortKey, toggleSortDir, refresh };
}
