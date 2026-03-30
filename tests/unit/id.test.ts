import { describe, it, expect } from "vitest";
import {
  parseId,
  formatActivityId,
  formatTaskId,
  formatStoryId,
  formatBugId,
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

  it("parses bug ID", () => {
    expect(parseId("B001")).toEqual({ bug: 1, type: "bug" });
    expect(parseId("B123")).toEqual({ bug: 123, type: "bug" });
  });

  it("parses project-qualified ID", () => {
    expect(parseId("Rocket::A01.T02.S001")).toEqual({
      project: "Rocket",
      activity: 1,
      task: 2,
      story: 1,
      type: "story",
    });
    expect(parseId("my-project::B042")).toEqual({
      project: "my-project",
      bug: 42,
      type: "bug",
    });
  });

  it("throws on invalid ID", () => {
    expect(() => parseId("")).toThrow("Invalid ID");
    expect(() => parseId("X01")).toThrow("Invalid ID");
    expect(() => parseId("A")).toThrow("Invalid ID");
    expect(() => parseId("A01.S001")).toThrow("Invalid ID");
    expect(() => parseId("A01.T02.B001")).toThrow("Invalid ID");
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

describe("formatBugId", () => {
  it("formats with 3-digit padding", () => {
    expect(formatBugId(1)).toBe("B001");
    expect(formatBugId(42)).toBe("B042");
  });
});

describe("formatFullId", () => {
  it("adds project prefix", () => {
    expect(formatFullId("Rocket", "A01.T02.S001")).toBe(
      "Rocket::A01.T02.S001",
    );
  });
});
