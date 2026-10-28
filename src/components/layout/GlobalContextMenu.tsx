// 全局右键菜单 — 文件条目统一
import { useUiStore } from '@/stores/useUiStore';
import { ContextMenu, MenuItem, MenuSeparator, MenuSubmenu } from '../ui/ContextMenu';
import { useDataStore } from '@/stores/useDataStore';
import { fileApi, projectApi, kbApi, tagApi } from '@/lib/ipc';
import { useSelectionStore } from '@/stores/useSelectionStore';
import { startMoveFile, undoMoveFile } from '@/lib/moveFile';
import { openGraphFromFocus } from '@/lib/graphEntry';
import type { MoveUndoInfo } from '@shared/types';
import { useRef, useState, useEffect } from 'react';

export function GlobalContextMenu() {
  const contextMenu = useUiStore((s) => s.contextMenu);
  const closeContextMenu = useUiStore((s) => s.closeContextMenu);
  const openModal = useUiStore((s) => s.openModal);
  const showToast = useUiStore((s) => s.showToast);

  const projects = useDataStore((s) => s.projects);
  const topics = useDataStore((s) => s.topics);
  const tags = useDataStore((s) => s.tags);
  const refreshInboxCount = useDataStore((s) => s.refreshInboxCount);
  const bumpFilesRevision = useDataStore((s) => s.bumpFilesRevision);
  const refreshTopics = useDataStore((s) => s.refreshTopics);
  const refreshKbCounts = useDataStore((s) => s.refreshKbCounts);

  const [undoRecord, setUndoRecord] = useState<MoveUndoInfo | null>(null);

  // 菜单打开时查询该文件是否处于可撤销状态
  useEffect(() => {
    let cancelled = false;
    setUndoRecord(null);

    if (contextMenu && contextMenu.fileIds.length === 1) {
      fileApi
        .getMoveUndo(contextMenu.fileIds[0])
        .then((record) => {
          if (!cancelled) setUndoRecord(record);
        })
        .catch(() => {
          if (!cancelled) setUndoRecord(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [contextMenu]);

  if (!contextMenu) return null;

  const { x, y, fileIds, scene, currentProjectId } = contextMenu;
  const isSingle = fileIds.length === 1;
  const firstFileMissing = false; // 简化：在菜单项内再判断

  const handleOpen = async () => {
    if (fileIds.length === 1) {
      const result = await fileApi.open(fileIds[0]);
      if (!result.ok && result.reason) {
        showToast(result.reason, 'error');
      }
    }
    closeContextMenu();
  };

  const handleReveal = async () => {
    if (fileIds.length === 1) {
      await fileApi.reveal(fileIds[0]);
    }
    closeContextMenu();
  };

  const handleMove = async () => {
    if (!isSingle) return;
    const fileId = fileIds[0];
    closeContextMenu();
    await startMoveFile(fileId);
  };

  const handleUndoMove = async () => {
    if (!isSingle) return;
    const fileId = fileIds[0];
    closeContextMenu();
    await undoMoveFile(fileId);
  };

  const handleMarkFiled = async () => {
    await fileApi.markFiled(fileIds);
    await refreshInboxCount();
    closeContextMenu();
  };

  const handleSaveToKb = () => {
    openModal({ type: 'save-to-kb', fileIds });
  };

  const handleRemoveFromKb = () => {
    openModal({ type: 'remove-from-kb', fileIds });
  };

  const handleRemoveIndex = () => {
    openModal({
      type: 'confirm',
      config: {
        title: `从软件移除 ${fileIds.length} 项？`,
        message: '文件仍在磁盘原位置，只是不再显示在 Weave 中。',
        confirmText: '从软件移除',
        onConfirm: async () => {
          const result = await fileApi.remove(fileIds);
          bumpFilesRevision();
          closeContextMenu();
          await refreshInboxCount();
          if (result.fail > 0) {
            openModal({ type: 'batch-result', config: result });
          }
        },
      },
    });
  };

  const handleAddToProject = async (projectId: number) => {
    await projectApi.addFiles(projectId, fileIds);
    bumpFilesRevision();
    showToast(`已添加到项目`);
    closeContextMenu();
  };

  const handleLinkContacts = () => {
    if (fileIds.length === 0) return;
    openModal({ type: 'contact-picker', fileIds });
  };

  const handleViewGraph = () => {
    if (!isSingle) return;
    openGraphFromFocus('file', fileIds[0], '');
  };

  const handleRemoveFromProject = async () => {
    if (currentProjectId != null && fileIds.length === 1) {
      await projectApi.removeFile(currentProjectId, fileIds[0]);
      bumpFilesRevision();
      showToast('已取消与项目的关联');
      closeContextMenu();
    }
  };

  const handleAddTag = async (tagId: number) => {
    await tagApi.addToFiles(fileIds, [tagId]);
    closeContextMenu();
  };

  const handleCreateTag = async (name: string) => {
    const tag = await tagApi.create(name);
    await tagApi.addToFiles(fileIds, [tag.id]);
    closeContextMenu();
  };

  const handleAddToTopic = async (topicId: number) => {
    await kbApi.addToTopic(fileIds, topicId);
    closeContextMenu();
  };

  const handleCreateTopic = async (name: string) => {
    try {
      const topic = await kbApi.createTopic(name);
      await kbApi.addToTopic(fileIds, topic.id);
      await refreshTopics();
      await refreshKbCounts();
      closeContextMenu();
    } catch {
      showToast('创建专题失败', 'error');
    }
  };

  const isInKnowledge = false; // 简化：单文件时可通过 fileApi 获取，这里先设为 false 以显示"存入资料库"

  return (
    <ContextMenu x={x} y={y} onClose={closeContextMenu}>
      {undoRecord && isSingle && (
        <>
          <MenuItem onClick={handleUndoMove}>↩ 撤销此操作</MenuItem>
          <MenuSeparator />
        </>
      )}

      <MenuItem onClick={handleOpen} disabled={!isSingle}>
        用系统程序打开
      </MenuItem>
      <MenuItem onClick={handleReveal} disabled={!isSingle}>
        打开所在文件夹
      </MenuItem>
      <MenuItem onClick={handleMove} disabled={!isSingle}>
        📁 移动到文件夹…
      </MenuItem>

      <MenuSeparator />

      <MenuSubmenu label="关联到项目 ▸">
        {projects.length === 0 && (
          <div className="px-3 py-2 text-sm text-ink-3">暂无项目</div>
        )}
        {projects.map((p) => (
          <MenuItem key={p.id} onClick={() => handleAddToProject(p.id)}>
            {p.name}
          </MenuItem>
        ))}
      </MenuSubmenu>

      <MenuItem onClick={handleLinkContacts}>
        👤 关联联系人{fileIds.length > 1 ? `（${fileIds.length} 个文件）` : ''}
      </MenuItem>

      <MenuItem onClick={handleViewGraph} disabled={!isSingle}>
        查看关系网
      </MenuItem>

      <MenuSubmenu label="加入专题 ▸">
        {topics.length === 0 && (
          <div className="px-3 py-2 text-sm text-ink-3">暂无专题</div>
        )}
        {topics.map((t) => (
          <MenuItem key={t.id} onClick={() => handleAddToTopic(t.id)}>
            {t.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <NewInlineMenuItem onCreate={handleCreateTopic} placeholder="输入专题名，回车创建" label="+ 新建专题…" />
      </MenuSubmenu>

      {scene === 'kb' ? (
        <MenuItem onClick={handleRemoveFromKb}>移出资料库</MenuItem>
      ) : (
        <MenuItem onClick={handleSaveToKb}>📚 存入资料库</MenuItem>
      )}

      <MenuSubmenu label="打标签 ▸">
        {tags.length === 0 && (
          <div className="px-3 py-2 text-sm text-ink-3">暂无标签</div>
        )}
        {tags.map((t) => (
          <MenuItem key={t.id} onClick={() => handleAddTag(t.id)}>
            {t.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <NewInlineMenuItem
          onCreate={handleCreateTag}
          label="+ 新建标签…"
          placeholder="输入标签名，回车创建"
        />
      </MenuSubmenu>

      {scene === 'project' && currentProjectId != null && (
        <>
          <MenuSeparator />
          <MenuItem onClick={handleRemoveFromProject} danger>
            取消与项目的关联
          </MenuItem>
        </>
      )}

      <MenuSeparator />
      <MenuItem onClick={handleRemoveIndex} danger>
        从软件移除
      </MenuItem>
    </ContextMenu>
  );
}

function NewInlineMenuItem({
  onCreate,
  label,
  placeholder,
}: {
  onCreate: (name: string) => void;
  label: string;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (name.trim()) {
        onCreate(name.trim());
      }
    } else if (e.key === 'Escape') {
      setEditing(false);
      setName('');
    }
  };

  if (!editing) {
    return <MenuItem onClick={() => setEditing(true)}>{label}</MenuItem>;
  }

  return (
    <div className="px-3 py-1">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-7 px-2 text-sm border border-line rounded bg-white outline-none focus:border-accent"
      />
    </div>
  );
}
