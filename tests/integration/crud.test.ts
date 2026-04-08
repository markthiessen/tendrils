import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let testHome: string;
let testCwd: string;

function td(args: string[]): string {
  return execFileSync(
    "node",
    [path.join(__dirname, "../../dist/index.js"), ...args],
    {
      env: { ...process.env, TD_HOME: testHome },
      cwd: testCwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
}

function tdJson(args: string[]): any {
  const output = td(["--json", ...args]);
  return JSON.parse(output);
}

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-crud-"));
  testCwd = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-cwd-"));
  td(["init", "test"]);
});

afterEach(() => {
  fs.rmSync(testHome, { recursive: true, force: true });
  fs.rmSync(testCwd, { recursive: true, force: true });
});

describe("goal CRUD", () => {
  it("add, list, show, edit, rm", () => {
    const added = tdJson(["goal", "add", "User Auth"]);
    expect(added.ok).toBe(true);
    expect(added.data.shortId).toBe("G01");
    expect(added.data.title).toBe("User Auth");

    tdJson(["goal", "add", "Payments"]);

    const list = tdJson(["goal", "list"]);
    expect(list.data).toHaveLength(2);

    const show = tdJson(["goal", "show", "G01"]);
    expect(show.data.title).toBe("User Auth");

    const edited = tdJson(["goal", "edit", "G01", "--title", "Authentication"]);
    expect(edited.data.title).toBe("Authentication");

    const removed = tdJson(["goal", "rm", "G01", "--confirm"]);
    expect(removed.data.deleted).toBe(true);

    const after = tdJson(["goal", "list"]);
    expect(after.data).toHaveLength(1);
  });
});

describe("task CRUD", () => {
  it("add, list, show, edit, move, rm", { timeout: 15000 }, () => {
    tdJson(["goal", "add", "Auth"]);
    tdJson(["goal", "add", "Payments"]);

    const added = tdJson(["task", "add", "G01", "Email login"]);
    expect(added.ok).toBe(true);
    expect(added.data.shortId).toBe("G01.T001");

    tdJson(["task", "add", "G01", "OAuth2"]);

    const list = tdJson(["task", "list"]);
    expect(list.data).toHaveLength(2);

    const filtered = tdJson(["task", "list", "G01"]);
    expect(filtered.data).toHaveLength(2);

    const show = tdJson(["task", "show", "G01.T001"]);
    expect(show.data.title).toBe("Email login");
    expect(show.data.status).toBe("backlog");

    const edited = tdJson(["task", "edit", "G01.T001", "--title", "Email/password login"]);
    expect(edited.data.title).toBe("Email/password login");

    // Move task to different goal
    const moved = tdJson(["task", "move", "G01.T001", "G02"]);
    expect(moved.data.goal_id).toBe(2);

    tdJson(["task", "rm", "G01.T001", "--confirm"]);
    const after = tdJson(["task", "list"]);
    expect(after.data).toHaveLength(1);
  });
});
