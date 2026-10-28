import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { projectApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const refreshProjects = useDataStore((s) => s.refreshProjects);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError('项目名不能超过 50 字');
      return;
    }

    setSubmitting(true);
    try {
      await projectApi.create(trimmed);
      await refreshProjects();
      onClose();
      setName('');
      setError('');
    } catch (e) {
      if (e instanceof Error && e.message.includes('同名')) {
        setError('已有同名项目');
      } else {
        setError('创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="新建项目" width={400}>
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
          placeholder="输入项目名称（1-50 字）"
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
          disabled={!name.trim() || submitting}
        >
          创建
        </Button>
      </div>
    </Modal>
  );
}
