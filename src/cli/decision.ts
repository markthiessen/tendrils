import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import {
  insertDecision,
  findAllDecisions,
  deleteDecision,
} from "../db/decision.js";
import { parseId } from "../model/id.js";
import { NotFoundError } from "../errors.js";
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

export function registerDecisionCommands(program: Command): void {
  // td decide "title" [--context A01.T01.S001] [--tag auth,api]
  program
    .command("decide")
    .description("Record a decision")
    .argument("<title>", "The decision, stated as a fact")
    .option("-c, --context <id>", "Story or bug ID that prompted this")
    .option("-t, --tag <tags>", "Comma-separated tags")
    .option("-a, --agent <name>", "Agent name")
    .action(
      (
        title: string,
        opts: { context?: string; tag?: string; agent?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        let contextType: "story" | "bug" | undefined;
        let contextId: number | undefined;
        if (opts.context) {
          const parsed = parseId(opts.context);
          if (parsed.type === "story") {
            contextType = "story";
            contextId = parsed.story;
          } else if (parsed.type === "bug") {
            contextType = "bug";
            contextId = parsed.bug;
          }
        }

        const tags = opts.tag
          ? opts.tag.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        const agent = opts.agent ?? process.env["TD_AGENT"] ?? undefined;

        const d = insertDecision(db, title, {
          contextType,
          contextId,
          tags,
          agent,
        });

        outputSuccess(
          ctx,
          d,
          `D${d.id}: ${d.title}${tags.length ? ` [${tags.join(", ")}]` : ""}`,
        );
      },
    );

  // td decisions [--tag auth]
  program
    .command("decisions")
    .description("List recorded decisions")
    .option("-t, --tag <tag>", "Filter by tag")
    .action((opts: { tag?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const decisions = findAllDecisions(db, { tag: opts.tag });

      if (ctx.json) {
        outputSuccess(ctx, decisions, "");
        return;
      }

      if (decisions.length === 0) {
        outputSuccess(
          ctx,
          [],
          opts.tag
            ? `No decisions tagged '${opts.tag}'.`
            : "No decisions recorded. Use 'td decide' to add one.",
        );
        return;
      }

      const rows = decisions.map((d) => [
        `D${d.id}`,
        d.title,
        d.tags || "-",
        d.agent || "-",
        d.created_at.slice(0, 10),
      ]);
      outputSuccess(
        ctx,
        decisions,
        renderTable(["ID", "Decision", "Tags", "Agent", "Date"], rows),
      );
    });

  // td decide rm <id>
  const decideGroup = program.commands.find((c) => c.name() === "decide");
  if (decideGroup) {
    // Add rm as a separate top-level command to keep it simple
  }

  program
    .command("undecide")
    .description("Remove a recorded decision")
    .argument("<id>", "Decision ID (e.g. 3)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const id = Number(idStr.replace(/^D/i, ""));
      const deleted = deleteDecision(db, id);
      if (!deleted) throw new NotFoundError("decision", `D${id}`);
      outputSuccess(ctx, { id, deleted: true }, `Removed decision D${id}.`);
    });
}
