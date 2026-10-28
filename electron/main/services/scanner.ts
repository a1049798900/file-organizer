// 扫描服务 — M1
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db';
import { getSetting, setSetting } from './settingsSvc';
import { getNamePinyin } from '../util/pinyin';
import type { ScanResult, ScanProgress } from '@shared/types';

let scanning = false;
let cancelled = false;

export function isScanning(): boolean {
  return scanning;
}

export function cancelScan(): void {
  cancelled = true;
}

/**
 * 扫描根目录，建立文件索引
 * @param onProgress 进度回调
 */
export async function startScan(
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  if (scanning) {
    throw new Error('已有扫描正在进行');
  }

  const root = getSetting('scan_root');
  if (!root) {
    throw new Error('未设置扫描根目录');
  }

  if (!fs.existsSync(root)) {
    throw new Error('根目录不存在');
  }

  try {
    fs.accessSync(root, fs.constants.R_OK);
  } catch {
    throw new Error('根目录无读取权限');
  }

  scanning = true;
  cancelled = false;

  const lastScanAt = Number(getSetting('last_scan_at') || '0');
  const db = getDb();

  // 已索引文件的状态快照：新文件一律进入收件箱，已有文件保留原有状态
  const existingRows = db
    .prepare('SELECT path, status FROM files')
    .all() as Array<{ path: string; status: 'inbox' | 'filed' }>;
  const existingStatus = new Map(existingRows.map((r) => [r.path, r.status]));

  let scanned = 0;
  let added = 0;
  let skipped = 0;
  let totalFiles = 0;

  // 先估算总文件数（快速遍历）
  try {
    totalFiles = await countFiles(root);
  } catch {
    totalFiles = 0;
  }

  const insertOrUpdate = db.prepare(`
    INSERT INTO files (name, alias, path, size, ext, mtime, status, in_knowledge, pinyin, created_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size,
      mtime = excluded.mtime,
      status = excluded.status
  `);

  const transaction = db.transaction((batch: Array<{
    name: string;
    path: string;
    size: number;
    ext: string;
    mtime: number;
    pinyin: string;
    status: 'inbox' | 'filed';
    isNew: boolean;
    createdAt: number;
  }>) => {
    for (const f of batch) {
      insertOrUpdate.run(
        f.name,
        f.path,
        f.size,
        f.ext,
        f.mtime,
        f.status,
        f.pinyin,
        f.createdAt,
      );
      if (f.isNew) {
        added++;
      }
    }
  });

  const now = Date.now();
  const batch: Array<{
    name: string;
    path: string;
    size: number;
    ext: string;
    mtime: number;
    pinyin: string;
    status: 'inbox' | 'filed';
    isNew: boolean;
    createdAt: number;
  }> = [];
  const BATCH_SIZE = 100;

  try {
    await walkDir(root, (filePath, stats) => {
      if (cancelled) return false; // 停止遍历

      scanned++;

      const name = path.basename(filePath);
      const ext = path.extname(name).slice(1).toLowerCase();

      const prevStatus = existingStatus.get(filePath);
      const isNew = prevStatus === undefined;
      // 新文件、上次扫描后修改过的文件、仍在收件箱中的文件 → inbox；其余保持已处理
      const isModified = lastScanAt > 0 && stats.mtimeMs > lastScanAt;
      const status: 'inbox' | 'filed' =
        isNew || isModified || prevStatus === 'inbox' ? 'inbox' : 'filed';

      const pinyin = getNamePinyin(name, null);

      batch.push({
        name,
        path: filePath,
        size: stats.size,
        ext: ext || 'none',
        mtime: Math.round(stats.mtimeMs),
        pinyin,
        status,
        isNew,
        createdAt: now,
      });

      if (batch.length >= BATCH_SIZE) {
        transaction(batch);
        batch.length = 0;
      }

      if (onProgress && scanned % 10 === 0) {
        onProgress({
          currentPath: filePath,
          processed: scanned,
          total: totalFiles,
        });
      }

      return true; // 继续遍历
    });

    // 处理剩余
    if (batch.length > 0 && !cancelled) {
      transaction(batch);
      batch.length = 0;
    }
  } catch (e) {
    scanning = false;
    throw e;
  }

  // 记录扫描完成时间
  if (!cancelled) {
    setSetting('last_scan_at', String(Date.now()));
  }

  scanning = false;

  return {
    scanned,
    added,
    skipped,
  };
}

/**
 * 递归统计文件总数（用于进度估算）
 */
async function countFiles(dir: string): Promise<number> {
  let count = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 跳过隐藏目录和系统目录
        if (entry.name.startsWith('.') || entry.name === '$RECYCLE.BIN' || entry.name === 'System Volume Information') {
          continue;
        }
        try {
          count += await countFiles(fullPath);
        } catch {
          // 无权限的目录跳过
        }
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch {
    // 无权限
  }

  return count;
}

/**
 * 递归遍历目录
 * @param callback 返回 false 可中止遍历
 */
async function walkDir(
  dir: string,
  callback: (filePath: string, stats: fs.Stats) => boolean,
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // 无权限，跳过
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // 跳过隐藏文件/目录
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      // 跳过系统目录
      if (entry.name === '$RECYCLE.BIN' || entry.name === 'System Volume Information') continue;
      await walkDir(fullPath, callback);
      if (cancelled) return;
    } else if (entry.isFile()) {
      let stats: fs.Stats;
      try {
        stats = fs.statSync(fullPath);
      } catch {
        continue;
      }
      const cont = callback(fullPath, stats);
      if (!cont) return;
    }
  }
}
