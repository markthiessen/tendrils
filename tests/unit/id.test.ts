import { describe, it, expect } from "vitest";
import {
  parseId,
  formatActivityId,
  formatTaskId,
  formatStoryId,
  formatFullId,
} from "../../src/model/id.js";

describe("parseId", () => {
  it("parses activity ID", () => {
    expect(parseId("A01")).toEqual({ activity: 1, type: "activity" });
    expect(parseId("A99")).toEqual({ activity: 99, type: "activity" });
  });

  it("parses task ID", () => {
    expect(parseId("A01.T02")).toEqual({
      activity: 1,
      task: 2,
      type: "task",
    });
  });

  it("parses story ID", () => {
    expect(parseId("A01.T02.S001")).toEqual({
      activity: 1,
      task: 2,
      story: 1,
      type: "story",
    });
  });

  it("parses project-qualified ID", () => {
    expect(parseId("MyProject::A01.T02.S001")).toEqual({
      project: "MyProject",
      activity: 1,
      task: 2,
      story: 1,
      type: "story",
    });
  });

  it("throws on invalid ID", () => {
    expect(() => parseId("")).toThrow("Invalid ID");
    expect(() => parseId("X01")).toThrow("Invalid ID");
    expect(() => parseId("A")).toThrow("Invalid ID");
    expect(() => parseId("A01.S001")).toThrow("Invalid ID");
    expect(() => parseId("B001")).toThrow("Invalid ID");
  });
});

describe("formatActivityId", () => {
  it("formats with zero padding", () => {
    expect(formatActivityId(1)).toBe("A01");
    expect(formatActivityId(12)).toBe("A12");
  });
});

describe("formatTaskId", () => {
  it("formats hierarchically", () => {
    expect(formatTaskId(1, 2)).toBe("A01.T02");
  });
});

describe("formatStoryId", () => {
  it("formats with 3-digit padding", () => {
    expect(formatStoryId(1, 2, 3)).toBe("A01.T02.S003");
    expect(formatStoryId(1, 2, 100)).toBe("A01.T02.S100");
  });
});

describe("formatFullId", () => {
  it("adds project prefix", () => {
    expect(formatFullId("MyProject", "A01.T02.S001")).toBe(
      "MyProject::A01.T02.S001",
    );
  });
});
