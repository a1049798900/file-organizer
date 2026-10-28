// 设置服务 — M9
import { getDb } from '../db';
import { getDbPath } from '../db-path';
import { app, dialog } from 'electron';
import fs from 'node:fs';

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  );
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function pickRoot(): string | null {
  const result = dialog.showOpenDialogSync({
    properties: ['openDirectory'],
    title: '选择扫描根目录',
  });
  if (!result || result.length === 0) return null;

  const dir = result[0];
  // 验证目录存在且可读
  try {
    fs.accessSync(dir, fs.constants.R_OK);
    return dir;
  } catch {
    return null;
  }
}

export function getDatabasePath(): string {
  return getDbPath();
}

export function getAppVersion(): string {
  return app.getVersion();
}
