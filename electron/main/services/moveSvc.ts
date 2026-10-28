// 文件物理移动与撤销服务
// 只做磁盘移动 + 更新索引路径，不读取文件内容
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { getDb } from '../db';
import type { MoveTargetInfo, MoveUndoInfo } from '@shared/types';

type Db = Database.Database;

/** 撤销窗口 10 分钟 */
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** 每个数据库实例独立的撤销栈，避免测试之间互相污染 */
const undoStores = new WeakMap<Db, Map<number, MoveUndoInfo>>();

function storeOf(db: Db): Map<number, MoveUndoInfo> {
  let store = undoStores.get(db);
  if (!store) {
    store = new Map();
    undoStores.set(db, store);
  }
  return store;
}

function prune(store: Map<number, MoveUndoInfo>): void {
  const now = Date.now();
  for (const [id, record] of store) {
    if (record.expiresAt <= now) store.delete(id);
  }
}

function isSamePath(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function getFilePathFrom(db: Db, id: number): string {
  const row = db.prepare('SELECT path FROM files WHERE id = ?').get(id) as
    | { path: string }
    | undefined;
  if (!row) throw new Error('文件不存在');
  return row.path;
}

/** 跨盘时 rename 会失败，回退为复制后删除源文件 */
function transfer(from: string, to: string): void {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

/** 校验目标路径是否可用，并返回规范化后的目标 */
export function resolveMoveTargetFrom(
  db: Db,
  id: number,
  targetDir: string,
): { source: string; targetDir: string; targetPath: string } {
  const source = getFilePathFrom(db, id);
  if (!fs.existsSync(source)) throw new Error('源文件已不在原路径');

  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    throw new Error('目标文件夹不存在');
  }
  if (isSamePath(path.dirname(source), resolvedDir)) {
    throw new Error('文件已在该文件夹中');
  }

  const targetPath = path.join(resolvedDir, path.basename(source));
  if (fs.existsSync(targetPath)) throw new Error('目标文件夹已存在同名文件');

  const occupied = db
    .prepare('SELECT id FROM files WHERE path = ? AND id != ?')
    .get(targetPath, id);
  if (occupied) throw new Error('目标路径已被其他已索引文件占用');

  return { source, targetDir: resolvedDir, targetPath };
}

/** 物理移动文件并更新索引路径 */
export function moveFileFrom(db: Db, id: number, targetDir: string): MoveTargetInfo {
  const { source, targetDir: resolvedDir, targetPath } = resolveMoveTargetFrom(
    db,
    id,
    targetDir,
  );

  transfer(source, targetPath);
  try {
    db.prepare('UPDATE files SET path = ? WHERE id = ?').run(targetPath, id);
  } catch (error) {
    // 数据库更新失败时把文件移回原位，避免磁盘与索引不一致
    transfer(targetPath, source);
    throw error;
  }

  const record: MoveUndoInfo = {
    fileId: id,
    from: source,
    to: targetPath,
    expiresAt: Date.now() + UNDO_WINDOW_MS,
  };
  storeOf(db).set(id, record);
  return { dir: resolvedDir, targetPath };
}

/** 查询当前文件是否处于可撤销状态 */
export function getMoveUndoFrom(db: Db, id: number): MoveUndoInfo | null {
  const store = storeOf(db);
  prune(store);
  return store.get(id) ?? null;
}

/** 撤销移动：把文件搬回原路径并恢复索引 */
export function undoMoveFrom(db: Db, id: number): MoveUndoInfo {
  const store = storeOf(db);
  prune(store);

  const record = store.get(id);
  if (!record) throw new Error('没有可撤销的移动记录（可能已超过 10 分钟）');

  if (!fs.existsSync(record.to)) throw new Error('文件已不在移动后的位置');
  if (fs.existsSync(record.from)) throw new Error('原路径已被占用，无法撤销');

  const occupied = db
    .prepare('SELECT id FROM files WHERE path = ? AND id != ?')
    .get(record.from, id);
  if (occupied) throw new Error('原路径已被其他已索引文件占用');

  transfer(record.to, record.from);
  try {
    db.prepare('UPDATE files SET path = ? WHERE id = ?').run(record.from, id);
  } catch (error) {
    transfer(record.from, record.to);
    throw error;
  }

  store.delete(id);
  return record;
}

// ---------- IPC 包装 ----------

export function moveFile(id: number, targetDir: string): MoveTargetInfo {
  return moveFileFrom(getDb(), id, targetDir);
}

export function getMoveUndo(id: number): MoveUndoInfo | null {
  return getMoveUndoFrom(getDb(), id);
}

export function undoMove(id: number): MoveUndoInfo {
  return undoMoveFrom(getDb(), id);
}
