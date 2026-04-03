import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { subscribe } from "./sse.js";
import { createContext } from "./context.js";
import { emit } from "./sse.js";
import { markDisconnectedAndRelease } from "../db/agent.js";
import { insertLogEntry } from "../db/log.js";
import { registerGoalRoutes } from "./routes/goals.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerWorkflowRoutes } from "./routes/workflow.js";
import { registerMapRoutes } from "./routes/map.js";
import { registerDecisionRoutes } from "./routes/decisions.js";
import { registerArchitectureRoutes } from "./routes/architecture.js";
import { registerAgentRoutes } from "./routes/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer(name: string, port: number) {
  const ctx = createContext(name);

  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: true });

  // Serve built UI
  const uiDist = path.resolve(__dirname, "..", "..", "ui", "dist");
  try {
    await app.register(fastifyStatic, {
      root: uiDist,
      prefix: "/",
      wildcard: false,
      maxAge: "30d",
      immutable: true,
    });

    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url === "/events") {
        reply.status(404).send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
      } else {
        reply.header("Cache-Control", "no-cache");
        reply.sendFile("index.html");
      }
    });
  } catch {
    // UI not built — that's ok for API-only dev mode
    app.setNotFoundHandler((_req, reply) => {
      reply.status(404).send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found. UI may not be built — run 'npm run build:ui'" } });
    });
  }

  // SSE endpoint
  app.get("/events", (req, reply) => {
    subscribe(reply);
  });

  // Workspace routes
  app.get("/api/workspaces", () => {
    return { ok: true, data: ctx.listWorkspaces() };
  });

  app.post<{ Params: { name: string } }>("/api/workspaces/:name/switch", (req) => {
    try {
      ctx.switchWorkspace(req.params.name);
      emit("workspace.switched", { name: ctx.name });
      return { ok: true, data: { name: ctx.name } };
    } catch (e: any) {
      return { ok: false, error: { code: "NOT_FOUND", message: e.message } };
    }
  });

  // Repo routes (for decisions scoping)
  app.get("/api/repos", () => {
    return { ok: true, data: ctx.listRepos() };
  });

  app.post<{ Body: { path: string } }>("/api/repos/switch", (req) => {
    const repo = ctx.listRepos().find((r) => r.path === req.body.path);
    if (!repo) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Repo not found" } };
    }
    ctx.switchRepo(repo.path);
    emit("repo.switched", { path: repo.path, name: repo.name });
    return { ok: true, data: repo };
  });

  // API routes
  registerGoalRoutes(app, ctx);
  registerTaskRoutes(app, ctx);
  registerWorkflowRoutes(app, ctx);
  registerMapRoutes(app, ctx);
  registerDecisionRoutes(app, ctx);
  registerArchitectureRoutes(app, ctx);
  registerAgentRoutes(app, ctx);

  // Periodic sweep for stale agent sessions (every 60s)
  const sweepInterval = setInterval(() => {
    try {
      ctx.withDb((db) => {
        const stale = markDisconnectedAndRelease(db);
        for (const s of stale) {
          if (s.task_id) {
            insertLogEntry(db, "task", s.task_id, `Auto-released: agent '${s.agent_name}' disconnected (stale heartbeat)`, undefined, "in-progress", "ready");
          }
          emit("agent.disconnected", { agent_name: s.agent_name, task_id: s.task_id });
        }
      });
    } catch {
      // ignore sweep errors
    }
  }, 60_000);

  app.addHook("onClose", () => clearInterval(sweepInterval));

  await app.listen({ port, host: "0.0.0.0" });

  return app;
}
