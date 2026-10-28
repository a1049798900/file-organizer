// 兜底预览 — 大图标 + 说明 + 用系统程序打开
import {
  FileArchive,
  FileQuestionMark,
  FileSpreadsheet,
  FileText,
  FileType,
  Film,
  FolderOpen,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { FileRow } from '@shared/types';
import { Button } from '../ui/Button';
import { fileApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';

const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
const SHEET_EXTS = ['xls', 'xlsx', 'csv', 'ods'];
const DOC_EXTS = ['doc', 'docx', 'rtf', 'odt', 'txt', 'md'];
const SLIDE_EXTS = ['ppt', 'pptx', 'odp', 'key'];

function iconFor(ext: string): LucideIcon {
  if (VIDEO_EXTS.includes(ext)) return Film;
  if (ARCHIVE_EXTS.includes(ext)) return FileArchive;
  if (SHEET_EXTS.includes(ext)) return FileSpreadsheet;
  if (DOC_EXTS.includes(ext)) return FileText;
  if (SLIDE_EXTS.includes(ext)) return Presentation;
  return FileType;
}

function hintFor(ext: string): string {
  if (VIDEO_EXTS.includes(ext)) return '视频不内嵌播放';
  if (AUDIO_EXTS.includes(ext)) return '音频不内嵌播放';
  if (ARCHIVE_EXTS.includes(ext)) return '压缩包不解压预览';
  if (ext === 'doc') return '旧版 .doc 暂不支持内嵌预览';
  return '该格式暂不支持内嵌预览';
}

interface FallbackPreviewProps {
  file: FileRow;
}

export function FallbackPreview({ file }: FallbackPreviewProps) {
  const showToast = useUiStore((s) => s.showToast);
  const ext = (file.ext || '').toLowerCase();
  const Icon = iconFor(ext);
  const hint = hintFor(ext);

  const handleOpen = async () => {
    const result = await fileApi.open(file.id);
    if (!result.ok && result.reason) showToast(result.reason, 'error');
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon size={56} strokeWidth={1.15} className="text-ink-3 opacity-70" />
      <div className="text-sm font-medium text-ink">{ext ? `${ext.toUpperCase()} 文件` : '文件'}</div>
      <div className="text-sm text-ink-3">{hint}</div>
      <Button variant="primary" size="md" onClick={handleOpen}>
        用系统程序打开
      </Button>
    </div>
  );
}

interface PathMissingPreviewProps {
  file: FileRow;
}

export function PathMissingPreview({ file }: PathMissingPreviewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <FolderOpen size={48} className="text-danger opacity-60" strokeWidth={1.25} />
      <div className="text-sm font-medium text-ink">文件已不在原路径</div>
      <div className="max-w-full break-all text-xs text-ink-3">{file.path}</div>
    </div>
  );
}

interface NotFoundPreviewProps {
  message?: string;
}

export function NotFoundPreview({ message = '文件不存在或已从软件移除' }: NotFoundPreviewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <FileQuestionMark size={48} className="text-ink-3 opacity-60" strokeWidth={1.25} />
      <div className="text-sm text-ink-2">{message}</div>
    </div>
  );
}
