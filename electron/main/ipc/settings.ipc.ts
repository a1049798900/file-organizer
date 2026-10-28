// 设置 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as settingsSvc from '../services/settingsSvc';

export function registerSettingsIpc(): void {
  // 获取设置
  ipcMain.handle(CH.SETTINGS_GET, () => {
    return settingsSvc.getAllSettings();
  });

  // 设置单个值
  ipcMain.handle(CH.SETTINGS_SET, (_event, args: { key: string; value: string }) => {
    settingsSvc.setSetting(args.key, args.value);
  });

  // 选择根目录
  ipcMain.handle(CH.SETTINGS_PICK_ROOT, () => {
    return settingsSvc.pickRoot();
  });

  // 获取数据库路径
  ipcMain.handle(CH.SETTINGS_GET_DB_PATH, () => {
    return settingsSvc.getDatabasePath();
  });

  // 获取版本号
  ipcMain.handle(CH.SETTINGS_GET_VERSION, () => {
    return settingsSvc.getAppVersion();
  });
}
