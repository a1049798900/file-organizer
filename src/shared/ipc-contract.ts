// IPC 通道名常量
// 渲染进程与主进程均引用此文件，确保通道名一致

export const CH = {
  // 扫描
  SCAN_START: 'scan:start',
  SCAN_CANCEL: 'scan:cancel',
  SCAN_PROGRESS: 'scan:progress',        // main → renderer 事件
  SCAN_RESULT: 'scan:result',            // 扫描完成结果
  // 文件
  FILE_LIST: 'file:list',
  FILE_GET: 'file:get',
  FILE_REMOVE: 'file:remove',
  FILE_MARK_FILED: 'file:markFiled',
  FILE_OPEN: 'file:open',
  FILE_REVEAL: 'file:reveal',
  FILE_PREVIEW_META: 'file:previewMeta',
  FILE_READ_BYTES: 'file:readBytes',           // 只读读取二进制用于预览渲染
  FILE_ASSOCIATIONS: 'file:associations',      // 标签 / 专题 / 项目
  FILE_PICK_MOVE_TARGET: 'file:pickMoveTarget', // 选择目标文件夹
  FILE_MOVE: 'file:move',                      // 物理移动文件
  FILE_GET_MOVE_UNDO: 'file:getMoveUndo',      // 查询可撤销状态
  FILE_UNDO_MOVE: 'file:undoMove',             // 撤销移动
  FILE_INDEX_PATHS: 'file:indexPaths',   // 拖入文件建立索引
  // 项目
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_RENAME: 'project:rename',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SET_STATUS: 'project:setStatus',
  PROJECT_ADD_FILES: 'project:addFiles',
  PROJECT_REMOVE_FILE: 'project:removeFile',
  // 日历
  CALENDAR_LIST_EVENTS: 'calendar:listEvents',
  CALENDAR_GET_AREA_DETAIL: 'calendar:getAreaDetail',
  CALENDAR_LIST_PROJECT_SCHEDULE: 'calendar:listProjectSchedule',
  CALENDAR_LIST_CONTACT_SCHEDULE: 'calendar:listContactSchedule',
  CALENDAR_CREATE_TASK: 'calendar:createTask',
  CALENDAR_UPDATE_TASK: 'calendar:updateTask',
  CALENDAR_SET_TASK_STATUS: 'calendar:setTaskStatus',
  CALENDAR_DELETE_TASK: 'calendar:deleteTask',
  CALENDAR_CREATE_MEETING: 'calendar:createMeeting',
  CALENDAR_UPDATE_MEETING: 'calendar:updateMeeting',
  CALENDAR_DELETE_MEETING: 'calendar:deleteMeeting',
  CALENDAR_SEED_SAMPLE: 'calendar:seedSampleData',
  CALENDAR_CLEAR_SAMPLE: 'calendar:clearSampleData',
  CALENDAR_REMINDER_OPEN: 'calendar:reminderOpen', // main → renderer 事件：点击提醒通知后跳转日历
  // 应用锁
  APP_LOCK_SET: 'app:lockSet',
  APP_LOCK_GET: 'app:lockGet',
  // 知识库
  KB_TOPICS: 'kb:listTopics',
  KB_CREATE_TOPIC: 'kb:createTopic',
  KB_RENAME_TOPIC: 'kb:renameTopic',
  KB_DELETE_TOPIC: 'kb:deleteTopic',
  KB_REORDER_TOPICS: 'kb:reorderTopics',
  KB_ADD_TO_KNOWLEDGE: 'kb:addToKnowledge',
  KB_REMOVE_FROM_KNOWLEDGE: 'kb:removeFromKnowledge',
  KB_ADD_TO_TOPIC: 'kb:addToTopic',
  KB_REMOVE_FROM_TOPIC: 'kb:removeFromTopic',
  // 标签
  TAG_LIST: 'tag:list',
  TAG_CREATE: 'tag:create',
  TAG_ADD_TO_FILES: 'tag:addToFiles',
  TAG_REMOVE_FROM_FILES: 'tag:removeFromFiles',
  // 通讯录
  CONTACT_LIST: 'contact:list',
  CONTACT_DETAIL: 'contact:detail',
  CONTACT_CREATE: 'contact:create',
  CONTACT_UPDATE: 'contact:update',
  CONTACT_DELETE: 'contact:delete',
  CONTACT_LIST_BY_FILE: 'contact:listByFile',
  CONTACT_SET_FILE_CONTACTS: 'contact:setFileContacts',
  CONTACT_LIST_BY_PROJECT: 'contact:listByProject',
  CONTACT_SET_PROJECT_CONTACTS: 'contact:setProjectContacts',
  CONTACT_SET_CONTACT_FILES: 'contact:setContactFiles',
  CONTACT_SET_CONTACT_PROJECTS: 'contact:setContactProjects',
  CONTACT_ADD_TO_FILES: 'contact:addToFiles',
  CONTACT_ADD_TO_PROJECTS: 'contact:addToProjects',
  CONTACT_DELETE_MANY: 'contact:deleteMany',
  // 关系网络
  GRAPH_GET: 'graph:get',
  GRAPH_UNLINK: 'graph:unlink',
  GRAPH_GET_UNLINK_UNDO: 'graph:getUnlinkUndo',
  GRAPH_UNDO_UNLINK: 'graph:undoUnlink',
  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_PICK_ROOT: 'settings:pickRoot',
  SETTINGS_GET_DB_PATH: 'settings:getDbPath',
  SETTINGS_GET_VERSION: 'settings:getVersion',
  // ---- 通用网页工作区（Web Workspace）----
  // 快捷方式 CRUD
  WEB_LIST_SHORTCUTS: 'web:listShortcuts',
  WEB_CREATE_SHORTCUT: 'web:createShortcut',
  WEB_UPDATE_SHORTCUT: 'web:updateShortcut',
  WEB_DELETE_SHORTCUT: 'web:deleteShortcut',
  WEB_REORDER_SHORTCUTS: 'web:reorderShortcuts',
  // 容器管理（按 shortcutId 路由）
  WEB_CREATE_VIEW: 'web:createView',       // 创建或获取缓存的 WebContentsView
  WEB_SET_BOUNDS: 'web:setBounds',         // 同步 bounds
  WEB_SHOW: 'web:show',                    // 显示指定 shortcut 的 view
  WEB_HIDE: 'web:hide',                    // 隐藏指定 shortcut 的 view
  WEB_HIDE_ALL: 'web:hideAll',             // 隐藏所有（切视图/应用锁）
  WEB_DESTROY: 'web:destroy',              // 销毁指定 shortcut 的缓存
  WEB_NAVIGATE: 'web:navigate',            // 导航 back/forward/refresh
  WEB_OPEN_EXTERNAL: 'web:openExternal',   // 外部浏览器打开
} as const;

export type ChannelKey = keyof typeof CH;
export type ChannelValue = typeof CH[ChannelKey];
