// 预览面板信息区 — 基础信息 + 关联数据
import type { FileAssociations, FileRow, TagRef } from '@shared/types';
import { formatMtime, formatSize } from '@/lib/format';
import { useUiStore } from '@/stores/useUiStore';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium tracking-wide text-ink-3">{children}</div>;
}

function EmptyChip({ text }: { text: string }) {
  return <span className="text-xs text-ink-3">{text}</span>;
}

interface ChipProps {
  label: string;
  onClick?: () => void;
}

function Chip({ label, onClick }: ChipProps) {
  if (!onClick) {
    return (
      <span className="inline-block rounded bg-bg-panel px-1.5 py-0.5 text-xs text-ink-2">
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-block rounded bg-bg-panel px-1.5 py-0.5 text-xs text-ink-2 transition-colors hover:bg-bg-hover hover:text-ink"
    >
      {label}
    </button>
  );
}

function ChipRow({ items, emptyText }: { items: TagRef[]; emptyText: string }) {
  if (items.length === 0) return <EmptyChip text={emptyText} />;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Chip key={item.id} label={item.name} />
      ))}
    </div>
  );
}

interface PreviewInfoProps {
  file: FileRow;
  associations: FileAssociations;
}

export function PreviewInfo({ file, associations }: PreviewInfoProps) {
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const setKbSelected = useUiStore((s) => s.setKbSelected);

  const openProject = (projectId: number) => {
    setActiveProjectId(projectId);
    setActiveView('project-detail');
  };

  const openTopic = (topicId: number) => {
    setKbSelected({ kind: 'topic', id: topicId });
    setActiveView('kb');
  };

  return (
    <div className="space-y-4 px-4 py-3">
      <section>
        <SectionTitle>基础信息</SectionTitle>
        <dl className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-1 text-sm">
          <dt className="text-ink-3">文件名</dt>
          <dd className="min-w-0 text-ink">
            <div className="truncate" title={file.name}>
              {file.alias || file.name}
            </div>
            {file.alias && (
              <div className="truncate text-xs text-ink-3" title={file.name}>
                {file.name}
              </div>
            )}
          </dd>

          <dt className="text-ink-3">大小</dt>
          <dd className="text-ink-2">{formatSize(file.size)}</dd>

          <dt className="text-ink-3">类型</dt>
          <dd className="text-ink-2">{(file.ext || 'none').toUpperCase()}</dd>

          <dt className="text-ink-3">修改时间</dt>
          <dd className="text-ink-2">{formatMtime(file.mtime)}</dd>

          <dt className="text-ink-3">路径</dt>
          <dd className="select-text break-all text-xs leading-relaxed text-ink-2">
            {file.path}
          </dd>
        </dl>
      </section>

      <section>
        <SectionTitle>关联数据</SectionTitle>
        <div className="space-y-2">
          <div>
            <div className="mb-1 text-[11px] text-ink-3">标签</div>
            <ChipRow items={associations.tags} emptyText="暂无标签" />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-3">专题</div>
            {associations.topics.length === 0 ? (
              <EmptyChip text="暂无专题" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {associations.topics.map((topic) => (
                  <Chip key={topic.id} label={topic.name} onClick={() => openTopic(topic.id)} />
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-3">项目</div>
            {associations.projects.length === 0 ? (
              <EmptyChip text="暂无项目" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {associations.projects.map((project) => (
                  <Chip
                    key={project.id}
                    label={project.name}
                    onClick={() => openProject(project.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
