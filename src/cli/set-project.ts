import type { Command } from "commander";
import path from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { loadProjectConfig, saveProjectConfig } from "../config/index.js";
import { writeRepoBinding } from "../config/binding.js";
import { NotFoundError } from "../errors.js";
import { outputSuccess, type OutputContext } from "../output/index.js";

function inferRepoName(): string {
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1]!;
  } catch {
    // no git remote
  }
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

export function registerSetProjectCommand(program: Command): void {
  program
    .command("set-project")
    .argument("<name>", "Project slug to bind to")
    .option("--repo <label>", "Repo role label (e.g. api, web, mobile)")
    .description("Bind current directory to an existing project")
    .action(async (name: string, opts: { repo?: string }) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const config = loadProjectConfig(name);
      if (!config) {
        throw new NotFoundError("project", name);
      }

      const cwd = process.cwd();

      // Resolve repo label
      let repo = opts.repo;
      if (!repo && !ctx.json && !ctx.quiet && process.stdin.isTTY) {
        const repoName = inferRepoName();
        repo = await ask(`Repo role for '${repoName}' (e.g. api, web, mobile — enter to skip): `);
        if (!repo) repo = undefined;
      }

      // Add or update binding
      if (!config.bindings) {
        config.bindings = [];
      }
      const existing = config.bindings.find((b) => b.path === cwd);
      if (existing) {
        if (repo) existing.repo = repo;
      } else {
        config.bindings.push({ path: cwd, repo });
      }
      saveProjectConfig(name, config);

      writeRepoBinding(cwd, name, repo);

      outputSuccess(
        ctx,
        { project: name, bound: cwd, repo: repo ?? null },
        `Bound current directory to project '${config.project.name}'.${repo ? ` Repo: ${repo}` : ""}`,
      );
    });
}
