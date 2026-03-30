import type { Command } from "commander";
import { loadProjectConfig } from "../config/index.js";
import { listProjectSlugs, resolveProject } from "../config/binding.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
  type OutputContext,
} from "../output/index.js";

export function registerProjectCommand(program: Command): void {
  const project = program
    .command("project")
    .description("Manage projects");

  project
    .command("list")
    .description("List all projects")
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const slugs = listProjectSlugs();
      const projects = slugs.map((slug) => {
        const config = loadProjectConfig(slug);
        return {
          slug,
          name: config?.project.name ?? slug,
          bindings: config?.bindings?.length ?? 0,
          created_at: config?.project.created_at ?? "",
        };
      });

      outputSuccess(
        ctx,
        projects,
        projects.length === 0
          ? "No projects found. Run 'td init --project <name>' to create one."
          : renderTable(
              ["Slug", "Name", "Bindings", "Created"],
              projects.map((p) => [
                p.slug,
                p.name,
                String(p.bindings),
                p.created_at,
              ]),
            ),
      );
    });

  project
    .command("info")
    .argument("[name]", "Project slug")
    .description("Show project details")
    .action((name?: string) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const slug = name ?? program.opts().project;
      if (!slug) {
        const resolved = resolveProject();
        return showProjectInfo(ctx, resolved.slug);
      }
      showProjectInfo(ctx, slug);
    });
}

function showProjectInfo(ctx: OutputContext, slug: string): void {
  const config = loadProjectConfig(slug);
  if (!config) {
    throw new NotFoundError("project", slug);
  }

  const data = {
    slug: config.project.slug,
    name: config.project.name,
    created_at: config.project.created_at,
    bindings: config.bindings ?? [],
  };

  outputSuccess(
    ctx,
    data,
    renderKeyValue([
      ["Name", config.project.name],
      ["Slug", config.project.slug],
      ["Created", config.project.created_at],
      [
        "Bindings",
        config.bindings?.map((b) => b.path).join("\n") || "none",
      ],
    ]),
  );
}
