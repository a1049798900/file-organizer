// 扫描 IPC 处理器
import { ipcMain, BrowserWindow } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import { startScan, cancelScan, isScanning } from '../services/scanner';

export function registerScanIpc(): void {
  // 开始扫描
  ipcMain.handle(CH.SCAN_START, async () => {
    if (isScanning()) {
      throw new Error('已有扫描正在进行');
    }

    const win = BrowserWindow.getFocusedWindow();
    const result = await startScan((progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(CH.SCAN_PROGRESS, progress);
      }
    });

    return result;
  });

  // 取消扫描
  ipcMain.handle(CH.SCAN_CANCEL, () => {
    cancelScan();
  });
}
