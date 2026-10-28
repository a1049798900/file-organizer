// 通用网页占位符 —— 按 shortcutId 路由 bounds/show/hide 到主进程 workspaceSvc
// 多实例安全：每个 shortcutId 独立的 bounds 追踪和 show/hide 状态
// 安全拦截：drop 事件阻止本地文件拖入，原生层 file:// 拦截兜底
import { useCallback, useEffect, useRef, useState } from 'react';
import { webApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';

interface WebPlaceholderProps {
  shortcutId: number;
  url: string;
  /** placeholder 被挂载时是否立即显示（默认 true） */
  autoShow?: boolean;
}

export function WebPlaceholder({
  shortcutId,
  url,
  autoShow = true,
}: WebPlaceholderProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const appLocked = useUiStore((s) => s.appLocked);
  const [ready, setReady] = useState(false);
  /** 第一次 sendBounds 成功完成标记；必须为 true 才允许调用 show() */
  const [boundsSent, setBoundsSent] = useState(false);
  /** 实例级：最后一次发送给主进程的 bounds */
  const lastSentBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  /** create 调用计数器，用于检测 url/shortcutId 变化时重建 */
  const createTokenRef = useRef(0);

  // sendBounds —— 比较后发送，避免 IPC 风暴
  const sendBounds = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const next = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    const last = lastSentBoundsRef.current;
    if (
      last &&
      last.x === next.x &&
      last.y === next.y &&
      last.width === next.width &&
      last.height === next.height
    ) {
      return;
    }
    lastSentBoundsRef.current = next;
    void webApi.setBounds({ shortcutId, bounds: next }).then(() => {
      setBoundsSent(true);
    });
  }, [shortcutId]);

  // 首次挂载（或 shortcutId/url 变化）：createView
  useEffect(() => {
    let cancelled = false;
    const token = ++createTokenRef.current;
    setReady(false);
    setBoundsSent(false);
    lastSentBoundsRef.current = null;

    webApi
      .createView({ shortcutId, url })
      .then(() => {
        if (cancelled || token !== createTokenRef.current) return;
        setReady(true);
      })
      .catch((err) => {
        console.error(`[web] createView shortcutId=${shortcutId} 失败:`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [shortcutId, url]);

  // ResizeObserver + rAF 节流 → setBounds IPC
  useEffect(() => {
    if (!ref.current || !ready) return;
    const el = ref.current;

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        sendBounds();
      });
    };

    const ro = new ResizeObserver(() => schedule());
    ro.observe(el);
    schedule(); // 首次同步

    const winResize = () => schedule();
    window.addEventListener('resize', winResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', winResize);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [ready, sendBounds]);

  // 应用锁：锁上后 hide，解锁后 show（仅在 boundsSent 后）
  useEffect(() => {
    if (!ready) return;
    if (appLocked) {
      void webApi.hide(shortcutId);
    } else if (autoShow && boundsSent) {
      void webApi.show(shortcutId);
    }
  }, [appLocked, autoShow, ready, boundsSent, shortcutId]);

  // 自动显示：必须 ready + boundsSent 都满足才 show
  useEffect(() => {
    if (!ready || !boundsSent) return;
    if (autoShow && !appLocked) {
      void webApi.show(shortcutId);
    }
    return () => {
      // 卸载时 hide 让 native view 脱离当前 bounds
      void webApi.hide(shortcutId);
      lastSentBoundsRef.current = null;
      setBoundsSent(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, boundsSent, autoShow, shortcutId]);

  // 安全拦截：阻止本地文件拖入（虽然原生层 file:// 拦截兜底，但双保险）
  const preventDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'none';
  }, []);

  return (
    <div
      ref={ref}
      // 绝对定位填满父容器，完全透明，仅做"定位标记"
      // WebContentsView 在 native 层盖在上面
      className="absolute inset-0"
      onDragEnter={preventDrop}
      onDragOver={preventDrop}
      onDrop={preventDrop}
    />
  );
}
