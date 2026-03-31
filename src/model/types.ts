export interface Activity {
  id: number;
  seq: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  activity_id: number;
  seq: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export type StoryStatus =
  | "backlog"
  | "ready"
  | "claimed"
  | "in-progress"
  | "blocked"
  | "review"
  | "done"
  | "cancelled";

export type Estimate = "XS" | "S" | "M" | "L" | "XL";

export interface Story {
  id: number;
  task_id: number;
  seq: number;
  title: string;
  description: string;
  release_id: number | null;
  status: StoryStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  blocked_reason: string | null;
  estimate: string | null;
  created_at: string;
  updated_at: string;
}

export type BugSeverity = "critical" | "high" | "medium" | "low";

export type BugStatus =
  | "reported"
  | "confirmed"
  | "claimed"
  | "in-progress"
  | "blocked"
  | "fixed"
  | "verified"
  | "wont-fix"
  | "cancelled";

export interface Bug {
  id: number;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  linked_story_id: number | null;
  linked_task_id: number | null;
  release_id: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
  blocked_reason: string | null;
  found_by: string | null;
  repro_steps: string | null;
  expected: string | null;
  actual: string | null;
  created_at: string;
  updated_at: string;
}

export type ReleaseStatus = "planning" | "active" | "released" | "archived";

export interface Release {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  status: ReleaseStatus;
  created_at: string;
  updated_at: string;
}

export interface StoryItem {
  id: number;
  story_id: number;
  title: string;
  repo: string | null;
  done: number;
  created_at: string;
}

export interface Decision {
  id: number;
  title: string;
  context_type: "story" | "bug" | null;
  context_id: number | null;
  tags: string;
  agent: string | null;
  created_at: string;
}

export interface WorkLogEntry {
  id: number;
  entity_type: "story" | "bug";
  entity_id: number;
  agent: string | null;
  message: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}
