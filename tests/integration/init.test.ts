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
  it("creates a new workspace", () => {
    const output = td(["init", "my-project"]);
    expect(output).toContain("Workspace 'my-project' created");

    // Check files were created
    expect(
      fs.existsSync(path.join(testHome, "workspaces", "my-project", "map.db")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(testHome, "workspaces", "my-project", "config.toml")),
    ).toBe(true);
    expect(fs.existsSync(path.join(testCwd, ".tendrils", "config.toml"))).toBe(true);

    // Check binding content
    const binding = fs.readFileSync(
      path.join(testCwd, ".tendrils", "config.toml"),
      "utf-8",
    );
    expect(binding).toContain('workspace = "my-project"');
  });

  it("returns JSON on --json", () => {
    const result = tdJson(["init", "my-project"]) as {
      ok: boolean;
      data: { workspace: string };
    };
    expect(result.ok).toBe(true);
    expect(result.data.workspace).toBe("my-project");
  });

  it("binds to existing workspace on second init", () => {
    td(["init", "my-project"]);

    // Init from a different directory
    const otherCwd = fs.mkdtempSync(
      path.join(os.tmpdir(), "tendrils-other-"),
    );
    try {
      const output = td(["init", "my-project"], { cwd: otherCwd });
      expect(output).toContain("to workspace 'my-project'");
    } finally {
      fs.rmSync(otherCwd, { recursive: true, force: true });
    }
  });

  it("uses 'default' when no name given", () => {
    const result = tdJson(["init"]) as {
      ok: boolean;
      data: { workspace: string };
    };
    expect(result.ok).toBe(true);
    expect(result.data.workspace).toBe("default");
  });
});

describe("td workspace list", () => {
  it("shows empty list when no workspaces", () => {
    const result = tdJson(["workspace", "list"]) as {
      ok: boolean;
      data: unknown[];
    };
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });

  it("lists created workspaces", () => {
    td(["init", "my-project"]);
    td(["init", "other-project"]);
    const result = tdJson(["workspace", "list"]) as {
      ok: boolean;
      data: Array<{ name: string }>;
    };
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(2);
    const names = result.data.map((w) => w.name).sort();
    expect(names).toEqual(["my-project", "other-project"]);
  });
});

describe("td workspace info", () => {
  it("shows workspace details", () => {
    td(["init", "my-project"]);
    const result = tdJson(["workspace", "info", "my-project"]) as {
      ok: boolean;
      data: { name: string; bindings: Array<{ path: string }> };
    };
    expect(result.ok).toBe(true);
    expect(result.data.name).toBe("my-project");
    expect(result.data.bindings).toHaveLength(1);
  });
});
