// 数据库 Schema 定义 — 11 张表 + 索引 + FTS5
// 严格遵循 MVP 工程规格第 4 节数据模型

export const SCHEMA_SQL = `
-- files 表
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  alias TEXT NULL,
  path TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  ext TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'filed',
  in_knowledge INTEGER NOT NULL DEFAULT 0,
  pinyin TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_in_knowledge ON files(in_knowledge);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);
CREATE INDEX IF NOT EXISTS idx_files_ext ON files(ext);

-- FTS5 虚拟表：文件名 + 别名 + 拼音首字母
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  name,
  alias,
  pinyin,
  content='files',
  content_rowid='id',
  tokenize='unicode61'
);

-- FTS 触发器：同步 files 表到 FTS 表
CREATE TRIGGER IF NOT EXISTS files_fts_after_insert AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, name, alias, pinyin) VALUES (new.id, new.name, new.alias, new.pinyin);
END;

CREATE TRIGGER IF NOT EXISTS files_fts_after_update AFTER UPDATE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name, alias, pinyin) VALUES ('delete', old.id, old.name, old.alias, old.pinyin);
  INSERT INTO files_fts(rowid, name, alias, pinyin) VALUES (new.id, new.name, new.alias, new.pinyin);
END;

CREATE TRIGGER IF NOT EXISTS files_fts_after_delete AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name, alias, pinyin) VALUES ('delete', old.id, old.name, old.alias, old.pinyin);
END;

-- projects 表
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- areas 表（领域）
CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- tasks 表（任务；带提醒的任务即待办）
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  project_id INTEGER NULL,
  area_id INTEGER NULL,
  contact_id INTEGER NULL,
  due_at INTEGER NULL,
  remind_at INTEGER NULL,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  is_important INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_remind_at ON tasks(remind_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_area_id ON tasks(area_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- project_meetings 表（会议）
CREATE TABLE IF NOT EXISTS project_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NULL,
  area_id INTEGER NULL,
  contact_id INTEGER NULL,
  title TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NULL,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT NULL,
  level TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_meetings_start_at ON project_meetings(start_at);
CREATE INDEX IF NOT EXISTS idx_project_meetings_project_id ON project_meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_area_id ON project_meetings(area_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_contact_id ON project_meetings(contact_id);

-- project_files 关联表
CREATE TABLE IF NOT EXISTS project_files (
  project_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, file_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_files_file_id ON project_files(file_id);
CREATE INDEX IF NOT EXISTS idx_project_files_added_at ON project_files(added_at);

-- resource_topics 表（知识库专题）
CREATE TABLE IF NOT EXISTS resource_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- resource_topic_links 关联表
CREATE TABLE IF NOT EXISTS resource_topic_links (
  topic_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (topic_id, file_id),
  FOREIGN KEY (topic_id) REFERENCES resource_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_links_file_id ON resource_topic_links(file_id);

-- tags 表
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- tag_links 关联表
CREATE TABLE IF NOT EXISTS tag_links (
  tag_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  PRIMARY KEY (tag_id, file_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_links_file_id ON tag_links(file_id);

-- contacts 表（通讯录联系人）
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  org TEXT NULL,
  department TEXT NULL,
  title TEXT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  note TEXT NULL,
  pinyin TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at);

-- file_contacts 关联表（文件 ↔ 联系人）
CREATE TABLE IF NOT EXISTS file_contacts (
  file_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (file_id, contact_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_contacts_contact_id ON file_contacts(contact_id);

-- project_contacts 关联表（项目 ↔ 联系人）
CREATE TABLE IF NOT EXISTS project_contacts (
  project_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  role TEXT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, contact_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_contact_id ON project_contacts(contact_id);

-- area_files 关联表（领域 ↔ 文件）
CREATE TABLE IF NOT EXISTS area_files (
  area_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (area_id, file_id),
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_area_files_file_id ON area_files(file_id);
CREATE INDEX IF NOT EXISTS idx_area_files_added_at ON area_files(added_at);

-- settings 表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- web_shortcuts 表（通用网页工作区快捷方式）
CREATE TABLE IF NOT EXISTS web_shortcuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_shortcuts_sort_order ON web_shortcuts(sort_order);
`;

export const SCHEMA_VERSION = '5';
