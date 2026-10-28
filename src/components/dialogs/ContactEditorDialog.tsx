import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { contactApi } from '@/lib/ipc';
import { useUiStore } from '@/stores/useUiStore';
import type { ContactInput, ContactRow } from '@shared/types';

interface ContactEditorDialogProps {
  contact?: ContactRow | null;
  onClose: () => void;
  onSaved: (contact: ContactRow) => void;
}

interface FormState {
  name: string;
  org: string;
  department: string;
  title: string;
  phone: string;
  email: string;
  note: string;
}

function toForm(contact?: ContactRow | null): FormState {
  return {
    name: contact?.name ?? '',
    org: contact?.org ?? '',
    department: contact?.department ?? '',
    title: contact?.title ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    note: contact?.note ?? '',
  };
}

const fieldLabels: { key: keyof Omit<FormState, 'note'>; label: string; placeholder: string }[] = [
  { key: 'org', label: '单位', placeholder: '所在单位' },
  { key: 'department', label: '部门', placeholder: '所在部门' },
  { key: 'title', label: '职务', placeholder: '职务 / 角色' },
  { key: 'phone', label: '电话', placeholder: '联系电话' },
  { key: 'email', label: '邮箱', placeholder: '电子邮箱' },
];

export function ContactEditorDialog({ contact, onClose, onSaved }: ContactEditorDialogProps) {
  const [form, setForm] = useState<FormState>(() => toForm(contact));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useUiStore((s) => s.showToast);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('姓名为必填项');
      return;
    }

    const input: ContactInput = {
      name,
      org: form.org,
      department: form.department,
      title: form.title,
      phone: form.phone,
      email: form.email,
      note: form.note,
    };

    setSubmitting(true);
    setError('');
    try {
      const saved = contact
        ? await contactApi.update(contact.id, input)
        : await contactApi.create(input);
      onSaved(saved);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存联系人失败';
      setError(message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
      showToast('保存联系人失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={contact ? '编辑联系人' : '新增联系人'} width={520}>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-sm text-ink-2 mb-1">
            姓名 <span className="text-danger">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="联系人姓名"
            maxLength={50}
            className="w-full h-8 px-3 border border-line rounded-md text-base outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {fieldLabels.slice(0, 4).map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-ink-2 mb-1">{field.label}</label>
              <input
                type="text"
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full h-8 px-3 border border-line rounded-md text-base outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm text-ink-2 mb-1">邮箱</label>
          <input
            type="text"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="电子邮箱"
            className="w-full h-8 px-3 border border-line rounded-md text-base outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-ink-2 mb-1">备注</label>
          <textarea
            value={form.note}
            onChange={(e) => setField('note', e.target.value)}
            placeholder="补充说明"
            rows={3}
            maxLength={1000}
            className="w-full px-3 py-2 border border-line rounded-md text-base outline-none focus:border-accent resize-none"
          />
        </div>

        {error && <div className="text-sm text-danger">{error}</div>}
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-line">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {contact ? '保存' : '创建'}
        </Button>
      </div>
    </Modal>
  );
}
