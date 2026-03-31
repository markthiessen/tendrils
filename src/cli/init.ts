import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import {
  getProjectDir,
  saveProjectConfig,
  loadProjectConfig,
  type ProjectConfig,
} from "../config/index.js";
import { writeRepoBinding } from "../config/binding.js";
import { initializeDb } from "../db/index.js";
import { outputSuccess, type OutputContext } from "../output/index.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferRepoName(): string {
  // Try git remote name first
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1]!;
  } catch {
    // no git remote
  }
  // Fall back to directory name
  return path.basename(process.cwd());
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new project or bind current directory to one")
    .argument("[name]", "Project name")
    .option("--repo <label>", "Repo role label (e.g. api, web, mobile)")
    .action(async (name: string | undefined, opts: { repo?: string }) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const projectName = name ?? "default";
      const slug = slugify(projectName);
      const existing = loadProjectConfig(slug);
      const cwd = process.cwd();

      // Resolve repo label — use flag, or prompt interactively
      let repo = opts.repo;
      if (!repo && !ctx.json && !ctx.quiet && process.stdin.isTTY) {
        const repoName = inferRepoName();
        repo = await ask(`Repo role for '${repoName}' (e.g. api, web, mobile — enter to skip): `);
        if (!repo) repo = undefined;
      }

      if (existing) {
        addBinding(existing, slug, cwd, repo);
        saveProjectConfig(slug, existing);
        writeRepoBinding(cwd, slug, repo);
        outputSuccess(
          ctx,
          { project: slug, bound: cwd, repo: repo ?? null },
          `Bound current directory to project '${existing.project.name}'.${repo ? ` Repo: ${repo}` : ""}`,
        );
        return;
      }

      const config: ProjectConfig = {
        project: {
          name: projectName,
          slug,
          created_at: new Date().toISOString(),
        },
        bindings: [{ path: cwd, repo }],
      };

      saveProjectConfig(slug, config);
      initializeDb(slug);
      writeRepoBinding(cwd, slug, repo);

      outputSuccess(
        ctx,
        { project: slug, path: getProjectDir(slug), bound: cwd, repo: repo ?? null },
        `Project '${projectName}' created.${repo ? ` Repo: ${repo}.` : ""} Database: ${getProjectDir(slug)}/map.db`,
      );
    });
}

function addBinding(
  config: ProjectConfig,
  _slug: string,
  dir: string,
  repo?: string,
): void {
  if (!config.bindings) {
    config.bindings = [];
  }
  const existing = config.bindings.find((b) => b.path === dir);
  if (existing) {
    if (repo) existing.repo = repo;
  } else {
    config.bindings.push({ path: dir, repo });
  }
}
