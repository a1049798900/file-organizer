// 关系图谱 Canvas 渲染层
// 纯 Canvas 2D 自绘：高分屏缩放、平移缩放、视口裁剪、四叉树命中、悬停高亮、键盘焦点、图内搜索。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData, GraphNode, GraphNodeType, GraphRelationType } from '@shared/graph';
import {
  computeRadialLayout,
  type GraphLayoutResult,
} from '@/lib/graphLayout';
import { buildQuadTree, type QuadTree } from '@/lib/quadtree';

const TYPE_COLORS: Record<GraphNodeType, string> = {
  project: '#5856d6',
  file: '#0a84ff',
  contact: '#34c759',
  topic: '#ff9500',
  area: '#af52de',
};

const RELATION_STYLES: Record<GraphRelationType, { color: string; dashed: boolean }> = {
  project_file: { color: 'rgba(88, 86, 214, 0.42)', dashed: false },
  project_contact: { color: 'rgba(52, 199, 89, 0.42)', dashed: true },
  file_contact: { color: 'rgba(52, 199, 89, 0.38)', dashed: true },
  file_topic: { color: 'rgba(255, 149, 0, 0.42)', dashed: true },
  area_file: { color: 'rgba(175, 82, 222, 0.42)', dashed: false },
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const CLICK_DELAY_MS = 220;

export interface GraphCanvasProps {
  data: GraphData;
  searchQuery: string;
  activeKey: string | null;
  selectedKey: string | null;
  onActiveKeyChange: (key: string | null) => void;
  onNodeClick: (node: GraphNode) => void;
  onNodeDoubleClick: (node: GraphNode) => void;
  onNodeContextMenu: (node: GraphNode, clientX: number, clientY: number) => void;
}

interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

/** 节点世界坐标半径：数量多时缩小，度数略作微调 */
function worldRadius(node: GraphNode, total: number): number {
  if (node.isFocus) return 16;
  const base = total > 120 ? 4.2 : total > 60 ? 5.5 : 8;
  return base + Math.min(4, node.degree * 0.5);
}

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function GraphCanvas({
  data,
  searchQuery,
  activeKey,
  selectedKey,
  onActiveKeyChange,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
}: GraphCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const quadtreeRef = useRef<QuadTree | null>(null);
  const hoverRef = useRef<string | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => {});

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [layout, setLayout] = useState<GraphLayoutResult | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of data.nodes) map.set(node.key, node);
    return map;
  }, [data.nodes]);

  const radiusMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of data.nodes) map.set(node.key, worldRadius(node, data.nodes.length));
    return map;
  }, [data.nodes]);

  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of data.edges) {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
  }, [data.edges]);

  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [] as string[];
    return data.nodes
      .filter(
        (node) =>
          node.label.toLowerCase().includes(query) || node.subtitle.toLowerCase().includes(query),
      )
      .map((node) => node.key);
  }, [data.nodes, searchQuery]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current();
    });
  }, []);

  // 容器尺寸变化 → 重新布局
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Web Worker 计算确定性径向布局（不可用时降级为同步计算）
  useEffect(() => {
    if (!size.width || !size.height) return;
    let cancelled = false;
    let worker: Worker | null = null;
    const input = {
      nodes: data.nodes.map((node) => ({ key: node.key, type: node.type, isFocus: node.isFocus })),
      width: size.width,
      height: size.height,
    };
    const apply = (result: GraphLayoutResult) => {
      if (cancelled) return;
      setLayout(result);
    };

    try {
      worker = new Worker(new URL('../../workers/graphLayout.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<GraphLayoutResult>) => apply(event.data);
      worker.onerror = () => apply(computeRadialLayout(input));
      worker.postMessage(input);
    } catch {
      apply(computeRadialLayout(input));
    }

    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [data.nodes, size.width, size.height]);

  // 布局变化后重建四叉树
  useEffect(() => {
    if (!layout) {
      quadtreeRef.current = null;
      return;
    }
    quadtreeRef.current = buildQuadTree(
      layout.nodes.map((node) => ({ key: node.key, x: node.x, y: node.y })),
    );
    scheduleDraw();
  }, [layout, scheduleDraw]);

  // 切换焦点或窗口尺寸变化时回到默认视口
  useEffect(() => {
    viewportRef.current = { scale: 1, tx: 0, ty: 0 };
  }, [data.focus, size.width, size.height]);

  // 图谱打开/切换焦点后自动获取键盘焦点，便于 Tab 逐节点浏览
  useEffect(() => {
    canvasRef.current?.focus({ preventScroll: true });
  }, [data.focus]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      const tree = quadtreeRef.current;
      if (!canvas || !tree) return null;
      const rect = canvas.getBoundingClientRect();
      const viewport = viewportRef.current;
      const worldX = (clientX - rect.left - viewport.tx) / viewport.scale;
      const worldY = (clientY - rect.top - viewport.ty) / viewport.scale;
      const nearest = tree.nearest(worldX, worldY);
      if (!nearest) return null;
      const radius = radiusMap.get(nearest.key) ?? 6;
      const pad = 6 / viewport.scale;
      const distance = Math.hypot(nearest.x - worldX, nearest.y - worldY);
      if (distance > radius + pad) return null;
      return nodeMap.get(nearest.key) ?? null;
    },
    [nodeMap, radiusMap],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || size.width === 0 || size.height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(size.width * dpr);
    const pixelHeight = Math.round(size.height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const viewport = viewportRef.current;
    const positions = new Map(layout.nodes.map((node) => [node.key, node]));
    const screenOf = (x: number, y: number) => ({
      x: x * viewport.scale + viewport.tx,
      y: y * viewport.scale + viewport.ty,
    });

    const hoverNeighbors = hoverKey ? neighborMap.get(hoverKey) : null;
    const highlighted = hoverKey
      ? new Set<string>([hoverKey, ...(hoverNeighbors ?? [])])
      : null;
    const matchSet = new Set(searchMatches);
    const labelsVisible = data.nodes.length <= 80 || hoverKey != null;

    // ---- 边 ----
    for (const edge of data.edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const a = screenOf(source.x, source.y);
      const b = screenOf(target.x, target.y);
      if (
        Math.max(a.x, b.x) < -40 ||
        Math.min(a.x, b.x) > size.width + 40 ||
        Math.max(a.y, b.y) < -40 ||
        Math.min(a.y, b.y) > size.height + 40
      ) {
        continue;
      }

      const connected = hoverKey
        ? edge.source === hoverKey || edge.target === hoverKey
        : false;
      const style = RELATION_STYLES[edge.type];
      ctx.globalAlpha = hoverKey ? (connected ? 0.95 : 0.07) : 0.55;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = connected ? 2 : 1;
      ctx.setLineDash(style.dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // ---- 节点 ----
    for (const node of data.nodes) {
      const position = positions.get(node.key);
      if (!position) continue;
      const center = screenOf(position.x, position.y);
      const worldR = radiusMap.get(node.key) ?? 6;
      const radius = Math.max(2.5, worldR * viewport.scale);
      if (
        center.x + radius < -20 ||
        center.x - radius > size.width + 20 ||
        center.y + radius < -20 ||
        center.y - radius > size.height + 20
      ) {
        continue;
      }

      const dimmed = highlighted != null && !highlighted.has(node.key);
      const alpha = dimmed ? 0.16 : 1;
      const color = TYPE_COLORS[node.type];

      ctx.globalAlpha = alpha;

      // 焦点光晕
      if (node.isFocus) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = alpha;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 文件节点内嵌格式标识
      if (node.type === 'file' && node.ext && radius >= 6) {
        const label = node.ext.toUpperCase().slice(0, 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = `600 ${Math.max(6, Math.min(9, radius * 0.85))}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, center.x, center.y + 0.5);
      }

      // 搜索命中
      if (matchSet.has(node.key)) {
        ctx.strokeStyle = '#ff9f0a';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 键盘焦点 / 详情选中
      if (node.key === activeKey || node.key === selectedKey) {
        ctx.strokeStyle = node.key === selectedKey ? '#1c1c1e' : '#0a84ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 悬停
      if (node.key === hoverKey) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#1c1c1e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 标签
      const showLabel =
        labelsVisible ||
        node.isFocus ||
        node.key === hoverKey ||
        node.key === activeKey ||
        node.key === selectedKey ||
        matchSet.has(node.key);
      if (showLabel) {
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = node.isFocus ? '#1c1c1e' : '#6e6e73';
        ctx.font = `${node.isFocus ? '600 ' : ''}11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(truncateLabel(node.label), center.x, center.y + radius + 6);
      }
    }

    ctx.globalAlpha = 1;
  }, [
    activeKey,
    data.edges,
    data.nodes,
    hoverKey,
    layout,
    neighborMap,
    radiusMap,
    searchMatches,
    selectedKey,
    size.height,
    size.width,
  ]);

  drawRef.current = draw;
  useEffect(() => {
    scheduleDraw();
  }, [draw, scheduleDraw]);

  // 滚轮以鼠标为中心缩放
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const viewport = viewportRef.current;
      const factor = Math.exp(-event.deltaY * 0.0015);
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * factor));
      if (nextScale === viewport.scale) return;
      const ratio = nextScale / viewport.scale;
      viewportRef.current = {
        scale: nextScale,
        tx: mouseX - (mouseX - viewport.tx) * ratio,
        ty: mouseY - (mouseY - viewport.ty) * ratio,
      };
      scheduleDraw();
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [scheduleDraw]);

  // 图内搜索：高亮并居中第一个命中节点
  const lastSearchRef = useRef('');
  useEffect(() => {
    if (!searchQuery.trim()) {
      lastSearchRef.current = '';
      return;
    }
    if (!layout || searchMatches.length === 0) return;
    if (lastSearchRef.current === searchQuery) return;
    lastSearchRef.current = searchQuery;
    const target = layout.nodes.find((node) => node.key === searchMatches[0]);
    if (!target) return;
    const viewport = viewportRef.current;
    viewportRef.current = {
      scale: viewport.scale,
      tx: size.width / 2 - target.x * viewport.scale,
      ty: size.height / 2 - target.y * viewport.scale,
    };
    onActiveKeyChange(searchMatches[0]);
    scheduleDraw();
  }, [layout, onActiveKeyChange, scheduleDraw, searchMatches, searchQuery, size.height, size.width]);

  useEffect(() => {
    return () => {
      // StrictMode 双跑清理时必须把引用置空，
      // 否则第二遍 scheduleDraw 会因脏引用永远跳过排帧（画布白屏）
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (clickTimerRef.current != null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);

  const dragRef = useRef({
    active: false,
    panning: false,
    moved: false,
    startX: 0,
    startY: 0,
    originTx: 0,
    originTy: 0,
    nodeKey: null as string | null,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
    const node = hitTest(event.clientX, event.clientY);
    const viewport = viewportRef.current;
    dragRef.current = {
      active: true,
      panning: node == null,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originTx: viewport.tx,
      originTy: viewport.ty,
      nodeKey: node?.key ?? null,
    };
    canvas.style.cursor = node ? 'pointer' : 'grabbing';
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.active) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.panning && drag.moved) {
        viewportRef.current = {
          scale: viewportRef.current.scale,
          tx: drag.originTx + dx,
          ty: drag.originTy + dy,
        };
        scheduleDraw();
      }
      return;
    }

    const node = hitTest(event.clientX, event.clientY);
    const key = node?.key ?? null;
    if (key !== hoverRef.current) {
      hoverRef.current = key;
      setHoverKey(key);
    }
    event.currentTarget.style.cursor = key ? 'pointer' : 'grab';
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    dragRef.current.active = false;
    canvas.style.cursor = drag.nodeKey ? 'pointer' : 'grab';

    if (!drag.moved && drag.nodeKey) {
      const node = nodeMap.get(drag.nodeKey);
      if (node) {
        if (clickTimerRef.current != null) window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = window.setTimeout(() => {
          clickTimerRef.current = null;
          onNodeClick(node);
        }, CLICK_DELAY_MS);
      }
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(event.clientX, event.clientY);
    if (!node) return;
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onNodeDoubleClick(node);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const node = hitTest(event.clientX, event.clientY);
    if (node) onNodeContextMenu(node, event.clientX, event.clientY);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const keys = data.nodes.map((node) => node.key);
      if (keys.length === 0) return;
      const current = activeKey ? keys.indexOf(activeKey) : -1;
      const nextIndex = event.shiftKey
        ? (current - 1 + keys.length) % keys.length
        : (current + 1) % keys.length;
      onActiveKeyChange(keys[nextIndex]);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!activeKey) return;
      const node = nodeMap.get(activeKey);
      if (node) onNodeClick(node);
    }
  };

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none outline-none"
        style={{ cursor: 'grab' }}
        tabIndex={0}
        role="application"
        aria-label="关系网络图，Tab 切换节点，Enter 查看详情"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!dragRef.current.active && hoverRef.current != null) {
            hoverRef.current = null;
            setHoverKey(null);
          }
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
