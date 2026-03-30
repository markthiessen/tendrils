import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { insertTask, findAllTasks, findTaskById, updateTask, deleteTask } from "../../db/task.js";
import { emit } from "../sse.js";

export function registerTaskRoutes(app: FastifyInstance, db: Database.Database) {
  app.get<{ Querystring: { activityId?: string } }>("/api/tasks", (req) => {
    const actId = req.query.activityId ? Number(req.query.activityId) : undefined;
    return { ok: true, data: findAllTasks(db, actId) };
  });

  app.get<{ Params: { id: string } }>("/api/tasks/:id", (req) => {
    const t = findTaskById(db, Number(req.params.id));
    if (!t) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
    return { ok: true, data: t };
  });

  app.post<{ Body: { activityId: number; title: string; description?: string } }>("/api/tasks", (req) => {
    const t = insertTask(db, req.body.activityId, req.body.title, req.body.description ?? "");
    emit("task.created", t);
    return { ok: true, data: t };
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string } }>("/api/tasks/:id", (req) => {
    const t = updateTask(db, Number(req.params.id), req.body);
    if (!t) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
    emit("task.updated", t);
    return { ok: true, data: t };
  });

  app.delete<{ Params: { id: string } }>("/api/tasks/:id", (req) => {
    const id = Number(req.params.id);
    const deleted = deleteTask(db, id);
    if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Task not found" } };
    emit("task.deleted", { id });
    return { ok: true, data: { id, deleted: true } };
  });
}
