# 02 · 项目结构与文件职责

## 1. 顶层目录

```text
file-organizer/
├── .github/                 CI / PR 模板 / Dependabot
├── .localdb/                开发环境 SQLite（app.db，通常不入库）
├── .vscode/                 调试与任务配置
├── build/                   打包图标（icon.ico / png / icns）
├── dist/                    渲染进程构建产物（vite build）
├── dist-electron/           主进程 / 预加载构建产物（vite-plugin-electron）
├── electron/                Electron 源码（主进程 + 预加载）
├── public/                  静态资源（favicon、node.svg）
├── release/                 electron-builder 输出目录（release/${version}）
├── src/                     React 渲染进程源码
├── test/                    Vitest 单元测试 + Playwright e2e
├── docs/code-wiki/          本文档
├── index.html               渲染进程 HTML 入口
├── package.json             依赖、脚本、应用入口
├── vite.config.ts           构建/开发服务器/别名/Electron 插件
├── vitest.config.ts         单元测试配置
├── playwright.config.ts     e2e 配置
├── tsconfig.json            渲染进程 TS 配置（include: src）
├── tsconfig.node.json       Node/主进程/配置 TS 配置
├── electron-builder.json    打包配置
├── .npmrc                   npm 镜像与 hoist 配置
└── README.md / README.zh-CN.md
```

## 2. 主进程 `electron/`

### 2.1 入口与基础设施

| 文件 | 职责 | 关键导出/行为 |
| --- | --- | --- |
| [electron/main/index.ts](../../electron/main/index.ts) | 应用入口 | 单实例锁、自定义协议注册、DB 初始化、IPC 注册、窗口创建、退出清理 |
| [electron/main/db-path.ts](../../electron/main/db-path.ts) | 数据库路径解析 | 开发：`process.cwd()/.localdb/app.db`；打包：`app.getPath('userData')/app.db` |
| [electron/main/update.ts](../../electron/main/update.ts) | 自动更新 | `update(win)` 注册 `check-update` / `start-download` / `cancel-download` / `quit-and-install` |
| [electron/main/preview/assetProtocol.ts](../../electron/main/preview/assetProtocol.ts) | 本地资源协议 | `registerAssetSchemes()`（ready 前）、`registerAssetProtocol()`（ready 后）、`weave-asset://file/<id>` |
| [electron/main/util/pinyin.ts](../../electron/main/util/pinyin.ts) | 拼音首字母 | `getPinyinInitials(text)`、`getNamePinyin(name, alias)` |

### 2.2 数据层 `electron/main/db/`

| 文件 | 职责 |
| --- | --- |
| [db/schema.ts](../../electron/main/db/schema.ts) | 全量 DDL：8 张业务表 + 索引 + `files_fts` + 3 个同步触发器；`SCHEMA_VERSION = '1'` |
| [db/index.ts](../../electron/main/db/index.ts) | `getDb()` 单例（首次打开即迁移）、`closeDb()` |
| [db/migrate.ts](../../electron/main/db/migrate.ts) | 开启 WAL/外键、执行 DDL、写入/升级 `schema_version`、初始化 `last_scan_at` |

### 2.3 业务服务 `electron/main/services/`

| 文件 | 领域 | 导出函数 |
| --- | --- | --- |
| [scanner.ts](../../electron/main/services/scanner.ts) | 扫描 | `startScan(onProgress)`、`cancelScan()`、`isScanning()` |
| [fileSvc.ts](../../electron/main/services/fileSvc.ts) | 文件查询与操作 | `listFiles`、`getFile`、`removeFiles`、`markFiled`、`openFile`、`revealFile`、`getPreviewMeta`、`getInboxCount`、`isFileInProject`、`getFirstProjectForFile` |
| [projectSvc.ts](../../electron/main/services/projectSvc.ts) | 项目 | `listProjects`、`getProject`、`createProject`、`renameProject`、`deleteProject`、`setProjectStatus`、`addFilesToProject`、`removeFileFromProject`、`getProjectIdsForFile` |
| [kbSvc.ts](../../electron/main/services/kbSvc.ts) | 知识库 | `listTopics`、`createTopic`、`renameTopic`、`deleteTopic`、`reorderTopics`、`addToKnowledge`、`removeFromKnowledge`、`addToTopic`、`removeFromTopic`、`getKbCounts`、`isFileInTopic`、`getTopicIdsForFile` |
| [tagSvc.ts](../../electron/main/services/tagSvc.ts) | 标签 | `listTags`、`createTag`、`addToFiles`、`removeFromFiles`、`getTagsForFile`、`getTagsForFiles` |
| [settingsSvc.ts](../../electron/main/services/settingsSvc.ts) | 设置 | `getSetting`、`setSetting`、`getAllSettings`、`pickRoot`、`getDatabasePath`、`getAppVersion` |

### 2.4 IPC 处理器 `electron/main/ipc/`

| 文件 | 通道前缀 | 注册函数 |
| --- | --- | --- |
| [register.ts](../../electron/main/ipc/register.ts) | — | `registerAllIpc()` 顺序调用下面 6 个注册器 |
| [scan.ipc.ts](../../electron/main/ipc/scan.ipc.ts) | `scan:` | `registerScanIpc()` |
| [file.ipc.ts](../../electron/main/ipc/file.ipc.ts) | `file:` | `registerFileIpc()` |
| [project.ipc.ts](../../electron/main/ipc/project.ipc.ts) | `project:` | `registerProjectIpc()` |
| [kb.ipc.ts](../../electron/main/ipc/kb.ipc.ts) | `kb:` | `registerKbIpc()` |
| [tag.ipc.ts](../../electron/main/ipc/tag.ipc.ts) | `tag:` | `registerTagIpc()` |
| [settings.ipc.ts](../../electron/main/ipc/settings.ipc.ts) | `settings:` | `registerSettingsIpc()` |

### 2.5 预加载 `electron/preload/`

| 文件 | 职责 |
| --- | --- |
| [index.ts](../../electron/preload/index.ts) | `contextBridge.exposeInMainWorld('weave', api)`；附带模板遗留的加载动画（`domReady` + `useLoading` + 5s 兜底移除） |

## 3. 渲染进程 `src/`

### 3.1 入口与共享层

| 文件 | 职责 |
| --- | --- |
| [main.tsx](../../src/main.tsx) | `ReactDOM.createRoot` 挂载 `<App/>`；`postMessage('removeLoading')` 移除启动动画 |
| [App.tsx](../../src/App.tsx) | 唯一根组件，渲染 `<AppShell/>` |
| [index.css](../../src/index.css) | Tailwind v4 `@import` + `@theme` 设计令牌（Apple HIG 风格色板、字号、圆角、字体） |
| [shared/types.ts](../../src/shared/types.ts) | 跨进程 DTO：`FileRow`、`ProjectRow`、`TopicRow`、`FileListSource`、`FileSort` 等 |
| [shared/ipc-contract.ts](../../src/shared/ipc-contract.ts) | `CH` 通道常量 |
| [types/weave-api.d.ts](../../src/types/weave-api.d.ts) | `Window.weave` 类型声明 |
| [lib/ipc.ts](../../src/lib/ipc.ts) | `window.weave` 的类型化快捷导出（`scanApi/fileApi/...`） |
| [lib/cn.ts](../../src/lib/cn.ts) | `clsx` + `tailwind-merge` 的 `cn()` |
| [lib/format.ts](../../src/lib/format.ts) | `formatSize`、`formatMtime`、`formatShortDate` |

> 注意：`lib/ipc.ts` 中的类型引用写作 `import('./weave-api')`，而声明文件实际位于 `src/types/weave-api.d.ts`，且该声明本身通过 `declare global` 生效。详见 [08-testing-and-quality.md](08-testing-and-quality.md)。

### 3.2 状态与 Hook

| 文件 | 职责 |
| --- | --- |
| [stores/useUiStore.ts](../../src/stores/useUiStore.ts) | 视图切换、侧栏折叠、预览宽/开关、搜索词、右键菜单、全局 Modal、Toast |
| [stores/useDataStore.ts](../../src/stores/useDataStore.ts) | 收件箱数量、项目列表与筛选、专题、知识库计数、标签、`refreshAll` |
| [stores/useSelectionStore.ts](../../src/stores/useSelectionStore.ts) | 按 `listKey` 隔离的多选状态（`ids/anchor/focus`） |
| [hooks/useFileList.ts](../../src/hooks/useFileList.ts) | 列表数据加载 + 排序 + 刷新 + `enabled` 开关 |
| [hooks/useHotkeys.ts](../../src/hooks/useHotkeys.ts) | 列表键盘快捷键（↑↓ / Delete / Esc / Enter / Ctrl+A） |

### 3.3 布局组件 `components/layout/`

| 文件 | 职责 |
| --- | --- |
| [AppShell.tsx](../../src/components/layout/AppShell.tsx) | 全局骨架：TopBar + Sidebar + 当前 View + PreviewPane + 全局右键菜单 + 6 类 Modal + Toast |
| [TopBar.tsx](../../src/components/layout/TopBar.tsx) | 折叠按钮、搜索框（200ms 防抖）、设置入口 |
| [Sidebar.tsx](../../src/components/layout/Sidebar.tsx) | 收件箱/项目/知识库/设置导航，收件箱角标（>99 显示 99+） |
| [PreviewPane.tsx](../../src/components/layout/PreviewPane.tsx) | 可拖拽宽度的预览侧栏（360–480px），加载元数据 |
| [GlobalContextMenu.tsx](../../src/components/layout/GlobalContextMenu.tsx) | 文件右键菜单：打开/定位/关联项目/存入 KB/专题/打标签/移出索引 |

### 3.4 视图 `components/views/`

| 文件 | 数据源 | 关键交互 |
| --- | --- | --- |
| [InboxView.tsx](../../src/components/views/InboxView.tsx) | `{kind:'inbox'}` | 排序下拉、批量“标记已处理” |
| [ProjectsView.tsx](../../src/components/views/ProjectsView.tsx) | `useDataStore.projects` | 全部/进行中/已完成筛选、新建、右键重命名/删除、卡片网格 |
| [ProjectDetailView.tsx](../../src/components/views/ProjectDetailView.tsx) | `{kind:'project',projectId}` | 返回、状态切换、添加文件对话框、列表 |
| [KnowledgeBaseView.tsx](../../src/components/views/KnowledgeBaseView.tsx) | `kb-all` / `kb-uncategorized` / `kb-topic` | 专题栏、新建专题（内联输入）、专题右键重命名/删除 |
| [SearchResultsView.tsx](../../src/components/views/SearchResultsView.tsx) | `{kind:'search',query}` | 全局搜索结果、来源徽章 |
| [SettingsView.tsx](../../src/components/views/SettingsView.tsx) | `settingsApi` + `scanApi` | 选择扫描根目录、开始/取消扫描、进度条、结果、DB 路径、版本 |

### 3.5 列表基础设施 `components/filelist/`

| 文件 | 职责 |
| --- | --- |
| [FileList.tsx](../../src/components/filelist/FileList.tsx) | 虚拟滚动容器、选择/右键/双击/快捷键、加载骨架、空态 |
| [FileListHeader.tsx](../../src/components/filelist/FileListHeader.tsx) | 表头、全选（含 indeterminate）、排序指示 |
| [FileRow.tsx](../../src/components/filelist/FileRow.tsx) | 单行渲染（memo）：复选框、别名、来源徽章、KB 图标、路径失效、类型/大小/时间/标签 |

### 3.6 对话框与预览

| 文件 | 职责 |
| --- | --- |
| [NewProjectDialog.tsx](../../src/components/dialogs/NewProjectDialog.tsx) | 新建项目（1–50 字，重名提示） |
| [RenameDialog.tsx](../../src/components/dialogs/RenameDialog.tsx) | 项目/专题共用的重命名（项目 50 字、专题 30 字） |
| [SaveToKbDialog.tsx](../../src/components/dialogs/SaveToKbDialog.tsx) | 多选专题、可内联新建专题、可选“存入后移出收件箱” |
| [RemoveFromKbDialog.tsx](../../src/components/dialogs/RemoveFromKbDialog.tsx) | 移出知识库，可选“同时放回收件箱” |
| [AddFilesToProjectDialog.tsx](../../src/components/dialogs/AddFilesToProjectDialog.tsx) | 从知识库全部或搜索结果中挑选文件加入项目 |
| [UnsupportedPreview.tsx](../../src/components/previews/UnsupportedPreview.tsx) | 元数据卡片；失效路径/超大文件分支 |

### 3.7 UI 原子组件 `components/ui/`

`Button`（primary/secondary/ghost/danger × sm/md）、`IconButton`、`Checkbox`（支持 indeterminate）、`Modal`（Esc/遮罩关闭）、`ConfirmDialog`、`ContextMenu` + `MenuItem/MenuSeparator/MenuSubmenu`、`EmptyState`、`Skeleton/SkeletonRow`。

### 3.8 模板遗留

| 文件 | 状态 |
| --- | --- |
| [components/update/index.tsx](../../src/components/update/index.tsx) 等 | 使用 `window.ipcRenderer`，当前预加载未暴露；未被任何页面引用 |
| [demos/ipc.ts](../../src/demos/ipc.ts)、[demos/node.ts](../../src/demos/node.ts) | 模板演示代码，`main.tsx` 中已注释 |

## 4. 测试与构建配置

| 文件 | 作用 |
| --- | --- |
| [test/index.test.ts](../../test/index.test.ts) | Vitest 冒烟用例（1+1、`NODE_ENV=test`） |
| [test/e2e/e2e.spec.ts](../../test/e2e/e2e.spec.ts) | Playwright 启动 Electron 的 e2e；断言仍是模板首页内容 |
| [vitest.config.ts](../../vitest.config.ts) | 测试根目录、包含/排除、29s 超时 |
| [playwright.config.ts](../../playwright.config.ts) | `testDir: ./test/e2e`，单 worker，list reporter |
| [vite.config.ts](../../vite.config.ts) | 别名 `@`/`@shared`；每次启动删除 `dist-electron`；主进程/预加载构建配置 |
| [tsconfig.json](../../tsconfig.json) | 渲染进程配置，`paths` 映射别名，引用 `tsconfig.node.json` |
| [tsconfig.node.json](../../tsconfig.node.json) | 主进程、shared、vite/vitest 配置；`composite: true` |
| [electron-builder.json](../../electron-builder.json) | 打包目标、`asarUnpack` better-sqlite3、GitHub publish |

## 5. 路径别名与模块解析

```json
// tsconfig.json
"paths": {
  "@/*": ["./src/*"],
  "@shared/*": ["./src/shared/*"]
}
```

- `vite.config.ts` 同步配置 `@` → `src`、`@shared` → `src/shared`，保证运行时与类型检查一致。
- 主进程 TS 配置只映射 `@shared/*`（[tsconfig.node.json](../../tsconfig.node.json#L13-L15)），因此主进程代码引用共享类型时使用 `@shared/types`，如 [fileSvc.ts L4](../../electron/main/services/fileSvc.ts#L4)。

## 6. 构建产物

| 产物 | 来源 | 说明 |
| --- | --- | --- |
| `dist/index.html` + `dist/assets/*` | 渲染进程 | `vite build` |
| `dist-electron/main/index.js` | 主进程 | 由 `vite-plugin-electron` 构建；`main` 字段指向它 |
| `dist-electron/preload/index.mjs` | 预加载 | 窗口 `webPreferences.preload` 指向它 |
| `release/<version>/` | electron-builder | Windows NSIS、macOS dmg/zip |

`vite.config.ts` 在配置函数开头执行 `rmSync('dist-electron', { recursive: true, force: true })`（[L16](../../vite.config.ts#L16)），因此每次 `vite` 启动都会全量重建 Electron 产物。
