import type Database from "better-sqlite3";
import type { Decision } from "../model/types.js";

export function insertDecision(
  db: Database.Database,
  title: string,
  opts?: {
    contextType?: "story" | "bug";
    contextId?: number;
    tags?: string[];
    agent?: string;
  },
): Decision {
  const tags = opts?.tags?.length ? opts.tags.join(",") : "";
  const result = db
    .prepare(
      `INSERT INTO decisions (title, context_type, context_id, tags, agent)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      opts?.contextType ?? null,
      opts?.contextId ?? null,
      tags,
      opts?.agent ?? null,
    );

  return db
    .prepare("SELECT * FROM decisions WHERE id = ?")
    .get(result.lastInsertRowid) as Decision;
}

export function findAllDecisions(
  db: Database.Database,
  opts?: { tag?: string },
): Decision[] {
  if (opts?.tag) {
    return db
      .prepare(
        "SELECT * FROM decisions WHERE ',' || tags || ',' LIKE ? ORDER BY created_at DESC",
      )
      .all(`%,${opts.tag},%`) as Decision[];
  }
  return db
    .prepare("SELECT * FROM decisions ORDER BY created_at DESC")
    .all() as Decision[];
}

export function findDecisionById(
  db: Database.Database,
  id: number,
): Decision | undefined {
  return db
    .prepare("SELECT * FROM decisions WHERE id = ?")
    .get(id) as Decision | undefined;
}

export function deleteDecision(
  db: Database.Database,
  id: number,
): boolean {
  const result = db.prepare("DELETE FROM decisions WHERE id = ?").run(id);
  return result.changes > 0;
}
