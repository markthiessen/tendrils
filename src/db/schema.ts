export const SCHEMA_V1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(activity_id, seq)
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK(status IN ('planning','active','released','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  release_id INTEGER REFERENCES releases(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK(status IN ('backlog','ready','claimed','in-progress','blocked','review','done','cancelled')),
  claimed_by TEXT,
  claimed_at TEXT,
  blocked_reason TEXT,
  estimate TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, seq)
);

CREATE TABLE IF NOT EXISTS bugs (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK(severity IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'reported'
    CHECK(status IN ('reported','confirmed','claimed','in-progress','blocked','fixed','verified','wont-fix','cancelled')),
  linked_story_id INTEGER REFERENCES stories(id) ON DELETE SET NULL,
  linked_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  release_id INTEGER REFERENCES releases(id) ON DELETE SET NULL,
  claimed_by TEXT,
  claimed_at TEXT,
  blocked_reason TEXT,
  found_by TEXT,
  repro_steps TEXT,
  expected TEXT,
  actual TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_log (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('story','bug')),
  entity_id INTEGER NOT NULL,
  agent TEXT,
  message TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status, seq);
CREATE INDEX IF NOT EXISTS idx_stories_release ON stories(release_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
CREATE INDEX IF NOT EXISTS idx_work_log_entity ON work_log(entity_type, entity_id, created_at);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
`;

export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  context_type TEXT CHECK(context_type IN ('story','bug')),
  context_id INTEGER,
  tags TEXT NOT NULL DEFAULT '',
  agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_tags ON decisions(tags);

INSERT OR IGNORE INTO schema_version (version) VALUES (2);
`;

export const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS story_items (
  id INTEGER PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  repo TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_story_items_story ON story_items(story_id);

INSERT OR IGNORE INTO schema_version (version) VALUES (3);
`;

export const SCHEMA_V4 = `
CREATE TABLE IF NOT EXISTS story_dependencies (
  id INTEGER PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  depends_on_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(story_id, depends_on_id),
  CHECK(story_id != depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_story_deps_story ON story_dependencies(story_id);
CREATE INDEX IF NOT EXISTS idx_story_deps_depends ON story_dependencies(depends_on_id);

INSERT OR IGNORE INTO schema_version (version) VALUES (4);
`;

export const SCHEMA_V5 = `
DROP TABLE IF EXISTS bugs;
DROP TABLE IF EXISTS releases;
DROP INDEX IF EXISTS idx_stories_release;
DROP INDEX IF EXISTS idx_bugs_status;
DROP INDEX IF EXISTS idx_bugs_severity;
ALTER TABLE stories DROP COLUMN release_id;

INSERT OR IGNORE INTO schema_version (version) VALUES (5);
`;

export const SCHEMA_V6 = `
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  role TEXT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (6);
`;

export const SCHEMA_V7 = `
CREATE TABLE IF NOT EXISTS architecture (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mermaid_source TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS architecture_notes (
  id INTEGER PRIMARY KEY,
  node_id TEXT NOT NULL UNIQUE,
  note_type TEXT NOT NULL CHECK(note_type IN ('node','edge')),
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (7);
`;

export const SCHEMA_V8 = `
-- Flatten hierarchy: Activity -> Task -> Story becomes Goal -> Task
-- Goals replace Activities (the "why")
-- Tasks replace Stories (the claimable unit of work)
-- The old "tasks" middle layer is removed
-- Wrapped in a transaction so a partial failure doesn't corrupt the database.

BEGIN;

-- Create goals table from activities
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO goals (id, seq, title, description, created_at, updated_at)
  SELECT id, seq, title, description, created_at, updated_at FROM activities;

-- Create new tasks table (flattened from stories)
CREATE TABLE IF NOT EXISTS tasks_new (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK(status IN ('backlog','ready','claimed','in-progress','blocked','review','done','cancelled')),
  claimed_by TEXT,
  claimed_at TEXT,
  blocked_reason TEXT,
  estimate TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(goal_id, seq)
);

-- Migrate stories into tasks_new, resolving goal_id through old tasks table
INSERT INTO tasks_new (id, goal_id, seq, title, description, status, claimed_by, claimed_at, blocked_reason, estimate, created_at, updated_at)
  SELECT s.id, t.activity_id, s.seq, s.title, s.description, s.status, s.claimed_by, s.claimed_at, s.blocked_reason, s.estimate, s.created_at, s.updated_at
  FROM stories s
  JOIN tasks t ON s.task_id = t.id;

-- Create task_items from story_items
CREATE TABLE IF NOT EXISTS task_items (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks_new(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  repo TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO task_items (id, task_id, title, repo, done, created_at)
  SELECT id, story_id, title, repo, done, created_at FROM story_items;

CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id);

-- Create task_dependencies from story_dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks_new(id) ON DELETE CASCADE,
  depends_on_id INTEGER NOT NULL REFERENCES tasks_new(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, depends_on_id),
  CHECK(task_id != depends_on_id)
);

INSERT INTO task_dependencies (id, task_id, depends_on_id, created_at)
  SELECT id, story_id, depends_on_id, created_at FROM story_dependencies;

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON task_dependencies(depends_on_id);

-- Update work_log entity_type from 'story' to 'task'
UPDATE work_log SET entity_type = 'task' WHERE entity_type = 'story';

-- Update decisions context_type from 'story' to 'task'
UPDATE decisions SET context_type = 'task' WHERE context_type = 'story';

-- Drop old tables
DROP TABLE IF EXISTS story_dependencies;
DROP TABLE IF EXISTS story_items;
DROP TABLE IF EXISTS stories;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS activities;

-- Rename tasks_new to tasks
ALTER TABLE tasks_new RENAME TO tasks;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, seq);

-- Update work_log check constraint by recreating
CREATE TABLE IF NOT EXISTS work_log_new (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task')),
  entity_id INTEGER NOT NULL,
  agent TEXT,
  message TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO work_log_new SELECT * FROM work_log;
DROP TABLE work_log;
ALTER TABLE work_log_new RENAME TO work_log;

CREATE INDEX IF NOT EXISTS idx_work_log_entity ON work_log(entity_type, entity_id, created_at);

-- Update decisions check constraint
CREATE TABLE IF NOT EXISTS decisions_new (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  context_type TEXT CHECK(context_type IN ('task')),
  context_id INTEGER,
  tags TEXT NOT NULL DEFAULT '',
  agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO decisions_new SELECT * FROM decisions;
DROP TABLE decisions;
ALTER TABLE decisions_new RENAME TO decisions;

CREATE INDEX IF NOT EXISTS idx_decisions_tags ON decisions(tags);

INSERT OR IGNORE INTO schema_version (version) VALUES (8);

COMMIT;
`;

export const SCHEMA_V9 = `
-- Flatten to tasks only: remove task_items, add repo column to tasks
BEGIN;
ALTER TABLE tasks ADD COLUMN repo TEXT;
DROP INDEX IF EXISTS idx_task_items_task;
DROP TABLE IF EXISTS task_items;
INSERT OR IGNORE INTO schema_version (version) VALUES (9);
COMMIT;
`;

// Per-repo decisions database schema (lives at ~/.tendrils/repos/<hash>/decisions.db)
export const DECISIONS_SCHEMA_V1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  context_type TEXT CHECK(context_type IN ('story')),
  context_id INTEGER,
  tags TEXT NOT NULL DEFAULT '',
  agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_tags ON decisions(tags);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
`;
