// IPC 通道注册总入口
import { registerScanIpc } from './scan.ipc';
import { registerFileIpc } from './file.ipc';
import { registerProjectIpc } from './project.ipc';
import { registerCalendarIpc } from './calendar.ipc';
import { registerLockIpc } from './lock.ipc';
import { registerKbIpc } from './kb.ipc';
import { registerTagIpc } from './tag.ipc';
import { registerContactIpc } from './contact.ipc';
import { registerGraphIpc } from './graph.ipc';
import { registerSettingsIpc } from './settings.ipc';
import { registerWebIpc } from './web.ipc';

export function registerAllIpc(): void {
  registerScanIpc();
  registerFileIpc();
  registerProjectIpc();
  registerCalendarIpc();
  registerLockIpc();
  registerKbIpc();
  registerTagIpc();
  registerContactIpc();
  registerGraphIpc();
  registerSettingsIpc();
  // deepseek.ipc.ts 已废弃，所有 WebContentsView 管理委托给 workspaceSvc
  registerWebIpc();
}
