import { describe, it, expect } from "vitest";
import {
  validateStoryTransition,
  isValidStoryStatus,
} from "../../src/model/status.js";

describe("validateStoryTransition", () => {
  it("allows valid transitions", () => {
    expect(() => validateStoryTransition("backlog", "ready")).not.toThrow();
    expect(() => validateStoryTransition("ready", "claimed")).not.toThrow();
    expect(() => validateStoryTransition("claimed", "in-progress")).not.toThrow();
    expect(() => validateStoryTransition("in-progress", "done")).not.toThrow();
    expect(() => validateStoryTransition("in-progress", "blocked")).not.toThrow();
    expect(() => validateStoryTransition("blocked", "in-progress")).not.toThrow();
    expect(() => validateStoryTransition("in-progress", "review")).not.toThrow();
    expect(() => validateStoryTransition("review", "done")).not.toThrow();
    expect(() => validateStoryTransition("done", "ready")).not.toThrow();
  });

  it("allows cancel from any active state", () => {
    expect(() => validateStoryTransition("backlog", "cancelled")).not.toThrow();
    expect(() => validateStoryTransition("ready", "cancelled")).not.toThrow();
    expect(() => validateStoryTransition("claimed", "cancelled")).not.toThrow();
    expect(() => validateStoryTransition("in-progress", "cancelled")).not.toThrow();
    expect(() => validateStoryTransition("blocked", "cancelled")).not.toThrow();
    expect(() => validateStoryTransition("review", "cancelled")).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() => validateStoryTransition("backlog", "done")).toThrow("Invalid story status transition");
    expect(() => validateStoryTransition("ready", "done")).toThrow("Invalid story status transition");
    expect(() => validateStoryTransition("done", "in-progress")).toThrow("Invalid story status transition");
    expect(() => validateStoryTransition("backlog", "in-progress")).toThrow("Invalid story status transition");
  });
});

describe("isValidStoryStatus", () => {
  it("returns true for valid statuses", () => {
    expect(isValidStoryStatus("backlog")).toBe(true);
    expect(isValidStoryStatus("in-progress")).toBe(true);
    expect(isValidStoryStatus("done")).toBe(true);
  });

  it("returns false for invalid statuses", () => {
    expect(isValidStoryStatus("invalid")).toBe(false);
    expect(isValidStoryStatus("")).toBe(false);
  });
});
