import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { contactApi, fileApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { formatSize } from '@/lib/format';
import type { FileRow } from '@shared/types';

interface ContactFilePickerDialogProps {
  /** 目标联系人（单人或批量） */
  contactIds: number[];
  /** replace：用所选文件替换该联系人的全部关联；add：向所有目标联系人追加关联 */
  mode?: 'replace' | 'add';
  initialFileIds?: number[];
  title?: string;
  hint?: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function ContactFilePickerDialog({
  contactIds,
  mode = 'replace',
  initialFileIds = [],
  title,
  hint,
  onClose,
  onSaved,
}: ContactFilePickerDialogProps) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set(initialFileIds));
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      const source = query.trim()
        ? ({ kind: 'search', query: query.trim() } as const)
        : ({ kind: 'all' } as const);
      fileApi
        .list(source, { key: 'mtime', dir: 'desc' })
        .then((rows) => {
          if (!cancelled) setFiles(rows);
        })
        .catch(() => {
          if (!cancelled) showToast('加载文件失败', 'error');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, showToast]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (mode === 'replace') {
        await contactApi.setContactFiles(contactIds[0], Array.from(selected));
      } else {
        await contactApi.addToFiles(Array.from(selected), contactIds);
      }
      await onSaved();
      onClose();
    } catch {
      showToast('保存关联文件失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle = title ?? (mode === 'add' ? '批量关联文件' : '添加关联文件');
  const confirmDisabled = submitting || (mode === 'add' && selected.size === 0);

  return (
    <Modal open onClose={onClose} title={dialogTitle} width={560}>
      <div className="p-3 border-b border-line">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文件名、标签、拼音首字母"
          className="w-full h-8 px-3 bg-bg-panel rounded-md text-sm outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {hint && (
        <div className="px-4 py-2 text-xs text-ink-3 border-b border-line bg-bg-panel/50">
          {hint}
        </div>
      )}

      <div style={{ height: 400 }} className="overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-3">
            加载中…
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-3">
            {query.trim() ? '没有找到匹配的文件' : '还没有已索引的文件'}
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              role="button"
              tabIndex={0}
              className="w-full flex items-center gap-3 px-3 h-11 text-left border-b border-line/50 hover:bg-bg-hover cursor-pointer"
              onClick={() => toggle(file.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(file.id);
                }
              }}
            >
              <Checkbox
                checked={selected.has(file.id)}
                onChange={() => toggle(file.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-base text-ink truncate flex-1">{file.name}</span>
              <span className="text-xs text-ink-3 uppercase">{file.ext}</span>
              <span className="text-xs text-ink-3 w-16 text-right">{formatSize(file.size)}</span>
              {file.pathMissing && <span className="text-xs text-danger">路径失效</span>}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <span className="text-sm text-ink-2">已选 {selected.size} 个文件</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={confirmDisabled}>
            确认
          </Button>
        </div>
      </div>
    </Modal>
  );
}
