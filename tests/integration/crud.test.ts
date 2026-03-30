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

describe("activity CRUD", () => {
  it("add, list, show, edit, rm", () => {
    const added = tdJson(["activity", "add", "User Auth"]);
    expect(added.ok).toBe(true);
    expect(added.data.shortId).toBe("A01");
    expect(added.data.title).toBe("User Auth");

    tdJson(["activity", "add", "Payments"]);

    const list = tdJson(["activity", "list"]);
    expect(list.data).toHaveLength(2);

    const show = tdJson(["activity", "show", "A01"]);
    expect(show.data.title).toBe("User Auth");

    const edited = tdJson(["activity", "edit", "A01", "--title", "Authentication"]);
    expect(edited.data.title).toBe("Authentication");

    const removed = tdJson(["activity", "rm", "A01", "--confirm"]);
    expect(removed.data.deleted).toBe(true);

    const after = tdJson(["activity", "list"]);
    expect(after.data).toHaveLength(1);
  });
});

describe("task CRUD", () => {
  it("add, list, show, edit, rm", () => {
    tdJson(["activity", "add", "Auth"]);

    const added = tdJson(["task", "add", "A01", "Login"]);
    expect(added.ok).toBe(true);
    expect(added.data.title).toBe("Login");

    tdJson(["task", "add", "A01", "Registration"]);

    const list = tdJson(["task", "list"]);
    expect(list.data).toHaveLength(2);

    const filtered = tdJson(["task", "list", "A01"]);
    expect(filtered.data).toHaveLength(2);

    const edited = tdJson(["task", "edit", "A01.T01", "--title", "Login Flow"]);
    expect(edited.data.title).toBe("Login Flow");

    tdJson(["task", "rm", "A01.T01", "--confirm"]);
    const after = tdJson(["task", "list"]);
    expect(after.data).toHaveLength(1);
  });
});

describe("story CRUD", () => {
  it("add, list, show, edit, move, rm", () => {
    tdJson(["activity", "add", "Auth"]);
    tdJson(["task", "add", "A01", "Login"]);
    tdJson(["task", "add", "A01", "Signup"]);

    const added = tdJson(["story", "add", "A01.T01", "Email login"]);
    expect(added.ok).toBe(true);
    expect(added.data.shortId).toBe("A01.T01.S001");

    tdJson(["story", "add", "A01.T01", "OAuth2"]);

    const list = tdJson(["story", "list"]);
    expect(list.data).toHaveLength(2);

    const show = tdJson(["story", "show", "A01.T01.S001"]);
    expect(show.data.title).toBe("Email login");
    expect(show.data.status).toBe("backlog");

    const edited = tdJson(["story", "edit", "A01.T01.S001", "--title", "Email/password login"]);
    expect(edited.data.title).toBe("Email/password login");

    // Move story to different task
    const moved = tdJson(["story", "move", "A01.T01.S001", "A01.T02"]);
    expect(moved.data.task_id).toBe(2);

    tdJson(["story", "rm", "A01.T01.S001", "--confirm"]);
    const after = tdJson(["story", "list"]);
    expect(after.data).toHaveLength(1);
  });
});

describe("bug CRUD", () => {
  it("add, list, show, edit, link, unlink, rm", () => {
    tdJson(["activity", "add", "Auth"]);
    tdJson(["task", "add", "A01", "Login"]);
    tdJson(["story", "add", "A01.T01", "Email login"]);

    const added = tdJson(["bug", "add", "Safari crash", "--severity", "high", "--link", "A01.T01.S001"]);
    expect(added.ok).toBe(true);
    expect(added.data.shortId).toBe("B001");
    expect(added.data.severity).toBe("high");
    expect(added.data.linked_story_id).toBe(1);

    const list = tdJson(["bug", "list"]);
    expect(list.data).toHaveLength(1);

    const show = tdJson(["bug", "show", "B001"]);
    expect(show.data.title).toBe("Safari crash");

    const edited = tdJson(["bug", "edit", "B001", "--severity", "critical"]);
    expect(edited.data.severity).toBe("critical");

    const unlinked = tdJson(["bug", "unlink", "B001"]);
    expect(unlinked.data.linked_story_id).toBeNull();

    const linked = tdJson(["bug", "link", "B001", "A01.T01.S001"]);
    expect(linked.data.linked_story_id).toBe(1);

    tdJson(["bug", "rm", "B001", "--confirm"]);
    const after = tdJson(["bug", "list"]);
    expect(after.data).toHaveLength(0);
  });
});

describe("release CRUD", () => {
  it("add, list, show, assign, unassign, rm", () => {
    tdJson(["activity", "add", "Auth"]);
    tdJson(["task", "add", "A01", "Login"]);
    tdJson(["story", "add", "A01.T01", "Email login"]);

    const added = tdJson(["release", "add", "MVP"]);
    expect(added.ok).toBe(true);
    expect(added.data.name).toBe("MVP");

    const list = tdJson(["release", "list"]);
    expect(list.data).toHaveLength(1);

    tdJson(["release", "assign", "A01.T01.S001", "MVP"]);

    const show = tdJson(["release", "show", "MVP"]);
    expect(show.data.stories).toHaveLength(1);
    expect(show.data.stories[0].shortId).toBe("A01.T01.S001");

    tdJson(["release", "unassign", "A01.T01.S001"]);
    const after = tdJson(["release", "show", "MVP"]);
    expect(after.data.stories).toHaveLength(0);

    const edited = tdJson(["release", "edit", "MVP", "--status", "active"]);
    expect(edited.data.status).toBe("active");

    tdJson(["release", "rm", "MVP", "--confirm"]);
    const final = tdJson(["release", "list"]);
    expect(final.data).toHaveLength(0);
  });
});
