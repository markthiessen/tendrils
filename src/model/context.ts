import type { Database } from "../db/compat.js";
import type { Task, Decision } from "./types.js";
import { findTaskById, findAllTasks } from "../db/task.js";
import { findGoalById } from "../db/goal.js";
import { findAllRepos } from "../db/repo.js";
import { findDependencies, findDependents } from "../db/dependency.js";
import { findCommentsByTask } from "../db/comment.js";
import { findAllArchitectureNotes, type ArchitectureNote } from "../db/architecture.js";
import { formatTaskId } from "./id.js";

export interface GoalContext {
  title: string;
  description: string;
}

export interface SiblingContext {
  shortId: string;
  title: string;
  status: string;
  repo: string | null;
  output: string | null;
}

export type DecisionSource = "workspace" | "repo";

export type SourcedDecision = Decision & { source: DecisionSource };

export interface ContextBundle {
  goal: GoalContext | null;
  siblings: SiblingContext[];
  decisions: SourcedDecision[];
  all_decision_count: number;
  architecture: string;
  architecture_notes: ArchitectureNote[];
  relevant_nodes: string[];
  dependencies: DependencyContext[];
  dependents: DependentContext[];
  feedback: FeedbackEntry[];
}

export interface DependencyContext {
  shortId: string;
  title: string;
  status: string;
  output: string | null;
}

export interface DependentContext {
  shortId: string;
  title: string;
  status: string;
  description: string;
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
  // 0. Parent goal context
  const parentGoal = findGoalById(mapDb, task.goal_id);
  const goal: GoalContext | null = parentGoal
    ? { title: parentGoal.title, description: parentGoal.description }
    : null;

  // 0b. Sibling tasks under the same goal (excluding self)
  const allGoalTasks = findAllTasks(mapDb, { goalId: task.goal_id });
  const siblings: SiblingContext[] = allGoalTasks
    .filter((t) => t.id !== task.id)
    .map((t) => ({
      shortId: formatTaskId(t.goal_id, t.id),
      title: t.title,
      status: t.status,
      repo: t.repo,
      output: t.output,
    }));

  // 1. Decisions from both workspace (map.db) and per-repo (decisions.db)
  let workspaceDecisions: Decision[] = [];
  try {
    workspaceDecisions = mapDb
      .prepare("SELECT * FROM decisions ORDER BY created_at DESC")
      .all() as Decision[];
  } catch {
    // decisions table may not exist in older map.db
  }

  const repoDecisions: Decision[] = decisionsDb
    ? (decisionsDb.prepare("SELECT * FROM decisions ORDER BY created_at DESC").all() as Decision[])
    : [];

  // Tag each decision with its source
  const allSourced: SourcedDecision[] = [
    ...workspaceDecisions.map((d) => ({ ...d, source: "workspace" as const })),
    ...repoDecisions.map((d) => ({ ...d, source: "repo" as const })),
  ];
  const all_decision_count = allSourced.length;

  // Filter by repo relevance when the task targets a specific repo
  let decisions: SourcedDecision[];
  if (task.repo && allSourced.length > 0) {
    const repoRoles = new Set(
      findAllRepos(mapDb)
        .map((r) => r.role)
        .filter((r): r is string => r != null),
    );
    decisions = allSourced.filter((d) => {
      const tags = d.tags.split(",").map((t) => t.trim()).filter(Boolean);
      // A decision is repo-scoped if any tag matches a known repo role
      const scopedToRepo = tags.find((t) => repoRoles.has(t));
      if (scopedToRepo) {
        return tags.includes(task.repo!);
      }
      return true;
    });
  } else {
    decisions = allSourced;
  }

  // 2. Architecture diagram + notes
  let architecture = "";
  try {
    const arch = mapDb.prepare("SELECT mermaid_source FROM architecture WHERE id = 1").get() as { mermaid_source: string } | undefined;
    architecture = arch?.mermaid_source ?? "";
  } catch {
    // table may not exist
  }

  let allNotes: ArchitectureNote[] = [];
  try {
    allNotes = findAllArchitectureNotes(mapDb);
  } catch {
    // table may not exist
  }

  // Filter notes by repo relevance (same pattern as decisions)
  let architecture_notes: ArchitectureNote[];
  let relevant_nodes: string[];
  if (task.repo && allNotes.length > 0) {
    const repoRoles = new Set(
      findAllRepos(mapDb)
        .map((r) => r.role)
        .filter((r): r is string => r != null),
    );
    architecture_notes = allNotes.filter((n) => {
      if (n.repo_role && repoRoles.has(n.repo_role)) {
        return n.repo_role === task.repo;
      }
      return true; // unscoped notes always included
    });
    relevant_nodes = allNotes
      .filter((n) => n.repo_role === task.repo)
      .map((n) => n.node_id);
  } else {
    architecture_notes = allNotes;
    relevant_nodes = [];
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

  const depRows = findDependents(mapDb, task.id);
  const dependents: DependentContext[] = depRows.map((d) => {
    const depTask = findTaskById(mapDb, d.task_id);
    return {
      shortId: depTask ? formatTaskId(depTask.goal_id, depTask.id) : `T${d.task_id}`,
      title: depTask?.title ?? "(unknown)",
      status: depTask?.status ?? "(unknown)",
      description: depTask?.description ?? "",
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

  return { goal, siblings, decisions, all_decision_count, architecture, architecture_notes, relevant_nodes, dependencies, dependents, feedback };
}
