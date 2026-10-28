// 移动文件流程 — 右键菜单与预览面板共用
import { fileApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import { useDataStore } from '@/stores/useDataStore';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试';
}

/**
 * 选择目标文件夹 → 确认源/目标路径 → 执行物理移动
 * 返回是否已发起移动（用户取消选择时返回 false）
 */
export async function startMoveFile(fileId: number): Promise<boolean> {
  const { openModal, showToast } = useUiStore.getState();

  let target;
  try {
    target = await fileApi.pickMoveTarget(fileId);
  } catch (error) {
    showToast(errorMessage(error), 'error');
    return false;
  }
  if (!target) return false;

  openModal({
    type: 'confirm',
    config: {
      title: '移动到文件夹',
      message: `将文件物理移动到新位置：\n源路径：${target.sourcePath ?? ''}\n目标路径：${target.targetPath}`,
      confirmText: '移动',
      onConfirm: () => {
        fileApi
          .move(fileId, target.dir)
          .then(() => {
            useDataStore.getState().bumpFilesRevision();
            useDataStore.getState().refreshInboxCount();
            showToast('已移动，10 分钟内可右键撤销');
          })
          .catch((error) => showToast(errorMessage(error), 'error'));
      },
    },
  });

  return true;
}

/** 撤销 10 分钟内的移动 */
export async function undoMoveFile(fileId: number): Promise<void> {
  const { showToast } = useUiStore.getState();
  try {
    await fileApi.undoMove(fileId);
    useDataStore.getState().bumpFilesRevision();
    useDataStore.getState().refreshInboxCount();
    showToast('已撤销移动');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  }
}
