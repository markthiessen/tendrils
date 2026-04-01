import type { FastifyInstance } from "fastify";
import { insertDecision, findAllDecisions, deleteDecision } from "../../db/decision.js";
import { findAllRepos } from "../../db/repo.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerDecisionRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { tag?: string } }>("/api/decisions", (req) => {
    return ctx.withDecisionsDb((db) => {
      return { ok: true, data: findAllDecisions(db, { tag: req.query.tag }) };
    });
  });

  app.get<{ Querystring: { tag?: string; repoPath?: string } }>("/api/decisions/by-repo", (req) => {
    if (!req.query.repoPath) {
      return { ok: false, error: { code: "INVALID_ARGUMENT", message: "repoPath query parameter required" } };
    }
    const knownRepo = ctx.withDb((db) => findAllRepos(db).find((r) => r.path === req.query.repoPath));
    if (!knownRepo) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Repo not found in this workspace" } };
    }
    return ctx.withDecisionsDbFor(knownRepo.path, (db) => {
      return { ok: true, data: findAllDecisions(db, { tag: req.query.tag }) };
    });
  });

  app.post<{
    Body: {
      title: string;
      contextType?: "task";
      contextId?: number;
      tags?: string[];
      agent?: string;
    };
  }>("/api/decisions", (req) => {
    return ctx.withDecisionsDb((db) => {
      const d = insertDecision(db, req.body.title, {
        contextType: req.body.contextType,
        contextId: req.body.contextId,
        tags: req.body.tags,
        agent: req.body.agent,
      });
      emit("decision.created", d);
      return { ok: true, data: d };
    });
  });

  app.delete<{ Params: { id: string } }>("/api/decisions/:id", (req) => {
    return ctx.withDecisionsDb((db) => {
      const id = Number(req.params.id);
      const deleted = deleteDecision(db, id);
      if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Decision not found" } };
      emit("decision.deleted", { id });
      return { ok: true, data: { id, deleted: true } };
    });
  });
}
