// 关系网络入口辅助：统一从各处打开图谱
import { useUiStore } from '@/stores/useUiStore';
import type { GraphFocusType } from '@shared/graph';

export function openGraphFromFocus(type: GraphFocusType, id: number, label: string): void {
  useUiStore.getState().openGraph({ type, id }, label);
}

export function openGraphFromFile(fileId: number, label: string): void {
  openGraphFromFocus('file', fileId, label);
}
