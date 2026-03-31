import type { FastifyInstance } from "fastify";
import { insertStory, findAllStories, findStoryById, updateStory, deleteStory, moveStory } from "../../db/story.js";
import { insertStoryItem, findStoryItems, markStoryItemDone, markStoryItemUndone, deleteStoryItem } from "../../db/story-item.js";
import { insertLogEntry } from "../../db/log.js";
import { validateStoryTransition } from "../../model/status.js";
import type { StoryStatus } from "../../model/types.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerStoryRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { taskId?: string; status?: string; claimedBy?: string } }>("/api/stories", (req) => {
    return {
      ok: true,
      data: findAllStories(ctx.db, {
        taskId: req.query.taskId ? Number(req.query.taskId) : undefined,
        status: req.query.status,
        claimedBy: req.query.claimedBy,
      }),
    };
  });

  app.get<{ Params: { id: string } }>("/api/stories/:id", (req) => {
    const s = findStoryById(ctx.db, Number(req.params.id));
    if (!s) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    return { ok: true, data: s };
  });

  app.post<{ Body: { taskId: number; title: string; description?: string; estimate?: string } }>("/api/stories", (req) => {
    const s = insertStory(ctx.db, req.body.taskId, req.body.title, req.body.description ?? "", {
      estimate: req.body.estimate,
    });
    emit("story.created", s);
    return { ok: true, data: s };
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string; estimate?: string | null } }>("/api/stories/:id", (req) => {
    const s = updateStory(ctx.db, Number(req.params.id), req.body);
    if (!s) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    emit("story.updated", s);
    return { ok: true, data: s };
  });

  app.delete<{ Params: { id: string } }>("/api/stories/:id", (req) => {
    const id = Number(req.params.id);
    const deleted = deleteStory(ctx.db, id);
    if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    emit("story.deleted", { id });
    return { ok: true, data: { id, deleted: true } };
  });

  app.post<{ Params: { id: string }; Body: { taskId: number } }>("/api/stories/:id/move", (req) => {
    const s = moveStory(ctx.db, Number(req.params.id), req.body.taskId);
    if (!s) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    emit("story.updated", s);
    return { ok: true, data: s };
  });

  app.post<{ Params: { id: string }; Body: { agent?: string } }>("/api/stories/:id/claim", (req) => {
    const id = Number(req.params.id);
    const story = findStoryById(ctx.db, id);
    if (!story) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };

    if (story.status === "claimed" && story.claimed_by === req.body.agent) {
      return { ok: true, data: story };
    }
    if (story.status === "claimed") {
      return { ok: false, error: { code: "CONFLICT", message: `Already claimed by ${story.claimed_by}` } };
    }

    try { validateStoryTransition(story.status, "claimed"); } catch (e: any) {
      return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
    }

    ctx.db.prepare("UPDATE stories SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .run(req.body.agent ?? null, id);
    insertLogEntry(ctx.db, "story", id, `Claimed by ${req.body.agent ?? "unknown"}`, req.body.agent, story.status, "claimed");

    const updated = findStoryById(ctx.db, id)!;
    emit("story.updated", updated);
    return { ok: true, data: updated };
  });

  app.post<{ Params: { id: string } }>("/api/stories/:id/unclaim", (req) => {
    const id = Number(req.params.id);
    const story = findStoryById(ctx.db, id);
    if (!story) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    if (story.status !== "claimed") return { ok: false, error: { code: "INVALID_TRANSITION", message: "Story is not claimed" } };

    ctx.db.prepare("UPDATE stories SET status = 'ready', claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    insertLogEntry(ctx.db, "story", id, `Unclaimed`, story.claimed_by ?? undefined, "claimed", "ready");

    const updated = findStoryById(ctx.db, id)!;
    emit("story.updated", updated);
    return { ok: true, data: updated };
  });

  app.post<{ Params: { id: string }; Body: { status: string; reason?: string; agent?: string } }>("/api/stories/:id/status", (req) => {
    const id = Number(req.params.id);
    const story = findStoryById(ctx.db, id);
    if (!story) return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };

    const newStatus = req.body.status as StoryStatus;
    if (story.status === newStatus) return { ok: true, data: story };

    try { validateStoryTransition(story.status, newStatus); } catch (e: any) {
      return { ok: false, error: { code: "INVALID_TRANSITION", message: e.message } };
    }

    const sets = ["status = ?", "updated_at = datetime('now')"];
    const values: unknown[] = [newStatus];

    if (newStatus === "blocked" && req.body.reason) {
      sets.push("blocked_reason = ?");
      values.push(req.body.reason);
    } else if (story.blocked_reason && newStatus !== "blocked") {
      sets.push("blocked_reason = NULL");
    }

    values.push(id);
    ctx.db.prepare(`UPDATE stories SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    insertLogEntry(ctx.db, "story", id, `Status -> ${newStatus}`, req.body.agent, story.status, newStatus);

    const updated = findStoryById(ctx.db, id)!;
    emit("story.updated", updated);
    return { ok: true, data: updated };
  });

  // Story items (checklist)
  app.get<{ Params: { id: string } }>("/api/stories/:id/items", (req) => {
    const storyId = Number(req.params.id);
    if (!findStoryById(ctx.db, storyId)) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    }
    return { ok: true, data: findStoryItems(ctx.db, storyId) };
  });

  app.post<{ Params: { id: string }; Body: { title: string; repo?: string } }>("/api/stories/:id/items", (req) => {
    const storyId = Number(req.params.id);
    if (!findStoryById(ctx.db, storyId)) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Story not found" } };
    }
    const item = insertStoryItem(ctx.db, storyId, req.body.title, req.body.repo);
    emit("story.updated", { id: storyId });
    return { ok: true, data: item };
  });

  app.post<{ Params: { id: string; itemId: string } }>("/api/stories/:id/items/:itemId/done", (req) => {
    const item = markStoryItemDone(ctx.db, Number(req.params.itemId));
    if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found" } };
    emit("story.updated", { id: Number(req.params.id) });
    return { ok: true, data: item };
  });

  app.post<{ Params: { id: string; itemId: string } }>("/api/stories/:id/items/:itemId/undo", (req) => {
    const item = markStoryItemUndone(ctx.db, Number(req.params.itemId));
    if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found" } };
    emit("story.updated", { id: Number(req.params.id) });
    return { ok: true, data: item };
  });

  app.delete<{ Params: { id: string; itemId: string } }>("/api/stories/:id/items/:itemId", (req) => {
    const id = Number(req.params.itemId);
    const deleted = deleteStoryItem(ctx.db, id);
    if (!deleted) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found" } };
    emit("story.updated", { id: Number(req.params.id) });
    return { ok: true, data: { id, deleted: true } };
  });
}
