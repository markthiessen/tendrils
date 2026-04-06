export interface Goal {
  id: number;
  seq: number;
  title: string;
  description: string;
  archived_at: string | null;
  summary: string;
  created_at: string;
  updated_at: string;
}

export type TaskStatus =
  | "backlog"
  | "ready"
  | "claimed"
  | "in-progress"
  | "blocked"
  | "review"
  | "done"
  | "cancelled";

export type Estimate = "XS" | "S" | "M" | "L" | "XL";

export interface Task {
  id: number;
  goal_id: number;
  seq: number;
  title: string;
  description: string;
  status: TaskStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  blocked_reason: string | null;
  estimate: string | null;
  repo: string | null;
  output: string | null;
  pr_url: string | null;
  proof: string | null;
  rationale: string | null;
  shipped: boolean;
  version: number;
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

export interface Decision {
  id: number;
  title: string;
  context_type: "task" | null;
  context_id: number | null;
  tags: string;
  agent: string | null;
  created_at: string;
}

export interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_id: number;
  created_at: string;
}

export type AgentSessionStatus = "active" | "idle" | "disconnected";

export interface AgentSession {
  id: number;
  agent_name: string;
  task_id: number | null;
  repo: string | null;
  status: AgentSessionStatus;
  started_at: string;
  last_heartbeat: string;
  ended_at: string | null;
}

export type CommentType = "comment" | "approval" | "rejection";

export interface TaskComment {
  id: number;
  task_id: number;
  agent: string | null;
  message: string;
  type: CommentType;
  created_at: string;
}

export interface WorkLogEntry {
  id: number;
  entity_type: "task";
  entity_id: number;
  agent: string | null;
  message: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}
