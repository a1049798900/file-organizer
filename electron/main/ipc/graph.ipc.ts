// 关系网络 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as graphSvc from '../services/graphSvc';
import type { GraphQueryInput, GraphUnlinkInput } from '../../../src/shared/graph';

export function registerGraphIpc(): void {
  ipcMain.handle(CH.GRAPH_GET, (_event, input: GraphQueryInput) => {
    return graphSvc.getGraphData(input);
  });

  ipcMain.handle(CH.GRAPH_UNLINK, (_event, input: GraphUnlinkInput) => {
    return graphSvc.unlinkGraphEdge(input);
  });

  ipcMain.handle(CH.GRAPH_GET_UNLINK_UNDO, (_event, batchId: string) => {
    return graphSvc.getGraphUnlinkUndo(batchId);
  });

  ipcMain.handle(CH.GRAPH_UNDO_UNLINK, (_event, batchId: string) => {
    return graphSvc.undoGraphUnlink(batchId);
  });
}
