// 通用网页工作区 IPC 处理器 —— 委托给 shortcutsSvc + workspaceSvc
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import { getMainWindow } from '../index';
import * as shortcutsSvc from '../services/shortcutsSvc';
import * as workspaceSvc from '../services/workspaceSvc';

export function registerWebIpc(): void {
  // ---- 快捷方式 CRUD ----
  ipcMain.handle(CH.WEB_LIST_SHORTCUTS, () => {
    return shortcutsSvc.listShortcuts();
  });

  ipcMain.handle(
    CH.WEB_CREATE_SHORTCUT,
    (_event, args: { name: string; url: string }) => {
      return shortcutsSvc.createShortcut(args.name, args.url);
    },
  );

  ipcMain.handle(
    CH.WEB_UPDATE_SHORTCUT,
    (_event, args: { id: number; name: string; url: string }) => {
      shortcutsSvc.updateShortcut(args.id, args.name, args.url);
    },
  );

  ipcMain.handle(CH.WEB_DELETE_SHORTCUT, (_event, args: { id: number }) => {
    shortcutsSvc.deleteShortcut(args.id);
    // 删除快捷方式后，同步清理对应的 WebContentsView 缓存
    workspaceSvc.destroy(args.id);
  });

  ipcMain.handle(
    CH.WEB_REORDER_SHORTCUTS,
    (_event, args: { ids: number[] }) => {
      shortcutsSvc.reorderShortcuts(args.ids);
    },
  );

  // ---- 容器管理（按 shortcutId 路由）----
  ipcMain.handle(
    CH.WEB_CREATE_VIEW,
    (_event, args: { shortcutId: number; url: string }) => {
      const win = getMainWindow();
      if (!win) {
        throw new Error('[web] 主窗口尚未创建');
      }
      workspaceSvc.getOrCreateView(win, args.shortcutId, args.url);
    },
  );

  ipcMain.handle(
    CH.WEB_SET_BOUNDS,
    (_event, args: { shortcutId: number; bounds: { x: number; y: number; width: number; height: number } }) => {
      workspaceSvc.setBounds(args.shortcutId, args.bounds);
    },
  );

  ipcMain.handle(CH.WEB_SHOW, (_event, args: { shortcutId: number }) => {
    workspaceSvc.show(args.shortcutId);
  });

  ipcMain.handle(CH.WEB_HIDE, (_event, args: { shortcutId: number }) => {
    workspaceSvc.hide(args.shortcutId);
  });

  ipcMain.handle(CH.WEB_HIDE_ALL, () => {
    workspaceSvc.hideAll();
  });

  ipcMain.handle(CH.WEB_DESTROY, (_event, args: { shortcutId: number }) => {
    workspaceSvc.destroy(args.shortcutId);
  });

  ipcMain.handle(
    CH.WEB_NAVIGATE,
    (_event, args: { shortcutId: number; action: 'back' | 'forward' | 'refresh' }) => {
      workspaceSvc.navigate(args.shortcutId, args.action);
    },
  );

  ipcMain.handle(CH.WEB_OPEN_EXTERNAL, (_event, args: { shortcutId: number }) => {
    workspaceSvc.openExternal(args.shortcutId);
  });
}
