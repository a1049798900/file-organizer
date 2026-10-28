// 标签 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as tagSvc from '../services/tagSvc';

export function registerTagIpc(): void {
  // 标签列表
  ipcMain.handle(CH.TAG_LIST, () => {
    return tagSvc.listTags();
  });

  // 新建标签
  ipcMain.handle(CH.TAG_CREATE, (_event, name: string) => {
    return tagSvc.createTag(name);
  });

  // 给文件打标签
  ipcMain.handle(
    CH.TAG_ADD_TO_FILES,
    (_event, args: { fileIds: number[]; tagIds: number[] }) => {
      tagSvc.addToFiles(args.fileIds, args.tagIds);
    },
  );

  // 从文件移除标签
  ipcMain.handle(
    CH.TAG_REMOVE_FROM_FILES,
    (_event, args: { fileIds: number[]; tagIds: number[] }) => {
      tagSvc.removeFromFiles(args.fileIds, args.tagIds);
    },
  );
}
