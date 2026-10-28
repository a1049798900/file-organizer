import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { projectApi, kbApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';

interface RenameDialogProps {
  open: boolean;
  target: 'project' | 'topic';
  id: number;
  initialName: string;
  onClose: () => void;
}

export function RenameDialog({ open, target, id, initialName, onClose }: RenameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const refreshProjects = useDataStore((s) => s.refreshProjects);
  const refreshTopics = useDataStore((s) => s.refreshTopics);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError('');
    }
  }, [open, initialName]);

  const maxLen = target === 'project' ? 50 : 30;
  const duplicateMsg = target === 'project' ? '已有同名项目' : '已有同名专题';

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      onClose();
      return;
    }
    if (trimmed.length > maxLen) {
      setError(`名称不能超过 ${maxLen} 字`);
      return;
    }

    try {
      if (target === 'project') {
        await projectApi.rename(id, trimmed);
        await refreshProjects();
      } else {
        await kbApi.renameTopic(id, trimmed);
        await refreshTopics();
      }
      onClose();
    } catch (e) {
      if (e instanceof Error && e.message.includes('同名')) {
        setError(duplicateMsg);
      } else {
        setError('重命名失败');
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`重命名${target === 'project' ? '项目' : '专题'}`} width={400}>
      <div className="p-4">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          autoFocus
          className="w-full h-9 px-3 border border-line rounded-md text-base outline-none focus:border-accent"
        />
        {error && <div className="text-danger text-xs mt-2">{error}</div>}
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!name.trim() || name.trim() === initialName}
        >
          确定
        </Button>
      </div>
    </Modal>
  );
}
