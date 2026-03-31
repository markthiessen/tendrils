import type { Command } from "commander";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputSuccess, type OutputContext } from "../output/index.js";
import { ask } from "./util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getCommandFiles(): string[] {
  const src = getCommandsSource();
  if (!fs.existsSync(src)) return [];
  return fs.readdirSync(src).filter((f) => f.startsWith("td-") && f.endsWith(".md"));
}

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

  for (const file of getCommandFiles()) {
    const src = path.join(commandsSource, file);
    const dest = path.join(commandsTarget, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      installed.push(file);
    }
  }

  if (installed.length > 0) {
    ensureClaudePermissions(global);
  }

  return installed;
}

function ensureClaudePermissions(global: boolean): void {
  const settingsDir = global
    ? path.join(os.homedir(), ".claude")
    : path.join(process.cwd(), ".claude");
  const settingsPath = path.join(settingsDir, "settings.json");

  const tdPatterns = [
    "Bash(td:*)",
    "Bash(cat .tendrils/config.toml)",
  ];

  let settings: { permissions?: { allow?: string[] } } = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  }

  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];

  let changed = false;
  for (const pattern of tdPatterns) {
    if (!settings.permissions.allow.includes(pattern)) {
      settings.permissions.allow.push(pattern);
      changed = true;
    }
  }

  if (changed) {
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }
}

function removeCommands(global: boolean): string[] {
  const commandsDir = getCommandsTarget(global);
  const removed: string[] = [];

  for (const file of getCommandFiles()) {
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

  for (const file of getCommandFiles()) {
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
    .action(async (opts) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const global = opts.global ?? false;
      const installed = installCommands(global);
      const target = getCommandsTarget(global);

      const lines: string[] = [];
      if (installed.length) {
        lines.push(`Installed Claude commands to ${target}:`);
        lines.push(...installed.map((f) => `  /td-${f.replace(".md", "").replace("td-", "")}`));
      } else {
        outputSuccess(ctx, { commands: [], path: target, global }, "No command files found in tendrils package.");
        return;
      }

      // Ask to set up permissions
      if (!ctx.json && !ctx.quiet && process.stdin.isTTY) {
        const settingsPath = global
          ? path.join(os.homedir(), ".claude", "settings.json")
          : path.join(process.cwd(), ".claude", "settings.json");
        const answer = await ask(`Allow td commands in Claude Code? This adds permissions to ${settingsPath} (y/N): `);
        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
          ensureClaudePermissions(global);
          lines.push(`\nPermissions added to ${settingsPath}.`);
        }
      }

      outputSuccess(ctx, { commands: installed, path: target, global }, lines.join("\n"));
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
        { global: globalInstalled, local: localInstalled, available: getCommandFiles() },
        lines.join("\n"),
      );
    });
}
