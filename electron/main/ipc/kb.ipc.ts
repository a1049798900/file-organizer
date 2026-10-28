// 知识库 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as kbSvc from '../services/kbSvc';

export function registerKbIpc(): void {
  // 专题列表
  ipcMain.handle(CH.KB_TOPICS, () => {
    return kbSvc.listTopics();
  });

  // 新建专题
  ipcMain.handle(CH.KB_CREATE_TOPIC, (_event, name: string) => {
    return kbSvc.createTopic(name);
  });

  // 重命名专题
  ipcMain.handle(CH.KB_RENAME_TOPIC, (_event, args: { id: number; name: string }) => {
    kbSvc.renameTopic(args.id, args.name);
  });

  // 删除专题
  ipcMain.handle(CH.KB_DELETE_TOPIC, (_event, id: number) => {
    kbSvc.deleteTopic(id);
  });

  // 重排专题顺序
  ipcMain.handle(CH.KB_REORDER_TOPICS, (_event, topicIds: number[]) => {
    kbSvc.reorderTopics(topicIds);
  });

  // 存入知识库
  ipcMain.handle(
    CH.KB_ADD_TO_KNOWLEDGE,
    (_event, args: { fileIds: number[]; topicIds: number[]; moveOutOfInbox: boolean }) => {
      kbSvc.addToKnowledge(args.fileIds, args.topicIds, args.moveOutOfInbox);
    },
  );

  // 移出知识库
  ipcMain.handle(
    CH.KB_REMOVE_FROM_KNOWLEDGE,
    (_event, args: { fileIds: number[]; toInbox: boolean }) => {
      kbSvc.removeFromKnowledge(args.fileIds, args.toInbox);
    },
  );

  // 加入专题
  ipcMain.handle(
    CH.KB_ADD_TO_TOPIC,
    (_event, args: { fileIds: number[]; topicId: number }) => {
      kbSvc.addToTopic(args.fileIds, args.topicId);
    },
  );

  // 移出专题
  ipcMain.handle(
    CH.KB_REMOVE_FROM_TOPIC,
    (_event, args: { fileIds: number[]; topicId: number }) => {
      kbSvc.removeFromTopic(args.fileIds, args.topicId);
    },
  );
}
