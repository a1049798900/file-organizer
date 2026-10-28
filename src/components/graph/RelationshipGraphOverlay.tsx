// 关系网络覆盖层 — 只读全屏图谱
// 负责数据加载、面包屑、图内搜索、右键只读菜单、取消关联与 10 分钟撤销、应用锁遮罩。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Network, Search, Undo2, X } from 'lucide-react';
import type { GraphData, GraphEdge, GraphNode, GraphNodeType } from '@shared/graph';
import { graphNodeKey } from '@shared/graph';
import { graphApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';
import { GraphCanvas } from './GraphCanvas';
import { GraphNodeDetail } from './GraphNodeDetail';
import { ContextMenu, MenuItem, MenuSeparator } from '../ui/ContextMenu';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

const TYPE_LABELS: Record<GraphNodeType, string> = {
  project: '项目',
  file: '文件',
  contact: '联系人',
  topic: '专题',
  area: '领域',
};

interface UndoRecord {
  batchId: string;
  expiresAt: number;
  label: string;
}

interface MenuState {
  x: number;
  y: number;
  node: GraphNode;
  edge: GraphEdge | null;
}

interface UnlinkConfirm {
  edge: GraphEdge;
  nodeLabel: string;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RelationshipGraphOverlay() {
  const graphHistory = useUiStore((s) => s.graphHistory);
  const graphReturnView = useUiStore((s) => s.graphReturnView);
  const appLocked = useUiStore((s) => s.appLocked);
  const popGraphFocus = useUiStore((s) => s.popGraphFocus);
  const pushGraphFocus = useUiStore((s) => s.pushGraphFocus);
  const rewindGraphHistory = useUiStore((s) => s.rewindGraphHistory);
  const setCurrentGraphLabel = useUiStore((s) => s.setCurrentGraphLabel);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const showToast = useUiStore((s) => s.showToast);
  const bumpFilesRevision = useDataStore((s) => s.bumpFilesRevision);

  const current = graphHistory.length > 0 ? graphHistory[graphHistory.length - 1] : null;
  const focusType = current?.type ?? null;
  const focusId = current?.id ?? null;
  const focusKey = focusType && focusId != null ? graphNodeKey(focusType, focusId) : null;

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirm, setConfirm] = useState<UnlinkConfirm | null>(null);
  const [undo, setUndo] = useState<UndoRecord | null>(null);
  const [now, setNow] = useState(Date.now());

  const selectedNode = useMemo(
    () => (selectedKey && data ? data.nodes.find((node) => node.key === selectedKey) ?? null : null),
    [data, selectedKey],
  );

  // 加载焦点图数据：graphHistory 必非空才触发（左侧列表或外部入口 openGraph 已保证）
  useEffect(() => {
    if (appLocked || focusType == null || focusId == null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    graphApi
      .get({ focus: { type: focusType, id: focusId }, hops: 1, limit: 200 })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
        const focusNode = result.nodes.find((node) => node.isFocus);
        if (focusNode) setCurrentGraphLabel(focusNode.label);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : '关系网络加载失败');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appLocked, focusId, focusType, reloadToken, setCurrentGraphLabel]);

  // 切换焦点时重置交互状态与旧图数据（graphHistory 变时 focusKey 跟着变）
  useEffect(() => {
    setData(null);
    setError(null);
    setSelectedKey(null);
    setActiveKey(null);
    setSearchQuery('');
    setMenu(null);
    setConfirm(null);
  }, [focusKey]);

  // Esc：优先回退面包屑；只剩一个历史项时回到 graphReturnView 或收件箱
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menu || confirm) return;
      if (graphHistory.length > 1) {
        event.preventDefault();
        popGraphFocus();
      } else {
        event.preventDefault();
        const target = graphReturnView ?? 'inbox';
        setActiveView(target);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [confirm, graphHistory.length, graphReturnView, menu, popGraphFocus, setActiveView]);

  // 撤销窗口倒计时
  useEffect(() => {
    if (!undo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [undo]);

  useEffect(() => {
    if (undo && undo.expiresAt <= now) setUndo(null);
  }, [now, undo]);

  const handleUnlink = useCallback(
    async (edge: GraphEdge, nodeLabel: string) => {
      try {
        const result = await graphApi.unlink({
          relation: edge.type,
          source: edge.source,
          target: edge.target,
        });
        setUndo({ batchId: result.batchId, expiresAt: result.expiresAt, label: nodeLabel });
        setNow(Date.now());
        bumpFilesRevision();
        setReloadToken((token) => token + 1);
        showToast('已取消关联，可在 10 分钟内撤销');
      } catch (err) {
        showToast(err instanceof Error ? err.message : '取消关联失败', 'error');
      }
    },
    [bumpFilesRevision, showToast],
  );

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    try {
      await graphApi.undoUnlink(undo.batchId);
      bumpFilesRevision();
      setReloadToken((token) => token + 1);
      showToast('已撤销取消关联');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '撤销失败', 'error');
    } finally {
      setUndo(null);
    }
  }, [bumpFilesRevision, showToast, undo]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedKey(node.key);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (node: GraphNode) => {
      if (node.isFocus) return;
      pushGraphFocus({ type: node.type, id: node.entityId }, node.label);
    },
    [pushGraphFocus],
  );

  const handleNodeContextMenu = useCallback(
    (node: GraphNode, x: number, y: number) => {
      let edge: GraphEdge | null = null;
      if (data && focusKey && node.key !== focusKey) {
        edge =
          data.edges.find(
            (item) =>
              (item.source === focusKey && item.target === node.key) ||
              (item.target === focusKey && item.source === node.key),
          ) ?? null;
      }
      setMenu({ x, y, node, edge });
    },
    [data, focusKey],
  );

  // 应用锁：不渲染任何节点名，仅保留空白占位（全局 LockOverlay 会覆盖整个窗口）
  if (appLocked) {
    return <div className="flex-1 min-h-0 min-w-0 bg-white" aria-hidden="true" />;
  }

  const hasNeighbors = data != null && data.nodes.length > 1;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 min-w-0 bg-white overflow-hidden"
      role="region"
      aria-label="关系网络视图"
    >
      {/* 顶部条：面包屑 / 搜索 / 节点计数 / 关闭 */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-line bg-white flex-shrink-0">
        <Network size={18} className="text-accent flex-shrink-0" />
        <nav className="flex items-center gap-1 min-w-0 text-sm" aria-label="关系网路径">
          {graphHistory.map((item, index) => {
            const last = index === graphHistory.length - 1;
            const label = item.label || TYPE_LABELS[item.type];
            return (
              <span key={`${item.type}:${item.id}:${index}`} className="flex items-center gap-1 min-w-0">
                {index > 0 && <ChevronRight size={14} className="text-ink-3 flex-shrink-0" />}
                {last ? (
                  <span className="font-semibold text-ink truncate max-w-[220px]" title={label}>
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-ink-2 hover:text-accent truncate max-w-[160px]"
                    title={label}
                    onClick={() => rewindGraphHistory(index + 1)}
                  >
                    {label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <div className="relative w-[220px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="在图谱内搜索"
              className="h-8 w-full pl-7 pr-2 text-sm border border-line rounded-md bg-white outline-none focus:border-accent"
            />
          </div>
          {data && (
            <span className="text-xs text-ink-3 whitespace-nowrap">
              {data.nodes.length} 个节点
              {data.truncated && ' · 已截断'}
            </span>
          )}
        </div>
      </div>

      {/* 图区域 */}
      <div className="relative flex-1 min-h-0 bg-[#f7f7f9]">
        {loading && !data && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" aria-busy="true" aria-label="关系网络加载中">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex gap-4">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <AlertCircle size={36} strokeWidth={1.5} className="text-danger mb-1" />
            <div className="text-base text-ink-2">{error}</div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
                重试
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && data && !hasNeighbors && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <Network size={40} strokeWidth={1.5} className="text-ink-3 mb-1" />
            <div className="text-base text-ink-2">暂无关联</div>
            <div className="text-sm text-ink-3">
              「{current?.label || '当前焦点'}」还没有任何文件、联系人、专题或项目关联。
            </div>
          </div>
        )}

        {!loading && !error && data && hasNeighbors && (
          <GraphCanvas
            data={data}
            searchQuery={searchQuery}
            activeKey={activeKey}
            selectedKey={selectedKey}
            onActiveKeyChange={setActiveKey}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
          />
        )}

        {/* 右侧详情抽屉 */}
        {selectedNode && (
          <div className="absolute right-0 top-0 bottom-0 z-10 w-[380px] border-l border-line bg-white shadow-xl">
            <GraphNodeDetail
              node={selectedNode}
              onClose={() => setSelectedKey(null)}
              onFocusNode={(node) => {
                if (node.isFocus) return;
                pushGraphFocus({ type: node.type, id: node.entityId }, node.label);
              }}
              onOpenProject={(projectId, label) =>
                pushGraphFocus({ type: 'project', id: projectId }, label)
              }
            />
          </div>
        )}

        {/* 节点右键只读菜单 */}
        {menu && (
          <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
            <MenuItem
              onClick={() => {
                setSelectedKey(menu.node.key);
                setMenu(null);
              }}
            >
              查看详情
            </MenuItem>
            <MenuItem
              disabled={menu.node.isFocus}
              onClick={() => {
                if (!menu.node.isFocus) {
                  pushGraphFocus(
                    { type: menu.node.type, id: menu.node.entityId },
                    menu.node.label,
                  );
                }
                setMenu(null);
              }}
            >
              查看关系网
            </MenuItem>
            {menu.edge && (
              <>
                <MenuSeparator />
                <MenuItem
                  danger
                  onClick={() => {
                    setConfirm({ edge: menu.edge!, nodeLabel: menu.node.label });
                    setMenu(null);
                  }}
                >
                  取消关联…
                </MenuItem>
              </>
            )}
          </ContextMenu>
        )}

        {/* 撤销提示 */}
        {undo && undo.expiresAt > now && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
            <Undo2 size={14} className="flex-shrink-0" />
            <span className="whitespace-nowrap">
              已取消与「{undo.label}」的关联 · {formatRemaining(undo.expiresAt - now)}
            </span>
            <button
              type="button"
              className="font-medium text-[#8ab4ff] hover:underline"
              onClick={handleUndo}
            >
              撤销
            </button>
            <button
              type="button"
              className="text-white/70 hover:text-white"
              onClick={() => setUndo(null)}
              aria-label="关闭撤销提示"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm != null}
        title="取消关联？"
        message={
          confirm
            ? `将解除「${current?.label || '当前焦点'}」与「${confirm.nodeLabel}」之间的关联。\n10 分钟内可在图谱中撤销。`
            : ''
        }
        confirmText="取消关联"
        danger
        onConfirm={() => {
          if (confirm) void handleUnlink(confirm.edge, confirm.nodeLabel);
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
