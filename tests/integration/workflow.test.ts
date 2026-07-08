import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openWorkspaceDb } from "../../dist/db/index.js";
import { loadWorkspaceConfig, saveWorkspaceConfig } from "../../dist/config/index.js";

let testHome: string;
let testCwd: string;

const execOpts = (): ExecFileSyncOptions => ({
  env: { ...process.env, TD_HOME: testHome },
  cwd: testCwd,
  encoding: "utf-8" as const,
  stdio: ["pipe", "pipe", "pipe"] as const,
});

function td(args: string[]): string {
  return execFileSync(
    "node",
    [path.join(__dirname, "../../dist/index.js"), ...args],
    execOpts(),
  ).toString().trim();
}

function tdJson(args: string[]): any {
  const output = td(["--json", ...args]);
  return JSON.parse(output);
}

// Run a command carrying an agent identity via TD_AGENT (no --agent flag).
function tdWithAgent(args: string[], agent: string): string {
  return execFileSync(
    "node",
    [path.join(__dirname, "../../dist/index.js"), ...args],
    { ...execOpts(), env: { ...process.env, TD_HOME: testHome, TD_AGENT: agent } },
  ).toString().trim();
}

function tdFail(args: string[]): string {
  try {
    execFileSync(
      "node",
      [path.join(__dirname, "../../dist/index.js"), ...args],
      execOpts(),
    );
    return "";
  } catch (err: any) {
    return (err.stderr ?? err.stdout ?? "").toString();
  }
}

function setup() {
  td(["init", "test"]);
  td(["goal", "add", "Auth"]);
  td(["task", "add", "G01", "Email login"]);
  td(["task", "add", "G01", "OAuth2"]);
  td(["task", "status", "G01.T001", "ready"]);
  td(["task", "status", "G01.T002", "ready"]);
}

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-wf-"));
  testCwd = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-cwd-"));
  // Align in-process DB/config helpers with the subprocess workspace.
  process.env.TD_HOME = testHome;
  setup();
});

afterEach(() => {
  delete process.env.TD_HOME;
  fs.rmSync(testHome, { recursive: true, force: true });
  fs.rmSync(testCwd, { recursive: true, force: true });
});

describe("td next", () => {
  it("returns highest-priority ready task", () => {
    const result = tdJson(["next"]);
    expect(result.ok).toBe(true);
    expect(result.data.entityType).toBe("task");
    expect(result.data.shortId).toBe("G01.T001");
  });

  it("includes dependents in context bundle", () => {
    // T001 depends on T002, so T002 has T001 as a dependent
    td(["task", "depends", "G01.T001", "--on", "G01.T002"]);
    // T001 is now blocked (unsatisfied dep on T002). T002 is still ready.
    const result = tdJson(["next", "--context"]);
    expect(result.ok).toBe(true);
    // T002 should be next (T001 is blocked)
    expect(result.data.shortId).toBe("G01.T002");
    expect(result.data.context.dependents).toHaveLength(1);
    expect(result.data.context.dependents[0].shortId).toBe("G01.T001");
    expect(result.data.context.dependents[0].title).toBe("Email login");
    expect(result.data.context.dependents[0].description).toBe("");
    expect(result.data.context.dependents[0].status).toBe("ready");
  });

  it("returns null when nothing ready", () => {
    td(["task", "status", "G01.T001", "claimed"]);
    td(["task", "status", "G01.T002", "claimed"]);
    const result = tdJson(["next"]);
    expect(result.data).toBeNull();
  });

});

describe("td task claim / unclaim", () => {
  it("claims a task", () => {
    const result = tdJson(["task", "claim", "G01.T001", "--agent", "claude-1"]);
    expect(result.data.status).toBe("claimed");
    expect(result.data.claimed_by).toBe("claude-1");
  });

  it("is idempotent for same agent", () => {
    td(["task", "claim", "G01.T001", "--agent", "claude-1"]);
    const result = tdJson(["task", "claim", "G01.T001", "--agent", "claude-1"]);
    expect(result.ok).toBe(true);
  });

  it("rejects claim by different agent", () => {
    td(["task", "claim", "G01.T001", "--agent", "claude-1"]);
    const err = tdFail(["task", "claim", "G01.T001", "--agent", "claude-2"]);
    expect(err).toContain("already claimed");
  });

  it("unclaims a task", () => {
    td(["task", "claim", "G01.T001", "--agent", "claude-1"]);
    const result = tdJson(["task", "unclaim", "G01.T001"]);
    expect(result.data.status).toBe("ready");
    expect(result.data.claimed_by).toBeNull();
  });
});

describe("td task status", () => {
  it("transitions through full lifecycle", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    td(["task", "status", "G01.T001", "in-progress"]);
    td(["task", "status", "G01.T001", "review", "--proof", "Verified: tests pass"]);
    const result = tdJson(["task", "status", "G01.T001", "done"]);
    expect(result.data.status).toBe("done");
  });

  it("rejects invalid transitions", () => {
    const err = tdFail(["task", "status", "G01.T001", "done"]);
    expect(err).toContain("Invalid task status transition");
  });

  it("is idempotent", () => {
    td(["task", "claim", "G01.T001"]);
    td(["task", "status", "G01.T001", "in-progress"]);
    const result = tdJson(["task", "status", "G01.T001", "in-progress"]);
    expect(result.ok).toBe(true);
    expect(result.data.status).toBe("in-progress");
  });

  it("supports blocked with reason", () => {
    td(["task", "claim", "G01.T001"]);
    td(["task", "status", "G01.T001", "in-progress"]);
    const result = tdJson(["task", "status", "G01.T001", "blocked", "--reason", "Need API key"]);
    expect(result.data.status).toBe("blocked");
    expect(result.data.blocked_reason).toBe("Need API key");
  });
});

describe("td log / history", () => {
  it("logs and retrieves entries", () => {
    td(["log", "G01.T001", "Started work", "--agent", "c1"]);
    td(["log", "G01.T001", "Halfway done", "--agent", "c1"]);
    const result = tdJson(["history", "G01.T001"]);
    // Includes the status->ready log from setup + 2 manual logs
    expect(result.data.length).toBeGreaterThanOrEqual(3);
    const manualLogs = result.data.filter((e: any) => e.agent === "c1");
    expect(manualLogs[0].message).toBe("Started work");
    expect(manualLogs[1].message).toBe("Halfway done");
  });

  it("includes status changes in history", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    td(["task", "status", "G01.T001", "in-progress"]);
    const result = tdJson(["history", "G01.T001"]);
    expect(result.data.length).toBeGreaterThanOrEqual(3);
    // First entry is the backlog->ready from setup
    expect(result.data[0].new_status).toBe("ready");
    expect(result.data[1].new_status).toBe("claimed");
  });
});

describe("td map", () => {
  it("renders map", () => {
    const output = td(["map"]);
    expect(output).toContain("MAP");
    expect(output).toContain("G01 Auth");
    expect(output).toContain("G01.T001 Email login");
  });

  it("exports as JSON", () => {
    const output = td(["map", "--export", "json"]);
    const data = JSON.parse(output);
    expect(data.goals).toHaveLength(1);
    expect(data.goals[0].tasks).toHaveLength(2);
  });
});

describe("td sync", () => {
  // Drive a task to done without a PR URL so sync would normally flag it.
  function driveToDone(id: string) {
    td(["task", "claim", id, "--agent", "c1"]);
    td(["task", "status", id, "in-progress"]);
    td(["task", "status", id, "review", "--proof", "done"]);
    td(["task", "status", id, "done"]);
  }

  it("reports unshipped done tasks in active goals", () => {
    driveToDone("G01.T001");
    const result = tdJson(["sync"]);
    const ids = result.data.map((r: any) => r.shortId);
    expect(ids).toContain("G01.T001");
    const row = result.data.find((r: any) => r.shortId === "G01.T001");
    expect(row.shipped).toBe(false);
    expect(row.reason).toBe("No PR URL");
  });

  it("skips tasks in archived goals", () => {
    // Both tasks done, one goal, archive it with --force (unshipped is fine).
    driveToDone("G01.T001");
    driveToDone("G01.T002");
    td(["goal", "archive", "G01", "--force", "--summary", "done"]);
    const result = tdJson(["sync"]);
    const ids = result.data.map((r: any) => r.shortId);
    expect(ids).not.toContain("G01.T001");
    expect(ids).not.toContain("G01.T002");
  });
});

describe("agent lease / heartbeat", () => {
  // Read the active session's stored heartbeat directly from the workspace DB.
  function getHeartbeat(agent: string): string | null {
    const db = openWorkspaceDb("test");
    try {
      const row = db
        .prepare(
          "SELECT last_heartbeat FROM agent_sessions WHERE agent_name = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        )
        .get(agent) as { last_heartbeat: string } | undefined;
      return row?.last_heartbeat ?? null;
    } finally {
      db.close();
    }
  }

  // Age the active session's heartbeat using a SQLite datetime expression.
  function ageHeartbeat(agent: string, expr: string) {
    const db = openWorkspaceDb("test");
    try {
      db.prepare(
        `UPDATE agent_sessions SET last_heartbeat = ${expr} WHERE agent_name = ? AND status = 'active'`,
      ).run(agent);
    } finally {
      db.close();
    }
  }

  it("refreshes the claiming agent's heartbeat on any td command", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    ageHeartbeat("c1", "datetime('now','-1 hour')");
    const before = getHeartbeat("c1");
    expect(before).toBeTruthy();

    // A non-log command carrying the agent identity should bump the heartbeat.
    tdWithAgent(["map"], "c1");

    const after = getHeartbeat("c1");
    expect(after).not.toBe(before);
    expect(after! > before!).toBe(true);
  });

  it("does not refresh a different agent's heartbeat", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    ageHeartbeat("c1", "datetime('now','-1 hour')");
    const before = getHeartbeat("c1");

    // A command from another agent must not touch c1's lease.
    tdWithAgent(["map"], "other");

    expect(getHeartbeat("c1")).toBe(before);
  });

  it("honors claim_lease_seconds when releasing stale claims", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    // 100s of silence: stale under a 60s lease, but fresh under the 300s default.
    ageHeartbeat("c1", "datetime('now','-100 seconds')");

    const cfg = loadWorkspaceConfig("test")!;
    cfg.workspace.claim_lease_seconds = 60;
    saveWorkspaceConfig("test", cfg);

    // td next sweeps stale claims first (no agent → the heartbeat hook is a no-op).
    td(["next"]);

    const result = tdJson(["task", "show", "G01.T001"]);
    expect(result.data.status).toBe("ready");
    expect(result.data.claimed_by).toBeNull();
  });
});

describe("version guard on task mutations", () => {
  function version(id: string): number {
    return tdJson(["task", "show", id]).data.version;
  }

  it("increments the version on every status change", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    const claimed = version("G01.T001");
    td(["task", "status", "G01.T001", "in-progress", "--agent", "c1"]);
    const inProgress = version("G01.T001");
    expect(inProgress).toBeGreaterThan(claimed);
    td(["task", "status", "G01.T001", "review", "--agent", "c1", "--proof", "done"]);
    const inReview = version("G01.T001");
    expect(inReview).toBeGreaterThan(inProgress);
  });

  it("increments the version on unclaim", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    const claimed = version("G01.T001");
    td(["task", "unclaim", "G01.T001"]);
    const unclaimed = version("G01.T001");
    expect(unclaimed).toBeGreaterThan(claimed);
  });

  it("increments the version when linking a PR to an unchanged status", () => {
    td(["task", "claim", "G01.T001", "--agent", "c1"]);
    const before = version("G01.T001");
    // Same-status update that only attaches a PR still bumps the version.
    td(["task", "status", "G01.T001", "claimed", "--agent", "c1", "--pr", "owner/repo#7"]);
    const after = version("G01.T001");
    expect(after).toBeGreaterThan(before);
  });
});

describe("td stats", () => {
  it("shows statistics", () => {
    const result = tdJson(["stats"]);
    expect(result.data.goals).toBe(1);
    expect(result.data.tasks.total).toBe(2);
    expect(result.data.tasks.ready).toBe(2);
  });
});
