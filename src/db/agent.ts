import type { Database } from "./compat.js";
import type { AgentSession } from "../model/types.js";

export function startSession(
  db: Database,
  agentName: string,
  taskId: number,
  repo?: string | null,
): AgentSession {
  // End any existing active session for this agent
  endActiveSession(db, agentName);

  const result = db
    .prepare(
      `INSERT INTO agent_sessions (agent_name, task_id, repo, status)
       VALUES (?, ?, ?, 'active')`,
    )
    .run(agentName, taskId, repo ?? null);

  return db
    .prepare("SELECT * FROM agent_sessions WHERE id = ?")
    .get(result.lastInsertRowid) as AgentSession;
}

export function heartbeat(db: Database, agentName: string): boolean {
  const result = db
    .prepare(
      `UPDATE agent_sessions SET last_heartbeat = datetime('now')
       WHERE agent_name = ? AND status = 'active'`,
    )
    .run(agentName);
  return result.changes > 0;
}

export function endSession(
  db: Database,
  agentName: string,
  taskId: number,
): void {
  db.prepare(
    `UPDATE agent_sessions SET status = 'idle', ended_at = datetime('now')
     WHERE agent_name = ? AND task_id = ? AND status = 'active'`,
  ).run(agentName, taskId);
}

export function endActiveSession(db: Database, agentName: string): void {
  db.prepare(
    `UPDATE agent_sessions SET status = 'idle', ended_at = datetime('now')
     WHERE agent_name = ? AND status = 'active'`,
  ).run(agentName);
}

export function findActiveSessions(db: Database): AgentSession[] {
  return db
    .prepare(
      `SELECT * FROM agent_sessions WHERE status = 'active'
       ORDER BY started_at DESC`,
    )
    .all() as AgentSession[];
}

export function findSessionsByAgent(
  db: Database,
  agentName: string,
): AgentSession[] {
  return db
    .prepare(
      "SELECT * FROM agent_sessions WHERE agent_name = ? ORDER BY started_at DESC",
    )
    .all(agentName) as AgentSession[];
}

export function findActiveSessionByAgent(
  db: Database,
  agentName: string,
): AgentSession | undefined {
  return db
    .prepare(
      "SELECT * FROM agent_sessions WHERE agent_name = ? AND status = 'active' LIMIT 1",
    )
    .get(agentName) as AgentSession | undefined;
}

export function countActiveSessionsByRepo(
  db: Database,
): Map<string | null, number> {
  const rows = db
    .prepare(
      "SELECT repo, COUNT(*) as count FROM agent_sessions WHERE status = 'active' GROUP BY repo",
    )
    .all() as { repo: string | null; count: number }[];

  const result = new Map<string | null, number>();
  for (const r of rows) {
    result.set(r.repo, r.count);
  }
  return result;
}

export function busyRepos(
  db: Database,
  maxPerRepo: number,
): Set<string | null> {
  const counts = countActiveSessionsByRepo(db);
  const busy = new Set<string | null>();
  for (const [repo, count] of counts) {
    if (count >= maxPerRepo) {
      busy.add(repo);
    }
  }
  return busy;
}

export function markDisconnectedAndRelease(
  db: Database,
  timeoutSeconds: number = 300,
): AgentSession[] {
  const stale = db
    .prepare(
      `SELECT * FROM agent_sessions
       WHERE status = 'active'
       AND last_heartbeat < datetime('now', '-' || ? || ' seconds')`,
    )
    .all(timeoutSeconds) as AgentSession[];

  if (stale.length > 0) {
    // Mark sessions as disconnected
    db.prepare(
      `UPDATE agent_sessions SET status = 'disconnected', ended_at = datetime('now')
       WHERE status = 'active'
       AND last_heartbeat < datetime('now', '-' || ? || ' seconds')`,
    ).run(timeoutSeconds);

    // Release task claims for stale sessions
    for (const session of stale) {
      if (session.task_id) {
        db.prepare(
          `UPDATE tasks SET status = 'ready', claimed_by = NULL, claimed_at = NULL,
           version = version + 1, updated_at = datetime('now')
           WHERE id = ? AND status IN ('claimed', 'in-progress')`,
        ).run(session.task_id);
      }
    }
  }

  return stale;
}
