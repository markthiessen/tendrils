import type { FastifyInstance } from "fastify";
import { findReleaseByName } from "../../db/release.js";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../../db/log.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerWorkflowRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { release?: string; repo?: string } }>("/api/next", (req) => {
    const params: unknown[] = [];

    if (req.query.release) {
      const rel = findReleaseByName(ctx.db, req.query.release);
      if (!rel) return { ok: false, error: { code: "NOT_FOUND", message: "Release not found" } };
      params.push(rel.id);
    }

    // Try confirmed bugs first
    const bug = ctx.db.prepare(
      `SELECT * FROM bugs WHERE status IN ('confirmed')
       ${req.query.release ? "AND release_id = ?" : ""}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, id
       LIMIT 1`,
    ).get(...(req.query.release ? params : [])) as any;

    if (bug) return { ok: true, data: { ...bug, entityType: "bug" } };

    // Then ready stories — prioritize those with incomplete items for this repo
    const repoFilter = req.query.repo
      ? `AND s.id IN (SELECT story_id FROM story_items WHERE repo = '${req.query.repo.replace(/'/g, "''")}' AND done = 0)`
      : "";

    let story = ctx.db.prepare(
      `SELECT s.*, t.activity_id FROM stories s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.status = 'ready'
       ${req.query.release ? "AND s.release_id = ?" : ""}
       ${repoFilter}
       ORDER BY COALESCE((SELECT r.sort_order FROM releases r WHERE r.id = s.release_id), 999999), t.activity_id, t.seq, s.seq
       LIMIT 1`,
    ).get(...(req.query.release ? params : [])) as any;

    // Fall back to any ready story if no repo-specific matches
    if (!story && req.query.repo) {
      story = ctx.db.prepare(
        `SELECT s.*, t.activity_id FROM stories s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.status = 'ready'
         ${req.query.release ? "AND s.release_id = ?" : ""}
         ORDER BY COALESCE((SELECT r.sort_order FROM releases r WHERE r.id = s.release_id), 999999), t.activity_id, t.seq, s.seq
         LIMIT 1`,
      ).get(...(req.query.release ? params : [])) as any;
    }

    if (story) return { ok: true, data: { ...story, entityType: "story" } };

    return { ok: true, data: null };
  });

  app.get<{ Params: { entityType: string; entityId: string } }>("/api/log/:entityType/:entityId", (req) => {
    const entries = findLogEntries(ctx.db, req.params.entityType as "story" | "bug", Number(req.params.entityId));
    return { ok: true, data: entries };
  });

  app.get<{ Querystring: { limit?: string } }>("/api/log", (req) => {
    const entries = findRecentLogEntries(ctx.db, Number(req.query.limit ?? 20));
    return { ok: true, data: entries };
  });

  app.post<{ Body: { entityType: "story" | "bug"; entityId: number; message: string; agent?: string } }>("/api/log", (req) => {
    const entry = insertLogEntry(ctx.db, req.body.entityType, req.body.entityId, req.body.message, req.body.agent);
    emit("log.created", entry);
    return { ok: true, data: entry };
  });
}
