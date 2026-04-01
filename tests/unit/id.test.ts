import { describe, it, expect } from "vitest";
import {
  parseId,
  formatGoalId,
  formatTaskId,
  formatFullId,
} from "../../src/model/id.js";

describe("parseId", () => {
  it("parses goal ID", () => {
    expect(parseId("G01")).toEqual({ goal: 1, type: "goal" });
    expect(parseId("G99")).toEqual({ goal: 99, type: "goal" });
  });

  it("parses task ID", () => {
    expect(parseId("G01.T002")).toEqual({
      goal: 1,
      task: 2,
      type: "task",
    });
  });

  it("parses project-qualified ID", () => {
    expect(parseId("MyProject::G01.T001")).toEqual({
      project: "MyProject",
      goal: 1,
      task: 1,
      type: "task",
    });
  });

  it("throws on invalid ID", () => {
    expect(() => parseId("")).toThrow("Invalid ID");
    expect(() => parseId("X01")).toThrow("Invalid ID");
    expect(() => parseId("G")).toThrow("Invalid ID");
    expect(() => parseId("A01.T01.S001")).toThrow("Invalid ID");
    expect(() => parseId("B001")).toThrow("Invalid ID");
  });
});

describe("formatGoalId", () => {
  it("formats with zero padding", () => {
    expect(formatGoalId(1)).toBe("G01");
    expect(formatGoalId(12)).toBe("G12");
  });
});

describe("formatTaskId", () => {
  it("formats hierarchically", () => {
    expect(formatTaskId(1, 2)).toBe("G01.T002");
    expect(formatTaskId(1, 100)).toBe("G01.T100");
  });
});

describe("formatFullId", () => {
  it("adds project prefix", () => {
    expect(formatFullId("MyProject", "G01.T001")).toBe(
      "MyProject::G01.T001",
    );
  });
});
