import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputSuccess, type OutputContext } from "../output/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMAND_FILES = ["td-discover.md", "td-plan.md", "td-status.md"];

function getCommandsSource(): string {
  return path.resolve(__dirname, "..", "..", "commands");
}

function installCommands(targetDir: string): string[] {
  const commandsTarget = path.join(targetDir, ".claude", "commands");
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

function removeCommands(targetDir: string): string[] {
  const commandsDir = path.join(targetDir, ".claude", "commands");
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

function listInstalledCommands(targetDir: string): string[] {
  const commandsDir = path.join(targetDir, ".claude", "commands");
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
      "Install Claude slash commands (/td-discover, /td-plan, /td-status) into this repo",
    )
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const cwd = process.cwd();
      const installed = installCommands(cwd);

      outputSuccess(
        ctx,
        { commands: installed, path: path.join(cwd, ".claude", "commands") },
        installed.length
          ? `Installed Claude commands to .claude/commands/:\n${installed.map((f) => `  /td-${f.replace(".md", "").replace("td-", "")}`).join("\n")}`
          : "No command files found in tendrils package.",
      );
    });

  claude
    .command("uninstall")
    .description("Remove tendrils slash commands from this repo")
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const cwd = process.cwd();
      const removed = removeCommands(cwd);

      outputSuccess(
        ctx,
        { removed },
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

      const cwd = process.cwd();
      const installed = listInstalledCommands(cwd);

      outputSuccess(
        ctx,
        { installed, available: COMMAND_FILES },
        installed.length
          ? `Installed commands:\n${installed.map((f) => `  /td-${f.replace(".md", "").replace("td-", "")}`).join("\n")}`
          : "No tendrils commands installed. Run 'td claude install' to add them.",
      );
    });
}
