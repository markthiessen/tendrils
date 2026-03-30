import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { insertActivity, findAllActivities, findActivityById, updateActivity, deleteActivity } from "../../db/activity.js";
import { emit } from "../sse.js";

export function registerActivityRoutes(app: FastifyInstance, db: Database.Database) {
  app.get("/api/activities", () => {
    return { ok: true, data: findAllActivities(db) };
  });

  app.get<{ Params: { id: string } }>("/api/activities/:id", (req) => {
    const a = findActivityById(db, Number(req.params.id));
    if (!a) return { ok: false, error: { code: "NOT_FOUND", message: "Activity not found" } };
    return { ok: true, data: a };
  });

  app.post<{ Body: { title: string; description?: string } }>("/api/activities", (req) => {
    const a = insertActivity(db, req.body.title, req.body.description ?? "");
    emit("activity.created", a);
    return { ok: true, data: a };
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string } }>("/api/activities/:id", (req) => {
    const a = updateActivity(db, Number(req.params.id), req.body);
    if (!a) return { ok: false, error: { code: "NOT_FOUND", message: "Activity not found" } };
    emit("activity.updated", a);
    return { ok: true, data: a };
  });

  app.delete<{ Params: { id: string } }>("/api/activities/:id", (req) => {
    const id = Number(req.params.id);
    const deleted = deleteActivity(db, id);
    if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Activity not found" } };
    emit("activity.deleted", { id });
    return { ok: true, data: { id, deleted: true } };
  });
}
