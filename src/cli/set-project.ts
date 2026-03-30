import type { Command } from "commander";
import { loadProjectConfig, saveProjectConfig } from "../config/index.js";
import { writeRepoBinding } from "../config/binding.js";
import { NotFoundError } from "../errors.js";
import { outputSuccess, type OutputContext } from "../output/index.js";

export function registerSetProjectCommand(program: Command): void {
  program
    .command("set-project")
    .argument("<name>", "Project slug to bind to")
    .description("Bind current directory to an existing project")
    .action((name: string) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const config = loadProjectConfig(name);
      if (!config) {
        throw new NotFoundError("project", name);
      }

      // Add binding
      if (!config.bindings) {
        config.bindings = [];
      }
      const cwd = process.cwd();
      if (!config.bindings.some((b) => b.path === cwd)) {
        config.bindings.push({ path: cwd });
        saveProjectConfig(name, config);
      }

      writeRepoBinding(cwd, name);

      outputSuccess(
        ctx,
        { project: name, bound: cwd },
        `Bound current directory to project '${config.project.name}'.`,
      );
    });
}
