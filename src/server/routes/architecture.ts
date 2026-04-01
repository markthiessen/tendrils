import type { FastifyInstance } from "fastify";
import {
  getArchitecture,
  updateArchitecture,
  findAllArchitectureNotes,
  upsertArchitectureNote,
  deleteArchitectureNote,
} from "../../db/architecture.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerArchitectureRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get("/api/architecture", () => {
    return ctx.withDb((db) => {
      const arch = getArchitecture(db);
      const notes = findAllArchitectureNotes(db);
      return { ok: true, data: { ...arch, notes } };
    });
  });

  app.put<{ Body: { mermaid_source: string } }>("/api/architecture", (req) => {
    return ctx.withDb((db) => {
      const arch = updateArchitecture(db, req.body.mermaid_source);
      emit("architecture.updated", arch);
      return { ok: true, data: arch };
    });
  });

  app.put<{
    Params: { nodeId: string };
    Body: { note_type: "node" | "edge"; content: string };
  }>("/api/architecture/notes/:nodeId", (req) => {
    return ctx.withDb((db) => {
      const note = upsertArchitectureNote(
        db,
        req.params.nodeId,
        req.body.note_type,
        req.body.content,
      );
      emit("architecture.note.updated", note);
      return { ok: true, data: note };
    });
  });

  app.delete<{ Params: { nodeId: string } }>("/api/architecture/notes/:nodeId", (req) => {
    return ctx.withDb((db) => {
      const deleted = deleteArchitectureNote(db, req.params.nodeId);
      if (!deleted) {
        return { ok: false, error: { code: "NOT_FOUND", message: "Note not found" } };
      }
      emit("architecture.note.deleted", { nodeId: req.params.nodeId });
      return { ok: true, data: { nodeId: req.params.nodeId, deleted: true } };
    });
  });
}
