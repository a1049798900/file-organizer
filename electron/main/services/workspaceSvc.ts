// 通用网页工作区容器管理服务 —— LRU 缓存多 WebContentsView
// 核心：最多保留 2 个活跃容器，共享 persist:deepseek session 分区（兼容老用户登录态）
// 安全拦截：file:// 拦截、window.open → 系统浏览器、硬件权限封锁
import { WebContentsView, BrowserWindow, session, shell } from 'electron';

const SESSION_PARTITION = 'persist:deepseek';
/** LRU 缓存上限：最多保留 2 个活跃容器（含当前正在使用的） */
const MAX_CACHE_SIZE = 2;
/** bounds 安全守卫阈值：拒绝覆盖侧边栏区域 */
const SIDEBAR_GUARD_X = 200;
const MIN_REASONABLE_WIDTH = 320;

interface CachedView {
  view: WebContentsView;
  shortcutId: number;
  url: string;
  lastBounds: Electron.Rectangle;
  lastAccessAt: number;
}

/** LRU 缓存：shortcutId → CachedView */
const cache = new Map<number, CachedView>();
let hostedWindow: BrowserWindow | null = null;

function ensureHostedWindow(window: BrowserWindow): void {
  if (hostedWindow === window) return;
  // 宿主窗口更换：把现有 view 重新挂载到新窗口
  cache.forEach((cached) => {
    try {
      hostedWindow?.contentView.removeChildView(cached.view);
    } catch {
      /* noop */
    }
    try {
      window.contentView.addChildView(cached.view);
    } catch (err) {
      console.warn(`[workspace] 重新挂载 shortcutId=${cached.shortcutId} 失败:`, err);
    }
  });
  hostedWindow = window;
}

/**
 * 应用安全拦截到指定 WebContents：
 * 1. file:// / blob:// 拦截（本地拖入）
 * 2. window.open → 系统浏览器
 * 3. 硬件权限封锁（partition 级别兜底）
 */
function installSecurityHandlers(webContents: Electron.WebContents): void {
  // 1. file:// / blob:// 拦截（本地拖入场景）—— 直接阻止，不暴露文件路径给系统浏览器
  webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      event.preventDefault();
    }
  });

  // 2. window.open / target="_blank" → 系统浏览器
  webContents.setWindowOpenHandler(({ url }) => {
    if (url && url.startsWith('https:')) {
      void shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // 3. 拒绝所有硬件权限请求（partition 级别兜底）
  const partition = session.fromPartition(SESSION_PARTITION);
  partition.setPermissionRequestHandler(
    (_wc: unknown, _permission: unknown, callback: (allow: boolean) => void) => {
      callback(false);
    },
  );
}

/**
 * 淘汰最旧的缓存条目（LRU）；确保缓存大小不超过 MAX_CACHE_SIZE
 */
function evictIfNeeded(exceptId: number): void {
  // 按 lastAccessAt 升序排列，exceptId 跳过
  const entries = Array.from(cache.entries())
    .filter(([id]) => id !== exceptId)
    .sort((a, b) => a[1].lastAccessAt - b[1].lastAccessAt);

  // 保留 exceptId + 最多 MAX_CACHE_SIZE - 1 个其他条目
  const keepOthers = MAX_CACHE_SIZE - 1;
  const toEvict = entries.slice(keepOthers);

  for (const [id, cached] of toEvict) {
    try {
      hostedWindow?.contentView.removeChildView(cached.view);
    } catch {
      /* noop */
    }
    cached.view.webContents.close();
    cache.delete(id);
    console.log(`[workspace] LRU 淘汰 shortcutId=${id} (url=${cached.url})`);
  }
}

function createView(window: BrowserWindow, shortcutId: number, url: string): CachedView {
  ensureHostedWindow(window);

  const view = new WebContentsView({
    webPreferences: {
      partition: SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // 挂载到 BrowserWindow（先隐藏）
  try {
    window.contentView.addChildView(view);
  } catch (err) {
    console.warn('[workspace] addChildView 失败:', err);
  }

  installSecurityHandlers(view.webContents);

  // 默认 bounds：隐藏状态（x=-10000），show 时再定位
  view.setBounds({ x: -10000, y: -10000, width: 0, height: 0 });

  void view.webContents.loadURL(url).catch((err) => {
    console.error(`[workspace] shortcutId=${shortcutId} 加载 URL 失败:`, err);
  });

  const cached: CachedView = {
    view,
    shortcutId,
    url,
    lastBounds: { x: -10000, y: -10000, width: 0, height: 0 },
    lastAccessAt: Date.now(),
  };

  cache.set(shortcutId, cached);
  evictIfNeeded(shortcutId);
  return cached;
}

/**
 * 创建或获取缓存的 WebContentsView；不存在则新建
 */
export function getOrCreateView(
  window: BrowserWindow,
  shortcutId: number,
  url: string,
): WebContentsView {
  let cached = cache.get(shortcutId);
  if (!cached) {
    cached = createView(window, shortcutId, url);
  } else {
    ensureHostedWindow(window);
  }
  cached.lastAccessAt = Date.now();
  evictIfNeeded(shortcutId);
  return cached.view;
}

/**
 * 同步 bounds（渲染进程 ResizeObserver 实时推送）
 */
export function setBounds(shortcutId: number, bounds: Electron.Rectangle): void {
  const cached = cache.get(shortcutId);
  if (!cached) return;
  cached.lastBounds = bounds;
  cached.view.setBounds(bounds);
  cached.lastAccessAt = Date.now();
}

/**
 * 显示指定 shortcut 的 WebContentsView
 * 安全检查：bounds 必须存在且合理，否则拒绝显示
 */
export function show(shortcutId: number): void {
  const cached = cache.get(shortcutId);
  if (!cached) {
    console.warn(`[workspace] show() 拒绝：shortcutId=${shortcutId} 不存在`);
    return;
  }
  const bounds = cached.lastBounds;
  // bounds 安全检查：必须在主内容区合理范围内
  if (bounds.x < SIDEBAR_GUARD_X) {
    console.warn(
      `[workspace] show() 拒绝：bounds.x=${bounds.x} 可能覆盖侧边栏区域`,
    );
    return;
  }
  if (bounds.width < MIN_REASONABLE_WIDTH) {
    console.warn(
      `[workspace] show() 拒绝：bounds.width=${bounds.width} 过小`,
    );
    return;
  }
  cached.view.setBounds(bounds);
  cached.view.webContents.setBackgroundThrottling(false);
  cached.lastAccessAt = Date.now();
}

/**
 * 隐藏指定 shortcut 的 WebContentsView
 */
export function hide(shortcutId: number): void {
  const cached = cache.get(shortcutId);
  if (!cached) return;
  cached.view.setBounds({ x: -10000, y: -10000, width: 0, height: 0 });
  cached.view.webContents.setBackgroundThrottling(true);
}

/**
 * 隐藏所有 WebContentsView
 */
export function hideAll(): void {
  cache.forEach((cached) => {
    cached.view.setBounds({ x: -10000, y: -10000, width: 0, height: 0 });
    cached.view.webContents.setBackgroundThrottling(true);
  });
}

/**
 * 导航控制：back/forward/refresh
 */
export function navigate(
  shortcutId: number,
  action: 'back' | 'forward' | 'refresh',
): void {
  const cached = cache.get(shortcutId);
  if (!cached) return;
  cached.lastAccessAt = Date.now();
  const wc = cached.view.webContents;
  switch (action) {
    case 'back':
      if (wc.canGoBack()) wc.goBack();
      break;
    case 'forward':
      if (wc.canGoForward()) wc.goForward();
      break;
    case 'refresh':
      wc.reload();
      break;
  }
}

/**
 * 在系统浏览器中打开当前 URL
 */
export function openExternal(shortcutId: number): void {
  const cached = cache.get(shortcutId);
  if (!cached) return;
  const url = cached.view.webContents.getURL() || cached.url;
  if (url && url.startsWith('http')) {
    void shell.openExternal(url);
  }
}

/**
 * 彻底销毁指定 shortcut 的缓存条目
 */
export function destroy(shortcutId: number): void {
  const cached = cache.get(shortcutId);
  if (!cached) return;
  try {
    hostedWindow?.contentView.removeChildView(cached.view);
  } catch {
    /* noop */
  }
  cached.view.webContents.close();
  cache.delete(shortcutId);
}

/**
 * 彻底销毁所有缓存（应用退出时调用）
 */
export function destroyAll(): void {
  cache.forEach((cached) => {
    try {
      hostedWindow?.contentView.removeChildView(cached.view);
    } catch {
      /* noop */
    }
    cached.view.webContents.close();
  });
  cache.clear();
  hostedWindow = null;
}

/**
 * 重新加载指定 shortcut 的 URL（用户切换到不存在的缓存时触发）
 */
export function loadUrl(shortcutId: number, url: string): void {
  const cached = cache.get(shortcutId);
  if (!cached) return;
  void cached.view.webContents.loadURL(url).catch((err) => {
    console.error(`[workspace] shortcutId=${shortcutId} reload 失败:`, err);
  });
  cached.url = url;
}

/** 调试：返回当前缓存大小 */
export function getCacheSize(): number {
  return cache.size;
}

/** 获取宿主窗口（供外部替换） */
export function getHostedWindow(): BrowserWindow | null {
  return hostedWindow;
}
