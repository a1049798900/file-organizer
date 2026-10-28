// 文件 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as fileSvc from '../services/fileSvc';
import * as moveSvc from '../services/moveSvc';
import type { FileListSource, FileSort } from '@shared/types';

export function registerFileIpc(): void {
  // 文件列表
  ipcMain.handle(
    CH.FILE_LIST,
    (_event, args: { source: FileListSource; sort: FileSort }) => {
      return fileSvc.listFiles(args.source, args.sort);
    },
  );

  // 获取单个文件
  ipcMain.handle(CH.FILE_GET, (_event, id: number) => {
    return fileSvc.getFile(id);
  });

  // 移出索引
  ipcMain.handle(CH.FILE_REMOVE, (_event, ids: number[]) => {
    return fileSvc.removeFiles(ids);
  });

  // 标记为已处理
  ipcMain.handle(CH.FILE_MARK_FILED, (_event, ids: number[]) => {
    fileSvc.markFiled(ids);
  });

  // 用系统程序打开
  ipcMain.handle(CH.FILE_OPEN, (_event, id: number) => {
    return fileSvc.openFile(id);
  });

  // 在文件夹中定位
  ipcMain.handle(CH.FILE_REVEAL, (_event, id: number) => {
    return fileSvc.revealFile(id);
  });

  // 预览元数据
  ipcMain.handle(CH.FILE_PREVIEW_META, (_event, id: number) => {
    return fileSvc.getPreviewMeta(id);
  });

  // 只读读取二进制（图片以外的 PDF / Word / Excel 渲染）
  ipcMain.handle(CH.FILE_READ_BYTES, (_event, id: number) => {
    return fileSvc.readFileBytes(id);
  });

  // 标签 / 专题 / 项目关联
  ipcMain.handle(CH.FILE_ASSOCIATIONS, (_event, id: number) => {
    return fileSvc.getFileAssociations(id);
  });

  // 选择移动目标文件夹
  ipcMain.handle(CH.FILE_PICK_MOVE_TARGET, (_event, id: number) => {
    return fileSvc.pickMoveTarget(id);
  });

  // 物理移动
  ipcMain.handle(CH.FILE_MOVE, (_event, args: { id: number; targetDir: string }) => {
    return moveSvc.moveFile(args.id, args.targetDir);
  });

  // 查询可撤销状态
  ipcMain.handle(CH.FILE_GET_MOVE_UNDO, (_event, id: number) => {
    return moveSvc.getMoveUndo(id);
  });

  // 撤销移动
  ipcMain.handle(CH.FILE_UNDO_MOVE, (_event, id: number) => {
    return moveSvc.undoMove(id);
  });

  // 拖入文件建立索引（直接进入收件箱）
  ipcMain.handle(CH.FILE_INDEX_PATHS, (_event, paths: string[]) => {
    const list = Array.isArray(paths) ? paths.filter((p) => typeof p === 'string') : [];
    return fileSvc.indexPaths(list);
  });
}
