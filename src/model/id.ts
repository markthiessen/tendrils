import { InvalidArgumentError } from "../errors.js";

export type EntityType = "activity" | "task" | "story";

export interface ParsedId {
  project?: string;
  activity?: number;
  task?: number;
  story?: number;
  type: EntityType;
}

const ID_PATTERN =
  /^(?:([A-Za-z][A-Za-z0-9_-]*)::)?(?:(A)(\d+)(?:\.(T)(\d+)(?:\.(S)(\d+))?)?)$/;

export function parseId(input: string): ParsedId {
  const m = input.match(ID_PATTERN);
  if (!m) {
    throw new InvalidArgumentError(
      `Invalid ID '${input}'. Expected format: A01, A01.T02, or A01.T02.S001`,
    );
  }

  const project = m[1] || undefined;

  // Activity/Task/Story branch
  const activity = parseInt(m[3]!, 10);

  if (m[4] === "T") {
    const task = parseInt(m[5]!, 10);
    if (m[6] === "S") {
      const story = parseInt(m[7]!, 10);
      return { project, activity, task, story, type: "story" };
    }
    return { project, activity, task, type: "task" };
  }

  return { project, activity, type: "activity" };
}

export function formatActivityId(id: number): string {
  return `A${String(id).padStart(2, "0")}`;
}

export function formatTaskId(activityId: number, taskId: number): string {
  return `${formatActivityId(activityId)}.T${String(taskId).padStart(2, "0")}`;
}

export function formatStoryId(
  activityId: number,
  taskId: number,
  storyId: number,
): string {
  return `${formatTaskId(activityId, taskId)}.S${String(storyId).padStart(3, "0")}`;
}

export function formatFullId(project: string, shortId: string): string {
  return `${project}::${shortId}`;
}
