import type { FastifyInstance } from "fastify";
import { insertTask, findAllTasks, findTaskById, updateTask, deleteTask, moveTask } from "../../db/task.js";
import { insertTaskItem, findTaskItems, markTaskItemDone, markTaskItemUndone, deleteTaskItem } from "../../db/task-item.js";
import { insertLogEntry } from "../../db/log.js";
import { validateTaskTransition } from "../../model/status.js";
import type { TaskStatus } from "../../model/types.js";
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

  app.post<{ Body: { goalId: number; title: string; description?: string; estimate?: string } }>("/api/tasks", (req) => {
    return ctx.withDb((db) => {
      const t = insertTask(db, req.body.goalId, req.body.title, req.body.description ?? "", {
        estimate: req.body.estimate,
      });
      emit("task.created", t);
      return { ok: true, data: t };
    });
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string; estimate?: string | null } }>("/api/tasks/:id", (req) => {
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

      db.prepare("UPDATE tasks SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(req.body.agent ?? null, id);
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

  app.post<{ Params: { id: string }; Body: { status: string; reason?: string; agent?: string } }>("/api/tasks/:id/status", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const task = findTaskById(db, id);
      if (!task) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };

      const newStatus = req.body.status as TaskStatus;
      if (task.status === newStatus) return { ok: true, data: task };

      try { validateTaskTransition(task.status, newStatus); } catch (e: any) {
        return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
      }

      const sets = ["status = ?", "updated_at = datetime('now')"];
      const values: unknown[] = [newStatus];

      if (newStatus === "blocked" && req.body.reason) {
        sets.push("blocked_reason = ?");
        values.push(req.body.reason);
      } else if (task.blocked_reason && newStatus !== "blocked") {
        sets.push("blocked_reason = NULL");
      }

      values.push(id);
      db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      insertLogEntry(db, "task", id, `Status -> ${newStatus}`, req.body.agent, task.status, newStatus);

      const updated = findTaskById(db, id)!;
      emit("task.updated", updated);
      return { ok: true, data: updated };
    });
  });

  // Task items (checklist)
  app.get<{ Params: { id: string } }>("/api/tasks/:id/items", (req) => {
    return ctx.withDb((db) => {
      const taskId = Number(req.params.id);
      if (!findTaskById(db, taskId)) {
        return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      }
      return { ok: true, data: findTaskItems(db, taskId) };
    });
  });

  app.post<{ Params: { id: string }; Body: { title: string; repo?: string } }>("/api/tasks/:id/items", (req) => {
    return ctx.withDb((db) => {
      const taskId = Number(req.params.id);
      if (!findTaskById(db, taskId)) {
        return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
      }
      const item = insertTaskItem(db, taskId, req.body.title, req.body.repo);
      emit("task.updated", { id: taskId });
      return { ok: true, data: item };
    });
  });

  app.post<{ Params: { id: string; itemId: string } }>("/api/tasks/:id/items/:itemId/done", (req) => {
    return ctx.withDb((db) => {
      const item = markTaskItemDone(db, Number(req.params.itemId));
      if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found" } };
      emit("task.updated", { id: Number(req.params.id) });
      return { ok: true, data: item };
    });
  });

  app.post<{ Params: { id: string; itemId: string } }>("/api/tasks/:id/items/:itemId/undo", (req) => {
    return ctx.withDb((db) => {
      const item = markTaskItemUndone(db, Number(req.params.itemId));
      if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found" } };
      emit("task.updated", { id: Number(req.params.id) });
      return { ok: true, data: item };
    });
  });

  app.delete<{ Params: { id: string; itemId: string } }>("/api/tasks/:id/items/:itemId", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.itemId);
      const deleted = deleteTaskItem(db, id);
      if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found" } };
      emit("task.updated", { id: Number(req.params.id) });
      return { ok: true, data: { id, deleted: true } };
    });
  });
}
