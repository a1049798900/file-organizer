// Word 预览 — mammoth 只读转换为 HTML，不提取正文存储
import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import type { FileRow } from '@shared/types';
import { fileApi } from '@/lib/ipc';
import { PreviewErrorState, PreviewSkeleton } from './PreviewStatus';

const BLOCKED_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'form',
  'input',
  'button',
  'textarea',
  'select',
];

/** 轻量白名单清洗，移除脚本与事件属性 */
function sanitizeHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll(BLOCKED_TAGS.join(',')).forEach((el) => el.remove());

  parsed.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href' && !/^(https?:|mailto:|#)/i.test(value)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'src' || name === 'xlink:href') && !/^data:image\//i.test(value)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return parsed.body.innerHTML;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

interface DocxPreviewProps {
  file: FileRow;
}

export function DocxPreview({ file }: DocxPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(false);

    (async () => {
      try {
        const bytes = await fileApi.readBytes(file.id);
        if (cancelled) return;
        const result = await mammoth.convertToHtml({ arrayBuffer: toArrayBuffer(bytes) });
        if (cancelled) return;
        setHtml(sanitizeHtml(result.value));
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file.id]);

  if (error) {
    return <PreviewErrorState fileId={file.id} />;
  }

  if (html == null) {
    return <PreviewSkeleton />;
  }

  return (
    <div className="h-full overflow-auto bg-white px-4 py-3">
      <div
        className="docx-body text-sm leading-relaxed text-ink-2 [&_a]:text-accent [&_a]:underline [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink [&_img]:max-w-full [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:bg-bg-panel [&_th]:px-2 [&_th]:py-1 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
