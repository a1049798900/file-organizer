# File Organizer - 办公文件整理工具

一款 Windows 本地办公文件整理工具，支持十万级文件规模。

## 核心功能
- 扫描指定文件夹（doc/docx/pdf/xls/xlsx/jpg/png 等格式）
- 提取标题信息，由本地 AI (Ollama) 生成文件名和标签分类建议
- 用户审阅后应用，安全可控

## 核心约束
- 只改名和打标签，绝不修改文件内容、不修改元数据、不上传云端
- 默认虚拟归类（SQLite 标签），可选物理移动
- 物理移动记录新老路径、禁止静默覆盖、支持按批次撤销

## 技术栈
- **桌面框架**：Electron (Node.js 后端)
- **前端**：React 19 + TypeScript + Tailwind CSS v4
- **构建工具**：Vite + electron-vite
- **数据库**：better-sqlite3 (SQLite WAL 模式 + FTS5 全文检索)
- **本地 AI**：Ollama
- **UI 风格**：Apple HIG 风格
- **虚拟滚动**：TanStack Virtual

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发模式（热更新）
npm run dev

# 类型检查
npm run typecheck

# 构建生产版本
npm run build

# 运行单元测试
npm run test
```

## 项目结构

```
file-organizer/
├── electron/              # Electron 主进程 & 预加载脚本
│   ├── main/             # 主进程（Node.js 后端，文件扫描、数据库操作）
│   └── preload/          # 预加载脚本（IPC 桥接）
├── src/                   # 渲染进程（React 前端）
│   ├── components/       # UI 组件
│   ├── assets/           # 静态资源
│   ├── App.tsx           # 根组件
│   ├── main.tsx          # 入口文件
│   └── index.css         # 全局样式（Tailwind）
├── public/               # 公共资源
├── build/                # 构建资源（图标等）
├── test/                 # 测试文件
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置
├── electron-builder.json # electron-builder 配置
└── package.json
```

## 开发状态
项目脚手架已搭建完成，基础环境就绪。

## 开发路线
- [x] 环境调研与评估
- [x] 项目脚手架搭建（Electron + React + TS + Tailwind + SQLite）
- [ ] 第一步：Node.js 扫描文件 → SQLite → 前端虚拟列表
- [ ] 第二步：AI 建议生成功能
- [ ] 第三步：标签分类与虚拟归类
- [ ] 第四步：物理移动与撤销机制
