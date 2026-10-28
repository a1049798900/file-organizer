// 预览调度器 — 按扩展名选择只读预览方式
import type { FileRow } from '@shared/types';
import { ImagePreview } from './ImagePreview';
import { PdfPreview } from './PdfPreview';
import { DocxPreview } from './DocxPreview';
import { XlsxPreview } from './XlsxPreview';
import { FallbackPreview, PathMissingPreview } from './UnsupportedPreview';

const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'ico',
  'avif',
]);

const SHEET_EXTS = new Set(['xlsx', 'xls', 'csv']);

interface FilePreviewProps {
  file: FileRow;
}

export function FilePreview({ file }: FilePreviewProps) {
  if (file.pathMissing) {
    return <PathMissingPreview file={file} />;
  }

  const ext = (file.ext || '').toLowerCase();

  if (IMAGE_EXTS.has(ext)) return <ImagePreview file={file} />;
  if (ext === 'pdf') return <PdfPreview file={file} />;
  if (ext === 'docx') return <DocxPreview file={file} />;
  if (SHEET_EXTS.has(ext)) return <XlsxPreview file={file} />;

  return <FallbackPreview file={file} />;
}
