import { useCallback, useEffect, useState } from 'react';
import { Plus, UserRound, FolderPlus, FilePlus2, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { EmptyState } from '../ui/EmptyState';
import { ContactDetailCard } from '../contacts/ContactDetailCard';
import { ContactEditorDialog } from '../dialogs/ContactEditorDialog';
import { ContactFilePickerDialog } from '../dialogs/ContactFilePickerDialog';
import { ProjectPickerDialog } from '../dialogs/ProjectPickerDialog';
import { useUiStore } from '@/stores/useUiStore';
import { contactApi } from '@/lib/ipc';
import { openGraphFromFocus } from '@/lib/graphEntry';
import {
  isExternalFileDrop,
  isFileDrag,
  readFileDragIds,
  setContactDragData,
} from '@/lib/drag';
import { cn } from '@/lib/cn';
import type { ContactDetail, ContactRow } from '@shared/types';

function secondaryText(contact: ContactRow): string {
  return [contact.org, contact.department, contact.title].filter(Boolean).join(' · ');
}

export function ContactsView() {
  const selectedContactId = useUiStore((s) => s.selectedContactId);
  const setSelectedContactId = useUiStore((s) => s.setSelectedContactId);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const openModal = useUiStore((s) => s.openModal);
  const showToast = useUiStore((s) => s.showToast);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<{ contact: ContactRow | null } | null>(null);

  // 批量选择与拖拽状态
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set());
  const [dragOverContactId, setDragOverContactId] = useState<number | null>(null);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setReloadKey((key) => key + 1);
  }, []);

  // 联系人列表（搜索防抖）
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      contactApi
        .list(query)
        .then((rows) => {
          if (!cancelled) setContacts(rows);
        })
        .catch(() => {
          if (!cancelled) showToast('加载联系人失败', 'error');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query.trim() ? 200 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, reloadKey, showToast]);

  // 选中联系人详情
  useEffect(() => {
    if (selectedContactId == null) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    contactApi
      .getDetail(selectedContactId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setSelectedContactId(null);
          return;
        }
        setDetail(result);
      })
      .catch(() => {
        if (!cancelled) showToast('加载联系人详情失败', 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedContactId, reloadKey, setSelectedContactId, showToast]);

  // 列表加载完成后自动选中第一条（搜索时不打断当前选择）
  useEffect(() => {
    if (loading || query.trim() || selectedContactId != null || contacts.length === 0) return;
    setSelectedContactId(contacts[0].id);
  }, [loading, query, selectedContactId, contacts, setSelectedContactId]);

  // 清理已不在列表中的批量选择
  useEffect(() => {
    setBulkSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(contacts.map((c) => c.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [contacts]);

  // 拖拽结束（无论在何处松手）时清除行高亮
  useEffect(() => {
    const clear = () => setDragOverContactId(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  const toggleBulkSelected = (id: number) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaved = (saved: ContactRow) => {
    setSelectedContactId(saved.id);
    void refresh();
  };

  const handleDelete = () => {
    if (!selectedContactId) return;
    const id = selectedContactId;
    openModal({
      type: 'confirm',
      config: {
        title: '删除联系人',
        message: '删除后将从项目和文件关联中移除，不影响文件本身。',
        confirmText: '删除',
        onConfirm: () => {
          contactApi
            .remove(id)
            .then(() => {
              setSelectedContactId(null);
              setDetail(null);
              setBulkSelectedIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              void refresh();
              showToast('联系人已删除');
            })
            .catch(() => showToast('删除联系人失败', 'error'));
        },
      },
    });
  };

  const handleBulkDelete = () => {
    if (bulkSelectedIds.size === 0) return;
    const ids = Array.from(bulkSelectedIds);

    openModal({
      type: 'confirm',
      config: {
        title: `删除选中的 ${ids.length} 位联系人？`,
        message: '删除后将从项目和文件关联中移除，不影响文件本身。',
        confirmText: '删除',
        onConfirm: () => {
          contactApi
            .removeMany(ids)
            .then((result) => {
              if (selectedContactId != null && ids.includes(selectedContactId)) {
                setSelectedContactId(null);
                setDetail(null);
              }
              setBulkSelectedIds(new Set());
              void refresh();
              showToast(
                result.fail > 0
                  ? `已删除 ${result.ok} 位，失败 ${result.fail} 位`
                  : `已删除 ${result.ok} 位联系人`,
              );
            })
            .catch(() => showToast('批量删除失败', 'error'));
        },
      },
    });
  };

  const handleSelectProject = (projectId: number) => {
    setActiveProjectId(projectId);
    setActiveView('project-detail');
  };

  // 拖拽联系人到项目：选中行按多选集合拖出，未选中行只拖自身
  const handleContactDragStart = (e: React.DragEvent, contactId: number) => {
    if (bulkSelectedIds.has(contactId)) {
      setContactDragData(e, Array.from(bulkSelectedIds));
    } else {
      setContactDragData(e, [contactId]);
    }
  };

  // 从文件列表拖入联系人行：追加文件关联
  const handleContactDragOver = (e: React.DragEvent, contactId: number) => {
    if (!isFileDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverContactId !== contactId) setDragOverContactId(contactId);
  };

  const handleContactDragLeave = (e: React.DragEvent, contactId: number) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverContactId((current) => (current === contactId ? null : current));
  };

  const handleContactDrop = (e: React.DragEvent, contactId: number) => {
    if (!isFileDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverContactId(null);

    const fileIds = readFileDragIds(e);
    if (fileIds.length === 0) return;

    contactApi
      .addToFiles(fileIds, [contactId])
      .then((result) => {
        setSelectedContactId(contactId);
        void refresh();
        showToast(
          result.fail > 0
            ? `已关联 ${result.ok} 项，失败 ${result.fail} 项`
            : `已关联 ${fileIds.length} 个文件`,
        );
      })
      .catch(() => showToast('关联文件失败', 'error'));
  };

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onDragOver={(e) => {
        // 系统外部文件不允许拖入通讯录
        if (isExternalFileDrop(e.dataTransfer)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'none';
        }
      }}
      onDrop={(e) => {
        if (isExternalFileDrop(e.dataTransfer)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="flex flex-1 min-h-0">
        <aside className="w-[280px] shrink-0 border-r border-line flex flex-col min-h-0 bg-white">
          {/* 列表标题 */}
          <div className="px-4 py-4 border-b border-line shrink-0">
            <div className="flex items-center gap-1.5 text-base font-semibold text-ink">
              <UserRound size={18} className="text-ink-2" />
              通讯录
              <span className="text-xs text-ink-3 font-normal">{contacts.length}</span>
            </div>
          </div>

          {/* 搜索 + 新增 */}
          <div className="px-4 py-2.5 border-b border-line shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索姓名、单位、电话、拼音"
                className="flex-1 min-w-0 h-8 px-2.5 border border-line rounded text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => setEditor({ contact: null })}
                className="shrink-0"
              >
                <Plus size={14} className="mr-1" />
                新增联系人
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            {loading && contacts.length === 0 ? (
              <div className="px-3 py-6 text-sm text-ink-3 text-center">加载中…</div>
            ) : contacts.length === 0 ? (
              <EmptyState
                icon="search"
                text={
                  query.trim()
                    ? '没有找到匹配的联系人'
                    : '还没有联系人。点击「+ 新增联系人」开始维护。'
                }
                className="py-10 px-4"
              />
            ) : (
              contacts.map((contact) => {
                const active = contact.id === selectedContactId;
                const secondary = secondaryText(contact);
                const isDragOver = dragOverContactId === contact.id;
                return (
                  <div
                    key={contact.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => handleContactDragStart(e, contact.id)}
                    onDragOver={(e) => handleContactDragOver(e, contact.id)}
                    onDragLeave={(e) => handleContactDragLeave(e, contact.id)}
                    onDrop={(e) => handleContactDrop(e, contact.id)}
                    onClick={() => setSelectedContactId(contact.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedContactId(contact.id);
                      }
                    }}
                    className={cn(
                      'w-full flex items-start gap-2.5 px-4 py-3 border-b border-line/50 transition-colors cursor-pointer',
                      active ? 'bg-accent-weak' : 'hover:bg-bg-hover',
                      isDragOver && 'bg-accent-weak ring-2 ring-inset ring-accent/50',
                    )}
                  >
                    <span className="pt-0.5 shrink-0">
                      <Checkbox
                        checked={bulkSelectedIds.has(contact.id)}
                        onChange={() => toggleBulkSelected(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'text-sm font-medium truncate mb-0.5',
                          active ? 'text-accent' : 'text-ink',
                        )}
                      >
                        {contact.name}
                      </div>
                      <div className="text-xs text-ink-3 truncate">
                        {secondary || '未填写单位信息'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0">
          {detail ? (
            <ContactDetailCard
              detail={detail}
              onEdit={() => setEditor({ contact: detail })}
              onDelete={handleDelete}
              onRefresh={refresh}
              onSelectProject={handleSelectProject}
              onViewGraph={() => openGraphFromFocus('contact', detail.id, detail.name)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-ink-3">
              选择左侧联系人查看档案
            </div>
          )}
        </main>
      </div>

      {/* 底部批量操作栏 */}
      {bulkSelectedIds.size > 0 && (
        <div className="h-12 shrink-0 border-t border-line bg-bg-panel/60 flex items-center justify-between px-4">
          <span className="text-sm text-ink-2">
            已选 {bulkSelectedIds.size} 位联系人
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setProjectPickerOpen(true)}
            >
              <FolderPlus size={14} className="mr-1" />
              批量关联项目
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilePickerOpen(true)}
            >
              <FilePlus2 size={14} className="mr-1" />
              批量关联文件
            </Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>
              <Trash2 size={14} className="mr-1" />
              批量删除
            </Button>
            <button
              type="button"
              onClick={() => setBulkSelectedIds(new Set())}
              className="flex items-center gap-1 h-7 px-2 rounded-md text-sm text-ink-3 hover:bg-bg-hover"
            >
              <X size={14} /> 取消选择
            </button>
          </div>
        </div>
      )}

      {editor && (
        <ContactEditorDialog
          contact={editor.contact}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

      {filePickerOpen && bulkSelectedIds.size > 0 && (
        <ContactFilePickerDialog
          contactIds={Array.from(bulkSelectedIds)}
          mode="add"
          title={`批量关联文件（${bulkSelectedIds.size} 位联系人）`}
          hint="将为所选联系人追加文件关联，不移除已有关系。"
          onSaved={refresh}
          onClose={() => setFilePickerOpen(false)}
        />
      )}

      {projectPickerOpen && bulkSelectedIds.size > 0 && (
        <ProjectPickerDialog
          contactIds={Array.from(bulkSelectedIds)}
          onSaved={(linked) => {
            showToast(`已关联 ${linked} 项`);
            void refresh();
          }}
          onClose={() => setProjectPickerOpen(false)}
        />
      )}
    </div>
  );
}
