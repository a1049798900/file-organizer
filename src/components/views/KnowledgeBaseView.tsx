import { useMemo, useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { FileList } from '../filelist/FileList';
import { Resizer } from '../ui/Resizer';
import { useFileList } from '@/hooks/useFileList';
import { useUiStore, type KbSelected } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { kbApi } from '@/lib/ipc';
import { EmptyState } from '../ui/EmptyState';
import { ContextMenu, MenuItem, MenuSeparator } from '../ui/ContextMenu';
import type { FileSortKey } from '@shared/types';
import { KB_SIDEBAR_LAYOUT } from '@/lib/layout';
import { cn } from '@/lib/cn';

export function KnowledgeBaseView() {
  const kbSelected = useUiStore((s) => s.kbSelected);
  const setKbSelected = useUiStore((s) => s.setKbSelected);
  const kbSidebarWidth = useUiStore((s) => s.kbSidebarWidth);
  const setKbSidebarWidth = useUiStore((s) => s.setKbSidebarWidth);
  const topics = useDataStore((s) => s.topics);
  const kbCounts = useDataStore((s) => s.kbCounts);
  const refreshTopics = useDataStore((s) => s.refreshTopics);
  const refreshKbCounts = useDataStore((s) => s.refreshKbCounts);
  const openModal = useUiStore((s) => s.openModal);

  const [newTopicName, setNewTopicName] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    topicId: number;
    topicName: string;
  } | null>(null);
  const newTopicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingTopic && newTopicRef.current) {
      newTopicRef.current.focus();
    }
  }, [isAddingTopic]);

  const source = useMemo(() => {
    switch (kbSelected.kind) {
      case 'all':
        return { kind: 'kb-all' as const };
      case 'uncategorized':
        return { kind: 'kb-uncategorized' as const };
      case 'topic':
        return { kind: 'kb-topic' as const, topicId: kbSelected.id };
    }
  }, [kbSelected]);

  const { rows, loading, refresh, sort, sortActive, setSortKey } = useFileList({
    listKey: `kb-${kbSelected.kind}-${kbSelected.kind === 'topic' ? kbSelected.id : 'all'}`,
    source,
  });

  const handleSortChange = (key: FileSortKey) => {
    setSortKey(key);
  };

  const handleCreateTopic = async () => {
    const name = newTopicName.trim();
    if (!name) {
      setIsAddingTopic(false);
      return;
    }
    try {
      const topic = await kbApi.createTopic(name);
      await refreshTopics();
      await refreshKbCounts();
      setKbSelected({ kind: 'topic', id: topic.id });
      setNewTopicName('');
      setIsAddingTopic(false);
    } catch (e) {
      // 重名等错误
      console.error(e);
    }
  };

  const handleTopicContextMenu = (e: React.MouseEvent, topicId: number, topicName: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, topicId, topicName });
  };

  const handleRenameTopic = () => {
    if (!contextMenu) return;
    openModal({
      type: 'rename',
      target: 'topic',
      id: contextMenu.topicId,
      name: contextMenu.topicName,
    });
    setContextMenu(null);
  };

  const handleDeleteTopic = () => {
    if (!contextMenu) return;
    const { topicId, topicName } = contextMenu;
    setContextMenu(null);
    openModal({
      type: 'confirm',
      config: {
        title: `删除专题「${topicName}」？`,
        message: '其中的文件回到「未分类」，文件本身不删除。',
        confirmText: '删除',
        onConfirm: async () => {
          await kbApi.deleteTopic(topicId);
          await refreshTopics();
          await refreshKbCounts();
          if (kbSelected.kind === 'topic' && kbSelected.id === topicId) {
            setKbSelected({ kind: 'all' });
          }
        },
      },
    });
  };

  const getTitle = () => {
    switch (kbSelected.kind) {
      case 'all':
        return `全部资料 (${kbCounts.all})`;
      case 'uncategorized':
        return `未分类 (${kbCounts.uncategorized})`;
      case 'topic': {
        const t = topics.find((t) => t.id === kbSelected.id);
        return t ? `${t.name} (${t.fileCount})` : '专题';
      }
    }
  };

  const isEmpty = kbCounts.all === 0 && topics.length === 0;

  return (
    <div className="flex flex-1 min-h-0">
      {/* 左侧专题栏 */}
      <div
        className="flex-shrink-0 border-r border-line bg-bg-panel flex flex-col"
        style={{ width: kbSidebarWidth }}
      >
        <div className="py-2 px-2">
          {/* 全部资料 */}
          <button
            onClick={() => setKbSelected({ kind: 'all' })}
            className={cn(
              'w-full flex items-center justify-between h-8 px-2 rounded-md text-sm',
              kbSelected.kind === 'all'
                ? 'bg-accent text-white'
                : 'text-ink hover:bg-bg-hover',
            )}
          >
            <span>全部资料</span>
            <span className="text-xs opacity-75">{kbCounts.all}</span>
          </button>

          {/* 未分类 */}
          <button
            onClick={() => setKbSelected({ kind: 'uncategorized' })}
            className={cn(
              'w-full flex items-center justify-between h-8 px-2 rounded-md text-sm mt-0.5',
              kbSelected.kind === 'uncategorized'
                ? 'bg-accent text-white'
                : 'text-ink hover:bg-bg-hover',
            )}
          >
            <span>未分类</span>
            <span className="text-xs opacity-75">{kbCounts.uncategorized}</span>
          </button>
        </div>

        <div className="mx-2 h-px bg-line" />

        {/* 专题列表 */}
        <div className="flex-1 min-h-0 overflow-auto py-2 px-2">
          <div className="text-xs text-ink-3 px-2 mb-1">专题</div>
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setKbSelected({ kind: 'topic', id: t.id })}
              onContextMenu={(e) => handleTopicContextMenu(e, t.id, t.name)}
              className={cn(
                'w-full flex items-center justify-between h-8 px-2 rounded-md text-sm mt-0.5',
                kbSelected.kind === 'topic' && kbSelected.id === t.id
                  ? 'bg-accent text-white'
                  : 'text-ink hover:bg-bg-hover',
              )}
            >
              <span className="truncate">· {t.name}</span>
              <span className="text-xs opacity-75 flex-shrink-0 ml-1">{t.fileCount}</span>
            </button>
          ))}

          {/* 新建专题 */}
          {isAddingTopic ? (
            <div className="mt-1 px-1">
              <input
                ref={newTopicRef}
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTopic();
                  if (e.key === 'Escape') {
                    setIsAddingTopic(false);
                    setNewTopicName('');
                  }
                }}
                onBlur={handleCreateTopic}
                placeholder="专题名称"
                className="w-full h-7 px-2 text-sm border border-accent rounded bg-white outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAddingTopic(true)}
              className="w-full flex items-center h-8 px-2 rounded-md text-sm text-ink-2 hover:bg-bg-hover mt-1"
            >
              <Plus size={14} className="mr-1" />
              新建专题
            </button>
          )}
          {!isAddingTopic && (
            <div className="text-[11px] text-ink-3 px-2 mt-1 leading-4">
              专题是资料的合集，一个文件可以属于多个专题。
            </div>
          )}
        </div>
      </div>

      {/* 专题栏 Resizer */}
      <Resizer
        direction="left"
        value={kbSidebarWidth}
        onChange={setKbSidebarWidth}
        min={KB_SIDEBAR_LAYOUT.min}
        max={KB_SIDEBAR_LAYOUT.max}
        maxPct={KB_SIDEBAR_LAYOUT.maxPct}
        defaultSize={KB_SIDEBAR_LAYOUT.defaultSize}
      />

      {/* 右侧文件列表 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 标题栏 */}
        <div className="h-14 flex items-center px-4 border-b border-line flex-shrink-0">
          <div className="text-xl font-semibold text-ink">{getTitle()}</div>
        </div>

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              text="资料库是空的。在这里存文件资料，不是写笔记的地方。在收件箱或项目中右键文件 →「存入资料库」；或直接把文件拖到这里。"
              icon="kb"
            />
          </div>
        ) : (
          <FileList
            listKey={`kb-${kbSelected.kind}-${kbSelected.kind === 'topic' ? kbSelected.id : 'all'}`}
            rows={rows}
            loading={loading}
            sort={sort}
            sortActive={sortActive}
            onSortChange={handleSortChange}
            scene="kb"
            emptyText="暂无文件"
            emptyIcon="kb"
            onRefresh={async () => {
              await refresh();
              await refreshTopics();
              await refreshKbCounts();
            }}
          />
        )}
      </div>

      {/* 专题右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <MenuItem onClick={handleRenameTopic}>重命名</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={handleDeleteTopic} danger>
            删除专题
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  );
}
