import { app, BrowserWindow, dialog, Menu, shell, Tray } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { update } from './update';
import { getDb, closeDb } from './db';
import { registerAllIpc } from './ipc/register';
import { registerAssetProtocol, registerAssetSchemes } from './preview/assetProtocol';
import { startReminderScheduler, stopReminderScheduler } from './services/reminderSvc';
import { destroyAll as destroyAllWebViews } from './services/workspaceSvc';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..');

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (process.platform === 'win32' && os.release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
/** 托盘「退出」或系统退出时为 true；否则关窗只隐藏到托盘 */
let isQuitting = false;
const preload = path.join(__dirname, '../preload/index.mjs');
const indexHtml = path.join(RENDERER_DIST, 'index.html');

/** IPC handler 需要时获取当前主窗口引用（可能为 null） */
export function getMainWindow(): BrowserWindow | null {
  return win;
}

function showMainWindow() {
  if (!win) {
    void createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// 托盘常驻：关窗不退出，提醒调度在主进程持续运行
function createTray() {
  try {
    tray = new Tray(path.join(process.env.VITE_PUBLIC, 'favicon.ico'));
  } catch (error) {
    console.error('[tray] 创建系统托盘失败，关窗时将直接退出', error);
    tray = null;
    return;
  }

  tray.setToolTip('Weave 工作台');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showMainWindow);
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'Weave 工作台',
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 500,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // loadURL/loadFile 返回 Promise，必须捕获拒绝以避免 unhandled rejection
    void win.loadURL(VITE_DEV_SERVER_URL).catch((error) => {
      console.error('[window] 加载页面失败', error);
    });
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    void win.loadFile(indexHtml).catch((error) => {
      console.error('[window] 加载页面失败', error);
    });
  }

  // 有托盘时关窗只隐藏，保持主进程提醒调度运行；托盘创建失败则维持关窗退出
  win.on('close', (event) => {
    if (tray && !isQuitting) {
      event.preventDefault();
      win?.hide();
    }
  });

  win.on('closed', () => {
    win = null;
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto update
  update(win);
}

// Register privileged schemes before ready (required by Electron)
registerAssetSchemes();

/** 启动流程：数据库初始化失败时弹窗并退出，避免进程僵死 */
async function boot(): Promise<void> {
  // 注册自定义协议（必须在 app ready 之后）
  registerAssetProtocol();

  try {
    // 初始化数据库（含迁移，同步执行，失败即抛错）
    getDb();
    // 注册所有 IPC 通道
    registerAllIpc();
  } catch (error) {
    console.error('[boot] 数据库初始化失败', error);
    dialog.showErrorBox(
      '数据库初始化失败',
      `应用无法启动：${error instanceof Error ? error.message : String(error)}`,
    );
    app.quit();
    return;
  }

  await createWindow();
  // 系统托盘常驻（关窗隐藏后提醒仍可触发）
  createTray();
  // 启动日历桌面提醒调度
  startReminderScheduler();
}

// whenReady 链上必须挂 catch，否则 boot 内的异常会成为 unhandled rejection
app.whenReady().then(boot).catch((error) => {
  console.error('[boot] 启动失败', error);
  app.quit();
});

app.on('window-all-closed', () => {
  // 托盘常驻：关窗已拦截为隐藏，正常不会走到这里；
  // 若托盘创建失败导致窗口真正关闭，则在非 macOS 上退出
  if (!tray && process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopReminderScheduler();
  destroyAllWebViews();
  closeDb();
});

app.on('second-instance', () => {
  showMainWindow();
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    showMainWindow();
  } else {
    void createWindow();
  }
});
