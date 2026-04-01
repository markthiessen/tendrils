import type { FastifyInstance } from "fastify";
import { insertGoal, findAllGoals, findGoalById, updateGoal, deleteGoal } from "../../db/goal.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerGoalRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get("/api/goals", () => {
    return ctx.withDb((db) => ({ ok: true, data: findAllGoals(db) }));
  });

  app.get<{ Params: { id: string } }>("/api/goals/:id", (req) => {
    return ctx.withDb((db) => {
      const g = findGoalById(db, Number(req.params.id));
      if (!g) return { ok: false, error: { code: "NOT_FOUND", message: "Goal not found" } };
      return { ok: true, data: g };
    });
  });

  app.post<{ Body: { title: string; description?: string } }>("/api/goals", (req) => {
    return ctx.withDb((db) => {
      const g = insertGoal(db, req.body.title, req.body.description ?? "");
      emit("goal.created", g);
      return { ok: true, data: g };
    });
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string } }>("/api/goals/:id", (req) => {
    return ctx.withDb((db) => {
      const g = updateGoal(db, Number(req.params.id), req.body);
      if (!g) return { ok: false, error: { code: "NOT_FOUND", message: "Goal not found" } };
      emit("goal.updated", g);
      return { ok: true, data: g };
    });
  });

  app.delete<{ Params: { id: string } }>("/api/goals/:id", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const deleted = deleteGoal(db, id);
      if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Goal not found" } };
      emit("goal.deleted", { id });
      return { ok: true, data: { id, deleted: true } };
    });
  });
}
