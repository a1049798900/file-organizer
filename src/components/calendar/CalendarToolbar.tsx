// 日历工具条 — 今天、前后翻页、范围标题、新建入口、月/周/日切换
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { cn } from '@/lib/cn';
import { formatRangeLabel, type CalendarViewMode } from '@/lib/date';

const modes: { key: CalendarViewMode; label: string }[] = [
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' },
];

interface CalendarToolbarProps {
  mode: CalendarViewMode;
  anchor: Date;
  onModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreate: () => void;
}

export function CalendarToolbar({
  mode,
  anchor,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  onCreate,
}: CalendarToolbarProps) {
  const rangeLabel = formatRangeLabel(mode, anchor);
  const stepLabel = mode === 'month' ? '月' : mode === 'week' ? '周' : '日';

  return (
    <div className="h-14 flex items-center justify-between gap-3 px-4 border-b border-line flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-xl font-semibold text-ink flex-shrink-0">日历</div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={onToday} title="回到今天 (T)">
            今天
          </Button>
          <IconButton
            size={28}
            onClick={onPrev}
            aria-label={`上一${stepLabel}`}
            title={`上一${stepLabel} (←)`}
          >
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            size={28}
            onClick={onNext}
            aria-label={`下一${stepLabel}`}
            title={`下一${stepLabel} (→)`}
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>

        <div
          className="text-md font-medium text-ink truncate"
          aria-live="polite"
          title={rangeLabel}
        >
          {rangeLabel}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="primary" size="sm" onClick={onCreate} title="新建日程">
          <Plus size={14} className="mr-1" />
          新建日程
        </Button>

        <div
          className="flex items-center gap-0.5 p-0.5 bg-bg-panel rounded-md"
          role="group"
          aria-label="日历视图切换"
        >
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onModeChange(item.key)}
              aria-pressed={mode === item.key}
              title={`${item.label}视图 (${item.key.charAt(0).toUpperCase()})`}
              className={cn(
                'h-7 px-3 text-sm rounded transition-colors',
                mode === item.key
                  ? 'bg-white text-ink font-medium shadow-sm'
                  : 'text-ink-2 hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
