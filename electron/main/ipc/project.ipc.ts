// 项目 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as projectSvc from '../services/projectSvc';
import type { ProjectStatus } from '@shared/types';

export function registerProjectIpc(): void {
  // 项目列表
  ipcMain.handle(CH.PROJECT_LIST, (_event, filter: 'all' | 'active' | 'done' = 'all') => {
    return projectSvc.listProjects(filter);
  });

  // 新建项目
  ipcMain.handle(CH.PROJECT_CREATE, (_event, name: string) => {
    return projectSvc.createProject(name);
  });

  // 重命名项目
  ipcMain.handle(CH.PROJECT_RENAME, (_event, args: { id: number; name: string }) => {
    projectSvc.renameProject(args.id, args.name);
  });

  // 删除项目
  ipcMain.handle(CH.PROJECT_DELETE, (_event, id: number) => {
    projectSvc.deleteProject(id);
  });

  // 设置项目状态
  ipcMain.handle(
    CH.PROJECT_SET_STATUS,
    (_event, args: { id: number; status: ProjectStatus }) => {
      projectSvc.setProjectStatus(args.id, args.status);
    },
  );

  // 添加文件到项目
  ipcMain.handle(
    CH.PROJECT_ADD_FILES,
    (_event, args: { projectId: number; fileIds: number[] }) => {
      projectSvc.addFilesToProject(args.projectId, args.fileIds);
    },
  );

  // 从项目移除文件
  ipcMain.handle(
    CH.PROJECT_REMOVE_FILE,
    (_event, args: { projectId: number; fileId: number }) => {
      projectSvc.removeFileFromProject(args.projectId, args.fileId);
    },
  );
}
