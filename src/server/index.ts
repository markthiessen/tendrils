import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { subscribe } from "./sse.js";
import { createContext } from "./context.js";
import { emit } from "./sse.js";
import { registerActivityRoutes } from "./routes/activities.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerStoryRoutes } from "./routes/stories.js";
import { registerBugRoutes } from "./routes/bugs.js";
import { registerReleaseRoutes } from "./routes/releases.js";
import { registerWorkflowRoutes } from "./routes/workflow.js";
import { registerMapRoutes } from "./routes/map.js";
import { registerDecisionRoutes } from "./routes/decisions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer(slug: string, name: string, port: number) {
  const ctx = createContext(slug, name);

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

  // Project routes
  app.get("/api/projects", () => {
    return { ok: true, data: ctx.listProjects() };
  });

  app.post<{ Params: { slug: string } }>("/api/projects/:slug/switch", (req) => {
    try {
      ctx.switchProject(req.params.slug);
      emit("project.switched", { slug: ctx.slug, name: ctx.name });
      return { ok: true, data: { slug: ctx.slug, name: ctx.name } };
    } catch (e: any) {
      return { ok: false, error: { code: "NOT_FOUND", message: e.message } };
    }
  });

  // API routes
  registerActivityRoutes(app, ctx);
  registerTaskRoutes(app, ctx);
  registerStoryRoutes(app, ctx);
  registerBugRoutes(app, ctx);
  registerReleaseRoutes(app, ctx);
  registerWorkflowRoutes(app, ctx);
  registerMapRoutes(app, ctx);
  registerDecisionRoutes(app, ctx);

  await app.listen({ port, host: "0.0.0.0" });

  return app;
}
