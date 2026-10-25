// weave-asset:// 自定义协议
// 用于预览时安全加载本地文件，不暴露真实路径
import { protocol, type ProtocolRequest } from 'electron';
import fs from 'node:fs/promises';
import { getFile } from '../services/fileSvc';

/**
 * 在 app ready 之前注册特权 scheme。
 * 必须在 app.whenReady() 之前调用，否则不生效。
 */
export function registerAssetSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'weave-asset',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: false,
      },
    },
  ]);
}

const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100 MB

function mimeOf(ext: string): string {
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

export function registerAssetProtocol(): void {
  protocol.handle('weave-asset', async (request: ProtocolRequest) => {
    try {
      const url = new URL(request.url);
      // 路径格式：weave-asset://file/<id>
      const match = url.pathname.match(/^\/file\/(\d+)/);
      if (!match) {
        return new Response('invalid path', { status: 400 });
      }

      const id = Number(match[1]);
      const file = getFile(id);

      if (!file) {
        return new Response('not found', { status: 404 });
      }

      if (file.pathMissing) {
        return new Response('path missing', { status: 410 });
      }

      if (file.size > MAX_PREVIEW_SIZE) {
        return new Response('too large', { status: 413 });
      }

      const buf = await fs.readFile(file.path);
      return new Response(buf, {
        headers: {
          'Content-Type': mimeOf(file.ext),
          'Content-Length': String(file.size),
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      console.error('[weave-asset] error:', e);
      return new Response('internal error', { status: 500 });
    }
  });
}
