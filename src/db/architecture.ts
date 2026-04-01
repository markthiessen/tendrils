import type { Database } from "./compat.js";

export interface Architecture {
  mermaid_source: string;
  updated_at: string;
}

export interface ArchitectureNote {
  id: number;
  node_id: string;
  note_type: "node" | "edge";
  content: string;
  created_at: string;
  updated_at: string;
}

export function getArchitecture(db: Database): Architecture {
  const row = db
    .prepare("SELECT mermaid_source, updated_at FROM architecture WHERE id = 1")
    .get() as Architecture | undefined;
  if (row) return row;
  db.prepare(
    "INSERT OR IGNORE INTO architecture (id, mermaid_source) VALUES (1, '')",
  ).run();
  return { mermaid_source: "", updated_at: new Date().toISOString() };
}

export function updateArchitecture(
  db: Database,
  mermaidSource: string,
): Architecture {
  db.prepare(
    `INSERT INTO architecture (id, mermaid_source, updated_at)
     VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       mermaid_source = excluded.mermaid_source,
       updated_at = excluded.updated_at`,
  ).run(mermaidSource);
  return getArchitecture(db);
}

export function findAllArchitectureNotes(
  db: Database,
): ArchitectureNote[] {
  return db
    .prepare("SELECT * FROM architecture_notes ORDER BY node_id")
    .all() as ArchitectureNote[];
}

export function upsertArchitectureNote(
  db: Database,
  nodeId: string,
  noteType: "node" | "edge",
  content: string,
): ArchitectureNote {
  db.prepare(
    `INSERT INTO architecture_notes (node_id, note_type, content)
     VALUES (?, ?, ?)
     ON CONFLICT(node_id) DO UPDATE SET
       content = excluded.content,
       note_type = excluded.note_type,
       updated_at = datetime('now')`,
  ).run(nodeId, noteType, content);
  return db
    .prepare("SELECT * FROM architecture_notes WHERE node_id = ?")
    .get(nodeId) as ArchitectureNote;
}

export function deleteArchitectureNote(
  db: Database,
  nodeId: string,
): boolean {
  const result = db
    .prepare("DELETE FROM architecture_notes WHERE node_id = ?")
    .run(nodeId);
  return result.changes > 0;
}
