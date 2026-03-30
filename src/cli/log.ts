import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../db/log.js";
import { parseId, formatStoryId, formatBugId } from "../model/id.js";
import { findStoryById } from "../db/story.js";
import { findBugById } from "../db/bug.js";
import { findTaskById } from "../db/task.js";
import { NotFoundError, InvalidArgumentError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  type OutputContext,
} from "../output/index.js";

function getCtx(program: Command): OutputContext {
  return {
    json: program.opts().json ?? false,
    quiet: program.opts().quiet ?? false,
  };
}

function resolveDb(program: Command) {
  const resolved = resolveProject(program.opts().project);
  return getDb(resolved.slug);
}

export function registerLogCommands(program: Command): void {
  // td log <id> <message>
  program
    .command("log")
    .description("Add a work log entry to a story or bug")
    .argument("<id>", "Story or bug ID")
    .argument("<message>", "Log message")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, message: string, opts: { agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const agent = opts.agent ?? process.env["TD_AGENT"] ?? undefined;
      const parsed = parseId(idStr);

      if (parsed.type === "story") {
        const story = findStoryById(db, parsed.story!);
        if (!story) throw new NotFoundError("story", idStr);
        const entry = insertLogEntry(db, "story", parsed.story!, message, agent);
        const task = findTaskById(db, story.task_id);
        const shortId = formatStoryId(task?.activity_id ?? 0, story.task_id, story.id);
        outputSuccess(ctx, entry, `Logged to ${shortId}: ${message}`);
      } else if (parsed.type === "bug") {
        const bug = findBugById(db, parsed.bug!);
        if (!bug) throw new NotFoundError("bug", idStr);
        const entry = insertLogEntry(db, "bug", parsed.bug!, message, agent);
        outputSuccess(ctx, entry, `Logged to ${formatBugId(bug.id)}: ${message}`);
      } else {
        throw new InvalidArgumentError("Can only log to stories (S) or bugs (B).");
      }
    });

  // td history <id>
  program
    .command("history")
    .description("Show work log for a story or bug")
    .argument("[id]", "Story or bug ID (omit for recent activity)")
    .option("--recent", "Show recent activity across all entities")
    .option("-n, --limit <number>", "Number of entries", "20")
    .action(
      (
        idStr: string | undefined,
        opts: { recent?: boolean; limit: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        if (!idStr || opts.recent) {
          const entries = findRecentLogEntries(db, parseInt(opts.limit, 10));
          outputSuccess(
            ctx,
            entries,
            entries.length === 0
              ? "No log entries found."
              : renderTable(
                  ["Time", "Type", "ID", "Agent", "Message"],
                  entries.map((e) => [
                    e.created_at,
                    e.entity_type,
                    e.entity_type === "bug"
                      ? formatBugId(e.entity_id)
                      : `S${String(e.entity_id).padStart(3, "0")}`,
                    e.agent ?? "",
                    e.message,
                  ]),
                ),
          );
          return;
        }

        const parsed = parseId(idStr);
        let entityType: "story" | "bug";
        let entityId: number;

        if (parsed.type === "story") {
          entityType = "story";
          entityId = parsed.story!;
        } else if (parsed.type === "bug") {
          entityType = "bug";
          entityId = parsed.bug!;
        } else {
          throw new InvalidArgumentError(
            "Can only show history for stories (S) or bugs (B).",
          );
        }

        const entries = findLogEntries(db, entityType, entityId);
        outputSuccess(
          ctx,
          entries,
          entries.length === 0
            ? `No log entries for ${idStr}.`
            : renderTable(
                ["Time", "Agent", "Status Change", "Message"],
                entries.map((e) => [
                  e.created_at,
                  e.agent ?? "",
                  e.old_status && e.new_status
                    ? `${e.old_status} -> ${e.new_status}`
                    : "",
                  e.message,
                ]),
              ),
        );
      },
    );
}
