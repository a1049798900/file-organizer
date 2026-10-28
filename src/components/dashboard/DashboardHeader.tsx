// 页头：问候语 + 今日日期 + 快捷操作
import { PenLine, Plus } from 'lucide-react';
import { useUiStore } from '@/stores/useUiStore';

interface DashboardHeaderProps {
  taskCount: number;
  meetingCount: number;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function greetingByHour(hour: number): string {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 13) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function DashboardHeader({ taskCount, meetingCount }: DashboardHeaderProps) {
  const openModal = useUiStore((s) => s.openModal);
  const showToast = useUiStore((s) => s.showToast);

  const now = new Date();
  const dateText = `今天是 ${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`;

  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {greetingByHour(now.getHours())}，欢迎回来 👋
        </h1>
        <p className="text-sm text-gray-500">
          {dateText}，你有 {taskCount} 项待办和 {meetingCount} 个日程需要关注。
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => showToast('快速笔记功能即将上线')}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 shadow-sm transition-colors flex items-center gap-2"
        >
          <PenLine size={16} />
          快速笔记
        </button>
        <button
          onClick={() => openModal({ type: 'new-project' })}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          新建项目
        </button>
      </div>
    </div>
  );
}
