import type { FastifyInstance } from "fastify";
import { insertGoal, findAllGoals, findArchivedGoals, findGoalById, updateGoal, deleteGoal, archiveGoal } from "../../db/goal.js";
import { findAllTasks } from "../../db/task.js";
import { isTerminalStatus } from "../../model/status.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerGoalRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { archived?: string } }>("/api/goals", (req) => {
    return ctx.withDb((db) => ({
      ok: true,
      data: req.query.archived === "true" ? findArchivedGoals(db) : findAllGoals(db),
    }));
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

  app.patch<{ Params: { id: string }; Body: { summary: string } }>("/api/goals/:id/archive", (req) => {
    return ctx.withDb((db) => {
      const id = Number(req.params.id);
      const g = findGoalById(db, id);
      if (!g) return { ok: false, error: { code: "NOT_FOUND", message: "Goal not found" } };
      if (g.archived_at) return { ok: false, error: { code: "CONFLICT", message: "Goal is already archived" } };

      const tasks = findAllTasks(db, { goalId: id });
      const incomplete = tasks.filter((t) => !isTerminalStatus(t.status));
      if (incomplete.length > 0) {
        return { ok: false, error: { code: "CONFLICT", message: `Goal has ${incomplete.length} incomplete task(s)` } };
      }

      const archived = archiveGoal(db, id, req.body.summary ?? "");
      if (!archived) return { ok: false, error: { code: "NOT_FOUND", message: "Goal not found" } };
      emit("goal.archived", archived);
      return { ok: true, data: archived };
    });
  });
}
