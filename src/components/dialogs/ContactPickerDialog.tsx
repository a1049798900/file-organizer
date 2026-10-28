import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { contactApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import type { ContactRow } from '@shared/types';

export interface ContactPickerPreselect {
  kind: 'file' | 'project';
  id: number;
}

interface ContactPickerDialogProps {
  /** 传入时预选当前已关联的联系人；不传则为批量追加模式（初始不选中） */
  preselect?: ContactPickerPreselect;
  title?: string;
  hint?: string;
  onConfirm: (contactIds: number[]) => Promise<void> | void;
  onClose: () => void;
}

function secondaryText(contact: ContactRow): string {
  return [contact.org, contact.department, contact.title].filter(Boolean).join(' · ');
}

export function ContactPickerDialog({
  preselect,
  title = '关联联系人',
  hint,
  onConfirm,
  onClose,
}: ContactPickerDialogProps) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useUiStore((s) => s.showToast);

  // 首次加载：全部联系人与当前已关联联系人
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoading(true);

    const preselectPromise: Promise<ContactRow[]> = preselect
      ? preselect.kind === 'file'
        ? contactApi.listByFile(preselect.id)
        : contactApi.listByProject(preselect.id)
      : Promise.resolve([]);

    Promise.all([contactApi.list(''), preselectPromise])
      .then(([all, linked]) => {
        if (cancelled) return;
        setContacts(all);
        setSelected(new Set(linked.map((c) => c.id)));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) showToast('加载联系人失败', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [preselect?.kind, preselect?.id, showToast]);

  // 搜索联系人元数据
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      contactApi
        .list(query)
        .then((rows) => {
          if (!cancelled) setContacts(rows);
        })
        .catch(() => {});
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ready]);

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
      await onConfirm(Array.from(selected));
      onClose();
    } catch {
      showToast('关联失败，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} width={520}>
      <div className="p-3 border-b border-line">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索姓名、单位、部门、职务、电话、邮箱、拼音"
            className="w-full h-8 pl-8 pr-3 bg-bg-panel rounded-md text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">🔍</span>
        </div>
      </div>

      {hint && (
        <div className="px-4 py-2 text-xs text-ink-3 border-b border-line bg-bg-panel/50">
          {hint}
        </div>
      )}

      <div style={{ height: 380 }} className="overflow-auto">
        {loading && contacts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-3">
            加载中…
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-3">
            {query.trim() ? '没有找到匹配的联系人' : '还没有联系人，请先在通讯录新增。'}
          </div>
        ) : (
          contacts.map((contact) => {
            const secondary = secondaryText(contact);
            return (
              <div
                key={contact.id}
                role="button"
                tabIndex={0}
                className="w-full flex items-center gap-3 px-3 h-11 text-left border-b border-line/50 hover:bg-bg-hover cursor-pointer"
                onClick={() => toggle(contact.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(contact.id);
                  }
                }}
              >
                <Checkbox
                  checked={selected.has(contact.id)}
                  onChange={() => toggle(contact.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-base text-ink truncate">{contact.name}</span>
                {secondary && (
                  <span className="text-sm text-ink-3 truncate">{secondary}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <span className="text-sm text-ink-2">已选 {selected.size} 人</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!ready || submitting}>
            确认关联
          </Button>
        </div>
      </div>
    </Modal>
  );
}
