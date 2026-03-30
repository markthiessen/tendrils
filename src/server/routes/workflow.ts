import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { findReleaseByName } from "../../db/release.js";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../../db/log.js";
import { emit } from "../sse.js";

export function registerWorkflowRoutes(app: FastifyInstance, db: Database.Database) {
  app.get<{ Querystring: { release?: string } }>("/api/next", (req) => {
    const params: unknown[] = [];
    let releaseFilter = "";

    if (req.query.release) {
      const rel = findReleaseByName(db, req.query.release);
      if (!rel) return { ok: false, error: { code: "NOT_FOUND", message: "Release not found" } };
      releaseFilter = "AND release_id = ?";
      params.push(rel.id);
    }

    // Try confirmed bugs first
    const bug = db.prepare(
      `SELECT * FROM bugs WHERE status IN ('confirmed')
       ${req.query.release ? "AND release_id = ?" : ""}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, id
       LIMIT 1`,
    ).get(...(req.query.release ? params : [])) as any;

    if (bug) return { ok: true, data: { ...bug, entityType: "bug" } };

    // Then ready stories
    const story = db.prepare(
      `SELECT s.*, t.activity_id FROM stories s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.status = 'ready'
       ${req.query.release ? "AND s.release_id = ?" : ""}
       ORDER BY COALESCE((SELECT r.sort_order FROM releases r WHERE r.id = s.release_id), 999999), t.activity_id, t.seq, s.seq
       LIMIT 1`,
    ).get(...(req.query.release ? params : [])) as any;

    if (story) return { ok: true, data: { ...story, entityType: "story" } };

    return { ok: true, data: null };
  });

  app.get<{ Params: { entityType: string; entityId: string } }>("/api/log/:entityType/:entityId", (req) => {
    const entries = findLogEntries(db, req.params.entityType as "story" | "bug", Number(req.params.entityId));
    return { ok: true, data: entries };
  });

  app.get<{ Querystring: { limit?: string } }>("/api/log", (req) => {
    const entries = findRecentLogEntries(db, Number(req.query.limit ?? 20));
    return { ok: true, data: entries };
  });

  app.post<{ Body: { entityType: "story" | "bug"; entityId: number; message: string; agent?: string } }>("/api/log", (req) => {
    const entry = insertLogEntry(db, req.body.entityType, req.body.entityId, req.body.message, req.body.agent);
    emit("log.created", entry);
    return { ok: true, data: entry };
  });
}
