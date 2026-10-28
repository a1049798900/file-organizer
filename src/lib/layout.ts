/** 面板布局常量与钳制工具 — Resizer 组件和 AppShell resize 监听共用，避免逻辑分叉 */

export interface PanelLayout {
  min: number;
  max: number;
  maxPct: number;
  defaultSize: number;
}

/** 左侧一级导航栏 */
export const SIDEBAR_LAYOUT: PanelLayout = {
  min: 160,
  max: 600,
  maxPct: 0.4,
  defaultSize: 220,
};

/** 资料库专题栏（二级目录） */
export const KB_SIDEBAR_LAYOUT: PanelLayout = {
  min: 160,
  max: 600,
  maxPct: 0.4,
  defaultSize: 220,
};

/** 关系网络焦点选择侧栏 */
export const GRAPH_SIDEBAR_LAYOUT: PanelLayout = {
  min: 180,
  max: 600,
  maxPct: 0.4,
  defaultSize: 240,
};

/** 右侧预览面板 */
export const PREVIEW_LAYOUT: PanelLayout = {
  min: 320,
  max: 640,
  maxPct: 0.4,
  defaultSize: 400,
};

/** Web 工作区辅助侧屏 */
export const WEB_SIDEPANEL_LAYOUT: PanelLayout = {
  min: 360,
  max: 800,
  maxPct: 0.5, // 侧屏可以比预览面板稍宽
  defaultSize: 480,
};

/**
 * 将面板宽度钳制在 [min, min(max, window.innerWidth * maxPct)] 范围内。
 * 与 Resizer 组件内部逻辑保持完全一致。
 */
export function clampPanelWidth(
  next: number,
  layout: PanelLayout,
): number {
  const viewportMax = Math.floor(window.innerWidth * layout.maxPct);
  const upper = Math.min(layout.max, viewportMax);
  return Math.round(Math.max(layout.min, Math.min(upper, next)));
}
