import type { Database } from "../db/compat.js";
import type { Task, Decision } from "./types.js";
import { findTaskById } from "../db/task.js";
import { findDependencies } from "../db/dependency.js";
import { findCommentsByTask } from "../db/comment.js";
import { formatTaskId } from "./id.js";

export interface ContextBundle {
  decisions: Decision[];
  architecture: string;
  dependencies: DependencyContext[];
  feedback: FeedbackEntry[];
}

export interface DependencyContext {
  shortId: string;
  title: string;
  status: string;
  output: string | null;
}

export interface FeedbackEntry {
  agent: string | null;
  message: string;
  created_at: string;
}

export function assembleContext(
  mapDb: Database,
  decisionsDb: Database | null,
  task: Task,
): ContextBundle {
  // 1. Related decisions — from workspace decisions DB (per-repo)
  const decisions: Decision[] = decisionsDb
    ? (decisionsDb.prepare("SELECT * FROM decisions ORDER BY created_at DESC").all() as Decision[])
    : [];

  // 2. Architecture diagram
  let architecture = "";
  try {
    const arch = mapDb.prepare("SELECT mermaid_source FROM architecture WHERE id = 1").get() as { mermaid_source: string } | undefined;
    architecture = arch?.mermaid_source ?? "";
  } catch {
    // table may not exist
  }

  // 3. Dependency chain with outputs
  const deps = findDependencies(mapDb, task.id);
  const dependencies: DependencyContext[] = deps.map((d) => {
    const depTask = findTaskById(mapDb, d.depends_on_id);
    return {
      shortId: depTask ? formatTaskId(depTask.goal_id, depTask.id) : `T${d.depends_on_id}`,
      title: depTask?.title ?? "(unknown)",
      status: depTask?.status ?? "(unknown)",
      output: depTask?.output ?? null,
    };
  });

  // 4. Rejection feedback from prior attempts (rejection comments on this task)
  const comments = findCommentsByTask(mapDb, task.id);
  const feedback: FeedbackEntry[] = comments
    .filter((c) => c.type === "rejection")
    .map((c) => ({
      agent: c.agent,
      message: c.message,
      created_at: c.created_at,
    }));

  return { decisions, architecture, dependencies, feedback };
}
