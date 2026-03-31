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
