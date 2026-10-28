import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { kbApi, fileApi } from '@/lib/ipc';
import { useDataStore } from '@/stores/useDataStore';
import { useUiStore } from '@/stores/useUiStore';

interface SaveToKbDialogProps {
  fileIds: number[];
  onClose: () => void;
}

export function SaveToKbDialog({ fileIds, onClose }: SaveToKbDialogProps) {
  const topics = useDataStore((s) => s.topics);
  const refreshTopics = useDataStore((s) => s.refreshTopics);
  const refreshKbCounts = useDataStore((s) => s.refreshKbCounts);
  const refreshInboxCount = useDataStore((s) => s.refreshInboxCount);
  const showToast = useUiStore((s) => s.showToast);

  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [moveOutOfInbox, setMoveOutOfInbox] = useState(true);
  const [newTopicName, setNewTopicName] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasInboxFile, setHasInboxFile] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(true);

  // 检查是否有文件在收件箱中
  useEffect(() => {
    let cancelled = false;
    setCheckingInbox(true);

    async function check() {
      // 取第一个文件判断状态
      if (fileIds.length === 0) {
        if (!cancelled) setHasInboxFile(false);
        return;
      }
      try {
        const file = await fileApi.get(fileIds[0]);
        if (!cancelled) {
          setHasInboxFile(file?.status === 'inbox');
        }
      } catch {
        if (!cancelled) setHasInboxFile(false);
      } finally {
        if (!cancelled) setCheckingInbox(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [fileIds]);

  const toggleTopic = (topicId: number) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
  };

  const handleCreateTopic = async () => {
    const name = newTopicName.trim();
    if (!name) return;
    try {
      const topic = await kbApi.createTopic(name);
      setSelectedTopics((prev) => [...prev, topic.id]);
      setNewTopicName('');
      setShowNewTopic(false);
      await refreshTopics();
    } catch (e) {
      showToast('创建专题失败', 'error');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await kbApi.addToKnowledge(fileIds, selectedTopics, moveOutOfInbox);
      await refreshTopics();
      await refreshKbCounts();
      if (moveOutOfInbox) {
        await refreshInboxCount();
      }
      onClose();
    } catch (e) {
      showToast('存入资料库失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const showMoveOption = !checkingInbox && hasInboxFile;

  return (
    <Modal open onClose={onClose} title="存入资料库" width={480}>
      <div className="p-4">
        <div className="text-sm text-ink-2 mb-2">选择专题（可多选，可跳过）</div>
        <div className="text-[11px] text-ink-3 mb-3 leading-4">
          存入资料库 = 这事处理完了。专题是资料的合集，一个文件可以属于多个专题。
        </div>

        {/* 专题列表 */}
        <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-auto">
          {topics.length === 0 && (
            <div className="text-sm text-ink-3 w-full">暂无专题，存入后归入「未分类」</div>
          )}
          {topics.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line hover:bg-bg-hover cursor-pointer text-sm"
            >
              <Checkbox
                checked={selectedTopics.includes(t.id)}
                onChange={() => toggleTopic(t.id)}
              />
              <span>{t.name}</span>
            </label>
          ))}
        </div>

        {/* 新建专题 */}
        {showNewTopic ? (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
              placeholder="专题名称（1-30 字）"
              autoFocus
              className="flex-1 h-8 px-2 border border-line rounded-md text-sm outline-none focus:border-accent"
            />
            <Button size="sm" variant="secondary" onClick={handleCreateTopic}>
              创建
            </Button>
          </div>
        ) : (
          <button
            className="text-sm text-accent hover:underline mb-3"
            onClick={() => setShowNewTopic(true)}
          >
            + 新建专题…
          </button>
        )}

        {/* 移出收件箱选项 — 仅当有文件在收件箱时显示 */}
        {showMoveOption && (
          <label className="flex items-center gap-2 text-sm text-ink pt-3 border-t border-line">
            <Checkbox checked={moveOutOfInbox} onChange={(e) => setMoveOutOfInbox(e.target.checked)} />
            存入后从收件箱移除
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2 px-4 pb-4">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          存入
        </Button>
      </div>
    </Modal>
  );
}
