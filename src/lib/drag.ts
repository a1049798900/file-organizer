// 应用内拖拽建立关联 — 自定义 MIME 载荷
// 系统外部文件（Files）仍由通讯录拒绝，只接受应用内拖拽

export const FILES_DRAG_MIME = 'application/x-weave-files';
export const CONTACTS_DRAG_MIME = 'application/x-weave-contacts';

interface FileDragPayload {
  fileIds: number[];
}

interface ContactDragPayload {
  contactIds: number[];
}

function uniquePositiveIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
}

export function isFileDrag(dataTransfer: DataTransfer | null): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types).includes(FILES_DRAG_MIME);
}

export function isContactDrag(dataTransfer: DataTransfer | null): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types).includes(CONTACTS_DRAG_MIME);
}

/** 是否来自系统外部的文件拖入 */
export function isExternalFileDrop(dataTransfer: DataTransfer | null): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types).includes('Files');
}

export function setFileDragData(e: React.DragEvent, fileIds: number[]): void {
  const ids = uniquePositiveIds(fileIds);
  if (ids.length === 0) return;
  e.dataTransfer.setData(FILES_DRAG_MIME, JSON.stringify({ fileIds: ids }));
  e.dataTransfer.effectAllowed = 'copy';
}

export function setContactDragData(e: React.DragEvent, contactIds: number[]): void {
  const ids = uniquePositiveIds(contactIds);
  if (ids.length === 0) return;
  e.dataTransfer.setData(CONTACTS_DRAG_MIME, JSON.stringify({ contactIds: ids }));
  e.dataTransfer.effectAllowed = 'copy';
}

export function readFileDragIds(e: React.DragEvent): number[] {
  try {
    const raw = e.dataTransfer.getData(FILES_DRAG_MIME);
    if (!raw) return [];
    const payload = JSON.parse(raw) as FileDragPayload;
    return uniquePositiveIds(Array.isArray(payload.fileIds) ? payload.fileIds : []);
  } catch {
    return [];
  }
}

export function readContactDragIds(e: React.DragEvent): number[] {
  try {
    const raw = e.dataTransfer.getData(CONTACTS_DRAG_MIME);
    if (!raw) return [];
    const payload = JSON.parse(raw) as ContactDragPayload;
    return uniquePositiveIds(Array.isArray(payload.contactIds) ? payload.contactIds : []);
  } catch {
    return [];
  }
}
