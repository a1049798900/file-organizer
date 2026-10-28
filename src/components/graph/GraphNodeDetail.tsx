// 图谱右侧节点详情抽屉
// 复用现有详情组件：文件 → PreviewPane，联系人 → ContactDetailCard；
// 项目 / 领域 / 专题使用只读摘要，避免重复造一套编辑表单。
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { GraphNode } from '@shared/graph';
import type { ContactDetail } from '@shared/types';
import { useDataStore } from '@/stores/useDataStore';
import { calendarApi, contactApi } from '@/lib/ipc';
import { formatShortDate } from '@/lib/format';
import { PreviewPane } from '../layout/PreviewPane';
import { ContactDetailCard } from '../contacts/ContactDetailCard';
import { IconButton } from '../ui/IconButton';
import { Skeleton } from '../ui/Skeleton';

export interface GraphNodeDetailProps {
  node: GraphNode;
  onClose: () => void;
  /** 在图谱内把某个节点设为新焦点 */
  onFocusNode: (node: GraphNode) => void;
  /** 联系人卡内点击项目 → 图谱内切换焦点 */
  onOpenProject: (projectId: number, label: string) => void;
}

function DrawerShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-12 flex items-center gap-2 px-4 border-b border-line flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink truncate">{title}</div>
          {subtitle && <div className="text-xs text-ink-3 truncate">{subtitle}</div>}
        </div>
        <IconButton size={28} onClick={onClose} aria-label="关闭详情">
          <X size={16} />
        </IconButton>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-base">
      <span className="w-16 shrink-0 text-ink-3">{label}</span>
      <span className="text-ink break-words">{value}</span>
    </div>
  );
}

function ReadOnlyNote() {
  return (
    <p className="text-xs text-ink-3 leading-relaxed">
      图谱为只读视图，仅使用元数据与关联关系，不读取文件内容，也不会修改任何数据。
    </p>
  );
}

function ProjectSummary({ node }: { node: GraphNode }) {
  const projects = useDataStore((s) => s.projects);
  const project = projects.find((item) => item.id === node.entityId);
  const status = node.meta?.status ?? project?.status;
  const fileCount = node.meta?.fileCount ?? project?.fileCount ?? 0;

  return (
    <div className="p-5 space-y-3">
      <InfoRow label="类型" value="项目" />
      <InfoRow label="状态" value={status === 'done' ? '已完成' : '进行中'} />
      <InfoRow label="相关文件" value={`${fileCount} 个`} />
      {project && <InfoRow label="更新时间" value={formatShortDate(project.updatedAt)} />}
      <div className="pt-2">
        <ReadOnlyNote />
      </div>
    </div>
  );
}

function TopicSummary({ node }: { node: GraphNode }) {
  const topics = useDataStore((s) => s.topics);
  const topic = topics.find((item) => item.id === node.entityId);
  const fileCount = node.meta?.fileCount ?? topic?.fileCount ?? 0;

  return (
    <div className="p-5 space-y-3">
      <InfoRow label="类型" value="资料库专题" />
      <InfoRow label="相关文件" value={`${fileCount} 个`} />
      <div className="pt-2">
        <ReadOnlyNote />
      </div>
    </div>
  );
}

function AreaSummary({ node }: { node: GraphNode }) {
  const [counts, setCounts] = useState<{ tasks: number; meetings: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    calendarApi
      .getAreaDetail(node.entityId)
      .then((detail) => {
        if (cancelled) return;
        setCounts({ tasks: detail.tasks.length, meetings: detail.meetings.length });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.entityId]);

  return (
    <div className="p-5 space-y-3">
      <InfoRow label="类型" value="领域" />
      {loading ? (
        <Skeleton className="h-4 w-32" />
      ) : failed ? (
        <div className="text-sm text-ink-3">领域统计加载失败</div>
      ) : (
        <>
          <InfoRow label="任务" value={`${counts?.tasks ?? 0} 项`} />
          <InfoRow label="会议" value={`${counts?.meetings ?? 0} 项`} />
        </>
      )}
      <div className="pt-2">
        <ReadOnlyNote />
      </div>
    </div>
  );
}

function ContactSummary({
  node,
  onClose,
  onFocusNode,
  onOpenProject,
}: {
  node: GraphNode;
  onClose: () => void;
  onFocusNode: (node: GraphNode) => void;
  onOpenProject: (projectId: number, label: string) => void;
}) {
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    contactApi
      .getDetail(node.entityId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.entityId, reloadToken]);

  if (loading && !detail) {
    return (
      <DrawerShell title={node.label} subtitle={node.subtitle} onClose={onClose}>
        <div className="p-4 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </DrawerShell>
    );
  }

  if (!detail) {
    return (
      <DrawerShell title={node.label} subtitle={node.subtitle} onClose={onClose}>
        <div className="h-full flex items-center justify-center text-sm text-ink-3">
          联系人不存在或已被删除
        </div>
      </DrawerShell>
    );
  }

  return (
    <ContactDetailCard
      detail={detail}
      readOnly
      onRefresh={() => {
        setReloadToken((token) => token + 1);
      }}
      onSelectProject={(projectId) => {
        const project = detail.projects.find((item) => item.id === projectId);
        onOpenProject(projectId, project?.name ?? '项目');
      }}
      onClose={onClose}
      onViewGraph={() => onFocusNode(node)}
    />
  );
}

export function GraphNodeDetail({ node, onClose, onFocusNode, onOpenProject }: GraphNodeDetailProps) {
  switch (node.type) {
    case 'file':
      return (
        <PreviewPane
          embedded
          readOnly
          fileId={node.entityId}
          onClose={onClose}
          onViewGraph={() => onFocusNode(node)}
        />
      );
    case 'contact':
      return (
        <ContactSummary
          node={node}
          onClose={onClose}
          onFocusNode={onFocusNode}
          onOpenProject={onOpenProject}
        />
      );
    case 'project':
      return (
        <DrawerShell title={node.label} subtitle="项目" onClose={onClose}>
          <ProjectSummary node={node} />
        </DrawerShell>
      );
    case 'area':
      return (
        <DrawerShell title={node.label} subtitle="领域" onClose={onClose}>
          <AreaSummary node={node} />
        </DrawerShell>
      );
    case 'topic':
      return (
        <DrawerShell title={node.label} subtitle="资料库专题" onClose={onClose}>
          <TopicSummary node={node} />
        </DrawerShell>
      );
    default:
      return null;
  }
}
