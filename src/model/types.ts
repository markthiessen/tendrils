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
  status: StoryStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  blocked_reason: string | null;
  estimate: string | null;
  created_at: string;
  updated_at: string;
}

export interface Repo {
  id: number;
  path: string;
  role: string | null;
  name: string;
  created_at: string;
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
  context_type: "story" | null;
  context_id: number | null;
  tags: string;
  agent: string | null;
  created_at: string;
}

export interface StoryDependency {
  id: number;
  story_id: number;
  depends_on_id: number;
  created_at: string;
}

export interface WorkLogEntry {
  id: number;
  entity_type: "story";
  entity_id: number;
  agent: string | null;
  message: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}
