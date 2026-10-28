import Database from 'better-sqlite3';
import { getDbPath } from '../db-path';
import { migrate } from './migrate';

let db: Database.Database | null = null;

/**
 * 获取数据库单例
 * 首次调用时打开数据库并执行迁移
 */
export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    migrate(db);
  }
  return db;
}

/**
 * 关闭数据库（应用退出时调用）
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
