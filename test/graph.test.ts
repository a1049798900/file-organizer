import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../electron/main/db/migrate';
import {
  GRAPH_UNLINK_UNDO_WINDOW_MS,
  getGraphDataFrom,
  getGraphUnlinkUndoFrom,
  undoGraphUnlinkFrom,
  unlinkGraphEdgeFrom,
} from '../electron/main/services/graphSvc';

interface Seed {
  projectId: number;
  fileIds: number[];
  contactId: number;
  topicId: number;
  secondTopicId: number;
  areaId: number;
}

function insertProject(db: Database.Database, name: string): number {
  const info = db
    .prepare('INSERT INTO projects (name, status, created_at, updated_at) VALUES (?, ?, 1, 1)')
    .run(name, 'active');
  return Number(info.lastInsertRowid);
}

function insertFile(db: Database.Database, name: string): number {
  const info = db
    .prepare(
      'INSERT INTO files (name, path, size, ext, mtime, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(name, `D:\\资料\\${name}`, 1024, 'pdf', 1000, 'filed', 1000);
  return Number(info.lastInsertRowid);
}

function insertContact(db: Database.Database, name: string): number {
  const info = db
    .prepare('INSERT INTO contacts (name, org, department, title, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)')
    .run(name, '招商局', '办公室', '主任');
  return Number(info.lastInsertRowid);
}

function insertTopic(db: Database.Database, name: string): number {
  const info = db
    .prepare('INSERT INTO resource_topics (name, sort_order, created_at) VALUES (?, 0, 1)')
    .run(name);
  return Number(info.lastInsertRowid);
}

function insertArea(db: Database.Database, name: string): number {
  const info = db
    .prepare('INSERT INTO areas (name, created_at, updated_at) VALUES (?, 1, 1)')
    .run(name);
  return Number(info.lastInsertRowid);
}

function seed(db: Database.Database): Seed {
  const projectId = insertProject(db, '星火计划');
  const fileIds = [insertFile(db, '方案.pdf'), insertFile(db, '预算.xlsx')];
  const contactId = insertContact(db, '张三');
  const topicId = insertTopic(db, 'Q4 资料');
  const secondTopicId = insertTopic(db, '合同');
  const areaId = insertArea(db, '政务');

  db.prepare('INSERT INTO project_files (project_id, file_id, added_at) VALUES (?, ?, 1)').run(
    projectId,
    fileIds[0],
  );
  db.prepare('INSERT INTO project_contacts (project_id, contact_id, role, added_at) VALUES (?, ?, ?, 1)').run(
    projectId,
    contactId,
    '负责人',
  );
  db.prepare('INSERT INTO file_contacts (file_id, contact_id, added_at) VALUES (?, ?, 1)').run(
    fileIds[0],
    contactId,
  );
  db.prepare('INSERT INTO resource_topic_links (topic_id, file_id, added_at) VALUES (?, ?, 1)').run(
    topicId,
    fileIds[0],
  );
  db.prepare('INSERT INTO resource_topic_links (topic_id, file_id, added_at) VALUES (?, ?, 1)').run(
    secondTopicId,
    fileIds[1],
  );
  db.prepare('INSERT INTO area_files (area_id, file_id, added_at) VALUES (?, ?, 1)').run(
    areaId,
    fileIds[0],
  );

  return {
    projectId,
    fileIds,
    contactId,
    topicId,
    secondTopicId,
    areaId,
  };
}

function keys(data: { nodes: { key: string }[] }): string[] {
  return data.nodes.map((node) => node.key);
}

describe('graph query service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns files, contacts and topics for a project focus', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const data = getGraphDataFrom(db, { focus: { type: 'project', id: s.projectId } });

    expect(data.focus).toBe(`project:${s.projectId}`);
    expect(keys(data)).toEqual([
      `project:${s.projectId}`,
      `file:${s.fileIds[0]}`,
      `contact:${s.contactId}`,
      `topic:${s.topicId}`,
    ]);
    expect(data.truncated).toBe(false);

    expect(data.nodes[0].isFocus).toBe(true);
    expect(data.nodes[0].label).toBe('星火计划');

    const types = data.edges.map((edge) => edge.type).sort();
    expect(types).toEqual(['file_topic', 'project_contact', 'project_file']);

    const projectNode = data.nodes.find((node) => node.key === `project:${s.projectId}`);
    expect(projectNode?.degree).toBe(2);

    db.close();
  });

  it('returns project, contact, topic and area for a file focus', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const data = getGraphDataFrom(db, { focus: { type: 'file', id: s.fileIds[0] } });

    expect(keys(data).sort()).toEqual(
      [
        `file:${s.fileIds[0]}`,
        `project:${s.projectId}`,
        `contact:${s.contactId}`,
        `topic:${s.topicId}`,
        `area:${s.areaId}`,
      ].sort(),
    );
    expect(data.nodes[0].isFocus).toBe(true);
    expect(data.nodes[0].key).toBe(`file:${s.fileIds[0]}`);
    expect(data.nodes[0].ext).toBe('pdf');

    const relations = data.edges.map((edge) => edge.type).sort();
    expect(relations).toEqual([
      'area_file',
      'file_contact',
      'file_topic',
      'project_file',
    ]);

    db.close();
  });

  it('returns files, projects and pulled topics for a contact focus', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const data = getGraphDataFrom(db, { focus: { type: 'contact', id: s.contactId } });

    expect(keys(data)).toEqual([
      `contact:${s.contactId}`,
      `project:${s.projectId}`,
      `file:${s.fileIds[0]}`,
      `topic:${s.topicId}`,
    ]);
    expect(data.nodes[0].isFocus).toBe(true);
    expect(data.nodes[0].subtitle).toBe('招商局 · 办公室 · 主任');

    db.close();
  });

  it('returns files for a topic focus and excludes the focus itself from pulled topics', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const data = getGraphDataFrom(db, { focus: { type: 'topic', id: s.topicId } });

    expect(keys(data)).toEqual([`topic:${s.topicId}`, `file:${s.fileIds[0]}`]);
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].type).toBe('file_topic');

    db.close();
  });

  it('returns files for an area focus', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const data = getGraphDataFrom(db, { focus: { type: 'area', id: s.areaId } });

    expect(keys(data)).toEqual([`area:${s.areaId}`, `file:${s.fileIds[0]}`, `topic:${s.topicId}`]);
    expect(data.edges.map((edge) => edge.type).sort()).toEqual(['area_file', 'file_topic']);

    db.close();
  });

  it('keeps focus, projects, files and contacts before topics when truncating', () => {
    const db = new Database(':memory:');
    migrate(db);

    const projectId = insertProject(db, '大项目');
    for (let i = 0; i < 5; i += 1) {
      const fileId = insertFile(db, `文件${i}.pdf`);
      db.prepare('INSERT INTO project_files (project_id, file_id, added_at) VALUES (?, ?, 1)').run(
        projectId,
        fileId,
      );
    }
    const contactId = insertContact(db, '李四');
    db.prepare('INSERT INTO project_contacts (project_id, contact_id, added_at) VALUES (?, ?, 1)').run(
      projectId,
      contactId,
    );

    const data = getGraphDataFrom(db, {
      focus: { type: 'project', id: projectId },
      limit: 4,
    });

    expect(data.nodes).toHaveLength(4);
    expect(data.truncated).toBe(true);
    expect(data.nodes[0].isFocus).toBe(true);
    expect(data.nodes.slice(1).every((node) => node.type === 'file')).toBe(true);
    // 被截断节点的边不应出现悬挂引用
    const keptKeys = new Set(keys(data));
    for (const edge of data.edges) {
      expect(keptKeys.has(edge.source)).toBe(true);
      expect(keptKeys.has(edge.target)).toBe(true);
    }

    db.close();
  });

  it('is deterministic for the same focus', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const first = getGraphDataFrom(db, { focus: { type: 'file', id: s.fileIds[0] } });
    const second = getGraphDataFrom(db, { focus: { type: 'file', id: s.fileIds[0] } });

    expect(second.nodes.map((node) => [node.key, node.label, node.degree])).toEqual(
      first.nodes.map((node) => [node.key, node.label, node.degree]),
    );
    expect(second.edges.map((edge) => edge.key)).toEqual(first.edges.map((edge) => edge.key));

    db.close();
  });

  it('rejects invalid focus, hops and missing entities', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(() =>
      getGraphDataFrom(db, { focus: { type: 'bad' as never, id: 1 } }),
    ).toThrow('无效的焦点类型');
    expect(() => getGraphDataFrom(db, { focus: { type: 'file', id: 0 } })).toThrow(
      '无效的焦点 ID',
    );
    expect(() =>
      getGraphDataFrom(db, { focus: { type: 'file', id: 1 }, hops: 2 as never }),
    ).toThrow('Phase 1 仅支持 1 跳关系');
    expect(() => getGraphDataFrom(db, { focus: { type: 'file', id: 1 } })).toThrow(
      '焦点不存在或已被删除',
    );

    db.close();
  });
});

describe('graph unlink service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes a relation and restores it through undo', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const result = unlinkGraphEdgeFrom(db, {
      relation: 'project_file',
      source: `project:${s.projectId}`,
      target: `file:${s.fileIds[0]}`,
    });

    expect(
      db
        .prepare('SELECT COUNT(*) AS c FROM project_files WHERE project_id = ? AND file_id = ?')
        .get(s.projectId, s.fileIds[0]),
    ).toEqual({ c: 0 });
    expect(getGraphUnlinkUndoFrom(db, result.batchId)?.expiresAt).toBe(result.expiresAt);

    undoGraphUnlinkFrom(db, result.batchId);

    expect(
      db
        .prepare('SELECT COUNT(*) AS c FROM project_files WHERE project_id = ? AND file_id = ?')
        .get(s.projectId, s.fileIds[0]),
    ).toEqual({ c: 1 });
    expect(getGraphUnlinkUndoFrom(db, result.batchId)).toBeNull();

    db.close();
  });

  it('accepts source and target in either order', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    unlinkGraphEdgeFrom(db, {
      relation: 'project_contact',
      source: `contact:${s.contactId}`,
      target: `project:${s.projectId}`,
    });

    expect(
      db.prepare('SELECT COUNT(*) AS c FROM project_contacts WHERE project_id = ?').get(s.projectId),
    ).toEqual({ c: 0 });

    db.close();
  });

  it('rejects mismatched relation types and missing relations', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    expect(() =>
      unlinkGraphEdgeFrom(db, {
        relation: 'project_file',
        source: `file:${s.fileIds[0]}`,
        target: `file:${s.fileIds[1]}`,
      }),
    ).toThrow('关联两端类型不匹配');

    expect(() =>
      unlinkGraphEdgeFrom(db, {
        relation: 'project_file',
        source: `project:${s.projectId}`,
        target: `file:${s.fileIds[1]}`,
      }),
    ).toThrow('关联不存在或已解除');

    db.close();
  });

  it('expires the undo window after 10 minutes', () => {
    const db = new Database(':memory:');
    migrate(db);
    const s = seed(db);

    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const result = unlinkGraphEdgeFrom(db, {
      relation: 'project_file',
      source: `project:${s.projectId}`,
      target: `file:${s.fileIds[0]}`,
    });
    expect(getGraphUnlinkUndoFrom(db, result.batchId)).not.toBeNull();

    spy.mockReturnValue(now + GRAPH_UNLINK_UNDO_WINDOW_MS + 1);
    expect(getGraphUnlinkUndoFrom(db, result.batchId)).toBeNull();
    expect(() => undoGraphUnlinkFrom(db, result.batchId)).toThrow(
      '没有可撤销的取消关联记录（可能已超过 10 分钟）',
    );

    db.close();
  });
});
