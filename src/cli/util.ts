import path from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import type { Command } from "commander";
import type Database from "better-sqlite3";
import { resolveWorkspace } from "../config/binding.js";
import { getDb } from "../db/index.js";
import type { OutputContext } from "../output/index.js";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function inferRepoName(): string {
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1]!;
  } catch {
    // no git remote
  }
  return path.basename(process.cwd());
}

export function getCtx(program: Command): OutputContext {
  return {
    json: program.opts().json ?? false,
    quiet: program.opts().quiet ?? false,
  };
}

export function resolveDb(program: Command): Database.Database {
  const resolved = resolveWorkspace(program.opts().workspace);
  return getDb(resolved.name);
}

export function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
