// 主进程与渲染进程共享类型

export type FileStatus = 'inbox' | 'filed';
export type ProjectStatus = 'active' | 'done';

export interface TagRef {
  id: number;
  name: string;
}

export interface FileRow {
  id: number;
  name: string;
  alias: string | null;
  path: string;
  size: number;
  ext: string;          // 小写，不含点
  mtime: number;        // Unix ms
  status: FileStatus;
  inKnowledge: 0 | 1;
  createdAt: number;
  tags: TagRef[];       // JOIN tag_links 得到
  pathMissing: boolean; // 主进程计算
  // 搜索结果专用
  sourceBadge?: 'inbox' | 'project' | 'kb';
}

/** 文件关联数据 — 标签 / 专题 / 项目（只读展示） */
export interface FileAssociations {
  tags: TagRef[];
  topics: TagRef[];
  projects: TagRef[];
}

/** 移动文件的目标信息 */
export interface MoveTargetInfo {
  /** 目标文件夹绝对路径 */
  dir: string;
  /** 文件移动后的完整路径 */
  targetPath: string;
  /** 移动前的原路径（仅选择目标时返回，用于确认弹窗） */
  sourcePath?: string;
}

/** 可撤销的移动记录 */
export interface MoveUndoInfo {
  fileId: number;
  from: string;
  to: string;
  /** 撤销截止时间（Unix ms） */
  expiresAt: number;
}

export interface ProjectRow {
  id: number;
  name: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  fileCount: number;
}

export interface TopicRow {
  id: number;
  name: string;
  sortOrder: number;
  fileCount: number;
}

/** 通用网页工作区快捷方式 */
export interface WebShortcutRow {
  id: number;
  name: string;
  url: string;
  sortOrder: number;
  createdAt: number;
}

export interface ScanResult {
  scanned: number;
  added: number;
  skipped: number;
}

export interface ScanProgress {
  currentPath: string;
  processed: number;
  total: number;
}

export type FileListScene = 'inbox' | 'project' | 'kb' | 'search';

export type FileListSource =
  | { kind: 'inbox' }
  | { kind: 'all' }
  | { kind: 'project'; projectId: number }
  | { kind: 'kb-all' }
  | { kind: 'kb-uncategorized' }
  | { kind: 'kb-topic'; topicId: number }
  | { kind: 'search'; query: string };

export type FileSortKey = 'name' | 'ext' | 'size' | 'mtime' | 'tags';
export type SortDir = 'asc' | 'desc';

export interface FileSort {
  key: FileSortKey;
  dir: SortDir;
}

export interface BatchResult {
  ok: number;
  fail: number;
}

// --------- 通讯录 ---------

export interface ContactRow {
  id: number;
  name: string;
  org: string | null;
  department: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ContactInput {
  name: string;
  org?: string | null;
  department?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}

export interface ContactProjectRef {
  id: number;
  name: string;
  status: ProjectStatus;
}

export interface ContactFileRef {
  id: number;
  name: string;
  ext: string;
  size: number;
  mtime: number;
  pathMissing: boolean;
}

export interface ContactDetail extends ContactRow {
  projects: ContactProjectRef[];
  files: ContactFileRef[];
}
