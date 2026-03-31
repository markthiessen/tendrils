#!/usr/bin/env node

import { Command } from "commander";
import { TendrilsError } from "./errors.js";
import { errorEnvelope } from "./output/json.js";
import { registerInitCommand } from "./cli/init.js";
import { registerWorkspaceCommand } from "./cli/workspace.js";
import { registerClaudeCommand } from "./cli/claude.js";
import { registerActivityCommand } from "./cli/activity.js";
import { registerTaskCommand } from "./cli/task.js";
import { registerStoryCommand } from "./cli/story.js";
import { registerWorkflowCommands } from "./cli/status.js";
import { registerLogCommands } from "./cli/log.js";
import { registerMapCommand } from "./cli/map.js";
import { registerUiCommand } from "./cli/ui.js";
import { registerDecisionCommands } from "./cli/decision.js";
import { closeDb } from "./db/index.js";

const program = new Command();

program
  .name("td")
  .description("Tendrils — product story map management for LLM agents")
  .version("0.1.0")
  .option("--json", "Output in JSON format", false)
  .option("-w, --workspace <name>", "Override workspace for this invocation")
  .option("-q, --quiet", "Suppress non-essential output", false)
  .option("-v, --verbose", "Increase detail level", false);

// Register commands
registerInitCommand(program);
registerWorkspaceCommand(program);
registerClaudeCommand(program);
registerActivityCommand(program);
registerTaskCommand(program);
registerStoryCommand(program);
registerWorkflowCommands(program);
registerLogCommands(program);
registerMapCommand(program);
registerUiCommand(program);
registerDecisionCommands(program);

// Error handling
program.exitOverride();

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    if (err instanceof TendrilsError) {
      const isJson = process.argv.includes("--json");
      if (isJson) {
        console.error(JSON.stringify(errorEnvelope(err)));
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exitCode = err.exitCode;
    } else if (
      err instanceof Error &&
      "code" in err &&
      ["commander.help", "commander.helpDisplayed", "commander.version"].includes(
        (err as { code: string }).code,
      )
    ) {
      // Help or version was displayed, exit cleanly
    } else {
      console.error("Unexpected error:", err);
      process.exitCode = 1;
    }
  } finally {
    closeDb();
  }
}

main();
