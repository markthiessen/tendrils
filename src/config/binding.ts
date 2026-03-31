import fs from "node:fs";
import path from "node:path";
import TOML from "toml";
import {
  getTendrilsHome,
  getProjectsDir,
  loadProjectConfig,
} from "./index.js";
import { NoProjectError } from "../errors.js";
import type { RepoBinding } from "./index.js";

export interface ResolvedProject {
  slug: string;
  name: string;
  source: string;
  repo?: string;
}

export function resolveProject(
  flagProject?: string,
): ResolvedProject {
  // 1. --project flag
  if (flagProject) {
    const config = loadProjectConfig(flagProject);
    if (!config) {
      throw new NoProjectError(`Project '${flagProject}' not found.`);
    }
    return {
      slug: config.project.slug,
      name: config.project.name,
      source: "--project flag",
    };
  }

  // 2. TD_PROJECT env var
  const envProject = process.env["TD_PROJECT"];
  if (envProject) {
    const config = loadProjectConfig(envProject);
    if (!config) {
      throw new NoProjectError(
        `Project '${envProject}' (from TD_PROJECT) not found.`,
      );
    }
    return {
      slug: config.project.slug,
      name: config.project.name,
      source: "TD_PROJECT env",
    };
  }

  // 3. .tendrils.toml in CWD or parent dirs
  const binding = findRepoBinding(process.cwd());
  if (binding) {
    const config = loadProjectConfig(binding.project);
    if (config) {
      return {
        slug: config.project.slug,
        name: config.project.name,
        source: ".tendrils.toml",
        repo: binding.repo,
      };
    }
  }

  // 4. Binding path match in project configs
  const cwd = process.cwd();
  const projectSlugs = listProjectSlugs();
  for (const slug of projectSlugs) {
    const config = loadProjectConfig(slug);
    if (config?.bindings) {
      for (const b of config.bindings) {
        if (cwd === b.path || cwd.startsWith(b.path + path.sep)) {
          return {
            slug: config.project.slug,
            name: config.project.name,
            source: "binding path match",
            repo: b.repo,
          };
        }
      }
    }
  }

  // 5. If exactly one project exists, use it
  if (projectSlugs.length === 1) {
    const slug = projectSlugs[0]!;
    const config = loadProjectConfig(slug);
    if (config) {
      return {
        slug: config.project.slug,
        name: config.project.name,
        source: "only project",
      };
    }
  }

  // 6. Error
  if (projectSlugs.length === 0) {
    throw new NoProjectError(
      "No projects found. Run 'td init --project <name>' to create one.",
    );
  }
  throw new NoProjectError(
    `Multiple projects found: ${projectSlugs.join(", ")}. Specify with --project or create a .tendrils.toml file.`,
  );
}

function findRepoBinding(startDir: string): RepoBinding | null {
  let dir = startDir;
  const root = path.parse(dir).root;
  while (true) {
    const bindingPath = path.join(dir, ".tendrils.toml");
    if (fs.existsSync(bindingPath)) {
      const raw = fs.readFileSync(bindingPath, "utf-8");
      const parsed = TOML.parse(raw) as unknown as RepoBinding;
      if (parsed.project) {
        return parsed;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }
  return null;
}

export function listProjectSlugs(): string[] {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return [];
  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function writeRepoBinding(dir: string, projectSlug: string, repo?: string): void {
  const bindingPath = path.join(dir, ".tendrils.toml");
  let content = `project = "${projectSlug}"\n`;
  if (repo) {
    content += `repo = "${repo}"\n`;
  }
  fs.writeFileSync(bindingPath, content, "utf-8");
}
