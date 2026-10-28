import type Database from 'better-sqlite3';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

/**
 * 初始化数据库：执行建表 SQL、管理 schema_version
 */
export function migrate(db: Database.Database): void {
  // 开启 WAL 模式（必须在任何操作前设置）
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 旧库补列必须先于 SCHEMA_SQL 执行：
  // SCHEMA_SQL 中的 CREATE INDEX 会引用这些新列（如 idx_tasks_contact_id），
  // 若先 exec 建表脚本，旧库因缺列而在建索引时报 “no such column”。
  // 新库的表尚不存在，ensureColumn 会跳过，由 SCHEMA_SQL 建表时自带新列。
  ensureColumn(db, 'project_contacts', 'role', 'TEXT NULL');
  ensureColumn(db, 'tasks', 'contact_id', 'INTEGER NULL REFERENCES contacts(id) ON DELETE SET NULL');
  ensureColumn(
    db,
    'project_meetings',
    'contact_id',
    'INTEGER NULL REFERENCES contacts(id) ON DELETE SET NULL',
  );

  // 执行建表 SQL
  db.exec(SCHEMA_SQL);

  // 写入/更新 schema_version
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('schema_version') as
    | { value: string }
    | undefined;

  if (!row) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'schema_version',
      SCHEMA_VERSION,
    );
    // 初始化 last_scan_at
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
      'last_scan_at',
      '0',
    );
  } else if (row.value !== SCHEMA_VERSION) {
    // 未来版本迁移入口
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(
      SCHEMA_VERSION,
      'schema_version',
    );
  }

  backfillInbox(db);

  // 初始迁移：给新 web_shortcuts 表插入默认 DeepSeek 快捷方式（幂等）
  seedDefaultWebShortcut(db);
}

/**
 * 幂等插入默认 DeepSeek 快捷方式（首次运行时插入；旧库升级也会补）
 */
function seedDefaultWebShortcut(db: Database.Database): void {
  const DEFAULT_URL = 'https://chat.deepseek.com';
  const existing = db
    .prepare('SELECT id FROM web_shortcuts WHERE url = ?')
    .get(DEFAULT_URL);
  if (existing) return;

  const now = Date.now();
  db.prepare(
    'INSERT INTO web_shortcuts (name, url, sort_order, created_at) VALUES (?, ?, ?, ?)',
  ).run('DeepSeek 对话', DEFAULT_URL, 0, now);
}

/**
 * 幂等补列：表或列不存在时不做任何修改
 * （表不存在说明是新库，SCHEMA_SQL 建表时会自带新列）
 */
function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  if (!tableExists) return;

  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * 一次性修复历史数据：
 * 旧版本首次扫描会把全部文件直接写成 filed，导致收件箱始终为空。
 * 将尚未归入项目/知识库的 filed 文件放回收件箱，便于用户重新分拣。
 */
function backfillInbox(db: Database.Database): void {
  const done = db.prepare('SELECT value FROM settings WHERE key = ?').get('inbox_backfill_v1');
  if (done) return;

  db.prepare(`
    UPDATE files SET status = 'inbox'
    WHERE status = 'filed'
      AND in_knowledge = 0
      AND id NOT IN (SELECT file_id FROM project_files)
  `).run();

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'inbox_backfill_v1',
    String(Date.now()),
  );
}
