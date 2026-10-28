import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { kbApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';

interface RemoveFromKbDialogProps {
  fileIds: number[];
  onClose: () => void;
}

export function RemoveFromKbDialog({ fileIds, onClose }: RemoveFromKbDialogProps) {
  const [toInbox, setToInbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const refreshTopics = useDataStore((s) => s.refreshTopics);
  const refreshKbCounts = useDataStore((s) => s.refreshKbCounts);
  const refreshInboxCount = useDataStore((s) => s.refreshInboxCount);
  const showToast = useUiStore((s) => s.showToast);

  const isSingle = fileIds.length === 1;
  const title = isSingle ? '移出资料库' : `把 ${fileIds.length} 个文件移出资料库？`;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await kbApi.removeFromKnowledge(fileIds, toInbox);
      await refreshTopics();
      await refreshKbCounts();
      if (toInbox) {
        await refreshInboxCount();
      }
      onClose();
    } catch (e) {
      showToast('移出资料库失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} width={380} hideClose>
      <div className="p-5">
        {isSingle && (
          <div className="text-base text-ink mb-3">确定把该文件移出资料库？</div>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={toInbox} onChange={(e) => setToInbox(e.target.checked)} />
          同时放回收件箱
        </label>
        <div className="text-sm text-ink-3 mt-3">文件在磁盘上不受影响。</div>
        <div className="text-xs text-ink-3 mt-1">移出资料库后，文件仍显示在全局列表中，项目关联保留不变。</div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button variant="danger" onClick={handleSubmit} disabled={submitting}>
          移出
        </Button>
      </div>
    </Modal>
  );
}
