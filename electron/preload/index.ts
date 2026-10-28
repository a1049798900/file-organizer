import { ipcRenderer, contextBridge, webUtils } from 'electron';
import { CH } from '../../src/shared/ipc-contract';
import type { ScanProgress, ScanResult } from '../../src/shared/types';
import type {
  FileRow,
  FileListSource,
  FileSort,
  BatchResult,
  FileAssociations,
  MoveTargetInfo,
  MoveUndoInfo,
} from '../../src/shared/types';
import type { ProjectRow, ProjectStatus, TopicRow, TagRef } from '../../src/shared/types';
import type {
  ContactRow,
  ContactInput,
  ContactDetail,
} from '../../src/shared/types';
import type {
  CalendarEvent,
  CalendarRange,
  AreaDetail,
  SampleDataResult,
  TaskScheduleInput,
  MeetingScheduleInput,
  ProjectSchedule,
} from '../../src/shared/calendar';
import type {
  GraphData,
  GraphQueryInput,
  GraphUnlinkInput,
  GraphUnlinkResult,
} from '../../src/shared/graph';
import type { ReminderOpenPayload } from '../../src/shared/reminder';

// --------- Expose white-listed weave API to Renderer ---------
contextBridge.exposeInMainWorld('weave', {
  scan: {
    start: (): Promise<ScanResult> => ipcRenderer.invoke(CH.SCAN_START),
    cancel: (): Promise<void> => ipcRenderer.invoke(CH.SCAN_CANCEL),
    onProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
      const listener = (_event: unknown, progress: ScanProgress) => callback(progress);
      ipcRenderer.on(CH.SCAN_PROGRESS, listener);
      return () => ipcRenderer.off(CH.SCAN_PROGRESS, listener);
    },
  },

  file: {
    list: (source: FileListSource, sort: FileSort): Promise<FileRow[]> =>
      ipcRenderer.invoke(CH.FILE_LIST, { source, sort }),
    get: (id: number): Promise<FileRow | null> => ipcRenderer.invoke(CH.FILE_GET, id),
    remove: (ids: number[]): Promise<BatchResult> => ipcRenderer.invoke(CH.FILE_REMOVE, ids),
    markFiled: (ids: number[]): Promise<void> => ipcRenderer.invoke(CH.FILE_MARK_FILED, ids),
    open: (id: number): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke(CH.FILE_OPEN, id),
    reveal: (id: number): Promise<boolean> => ipcRenderer.invoke(CH.FILE_REVEAL, id),
    previewMeta: (id: number): Promise<FileRow | null> => ipcRenderer.invoke(CH.FILE_PREVIEW_META, id),
    readBytes: (id: number): Promise<Uint8Array> =>
      ipcRenderer.invoke(CH.FILE_READ_BYTES, id),
    associations: (id: number): Promise<FileAssociations> =>
      ipcRenderer.invoke(CH.FILE_ASSOCIATIONS, id),
    pickMoveTarget: (id: number): Promise<MoveTargetInfo | null> =>
      ipcRenderer.invoke(CH.FILE_PICK_MOVE_TARGET, id),
    move: (id: number, targetDir: string): Promise<MoveTargetInfo> =>
      ipcRenderer.invoke(CH.FILE_MOVE, { id, targetDir }),
    getMoveUndo: (id: number): Promise<MoveUndoInfo | null> =>
      ipcRenderer.invoke(CH.FILE_GET_MOVE_UNDO, id),
    undoMove: (id: number): Promise<MoveUndoInfo> =>
      ipcRenderer.invoke(CH.FILE_UNDO_MOVE, id),
    // 获取拖入文件在磁盘上的真实路径（Electron 32+ 移除 File.path 后的官方方案）
    pathForFile: (file: Parameters<typeof webUtils.getPathForFile>[0]): string =>
      webUtils.getPathForFile(file),
    indexPaths: (paths: string[]): Promise<BatchResult> =>
      ipcRenderer.invoke(CH.FILE_INDEX_PATHS, paths),
  },

  project: {
    list: (filter?: 'all' | 'active' | 'done'): Promise<ProjectRow[]> =>
      ipcRenderer.invoke(CH.PROJECT_LIST, filter ?? 'all'),
    create: (name: string): Promise<ProjectRow> => ipcRenderer.invoke(CH.PROJECT_CREATE, name),
    rename: (id: number, name: string): Promise<void> =>
      ipcRenderer.invoke(CH.PROJECT_RENAME, { id, name }),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(CH.PROJECT_DELETE, id),
    setStatus: (id: number, status: ProjectStatus): Promise<void> =>
      ipcRenderer.invoke(CH.PROJECT_SET_STATUS, { id, status }),
    addFiles: (projectId: number, fileIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.PROJECT_ADD_FILES, { projectId, fileIds }),
    removeFile: (projectId: number, fileId: number): Promise<void> =>
      ipcRenderer.invoke(CH.PROJECT_REMOVE_FILE, { projectId, fileId }),
  },

  calendar: {
    listEvents: (range: CalendarRange): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke(CH.CALENDAR_LIST_EVENTS, range),
    getAreaDetail: (areaId: number): Promise<AreaDetail> =>
      ipcRenderer.invoke(CH.CALENDAR_GET_AREA_DETAIL, areaId),
    listProjectSchedule: (projectId: number): Promise<ProjectSchedule> =>
      ipcRenderer.invoke(CH.CALENDAR_LIST_PROJECT_SCHEDULE, projectId),
    listContactSchedule: (contactId: number): Promise<ProjectSchedule> =>
      ipcRenderer.invoke(CH.CALENDAR_LIST_CONTACT_SCHEDULE, contactId),
    createTask: (input: TaskScheduleInput): Promise<number> =>
      ipcRenderer.invoke(CH.CALENDAR_CREATE_TASK, input),
    updateTask: (id: number, input: TaskScheduleInput): Promise<void> =>
      ipcRenderer.invoke(CH.CALENDAR_UPDATE_TASK, { id, input }),
    deleteTask: (id: number): Promise<void> =>
      ipcRenderer.invoke(CH.CALENDAR_DELETE_TASK, id),
    setTaskStatus: (id: number, status: 'done' | 'open'): Promise<void> =>
      ipcRenderer.invoke(CH.CALENDAR_SET_TASK_STATUS, { id, status }),
    createMeeting: (input: MeetingScheduleInput): Promise<number> =>
      ipcRenderer.invoke(CH.CALENDAR_CREATE_MEETING, input),
    updateMeeting: (id: number, input: MeetingScheduleInput): Promise<void> =>
      ipcRenderer.invoke(CH.CALENDAR_UPDATE_MEETING, { id, input }),
    deleteMeeting: (id: number): Promise<void> =>
      ipcRenderer.invoke(CH.CALENDAR_DELETE_MEETING, id),
    seedSampleData: (): Promise<SampleDataResult> =>
      ipcRenderer.invoke(CH.CALENDAR_SEED_SAMPLE),
    clearSampleData: (): Promise<void> => ipcRenderer.invoke(CH.CALENDAR_CLEAR_SAMPLE),
    onReminderOpen: (callback: (payload: ReminderOpenPayload) => void): (() => void) => {
      const listener = (_event: unknown, payload: ReminderOpenPayload) => callback(payload);
      ipcRenderer.on(CH.CALENDAR_REMINDER_OPEN, listener);
      return () => ipcRenderer.off(CH.CALENDAR_REMINDER_OPEN, listener);
    },
  },

  lock: {
    set: (locked: boolean): Promise<void> => ipcRenderer.invoke(CH.APP_LOCK_SET, locked),
    get: (): Promise<boolean> => ipcRenderer.invoke(CH.APP_LOCK_GET),
  },

  kb: {
    listTopics: (): Promise<TopicRow[]> => ipcRenderer.invoke(CH.KB_TOPICS),
    createTopic: (name: string): Promise<TopicRow> => ipcRenderer.invoke(CH.KB_CREATE_TOPIC, name),
    renameTopic: (id: number, name: string): Promise<void> =>
      ipcRenderer.invoke(CH.KB_RENAME_TOPIC, { id, name }),
    deleteTopic: (id: number): Promise<void> => ipcRenderer.invoke(CH.KB_DELETE_TOPIC, id),
    reorderTopics: (topicIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.KB_REORDER_TOPICS, topicIds),
    addToKnowledge: (
      fileIds: number[],
      topicIds: number[],
      moveOutOfInbox: boolean,
    ): Promise<void> =>
      ipcRenderer.invoke(CH.KB_ADD_TO_KNOWLEDGE, { fileIds, topicIds, moveOutOfInbox }),
    removeFromKnowledge: (fileIds: number[], toInbox: boolean): Promise<void> =>
      ipcRenderer.invoke(CH.KB_REMOVE_FROM_KNOWLEDGE, { fileIds, toInbox }),
    addToTopic: (fileIds: number[], topicId: number): Promise<void> =>
      ipcRenderer.invoke(CH.KB_ADD_TO_TOPIC, { fileIds, topicId }),
    removeFromTopic: (fileIds: number[], topicId: number): Promise<void> =>
      ipcRenderer.invoke(CH.KB_REMOVE_FROM_TOPIC, { fileIds, topicId }),
  },

  tag: {
    list: (): Promise<TagRef[]> => ipcRenderer.invoke(CH.TAG_LIST),
    create: (name: string): Promise<TagRef> => ipcRenderer.invoke(CH.TAG_CREATE, name),
    addToFiles: (fileIds: number[], tagIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.TAG_ADD_TO_FILES, { fileIds, tagIds }),
    removeFromFiles: (fileIds: number[], tagIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.TAG_REMOVE_FROM_FILES, { fileIds, tagIds }),
  },

  contact: {
    list: (query?: string): Promise<ContactRow[]> =>
      ipcRenderer.invoke(CH.CONTACT_LIST, query ?? ''),
    getDetail: (id: number): Promise<ContactDetail | null> =>
      ipcRenderer.invoke(CH.CONTACT_DETAIL, id),
    create: (input: ContactInput): Promise<ContactRow> =>
      ipcRenderer.invoke(CH.CONTACT_CREATE, input),
    update: (id: number, input: ContactInput): Promise<ContactRow> =>
      ipcRenderer.invoke(CH.CONTACT_UPDATE, { id, input }),
    remove: (id: number): Promise<void> => ipcRenderer.invoke(CH.CONTACT_DELETE, id),
    listByFile: (fileId: number): Promise<ContactRow[]> =>
      ipcRenderer.invoke(CH.CONTACT_LIST_BY_FILE, fileId),
    setFileContacts: (fileId: number, contactIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.CONTACT_SET_FILE_CONTACTS, { fileId, contactIds }),
    listByProject: (projectId: number): Promise<ContactRow[]> =>
      ipcRenderer.invoke(CH.CONTACT_LIST_BY_PROJECT, projectId),
    setProjectContacts: (projectId: number, contactIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.CONTACT_SET_PROJECT_CONTACTS, { projectId, contactIds }),
    setContactFiles: (contactId: number, fileIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.CONTACT_SET_CONTACT_FILES, { contactId, fileIds }),
    setContactProjects: (contactId: number, projectIds: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.CONTACT_SET_CONTACT_PROJECTS, { contactId, projectIds }),
    addToFiles: (fileIds: number[], contactIds: number[]): Promise<BatchResult> =>
      ipcRenderer.invoke(CH.CONTACT_ADD_TO_FILES, { fileIds, contactIds }),
    addToProjects: (projectIds: number[], contactIds: number[]): Promise<BatchResult> =>
      ipcRenderer.invoke(CH.CONTACT_ADD_TO_PROJECTS, { projectIds, contactIds }),
    removeMany: (ids: number[]): Promise<BatchResult> =>
      ipcRenderer.invoke(CH.CONTACT_DELETE_MANY, ids),
  },

  graph: {
    get: (input: GraphQueryInput): Promise<GraphData> =>
      ipcRenderer.invoke(CH.GRAPH_GET, input),
    unlink: (input: GraphUnlinkInput): Promise<GraphUnlinkResult> =>
      ipcRenderer.invoke(CH.GRAPH_UNLINK, input),
    getUnlinkUndo: (batchId: string): Promise<GraphUnlinkResult | null> =>
      ipcRenderer.invoke(CH.GRAPH_GET_UNLINK_UNDO, batchId),
    undoUnlink: (batchId: string): Promise<GraphUnlinkResult> =>
      ipcRenderer.invoke(CH.GRAPH_UNDO_UNLINK, batchId),
  },

  settings: {
    get: (): Promise<Record<string, string>> => ipcRenderer.invoke(CH.SETTINGS_GET),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke(CH.SETTINGS_SET, { key, value }),
    pickRoot: (): Promise<string | null> => ipcRenderer.invoke(CH.SETTINGS_PICK_ROOT),
    getDbPath: (): Promise<string> => ipcRenderer.invoke(CH.SETTINGS_GET_DB_PATH),
    getVersion: (): Promise<string> => ipcRenderer.invoke(CH.SETTINGS_GET_VERSION),
  },

  // ---- 通用网页工作区（Web Workspace）----
  web: {
    // 快捷方式 CRUD
    listShortcuts: (): Promise<import('../../src/shared/types').WebShortcutRow[]> =>
      ipcRenderer.invoke(CH.WEB_LIST_SHORTCUTS),
    createShortcut: (args: { name: string; url: string }): Promise<import('../../src/shared/types').WebShortcutRow> =>
      ipcRenderer.invoke(CH.WEB_CREATE_SHORTCUT, args),
    updateShortcut: (args: { id: number; name: string; url: string }): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_UPDATE_SHORTCUT, args),
    deleteShortcut: (id: number): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_DELETE_SHORTCUT, { id }),
    reorderShortcuts: (ids: number[]): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_REORDER_SHORTCUTS, { ids }),
    // 容器管理
    createView: (args: { shortcutId: number; url: string }): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_CREATE_VIEW, args),
    setBounds: (args: { shortcutId: number; bounds: { x: number; y: number; width: number; height: number } }): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_SET_BOUNDS, args),
    show: (shortcutId: number): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_SHOW, { shortcutId }),
    hide: (shortcutId: number): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_HIDE, { shortcutId }),
    hideAll: (): Promise<void> => ipcRenderer.invoke(CH.WEB_HIDE_ALL),
    destroy: (shortcutId: number): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_DESTROY, { shortcutId }),
    navigate: (args: { shortcutId: number; action: 'back' | 'forward' | 'refresh' }): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_NAVIGATE, args),
    openExternal: (shortcutId: number): Promise<void> =>
      ipcRenderer.invoke(CH.WEB_OPEN_EXTERNAL, { shortcutId }),
  },
});

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise<void>((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve();
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve();
        }
      });
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      return parent.appendChild(child);
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((e) => e === child)) {
      return parent.removeChild(child);
    }
  },
};

function useLoading() {
  const className = `loaders-css__square-spin`;
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `;
  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    },
  };
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

window.onmessage = (ev) => {
  if (ev.data.payload === 'removeLoading') {
    removeLoading();
  }
};

setTimeout(removeLoading, 4999);
