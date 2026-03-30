import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { insertBug, findAllBugs, findBugById, updateBug, deleteBug, linkBug } from "../../db/bug.js";
import { insertLogEntry } from "../../db/log.js";
import { validateBugTransition } from "../../model/status.js";
import type { BugSeverity, BugStatus } from "../../model/types.js";
import { emit } from "../sse.js";

export function registerBugRoutes(app: FastifyInstance, db: Database.Database) {
  app.get<{ Querystring: { severity?: string; status?: string; claimedBy?: string } }>("/api/bugs", (req) => {
    return { ok: true, data: findAllBugs(db, { severity: req.query.severity, status: req.query.status, claimedBy: req.query.claimedBy }) };
  });

  app.get<{ Params: { id: string } }>("/api/bugs/:id", (req) => {
    const b = findBugById(db, Number(req.params.id));
    if (!b) return { ok: false, error: { code: "NOT_FOUND", message: "Bug not found" } };
    return { ok: true, data: b };
  });

  app.post<{ Body: { title: string; description?: string; severity?: BugSeverity; linkedStoryId?: number; linkedTaskId?: number } }>("/api/bugs", (req) => {
    const b = insertBug(db, req.body.title, req.body.description ?? "", {
      severity: req.body.severity,
      linkedStoryId: req.body.linkedStoryId,
      linkedTaskId: req.body.linkedTaskId,
    });
    emit("bug.created", b);
    return { ok: true, data: b };
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string; severity?: BugSeverity } }>("/api/bugs/:id", (req) => {
    const b = updateBug(db, Number(req.params.id), req.body);
    if (!b) return { ok: false, error: { code: "NOT_FOUND", message: "Bug not found" } };
    emit("bug.updated", b);
    return { ok: true, data: b };
  });

  app.delete<{ Params: { id: string } }>("/api/bugs/:id", (req) => {
    const id = Number(req.params.id);
    const deleted = deleteBug(db, id);
    if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Bug not found" } };
    emit("bug.deleted", { id });
    return { ok: true, data: { id, deleted: true } };
  });

  app.post<{ Params: { id: string }; Body: { agent?: string } }>("/api/bugs/:id/claim", (req) => {
    const id = Number(req.params.id);
    const bug = findBugById(db, id);
    if (!bug) return { ok: false, error: { code: "NOT_FOUND", message: "Bug not found" } };

    if (bug.status === "claimed" && bug.claimed_by === req.body.agent) return { ok: true, data: bug };
    if (bug.status === "claimed") return { ok: false, error: { code: "CONFLICT", message: `Already claimed by ${bug.claimed_by}` } };

    try { validateBugTransition(bug.status, "claimed"); } catch (e: any) {
      return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
    }

    db.prepare("UPDATE bugs SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .run(req.body.agent ?? null, id);
    insertLogEntry(db, "bug", id, `Claimed by ${req.body.agent ?? "unknown"}`, req.body.agent, bug.status, "claimed");

    const updated = findBugById(db, id)!;
    emit("bug.updated", updated);
    return { ok: true, data: updated };
  });

  app.post<{ Params: { id: string }; Body: { status: string; reason?: string; agent?: string } }>("/api/bugs/:id/status", (req) => {
    const id = Number(req.params.id);
    const bug = findBugById(db, id);
    if (!bug) return { ok: false, error: { code: "NOT_FOUND", message: "Bug not found" } };

    const newStatus = req.body.status as BugStatus;
    if (bug.status === newStatus) return { ok: true, data: bug };

    try { validateBugTransition(bug.status, newStatus); } catch (e: any) {
      return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
    }

    const sets = ["status = ?", "updated_at = datetime('now')"];
    const values: unknown[] = [newStatus];
    if (newStatus === "blocked" && req.body.reason) { sets.push("blocked_reason = ?"); values.push(req.body.reason); }
    values.push(id);
    db.prepare(`UPDATE bugs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    insertLogEntry(db, "bug", id, `Status -> ${newStatus}`, req.body.agent, bug.status, newStatus);

    const updated = findBugById(db, id)!;
    emit("bug.updated", updated);
    return { ok: true, data: updated };
  });
}
