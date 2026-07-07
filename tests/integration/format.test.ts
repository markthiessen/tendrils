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

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-format-"));
  testCwd = fs.mkdtempSync(path.join(os.tmpdir(), "tendrils-cwd-"));
  td(["init", "test"]);
  // Seed decisions with substantial titles so the box-drawing table's
  // per-cell padding and per-row borders are representative.
  for (let i = 1; i <= 6; i++) {
    td([
      "decide",
      `Decision number ${i} describing a convention agents must follow across repos`,
      "--tag",
      "convention,api",
    ]);
  }
  // Seed map/arch content for the other commands.
  td(["goal", "add", "Auth"]);
  td(["task", "add", "G01", "Email login"]);
  td(["arch", "set", "graph TD; CLI-->DB"]);
  td(["arch", "note", "CLI", "Commander CLI"]);
});

afterEach(() => {
  fs.rmSync(testHome, { recursive: true, force: true });
  fs.rmSync(testCwd, { recursive: true, force: true });
});

describe("td decisions --format md", () => {
  it("emits a markdown table with a header and separator row", () => {
    const out = td(["decisions", "--format", "md"]);
    const lines = out.split("\n");
    expect(lines[0]).toBe("| ID | Decision | Tags | Agent | Date |");
    expect(lines[1]).toBe("| --- | --- | --- | --- | --- |");
    // No box-drawing characters in the compact form.
    expect(out).not.toMatch(/[─│┼┌┐└┘├┤┬┴]/);
  });

  it("keeps the same fields as the default table", () => {
    const out = td(["decisions", "--format", "md"]);
    expect(out).toContain("D1");
    expect(out).toContain("Decision number 1");
    expect(out).toContain("convention,api");
    // One data row per seeded decision (plus header + separator).
    const dataRows = out.split("\n").filter((l) => /^\| D\d/.test(l));
    expect(dataRows).toHaveLength(6);
  });

  it("is at most half the size of the default table output", () => {
    const table = td(["decisions"]);
    const md = td(["decisions", "--format", "md"]);
    expect(md.length).toBeLessThanOrEqual(table.length / 2);
  });

  it("leaves the default (table) output as box-drawing", () => {
    const table = td(["decisions"]);
    expect(table).toMatch(/[─│]/);
  });
});

describe("td repos --format md", () => {
  it("emits a markdown table instead of box-drawing", () => {
    const out = td(["repos", "--format", "md"]);
    expect(out.split("\n")[1]).toContain("---");
    expect(out).not.toMatch(/[─│]/);
    expect(out).toContain("tendrils");
  });
});

describe("td map --format md", () => {
  it("emits markdown headings and list items with status words", () => {
    const out = td(["map", "--format", "md"]);
    expect(out).toContain("# Map");
    expect(out).toContain("## G01 Auth");
    expect(out).toContain("- [backlog] G01.T001 Email login");
    // No cryptic status icons in the markdown form.
    expect(out).not.toContain("[ ]");
  });
});

describe("td stats --format md", () => {
  it("emits a markdown list", () => {
    const out = td(["stats", "--format", "md"]);
    expect(out).toContain("# Stats");
    expect(out).toContain("- Goals: 1");
    expect(out).toContain("- Tasks: 1");
  });
});

describe("td arch --format md", () => {
  it("renders notes as a markdown list under a heading", () => {
    const out = td(["arch", "--format", "md"]);
    expect(out).toContain("```mermaid");
    expect(out).toContain("### Notes");
    expect(out).toContain("- CLI (node): Commander CLI");
  });
});
