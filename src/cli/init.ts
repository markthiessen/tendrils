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
      const opts = { project: name };
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const projectName = opts.project ?? "default";
      const slug = slugify(projectName);
      const existing = loadProjectConfig(slug);

      if (existing) {
        // Bind current directory to existing project
        addBinding(existing, slug, process.cwd());
        saveProjectConfig(slug, existing);
        writeRepoBinding(process.cwd(), slug);
        outputSuccess(
          ctx,
          { project: slug, bound: process.cwd() },
          `Bound current directory to project '${existing.project.name}'.`,
        );
        return;
      }

      // Create new project
      const config: ProjectConfig = {
        project: {
          name: projectName,
          slug,
          created_at: new Date().toISOString(),
        },
        bindings: [{ path: process.cwd() }],
      };

      saveProjectConfig(slug, config);
      initializeDb(slug);
      writeRepoBinding(process.cwd(), slug);

      outputSuccess(
        ctx,
        { project: slug, path: getProjectDir(slug), bound: process.cwd() },
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
