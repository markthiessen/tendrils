import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/index.js";
import { subscribe } from "./sse.js";
import { registerActivityRoutes } from "./routes/activities.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerStoryRoutes } from "./routes/stories.js";
import { registerBugRoutes } from "./routes/bugs.js";
import { registerReleaseRoutes } from "./routes/releases.js";
import { registerWorkflowRoutes } from "./routes/workflow.js";
import { registerMapRoutes } from "./routes/map.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer(slug: string, port: number) {
  const db = getDb(slug);

  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: true });

  // Serve built UI
  const uiDist = path.resolve(__dirname, "..", "..", "ui", "dist");
  try {
    await app.register(fastifyStatic, {
      root: uiDist,
      prefix: "/",
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url === "/events") {
        reply.status(404).send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
      } else {
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

  // API routes
  registerActivityRoutes(app, db);
  registerTaskRoutes(app, db);
  registerStoryRoutes(app, db);
  registerBugRoutes(app, db);
  registerReleaseRoutes(app, db);
  registerWorkflowRoutes(app, db);
  registerMapRoutes(app, db);

  await app.listen({ port, host: "0.0.0.0" });

  return app;
}
