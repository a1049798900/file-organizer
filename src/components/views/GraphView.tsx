// 关系网络视图 — 仿资料库的左右分栏内嵌结构
// 左侧常驻焦点选择器（tabs + 搜索 + 列表），右侧是图谱画布。
// 不再依赖 Modal 弹窗选焦点；进入视图即自动选中第一项。
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Resizer } from '../ui/Resizer';
import { RelationshipGraphOverlay } from '../graph/RelationshipGraphOverlay';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { contactApi, fileApi } from '@/lib/ipc';
import { cn } from '@/lib/cn';
import { formatSize } from '@/lib/format';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { GRAPH_SIDEBAR_LAYOUT } from '@/lib/layout';
import type { ContactRow, FileRow } from '@shared/types';
import type { GraphFocusType } from '@shared/graph';

type FocusTab = 'project' | 'file' | 'contact' | 'topic';

const TABS: { key: FocusTab; label: string }[] = [
  { key: 'project', label: '项目' },
  { key: 'topic', label: '专题' },
  { key: 'contact', label: '联系人' },
  { key: 'file', label: '文件' },
];

const FILE_RESULT_LIMIT = 50;

export function GraphView() {
  const graphSidebarWidth = useUiStore((s) => s.graphSidebarWidth);
  const setGraphSidebarWidth = useUiStore((s) => s.setGraphSidebarWidth);
  const openGraph = useUiStore((s) => s.openGraph);
  const graphHistory = useUiStore((s) => s.graphHistory);

  const projects = useDataStore((s) => s.projects);
  const topics = useDataStore((s) => s.topics);

  const [tab, setTab] = useState<FocusTab>('project');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim().toLowerCase();
  const currentFocus = graphHistory.length > 0 ? graphHistory[graphHistory.length - 1] : null;

  // 进入 graph 视图时若尚未选中任何焦点，自动选中第一个可用的项目/专题。
  // project/topic 有 useDataStore 缓存，可立即选中；file/contact 必须搜索才有数据，暂不自动选。
  useEffect(() => {
    if (graphHistory.length > 0) return;
    if (projects.length > 0) {
      openGraph({ type: 'project', id: projects[0].id }, projects[0].name);
    } else if (topics.length > 0) {
      openGraph({ type: 'topic', id: topics[0].id }, topics[0].name);
    }
    // openGraph 内部已经 setActiveView('graph')，此时 activeView 已是 graph
  }, [graphHistory.length, projects, topics, openGraph]);

  // 切到其他视图再切回 graph 时，如果 graphHistory 被外层 clear 了（比如 closeGraph），也自动选第一项
  // 这个 effect 也覆盖该情况

  // 联系人：服务端搜索（防抖）
  useEffect(() => {
    if (tab !== 'contact') return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      contactApi
        .list(query)
        .then((rows) => {
          if (!cancelled) setContacts(rows);
        })
        .catch(() => {
          if (!cancelled) setContacts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, query]);

  // 文件：仅在有关键词时搜索（防抖），避免一次性拉出全量文件
  useEffect(() => {
    if (tab !== 'file') return;
    if (!query.trim()) {
      setFiles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fileApi
        .list({ kind: 'search', query: query.trim() }, { key: 'mtime', dir: 'desc' })
        .then((rows) => {
          if (!cancelled) setFiles(rows);
        })
        .catch(() => {
          if (!cancelled) setFiles([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, query]);

  const filteredProjects = useMemo(
    () => projects.filter((p) => !trimmed || p.name.toLowerCase().includes(trimmed)),
    [projects, trimmed],
  );

  const filteredTopics = useMemo(
    () => topics.filter((t) => !trimmed || t.name.toLowerCase().includes(trimmed)),
    [topics, trimmed],
  );

  const pick = (type: GraphFocusType, id: number, label: string) => {
    openGraph({ type, id }, label);
  };

  const switchTab = (next: FocusTab) => {
    if (next === tab) return;
    setTab(next);
    setQuery('');
    setLoading(false);
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="p-3 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      );
    }

    const currentKey = currentFocus ? `${currentFocus.type}:${currentFocus.id}` : null;

    const renderRow = (
      id: number,
      title: string,
      subtitle: string,
      type: GraphFocusType,
    ) => {
      const active = currentKey === `${type}:${id}`;
      return (
        <button
          key={`${type}:${id}`}
          type="button"
          onClick={() => pick(type, id, title)}
          className={cn(
            'w-full flex flex-col px-3 py-2 text-left border-b border-line/50 last:border-b-0',
            active
              ? 'bg-accent text-white hover:bg-accent/90'
              : 'hover:bg-accent-weak text-ink',
          )}
        >
          <span className="text-sm truncate">{title}</span>
          <span
            className={cn(
              'text-xs truncate',
              active ? 'text-white/80' : 'text-ink-3',
            )}
          >
            {subtitle}
          </span>
        </button>
      );
    };

    if (tab === 'project') {
      if (filteredProjects.length === 0) {
        return (
          <div className="p-4 text-sm text-ink-3">
            {trimmed ? '没有匹配的项目' : '暂无项目，请先在项目页创建'}
          </div>
        );
      }
      return filteredProjects.map((p) =>
        renderRow(
          p.id,
          p.name,
          `${p.status === 'active' ? '进行中' : '已完成'} · ${p.fileCount} 个文件`,
          'project',
        ),
      );
    }

    if (tab === 'topic') {
      if (filteredTopics.length === 0) {
        return (
          <div className="p-4 text-sm text-ink-3">
            {trimmed ? '没有匹配的专题' : '暂无专题，请先在资料库创建'}
          </div>
        );
      }
      return filteredTopics.map((t) =>
        renderRow(t.id, t.name, `${t.fileCount} 个文件`, 'topic'),
      );
    }

    if (tab === 'contact') {
      if (contacts.length === 0) {
        return (
          <div className="p-4 text-sm text-ink-3">
            {trimmed ? '没有匹配的联系人' : '暂无联系人'}
          </div>
        );
      }
      return contacts.map((c) =>
        renderRow(
          c.id,
          c.name,
          [c.org, c.department, c.title].filter(Boolean).join(' · ') || '未填写单位信息',
          'contact',
        ),
      );
    }

    // file
    if (!query.trim()) {
      return <div className="p-4 text-sm text-ink-3">输入文件名关键词后搜索</div>;
    }
    if (files.length === 0) {
      return <div className="p-4 text-sm text-ink-3">没有匹配的文件</div>;
    }
    const shown = files.slice(0, FILE_RESULT_LIMIT);
    return (
      <>
        {files.length > FILE_RESULT_LIMIT && (
          <div className="px-3 py-1.5 text-xs text-ink-3 border-b border-line/50">
            已匹配 {files.length} 个文件，仅显示前 {FILE_RESULT_LIMIT} 个，请继续输入关键词缩小范围
          </div>
        )}
        {shown.map((f) =>
          renderRow(
            f.id,
            f.alias || f.name,
            `${(f.ext || 'file').toUpperCase()} · ${formatSize(f.size)}`,
            'file',
          ),
        )}
      </>
    );
  };

  // 数据还没加载完，左侧也展示骨架或空态
  const leftEmpty =
    projects.length === 0 && topics.length === 0 && !loading && !query.trim();

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-white">
      {/* 左侧焦点选择器 */}
      <div
        className="flex-shrink-0 border-r border-line bg-bg-panel flex flex-col"
        style={{ width: graphSidebarWidth }}
      >
        {/* Tab 切换 */}
        <div className="px-2 pt-2 pb-1">
          <div className="flex gap-0.5 rounded-md bg-white border border-line overflow-hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                className={cn(
                  'flex-1 h-7 text-xs transition-colors',
                  tab === t.key ? 'bg-accent text-white' : 'text-ink-3 hover:text-ink hover:bg-bg-hover',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 搜索框 */}
        <div className="px-2 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'file' ? '文件名关键词搜索' : '按名称过滤'}
              className="h-7 w-full pl-6 pr-2 text-xs border border-line rounded-md bg-white outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {leftEmpty && tab === 'project' && (
            <EmptyState text="暂无项目" icon="folder" />
          )}
          {leftEmpty && tab === 'topic' && (
            <EmptyState text="暂无专题" icon="kb" />
          )}
          {!(leftEmpty && (tab === 'project' || tab === 'topic')) && renderList()}
        </div>
      </div>

      {/* Resizer */}
      <Resizer
        direction="left"
        value={graphSidebarWidth}
        onChange={setGraphSidebarWidth}
        min={GRAPH_SIDEBAR_LAYOUT.min}
        max={GRAPH_SIDEBAR_LAYOUT.max}
        maxPct={GRAPH_SIDEBAR_LAYOUT.maxPct}
        defaultSize={GRAPH_SIDEBAR_LAYOUT.defaultSize}
      />

      {/* 右侧图谱画布（内嵌 RelationshipGraphOverlay，它本身已经是 flex-1 min-h-0） */}
      <RelationshipGraphOverlay />
    </div>
  );
}
