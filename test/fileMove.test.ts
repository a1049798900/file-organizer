import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../electron/main/db/migrate';
import {
  UNDO_WINDOW_MS,
  getMoveUndoFrom,
  moveFileFrom,
  resolveMoveTargetFrom,
  undoMoveFrom,
} from '../electron/main/services/moveSvc';
import { getFileAssociationsFrom } from '../electron/main/services/fileSvc';

function insertFile(db: Database.Database, filePath: string): number {
  const info = db
    .prepare(
      'INSERT INTO files (name, path, size, ext, mtime, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(path.basename(filePath), filePath, 16, 'txt', 1000, 'filed', 1000);
  return Number(info.lastInsertRowid);
}

describe('file move service', () => {
  let db: Database.Database;
  let root: string;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-move-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('moves the file and updates the indexed path', () => {
    const sourceDir = path.join(root, 'source');
    const targetDir = path.join(root, 'target');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);

    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'hello weave');
    const id = insertFile(db, source);

    const result = moveFileFrom(db, id, targetDir);

    expect(result.targetPath).toBe(path.join(targetDir, 'note.txt'));
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.existsSync(result.targetPath)).toBe(true);

    const row = db.prepare('SELECT path FROM files WHERE id = ?').get(id) as { path: string };
    expect(row.path).toBe(result.targetPath);
  });

  it('records an undo entry that can move the file back', () => {
    const sourceDir = path.join(root, 'a');
    const targetDir = path.join(root, 'b');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);

    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    expect(getMoveUndoFrom(db, id)).toBeNull();

    moveFileFrom(db, id, targetDir);
    const undo = getMoveUndoFrom(db, id);
    expect(undo).not.toBeNull();
    expect(undo?.from).toBe(source);

    const reverted = undoMoveFrom(db, id);
    expect(reverted.to).toBe(undo?.to);
    expect(fs.existsSync(source)).toBe(true);

    const row = db.prepare('SELECT path FROM files WHERE id = ?').get(id) as { path: string };
    expect(row.path).toBe(source);
    expect(getMoveUndoFrom(db, id)).toBeNull();
  });

  it('rejects undoing twice', () => {
    const sourceDir = path.join(root, 'a');
    const targetDir = path.join(root, 'b');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);

    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    moveFileFrom(db, id, targetDir);
    undoMoveFrom(db, id);

    expect(() => undoMoveFrom(db, id)).toThrow('没有可撤销的移动记录');
  });

  it('expires the undo entry after 10 minutes', () => {
    const sourceDir = path.join(root, 'a');
    const targetDir = path.join(root, 'b');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);

    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    moveFileFrom(db, id, targetDir);
    expect(getMoveUndoFrom(db, id)).not.toBeNull();

    spy.mockReturnValue(now + UNDO_WINDOW_MS + 1);
    expect(getMoveUndoFrom(db, id)).toBeNull();
    expect(() => undoMoveFrom(db, id)).toThrow('没有可撤销的移动记录');
  });

  it('rejects moving into the same folder', () => {
    const sourceDir = path.join(root, 'a');
    fs.mkdirSync(sourceDir);
    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    expect(() => resolveMoveTargetFrom(db, id, sourceDir)).toThrow('文件已在该文件夹中');
  });

  it('rejects a target that already has a file with the same name', () => {
    const sourceDir = path.join(root, 'a');
    const targetDir = path.join(root, 'b');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'note.txt'), 'existing');

    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    expect(() => resolveMoveTargetFrom(db, id, targetDir)).toThrow('目标文件夹已存在同名文件');
  });

  it('rejects a target path already used by another indexed file', () => {
    const sourceDir = path.join(root, 'a');
    const targetDir = path.join(root, 'in', 'deep');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    // 另一个索引记录占用了目标路径，但磁盘文件不存在
    insertFile(db, path.join(targetDir, 'note.txt'));

    expect(() => resolveMoveTargetFrom(db, id, targetDir)).toThrow(
      '目标路径已被其他已索引文件占用',
    );
  });

  it('rejects a missing target folder', () => {
    const sourceDir = path.join(root, 'a');
    fs.mkdirSync(sourceDir);
    const source = path.join(sourceDir, 'note.txt');
    fs.writeFileSync(source, 'content');
    const id = insertFile(db, source);

    expect(() => resolveMoveTargetFrom(db, id, path.join(root, 'nope'))).toThrow(
      '目标文件夹不存在',
    );
  });
});

describe('file associations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns tags, topics and projects linked to the file', () => {
    const fileId = insertFile(db, path.join(os.tmpdir(), 'linked.txt'));

    const tagId = Number(
      db.prepare("INSERT INTO tags (name, created_at) VALUES ('合同', 1)").run().lastInsertRowid,
    );
    db.prepare('INSERT INTO tag_links (tag_id, file_id) VALUES (?, ?)').run(tagId, fileId);

    const topicId = Number(
      db
        .prepare("INSERT INTO resource_topics (name, sort_order, created_at) VALUES ('Q4 资料', 0, 1)")
        .run().lastInsertRowid,
    );
    db.prepare('INSERT INTO resource_topic_links (topic_id, file_id, added_at) VALUES (?, ?, 1)').run(
      topicId,
      fileId,
    );

    const projectId = Number(
      db
        .prepare("INSERT INTO projects (name, status, created_at, updated_at) VALUES ('星火计划', 'active', 1, 1)")
        .run().lastInsertRowid,
    );
    db.prepare('INSERT INTO project_files (project_id, file_id, added_at) VALUES (?, ?, 1)').run(
      projectId,
      fileId,
    );

    const result = getFileAssociationsFrom(db, fileId);

    expect(result.tags).toEqual([{ id: tagId, name: '合同' }]);
    expect(result.topics).toEqual([{ id: topicId, name: 'Q4 资料' }]);
    expect(result.projects).toEqual([{ id: projectId, name: '星火计划' }]);
  });

  it('returns empty arrays for an unlinked file', () => {
    const fileId = insertFile(db, path.join(os.tmpdir(), 'lonely.txt'));
    expect(getFileAssociationsFrom(db, fileId)).toEqual({ tags: [], topics: [], projects: [] });
  });
});
