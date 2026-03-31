import type { FastifyInstance } from "fastify";
import { insertDecision, findAllDecisions, deleteDecision } from "../../db/decision.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerDecisionRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { tag?: string } }>("/api/decisions", (req) => {
    return { ok: true, data: findAllDecisions(ctx.db, { tag: req.query.tag }) };
  });

  app.post<{
    Body: {
      title: string;
      contextType?: "story" | "bug";
      contextId?: number;
      tags?: string[];
      agent?: string;
    };
  }>("/api/decisions", (req) => {
    const d = insertDecision(ctx.db, req.body.title, {
      contextType: req.body.contextType,
      contextId: req.body.contextId,
      tags: req.body.tags,
      agent: req.body.agent,
    });
    emit("decision.created", d);
    return { ok: true, data: d };
  });

  app.delete<{ Params: { id: string } }>("/api/decisions/:id", (req) => {
    const id = Number(req.params.id);
    const deleted = deleteDecision(ctx.db, id);
    if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Decision not found" } };
    emit("decision.deleted", { id });
    return { ok: true, data: { id, deleted: true } };
  });
}
