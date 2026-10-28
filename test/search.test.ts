// 全局搜索回归测试：中文子串匹配、拼音首字母、标签搜索
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/db/migrate';
import { listFilesFrom } from '../electron/main/services/fileSvc';
import { getNamePinyin } from '../electron/main/util/pinyin';

function insertFile(
  db: Database.Database,
  name: string,
  opts: { alias?: string; pinyin?: string } = {},
): number {
  const pinyin = opts.pinyin ?? getNamePinyin(name, opts.alias ?? null);
  const info = db
    .prepare(
      'INSERT INTO files (name, alias, path, size, ext, mtime, status, in_knowledge, pinyin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(name, opts.alias ?? null, `/x/${name}`, 16, 'xlsx', 1000, 'filed', 0, pinyin, 1000);
  return Number(info.lastInsertRowid);
}

function addTag(db: Database.Database, fileId: number, tagName: string): void {
  db.prepare('INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)').run(tagName, 1000);
  const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: number };
  db.prepare('INSERT OR IGNORE INTO tag_links (tag_id, file_id) VALUES (?, ?)').run(
    tag.id,
    fileId,
  );
}

const SORT = { key: 'mtime' as const, dir: 'desc' as const };

describe('global file search (LIKE-based)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  afterEach(() => {
    db.close();
  });

  it('matches CJK substring in the middle of a filename', () => {
    insertFile(db, '2025年博白镇干部公休安排表.xlsx');
    insertFile(db, '2025年博白镇值班表.xlsx');
    insertFile(db, '无关文件.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: '博白' }, SORT);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.name.includes('博白'))).toBe(true);
  });

  it('matches digit prefix of a filename', () => {
    insertFile(db, '2025年博白镇干部公休安排表.xlsx');
    insertFile(db, '无关文件.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: '2025' }, SORT);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toContain('博白');
  });

  it('matches pinyin initials substring', () => {
    // 博白 -> bb
    insertFile(db, '2025年博白镇干部公休安排表.xlsx');
    insertFile(db, '无关文件.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: 'bb' }, SORT);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toContain('博白');
  });

  it('matches files by tag name', () => {
    const id = insertFile(db, '报告.xlsx');
    addTag(db, id, '测试1');
    insertFile(db, '无关文件.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: '测试1' }, SORT);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('报告.xlsx');
  });

  it('matches alias substring', () => {
    const id = insertFile(db, 'IMG_0001.xlsx', { alias: '博白汇总表' });
    insertFile(db, '无关文件.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: '博白' }, SORT);
    expect(rows.some((r) => r.id === id)).toBe(true);
  });

  it('multi-term query requires all terms to match', () => {
    insertFile(db, '2025年博白镇干部公休安排表.xlsx');
    insertFile(db, '2025年值班表.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: '2025 博白' }, SORT);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toContain('博白');
  });

  it('escapes LIKE wildcards in user input', () => {
    insertFile(db, '100%完成.xlsx');
    insertFile(db, '100天计划.xlsx');

    const rows = listFilesFrom(db, { kind: 'search', query: '100%' }, SORT);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('100%完成.xlsx');
  });

  it('returns empty for blank query', () => {
    insertFile(db, '博白.xlsx');
    const rows = listFilesFrom(db, { kind: 'search', query: '   ' }, SORT);
    expect(rows).toEqual([]);
  });
});
