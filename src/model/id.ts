import { InvalidArgumentError } from "../errors.js";

export type EntityType = "goal" | "task";

export interface ParsedId {
  project?: string;
  goal?: number;
  task?: number;
  type: EntityType;
}

const ID_PATTERN =
  /^(?:([A-Za-z][A-Za-z0-9_-]*)::)?(?:(G)(\d+)(?:\.(T)(\d+))?)$/;

export function parseId(input: string): ParsedId {
  const m = input.match(ID_PATTERN);
  if (!m) {
    throw new InvalidArgumentError(
      `Invalid ID '${input}'. Expected format: G01 or G01.T001`,
    );
  }

  const project = m[1] || undefined;
  const goal = parseInt(m[3]!, 10);

  if (m[4] === "T") {
    const task = parseInt(m[5]!, 10);
    return { project, goal, task, type: "task" };
  }

  return { project, goal, type: "goal" };
}

export function formatGoalId(id: number): string {
  return `G${String(id).padStart(2, "0")}`;
}

export function formatTaskId(goalId: number, taskId: number): string {
  return `${formatGoalId(goalId)}.T${String(taskId).padStart(3, "0")}`;
}

export function formatFullId(project: string, shortId: string): string {
  return `${project}::${shortId}`;
}
