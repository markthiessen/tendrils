import type { FastifyInstance } from "fastify";
import {
  findActiveSessions,
  findSessionsByAgent,
  findActiveSessionByAgent,
  heartbeat,
} from "../../db/agent.js";
import { findTaskById } from "../../db/task.js";
import { formatTaskId } from "../../model/id.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerAgentRoutes(app: FastifyInstance, ctx: ServerContext) {
  // GET /api/agents — list active agents with current task info
  app.get("/api/agents", () => {
    return ctx.withDb((db) => {
      const sessions = findActiveSessions(db);
      const data = sessions.map((s) => {
        const task = s.task_id ? findTaskById(db, s.task_id) : null;
        return {
          ...s,
          task: task
            ? { id: task.id, shortId: formatTaskId(task.goal_id, task.id), title: task.title, status: task.status }
            : null,
        };
      });
      return { ok: true, data };
    });
  });

  // GET /api/agents/:name — single agent detail with full session history
  app.get<{ Params: { name: string } }>("/api/agents/:name", (req) => {
    return ctx.withDb((db) => {
      const sessions = findSessionsByAgent(db, req.params.name);
      if (sessions.length === 0) {
        return { ok: false, error: { code: "NOT_FOUND", message: `No sessions found for agent '${req.params.name}'` } };
      }

      const active = sessions.find((s) => s.status === "active");
      const history = sessions.map((s) => {
        const task = s.task_id ? findTaskById(db, s.task_id) : null;
        return {
          ...s,
          task: task
            ? { id: task.id, shortId: formatTaskId(task.goal_id, task.id), title: task.title, status: task.status }
            : null,
        };
      });

      return {
        ok: true,
        data: {
          agent_name: req.params.name,
          status: active ? "active" : "idle",
          current_session: active ?? null,
          sessions: history,
        },
      };
    });
  });

  // GET /api/agents/:name/log — work log filtered to this agent
  app.get<{ Params: { name: string }; Querystring: { limit?: string } }>("/api/agents/:name/log", (req) => {
    return ctx.withDb((db) => {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const entries = db
        .prepare("SELECT * FROM work_log WHERE agent = ? ORDER BY created_at DESC LIMIT ?")
        .all(req.params.name, limit);
      return { ok: true, data: entries };
    });
  });

  // POST /api/agents/:name/heartbeat — update last_heartbeat
  app.post<{ Params: { name: string } }>("/api/agents/:name/heartbeat", (req) => {
    return ctx.withDb((db) => {
      const updated = heartbeat(db, req.params.name);
      if (!updated) {
        return { ok: false, error: { code: "NOT_FOUND", message: `No active session for agent '${req.params.name}'` } };
      }
      return { ok: true, data: { agent_name: req.params.name, heartbeat: true } };
    });
  });
}
