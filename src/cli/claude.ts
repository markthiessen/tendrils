import type { Command } from "commander";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputSuccess, type OutputContext } from "../output/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMAND_FILES = ["td-discover.md", "td-plan.md", "td-status.md"];

function getCommandsSource(): string {
  return path.resolve(__dirname, "..", "..", "commands");
}

function getCommandsTarget(global: boolean): string {
  if (global) {
    return path.join(os.homedir(), ".claude", "commands");
  }
  return path.join(process.cwd(), ".claude", "commands");
}

function installCommands(global: boolean): string[] {
  const commandsTarget = getCommandsTarget(global);
  fs.mkdirSync(commandsTarget, { recursive: true });

  const commandsSource = getCommandsSource();
  const installed: string[] = [];

  for (const file of COMMAND_FILES) {
    const src = path.join(commandsSource, file);
    const dest = path.join(commandsTarget, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      installed.push(file);
    }
  }

  return installed;
}

function removeCommands(global: boolean): string[] {
  const commandsDir = getCommandsTarget(global);
  const removed: string[] = [];

  for (const file of COMMAND_FILES) {
    const filePath = path.join(commandsDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      removed.push(file);
    }
  }

  return removed;
}

function listInstalledCommands(global: boolean): string[] {
  const commandsDir = getCommandsTarget(global);
  const found: string[] = [];

  for (const file of COMMAND_FILES) {
    if (fs.existsSync(path.join(commandsDir, file))) {
      found.push(file);
    }
  }

  return found;
}

export function registerClaudeCommand(program: Command): void {
  const claude = program
    .command("claude")
    .description("Manage Claude Code integrations");

  claude
    .command("install")
    .description(
      "Install Claude slash commands (/td-discover, /td-plan, /td-status)",
    )
    .option("-g, --global", "Install to ~/.claude/commands/ (available in all projects)")
    .action((opts) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const global = opts.global ?? false;
      const installed = installCommands(global);
      const target = getCommandsTarget(global);

      outputSuccess(
        ctx,
        { commands: installed, path: target, global },
        installed.length
          ? `Installed Claude commands to ${target}:\n${installed.map((f) => `  /td-${f.replace(".md", "").replace("td-", "")}`).join("\n")}`
          : "No command files found in tendrils package.",
      );
    });

  claude
    .command("uninstall")
    .description("Remove tendrils slash commands")
    .option("-g, --global", "Remove from ~/.claude/commands/")
    .action((opts) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const global = opts.global ?? false;
      const removed = removeCommands(global);

      outputSuccess(
        ctx,
        { removed, global },
        removed.length
          ? `Removed Claude commands: ${removed.join(", ")}`
          : "No tendrils commands found to remove.",
      );
    });

  claude
    .command("status")
    .description("Check which tendrils slash commands are installed")
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const globalInstalled = listInstalledCommands(true);
      const localInstalled = listInstalledCommands(false);
      const formatList = (files: string[]) =>
        files.map((f) => `  /td-${f.replace(".md", "").replace("td-", "")}`).join("\n");

      const lines: string[] = [];
      lines.push(`Global (~/.claude/commands/):`);
      lines.push(globalInstalled.length ? formatList(globalInstalled) : "  (none)");
      lines.push(`Local (.claude/commands/):`);
      lines.push(localInstalled.length ? formatList(localInstalled) : "  (none)");

      outputSuccess(
        ctx,
        { global: globalInstalled, local: localInstalled, available: COMMAND_FILES },
        lines.join("\n"),
      );
    });
}
