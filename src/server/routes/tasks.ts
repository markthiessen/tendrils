import type { FastifyInstance } from "fastify";
import { insertTask, findAllTasks, findTaskById, updateTask, deleteTask, moveTask, shipTask } from "../../db/task.js";
import { insertLogEntry } from "../../db/log.js";
import { insertComment, findCommentsByTask } from "../../db/comment.js";
import { validateTaskTransition } from "../../model/status.js";
import type { TaskStatus, CommentType } from "../../model/types.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerTaskRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { goalId?: string; status?: string; claimedBy?: string } }>("/api/tasks", (req) => {
    return ctx.withDb((db) => ({
      ok: true,
      data: findAllTasks(db, {
        goalId: req.query.goalId ? Number(req.query.goalId) : undefined,
        status: req.query.status,
        claimedBy: req.query.claimedBy,
      }),
    }));
  });

  app.get<{ Params: { id: string } }>("/api/tasks/:id", (req) => {
    return ctx.withDb((db) => {
      const t = findTaskById(db, Number(req.params.id));
      if (!t) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      return { ok: true, data: t };
    });
  });

  app.post<{ Body: { goalId: number; title: string; description?: string; estimate?: string; repo?: string } }>("/api/tasks", (req) => {
    return ctx.withDb((db) => {
      const t = insertTask(db, req.body.goalId, req.body.title, req.body.description ?? "", {
        estimate: req.body.estimate,
        repo: req.body.repo,
      });
      emit("task.created", t);
      return { ok: true, data: t };
    });
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string; estimate?: string | null; repo?: string | null } }>("/api/tasks/:id", (req) => {
    return ctx.withDb((db) => {
      const t = updateTask(db, Number(req.params.id), req.body);
      if (!t) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      emit("task.updated", t);
      return { ok: true, data: t };
    });
  });

  app.delete<{ Params: { id: string } }>("/api/tasks/:id", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const deleted = deleteTask(db, id);
      if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      emit("task.deleted", { id });
      return { ok: true, data: { id, deleted: true } };
    });
  });

  app.post<{ Params: { id: string }; Body: { goalId: number } }>("/api/tasks/:id/move", (req) => {
    return ctx.withDb((db) => {
      const t = moveTask(db, Number(req.params.id), req.body.goalId);
      if (!t) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      emit("task.updated", t);
      return { ok: true, data: t };
    });
  });

  app.post<{ Params: { id: string }; Body: { agent?: string } }>("/api/tasks/:id/claim", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };

      if (task.status === "claimed" && task.claimed_by === req.body.agent) {
        return { ok: true, data: task };
      }
      if (task.status === "claimed") {
        return { ok: false, error: { code: "CONFLICT", message: `Already claimed by ${task.claimed_by}` } };
      }

      try { validateTaskTransition(task.status, "claimed"); } catch (e: any) {
        return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
      }

      const result = db.prepare(
        "UPDATE tasks SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'), version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ?"
      ).run(req.body.agent ?? null, id, task.version);

      if (result.changes === 0) {
        return { ok: false, error: { code: "CONFLICT", message: "Task was modified concurrently — claim failed. Try again." } };
      }

      insertLogEntry(db, "task", id, `Claimed by ${req.body.agent ?? "unknown"}`, req.body.agent, task.status, "claimed");

      const updated = findTaskById(db, id)!;
      emit("task.updated", updated);
      return { ok: true, data: updated };
    });
  });

  app.post<{ Params: { id: string } }>("/api/tasks/:id/unclaim", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      if (task.status !== "claimed") return { ok: false, error: { code: "INVALID_TRANSITION", message: "Task is not claimed" } };

      db.prepare("UPDATE tasks SET status = 'ready', claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      insertLogEntry(db, "task", id, `Unclaimed`, task.claimed_by ?? undefined, "claimed", "ready");

      const updated = findTaskById(db, id)!;
      emit("task.updated", updated);
      return { ok: true, data: updated };
    });
  });

  app.post<{ Params: { id: string }; Body: { status: string; reason?: string; agent?: string; pr_url?: string } }>("/api/tasks/:id/status", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };

      const newStatus = req.body.status as TaskStatus;
      if (task.status === newStatus) return { ok: true, data: task };

      try { validateTaskTransition(task.status, newStatus); } catch (e: any) {
        return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
      }

      const sets = ["status = ?", "version = version + 1", "updated_at = datetime('now')"];
      const values: unknown[] = [newStatus];

      if (newStatus === "blocked" && req.body.reason) {
        sets.push("blocked_reason = ?");
        values.push(req.body.reason);
      } else if (task.blocked_reason && newStatus !== "blocked") {
        sets.push("blocked_reason = NULL");
      }

      if (req.body.pr_url) {
        sets.push("pr_url = ?");
        values.push(req.body.pr_url);
      }

      values.push(id);
      db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      insertLogEntry(db, "task", id, `Status -> ${newStatus}`, req.body.agent, task.status, newStatus);

      const updated = findTaskById(db, id)!;
      emit("task.updated", updated);
      return { ok: true, data: updated };
    });
  });

  // --- Comments ---

  app.get<{ Params: { id: string } }>("/api/tasks/:id/comments", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      return { ok: true, data: findCommentsByTask(db, id) };
    });
  });

  app.post<{ Params: { id: string }; Body: { message: string; type?: CommentType; agent?: string } }>("/api/tasks/:id/comments", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };

      const comment = insertComment(db, id, req.body.message, req.body.type ?? "comment", req.body.agent);
      emit("task.commented", { taskId: id, comment });
      return { ok: true, data: comment };
    });
  });

  // --- Accept / Reject ---

  app.post<{ Params: { id: string }; Body: { agent?: string; message?: string } }>("/api/tasks/:id/accept", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };

      if (task.status !== "review") {
        return { ok: false, error: { code: "INVALID_TRANSITION", message: `Cannot accept task in '${task.status}' status — must be in review` } };
      }

      db.prepare("UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE id = ?").run(id);
      insertLogEntry(db, "task", id, "Accepted", req.body.agent, "review", "done");

      const msg = req.body.message ?? "Approved";
      insertComment(db, id, msg, "approval", req.body.agent);

      const updated = findTaskById(db, id)!;
      emit("task.accepted", updated);
      emit("task.updated", updated);
      return { ok: true, data: updated };
    });
  });

  app.post<{ Params: { id: string } }>("/api/tasks/:id/ship", (req) => {
    return ctx.withDb((db) => {
      try {
        const t = shipTask(db, Number(req.params.id));
        emit("task.updated", t);
        return { ok: true, data: t };
      } catch (e: any) {
        const code = e.name === "NotFoundError" ? "NOT_FOUND" : "INVALID_ARGUMENT";
        return { ok: false, error: { code, message: e.message } };
      }
    });
  });

  app.post<{ Params: { id: string }; Body: { message: string; agent?: string } }>("/api/tasks/:id/reject", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };

      if (task.status !== "review") {
        return { ok: false, error: { code: "INVALID_TRANSITION", message: `Cannot reject task in '${task.status}' status — must be in review` } };
      }

      db.prepare("UPDATE tasks SET status = 'in-progress', updated_at = datetime('now') WHERE id = ?").run(id);
      insertLogEntry(db, "task", id, `Rejected: ${req.body.message}`, req.body.agent, "review", "in-progress");

      insertComment(db, id, req.body.message, "rejection", req.body.agent);

      const updated = findTaskById(db, id)!;
      emit("task.rejected", { task: updated, reason: req.body.message });
      emit("task.updated", updated);
      return { ok: true, data: updated };
    });
  });

}
