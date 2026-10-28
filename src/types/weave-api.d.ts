// window.weave 全局类型声明
import type {
  FileRow,
  FileListSource,
  FileSort,
  ProjectRow,
  ProjectStatus,
  TopicRow,
  TagRef,
  ScanResult,
  ScanProgress,
  BatchResult,
  ContactRow,
  ContactInput,
  ContactDetail,
  FileAssociations,
  MoveTargetInfo,
  MoveUndoInfo,
} from '@shared/types';
import type {
  CalendarEvent,
  CalendarRange,
  AreaDetail,
  SampleDataResult,
  TaskScheduleInput,
  MeetingScheduleInput,
  ProjectSchedule,
} from '@shared/calendar';
import type { ReminderOpenPayload } from '@shared/reminder';
import type {
  GraphData,
  GraphQueryInput,
  GraphUnlinkInput,
  GraphUnlinkResult,
} from '@shared/graph';
import type { WebShortcutRow } from '@shared/types';

export interface WeaveAPI {
  scan: {
    start(): Promise<ScanResult>;
    cancel(): Promise<void>;
    onProgress(callback: (progress: ScanProgress) => void): () => void;
  };
  file: {
    list(source: FileListSource, sort: FileSort): Promise<FileRow[]>;
    get(id: number): Promise<FileRow | null>;
    remove(ids: number[]): Promise<BatchResult>;
    markFiled(ids: number[]): Promise<void>;
    open(id: number): Promise<{ ok: boolean; reason?: string }>;
    reveal(id: number): Promise<boolean>;
    previewMeta(id: number): Promise<FileRow | null>;
    /** 只读读取文件二进制用于预览渲染 */
    readBytes(id: number): Promise<Uint8Array>;
    /** 标签 / 专题 / 项目关联 */
    associations(id: number): Promise<FileAssociations>;
    /** 选择移动目标文件夹 */
    pickMoveTarget(id: number): Promise<MoveTargetInfo | null>;
    /** 物理移动文件并更新索引路径 */
    move(id: number, targetDir: string): Promise<MoveTargetInfo>;
    /** 查询 10 分钟内的可撤销移动 */
    getMoveUndo(id: number): Promise<MoveUndoInfo | null>;
    /** 撤销移动 */
    undoMove(id: number): Promise<MoveUndoInfo>;
    /** 获取拖入文件在磁盘上的真实路径 */
    pathForFile(file: File): string;
    /** 将拖入的文件加入索引（进入收件箱） */
    indexPaths(paths: string[]): Promise<BatchResult>;
  };
  project: {
    list(filter?: 'all' | 'active' | 'done'): Promise<ProjectRow[]>;
    create(name: string): Promise<ProjectRow>;
    rename(id: number, name: string): Promise<void>;
    delete(id: number): Promise<void>;
    setStatus(id: number, status: ProjectStatus): Promise<void>;
    addFiles(projectId: number, fileIds: number[]): Promise<void>;
    removeFile(projectId: number, fileId: number): Promise<void>;
  };
  calendar: {
    listEvents(range: CalendarRange): Promise<CalendarEvent[]>;
    getAreaDetail(areaId: number): Promise<AreaDetail>;
    listProjectSchedule(projectId: number): Promise<ProjectSchedule>;
    listContactSchedule(contactId: number): Promise<ProjectSchedule>;
    createTask(input: TaskScheduleInput): Promise<number>;
    updateTask(id: number, input: TaskScheduleInput): Promise<void>;
    deleteTask(id: number): Promise<void>;
    setTaskStatus(id: number, status: 'done' | 'open'): Promise<void>;
    createMeeting(input: MeetingScheduleInput): Promise<number>;
    updateMeeting(id: number, input: MeetingScheduleInput): Promise<void>;
    deleteMeeting(id: number): Promise<void>;
    seedSampleData(): Promise<SampleDataResult>;
    clearSampleData(): Promise<void>;
    onReminderOpen(callback: (payload: ReminderOpenPayload) => void): () => void;
  };
  lock: {
    set(locked: boolean): Promise<void>;
    get(): Promise<boolean>;
  };
  kb: {
    listTopics(): Promise<TopicRow[]>;
    createTopic(name: string): Promise<TopicRow>;
    renameTopic(id: number, name: string): Promise<void>;
    deleteTopic(id: number): Promise<void>;
    reorderTopics(topicIds: number[]): Promise<void>;
    addToKnowledge(
      fileIds: number[],
      topicIds: number[],
      moveOutOfInbox: boolean,
    ): Promise<void>;
    removeFromKnowledge(fileIds: number[], toInbox: boolean): Promise<void>;
    addToTopic(fileIds: number[], topicId: number): Promise<void>;
    removeFromTopic(fileIds: number[], topicId: number): Promise<void>;
  };
  tag: {
    list(): Promise<TagRef[]>;
    create(name: string): Promise<TagRef>;
    addToFiles(fileIds: number[], tagIds: number[]): Promise<void>;
    removeFromFiles(fileIds: number[], tagIds: number[]): Promise<void>;
  };
  contact: {
    list(query?: string): Promise<ContactRow[]>;
    getDetail(id: number): Promise<ContactDetail | null>;
    create(input: ContactInput): Promise<ContactRow>;
    update(id: number, input: ContactInput): Promise<ContactRow>;
    remove(id: number): Promise<void>;
    listByFile(fileId: number): Promise<ContactRow[]>;
    setFileContacts(fileId: number, contactIds: number[]): Promise<void>;
    listByProject(projectId: number): Promise<ContactRow[]>;
    setProjectContacts(projectId: number, contactIds: number[]): Promise<void>;
    setContactFiles(contactId: number, fileIds: number[]): Promise<void>;
    setContactProjects(contactId: number, projectIds: number[]): Promise<void>;
    addToFiles(fileIds: number[], contactIds: number[]): Promise<BatchResult>;
    addToProjects(projectIds: number[], contactIds: number[]): Promise<BatchResult>;
    removeMany(ids: number[]): Promise<BatchResult>;
  };
  graph: {
    /** 焦点 + 1 跳邻居 + 邻居牵出的专题 */
    get(input: GraphQueryInput): Promise<GraphData>;
    /** 取消关联（写入 10 分钟撤销窗口） */
    unlink(input: GraphUnlinkInput): Promise<GraphUnlinkResult>;
    /** 查询取消关联批次是否仍可撤销 */
    getUnlinkUndo(batchId: string): Promise<GraphUnlinkResult | null>;
    /** 撤销取消关联 */
    undoUnlink(batchId: string): Promise<GraphUnlinkResult>;
  };
  settings: {
    get(): Promise<Record<string, string>>;
    set(key: string, value: string): Promise<void>;
    pickRoot(): Promise<string | null>;
    getDbPath(): Promise<string>;
    getVersion(): Promise<string>;
  };
  /** 通用网页工作区 —— 按 shortcutId 管理多 WebContentsView */
  web: {
    // 快捷方式 CRUD
    listShortcuts(): Promise<WebShortcutRow[]>;
    createShortcut(args: { name: string; url: string }): Promise<WebShortcutRow>;
    updateShortcut(args: { id: number; name: string; url: string }): Promise<void>;
    deleteShortcut(id: number): Promise<void>;
    reorderShortcuts(ids: number[]): Promise<void>;
    // 容器管理（按 shortcutId 路由，LRU 最多缓存 2 个）
    createView(args: { shortcutId: number; url: string }): Promise<void>;
    setBounds(args: {
      shortcutId: number;
      bounds: { x: number; y: number; width: number; height: number };
    }): Promise<void>;
    show(shortcutId: number): Promise<void>;
    hide(shortcutId: number): Promise<void>;
    hideAll(): Promise<void>;
    destroy(shortcutId: number): Promise<void>;
    navigate(args: {
      shortcutId: number;
      action: 'back' | 'forward' | 'refresh';
    }): Promise<void>;
    openExternal(shortcutId: number): Promise<void>;
  };
}

declare global {
  interface Window {
    weave: WeaveAPI;
  }
}

export {};
