import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let testHome: string;
let testCwd: string;

function td(args: string[], opts?: { cwd?: string }): string {
  const result = execFileSync(
    "node",
    [path.join(__dirname, "../../dist/index.js"), ...args],
    {
      env: { ...process.env, TD_HOME: testHome },
      cwd: opts?.cwd ?? testCwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  return result.trim();
}

function tdJson(args: string[], opts?: { cwd?: string }): unknown {
  const output = td(["--json", ...args], opts);
  return JSON.parse(output);
}

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-test-"));
  testCwd = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-cwd-"));
});

afterEach(() => {
  fs.rmSync(testHome, { recursive: true, force: true });
  fs.rmSync(testCwd, { recursive: true, force: true });
});

describe("td init", () => {
  it("creates a new project", () => {
    const output = td(["init", "rocket"]);
    expect(output).toContain("Project 'rocket' created");

    // Check files were created
    expect(
      fs.existsSync(path.join(testHome, "projects", "rocket", "map.db")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(testHome, "projects", "rocket", "config.toml")),
    ).toBe(true);
    expect(fs.existsSync(path.join(testCwd, ".tendrils.toml"))).toBe(true);

    // Check binding content
    const binding = fs.readFileSync(
      path.join(testCwd, ".tendrils.toml"),
      "utf-8",
    );
    expect(binding).toContain('project = "rocket"');
  });

  it("returns JSON on --json", () => {
    const result = tdJson(["init", "rocket"]) as {
      ok: boolean;
      data: { project: string };
    };
    expect(result.ok).toBe(true);
    expect(result.data.project).toBe("rocket");
  });

  it("binds to existing project on second init", () => {
    td(["init", "rocket"]);

    // Init from a different directory
    const otherCwd = fs.mkdtempSync(
      path.join(os.tmpdir(), "tendrils-other-"),
    );
    try {
      const output = td(["init", "rocket"], { cwd: otherCwd });
      expect(output).toContain("Bound current directory");
    } finally {
      fs.rmSync(otherCwd, { recursive: true, force: true });
    }
  });

  it("uses 'default' when no name given", () => {
    const result = tdJson(["init"]) as {
      ok: boolean;
      data: { project: string };
    };
    expect(result.ok).toBe(true);
    expect(result.data.project).toBe("default");
  });
});

describe("td project list", () => {
  it("shows empty list when no projects", () => {
    const result = tdJson(["project", "list"]) as {
      ok: boolean;
      data: unknown[];
    };
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });

  it("lists created projects", () => {
    td(["init", "rocket"]);
    td(["init", "atlas"]);
    const result = tdJson(["project", "list"]) as {
      ok: boolean;
      data: Array<{ slug: string; name: string }>;
    };
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(2);
    const slugs = result.data.map((p) => p.slug).sort();
    expect(slugs).toEqual(["atlas", "rocket"]);
  });
});

describe("td project info", () => {
  it("shows project details", () => {
    td(["init", "rocket"]);
    const result = tdJson(["project", "info", "rocket"]) as {
      ok: boolean;
      data: { slug: string; name: string; bindings: Array<{ path: string }> };
    };
    expect(result.ok).toBe(true);
    expect(result.data.slug).toBe("rocket");
    expect(result.data.name).toBe("rocket");
    expect(result.data.bindings).toHaveLength(1);
  });
});
