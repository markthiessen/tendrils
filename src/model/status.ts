import type { TaskStatus } from "./types.js";
import { InvalidArgumentError } from "../errors.js";

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["ready", "cancelled"],
  ready: ["claimed", "backlog", "cancelled"],
  claimed: ["in-progress", "ready", "cancelled"],
  "in-progress": ["blocked", "review", "done", "cancelled"],
  blocked: ["in-progress", "cancelled"],
  review: ["in-progress", "done", "cancelled"],
  done: ["ready"],
  cancelled: ["backlog", "ready"],
};

export const ALL_TASK_STATUSES: TaskStatus[] = Object.keys(
  TASK_TRANSITIONS,
) as TaskStatus[];

export function validateTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
): void {
  const allowed = TASK_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidArgumentError(
      `Invalid task status transition: '${from}' -> '${to}'. Allowed: ${allowed?.join(", ") ?? "none"}`,
    );
  }
}

export function isValidTaskStatus(s: string): s is TaskStatus {
  return ALL_TASK_STATUSES.includes(s as TaskStatus);
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "done" || status === "cancelled";
}
