// Excel / CSV 预览 — xlsx 只读转表格，限制行列数量
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import type { FileRow } from '@shared/types';
import { fileApi } from '@/lib/ipc';
import { cn } from '@/lib/cn';
import { PreviewErrorState, PreviewSkeleton } from './PreviewStatus';

const MAX_ROWS = 200;
const MAX_COLS = 30;

interface XlsxPreviewProps {
  file: FileRow;
}

export function XlsxPreview({ file }: XlsxPreviewProps) {
  const [book, setBook] = useState<WorkBook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBook(null);
    setSheetName('');
    setError(false);

    (async () => {
      try {
        const bytes = await fileApi.readBytes(file.id);
        if (cancelled) return;
        const workbook = XLSX.read(bytes, { type: 'array' });
        if (cancelled) return;
        setBook(workbook);
        setSheetName(workbook.SheetNames[0] ?? '');
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file.id]);

  const { matrix, totalRows, totalCols } = useMemo(() => {
    if (!book || !sheetName) {
      return { matrix: [] as string[][], totalRows: 0, totalCols: 0 };
    }
    const sheet = book.Sheets[sheetName];
    if (!sheet) {
      return { matrix: [] as string[][], totalRows: 0, totalCols: 0 };
    }

    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    const rows = raw.slice(0, MAX_ROWS);
    const totalCols = rows.reduce((max, row) => Math.max(max, row.length), 0);

    return {
      matrix: rows.map((row) =>
        row.slice(0, MAX_COLS).map((cell) => (cell == null ? '' : String(cell))),
      ),
      totalRows: raw.length,
      totalCols,
    };
  }, [book, sheetName]);

  if (error) {
    return <PreviewErrorState fileId={file.id} />;
  }

  if (!book) {
    return <PreviewSkeleton />;
  }

  const truncated = totalRows > MAX_ROWS || totalCols > MAX_COLS;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 min-h-0 overflow-auto">
        {matrix.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-3">
            空工作表
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <tbody>
              {matrix.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={cn(
                        'max-w-[220px] border border-line px-1.5 py-1 align-top break-words whitespace-pre-wrap',
                        rowIndex === 0
                          ? 'sticky top-0 z-10 bg-bg-panel font-medium text-ink'
                          : 'text-ink-2',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex h-9 flex-shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-white px-2">
        {book.SheetNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSheetName(name)}
            className={cn(
              'flex-shrink-0 rounded px-2 py-0.5 text-xs transition-colors',
              name === sheetName
                ? 'bg-accent-weak text-accent'
                : 'text-ink-2 hover:bg-bg-hover hover:text-ink',
            )}
          >
            {name}
          </button>
        ))}
        {truncated && (
          <span className="ml-auto flex-shrink-0 pr-1 text-[11px] text-ink-3">
            仅显示前 {MAX_ROWS} 行 / {MAX_COLS} 列
          </span>
        )}
      </div>
    </div>
  );
}
