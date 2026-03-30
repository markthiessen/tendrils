import type { Command } from "commander";
import fs from "node:fs";
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

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new project or bind current directory to one")
    .argument("[name]", "Project name")
    .action(async (name?: string) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const projectName = name ?? "default";
      const slug = slugify(projectName);
      const existing = loadProjectConfig(slug);
      const cwd = process.cwd();

      if (existing) {
        addBinding(existing, slug, cwd);
        saveProjectConfig(slug, existing);
        writeRepoBinding(cwd, slug);
        outputSuccess(
          ctx,
          { project: slug, bound: cwd },
          `Bound current directory to project '${existing.project.name}'.`,
        );
        return;
      }

      const config: ProjectConfig = {
        project: {
          name: projectName,
          slug,
          created_at: new Date().toISOString(),
        },
        bindings: [{ path: cwd }],
      };

      saveProjectConfig(slug, config);
      initializeDb(slug);
      writeRepoBinding(cwd, slug);

      outputSuccess(
        ctx,
        { project: slug, path: getProjectDir(slug), bound: cwd },
        `Project '${projectName}' created. Database: ${getProjectDir(slug)}/map.db`,
      );
    });
}

function addBinding(
  config: ProjectConfig,
  _slug: string,
  dir: string,
): void {
  if (!config.bindings) {
    config.bindings = [];
  }
  if (!config.bindings.some((b) => b.path === dir)) {
    config.bindings.push({ path: dir });
  }
}
