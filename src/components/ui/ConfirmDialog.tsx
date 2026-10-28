import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} width={400} hideClose>
      <div className="p-5">
        <div className="text-lg font-semibold text-ink mb-2">{title}</div>
        <div className="text-sm text-ink-2 leading-relaxed whitespace-pre-line break-all">{message}</div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <Button variant="secondary" onClick={onClose}>
          {cancelText}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
