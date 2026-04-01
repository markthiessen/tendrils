import type { FastifyInstance } from "fastify";
import { findAllGoals, countArchivedGoals } from "../../db/goal.js";
import { findAllTasks } from "../../db/task.js";
import { formatGoalId, formatTaskId } from "../../model/id.js";
import type { ServerContext } from "../context.js";

export function registerMapRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get("/api/map", () => {
    return ctx.withDb((db) => {
      const goals = findAllGoals(db);
      const tasks = findAllTasks(db);

      const mapData = goals.map((g) => {
        const goalTasks = tasks.filter((t) => t.goal_id === g.id);
        return {
          ...g,
          shortId: formatGoalId(g.id),
          tasks: goalTasks.map((t) => ({
            ...t,
            shortId: formatTaskId(g.id, t.id),
          })),
        };
      });

      return {
        ok: true,
        data: {
          goals: mapData,
          archivedCount: countArchivedGoals(db),
        },
      };
    });
  });

  app.get("/api/stats", () => {
    return ctx.withDb((db) => {
      const goals = findAllGoals(db);
      const tasks = findAllTasks(db);

      const taskCounts: Record<string, number> = {};
      for (const t of tasks) taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1;

      return {
        ok: true,
        data: {
          goals: goals.length,
          tasks: { total: tasks.length, ...taskCounts },
        },
      };
    });
  });
}
