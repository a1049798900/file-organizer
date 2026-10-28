// 应用锁 IPC 处理器 — 渲染进程手动锁定/解锁后同步给主进程
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as lockSvc from '../services/lockSvc';

export function registerLockIpc(): void {
  ipcMain.handle(CH.APP_LOCK_SET, (_event, locked: boolean) => {
    lockSvc.setAppLocked(Boolean(locked));
  });

  ipcMain.handle(CH.APP_LOCK_GET, () => {
    return lockSvc.getAppLocked();
  });
}
