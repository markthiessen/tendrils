import type { FastifyInstance } from "fastify";
import { insertRelease, findAllReleases, findReleaseByName, updateRelease, deleteRelease, assignStoryToRelease, unassignStoryFromRelease } from "../../db/release.js";
import { findAllStories } from "../../db/story.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerReleaseRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get("/api/releases", () => {
    return { ok: true, data: findAllReleases(ctx.db) };
  });

  app.get<{ Params: { name: string } }>("/api/releases/:name", (req) => {
    const r = findReleaseByName(ctx.db, req.params.name);
    if (!r) return { ok: false, error: { code: "NOT_FOUND", message: "Release not found" } };
    const stories = findAllStories(ctx.db, { releaseId: r.id });
    return { ok: true, data: { ...r, stories } };
  });

  app.post<{ Body: { name: string; description?: string } }>("/api/releases", (req) => {
    const r = insertRelease(ctx.db, req.body.name, req.body.description ?? "");
    emit("release.created", r);
    return { ok: true, data: r };
  });

  app.put<{ Params: { name: string }; Body: { name?: string; description?: string; status?: string } }>("/api/releases/:name", (req) => {
    const r = findReleaseByName(ctx.db, req.params.name);
    if (!r) return { ok: false, error: { code: "NOT_FOUND", message: "Release not found" } };
    const updated = updateRelease(ctx.db, r.id, req.body);
    emit("release.updated", updated);
    return { ok: true, data: updated };
  });

  app.delete<{ Params: { name: string } }>("/api/releases/:name", (req) => {
    const r = findReleaseByName(ctx.db, req.params.name);
    if (!r) return { ok: false, error: { code: "NOT_FOUND", message: "Release not found" } };
    deleteRelease(ctx.db, r.id);
    emit("release.deleted", { name: req.params.name });
    return { ok: true, data: { name: req.params.name, deleted: true } };
  });

  app.post<{ Body: { storyId: number; releaseName: string } }>("/api/releases/assign", (req) => {
    const r = findReleaseByName(ctx.db, req.body.releaseName);
    if (!r) return { ok: false, error: { code: "NOT_FOUND", message: "Release not found" } };
    assignStoryToRelease(ctx.db, req.body.storyId, r.id);
    emit("story.updated", { id: req.body.storyId, release_id: r.id });
    return { ok: true, data: { storyId: req.body.storyId, releaseId: r.id } };
  });

  app.post<{ Body: { storyId: number } }>("/api/releases/unassign", (req) => {
    unassignStoryFromRelease(ctx.db, req.body.storyId);
    emit("story.updated", { id: req.body.storyId, release_id: null });
    return { ok: true, data: { storyId: req.body.storyId } };
  });
}
