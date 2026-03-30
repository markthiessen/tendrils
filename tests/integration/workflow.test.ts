import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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
  td(["activity", "add", "Auth"]);
  td(["task", "add", "A01", "Login"]);
  td(["story", "add", "A01.T01", "Email login"]);
  td(["story", "add", "A01.T01", "OAuth2"]);
  td(["status", "A01.T01.S001", "ready"]);
  td(["status", "A01.T01.S002", "ready"]);
  td(["release", "add", "MVP"]);
  td(["release", "assign", "A01.T01.S001", "MVP"]);
}

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-wf-"));
  testCwd = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-cwd-"));
  setup();
});

afterEach(() => {
  fs.rmSync(testHome, { recursive: true, force: true });
  fs.rmSync(testCwd, { recursive: true, force: true });
});

describe("td next", () => {
  it("returns highest-priority ready story", () => {
    const result = tdJson(["next"]);
    expect(result.ok).toBe(true);
    expect(result.data.entityType).toBe("story");
    expect(result.data.shortId).toBe("A01.T01.S001");
  });

  it("returns bugs before stories when confirmed", () => {
    td(["bug", "add", "Crash", "--severity", "high"]);
    td(["status", "B001", "confirmed"]);
    const result = tdJson(["next"]);
    expect(result.data.entityType).toBe("bug");
    expect(result.data.shortId).toBe("B001");
  });

  it("returns null when nothing ready", () => {
    td(["status", "A01.T01.S001", "claimed"]);
    td(["status", "A01.T01.S002", "claimed"]);
    const result = tdJson(["next"]);
    expect(result.data).toBeNull();
  });

  it("filters by release", () => {
    const result = tdJson(["next", "--release", "MVP"]);
    expect(result.data.shortId).toBe("A01.T01.S001");
  });
});

describe("td claim / unclaim", () => {
  it("claims a story", () => {
    const result = tdJson(["claim", "A01.T01.S001", "--agent", "claude-1"]);
    expect(result.data.status).toBe("claimed");
    expect(result.data.claimed_by).toBe("claude-1");
  });

  it("is idempotent for same agent", () => {
    td(["claim", "A01.T01.S001", "--agent", "claude-1"]);
    const result = tdJson(["claim", "A01.T01.S001", "--agent", "claude-1"]);
    expect(result.ok).toBe(true);
  });

  it("rejects claim by different agent", () => {
    td(["claim", "A01.T01.S001", "--agent", "claude-1"]);
    const err = tdFail(["claim", "A01.T01.S001", "--agent", "claude-2"]);
    expect(err).toContain("already claimed");
  });

  it("unclaims a story", () => {
    td(["claim", "A01.T01.S001", "--agent", "claude-1"]);
    const result = tdJson(["unclaim", "A01.T01.S001"]);
    expect(result.data.status).toBe("ready");
    expect(result.data.claimed_by).toBeNull();
  });
});

describe("td status", () => {
  it("transitions through full lifecycle", () => {
    td(["claim", "A01.T01.S001", "--agent", "c1"]);
    td(["status", "A01.T01.S001", "in-progress"]);
    td(["status", "A01.T01.S001", "review"]);
    const result = tdJson(["status", "A01.T01.S001", "done"]);
    expect(result.data.status).toBe("done");
  });

  it("rejects invalid transitions", () => {
    const err = tdFail(["status", "A01.T01.S001", "done"]);
    expect(err).toContain("Invalid story status transition");
  });

  it("is idempotent", () => {
    td(["claim", "A01.T01.S001"]);
    td(["status", "A01.T01.S001", "in-progress"]);
    const result = tdJson(["status", "A01.T01.S001", "in-progress"]);
    expect(result.ok).toBe(true);
    expect(result.data.status).toBe("in-progress");
  });

  it("supports blocked with reason", () => {
    td(["claim", "A01.T01.S001"]);
    td(["status", "A01.T01.S001", "in-progress"]);
    const result = tdJson(["status", "A01.T01.S001", "blocked", "--reason", "Need API key"]);
    expect(result.data.status).toBe("blocked");
    expect(result.data.blocked_reason).toBe("Need API key");
  });
});

describe("td log / history", () => {
  it("logs and retrieves entries", () => {
    td(["log", "A01.T01.S001", "Started work", "--agent", "c1"]);
    td(["log", "A01.T01.S001", "Halfway done", "--agent", "c1"]);
    const result = tdJson(["history", "A01.T01.S001"]);
    // Includes the status->ready log from setup + 2 manual logs
    expect(result.data.length).toBeGreaterThanOrEqual(3);
    const manualLogs = result.data.filter((e: any) => e.agent === "c1");
    expect(manualLogs[0].message).toBe("Started work");
    expect(manualLogs[1].message).toBe("Halfway done");
  });

  it("includes status changes in history", () => {
    td(["claim", "A01.T01.S001", "--agent", "c1"]);
    td(["status", "A01.T01.S001", "in-progress"]);
    const result = tdJson(["history", "A01.T01.S001"]);
    expect(result.data.length).toBeGreaterThanOrEqual(3);
    // First entry is the backlog->ready from setup
    expect(result.data[0].new_status).toBe("ready");
    expect(result.data[1].new_status).toBe("claimed");
  });
});

describe("td map", () => {
  it("renders story map", () => {
    const output = td(["map"]);
    expect(output).toContain("STORY MAP");
    expect(output).toContain("A01 Auth");
    expect(output).toContain("A01.T01 Login");
    expect(output).toContain("A01.T01.S001 Email login");
  });

  it("exports as JSON", () => {
    const output = td(["map", "--export", "json"]);
    const data = JSON.parse(output);
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0].tasks[0].stories).toHaveLength(2);
  });
});

describe("td stats", () => {
  it("shows statistics", () => {
    const result = tdJson(["stats"]);
    expect(result.data.activities).toBe(1);
    expect(result.data.tasks).toBe(1);
    expect(result.data.stories.total).toBe(2);
    expect(result.data.stories.ready).toBe(2);
  });
});
