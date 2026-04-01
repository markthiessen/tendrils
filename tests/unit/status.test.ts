import { describe, it, expect } from "vitest";
import {
  validateTaskTransition,
  isValidTaskStatus,
} from "../../src/model/status.js";

describe("validateTaskTransition", () => {
  it("allows valid transitions", () => {
    expect(() => validateTaskTransition("backlog", "ready")).not.toThrow();
    expect(() => validateTaskTransition("ready", "claimed")).not.toThrow();
    expect(() => validateTaskTransition("claimed", "in-progress")).not.toThrow();
    expect(() => validateTaskTransition("in-progress", "done")).not.toThrow();
    expect(() => validateTaskTransition("in-progress", "blocked")).not.toThrow();
    expect(() => validateTaskTransition("blocked", "in-progress")).not.toThrow();
    expect(() => validateTaskTransition("in-progress", "review")).not.toThrow();
    expect(() => validateTaskTransition("review", "done")).not.toThrow();
    expect(() => validateTaskTransition("done", "ready")).not.toThrow();
  });

  it("allows cancel from any active state", () => {
    expect(() => validateTaskTransition("backlog", "cancelled")).not.toThrow();
    expect(() => validateTaskTransition("ready", "cancelled")).not.toThrow();
    expect(() => validateTaskTransition("claimed", "cancelled")).not.toThrow();
    expect(() => validateTaskTransition("in-progress", "cancelled")).not.toThrow();
    expect(() => validateTaskTransition("blocked", "cancelled")).not.toThrow();
    expect(() => validateTaskTransition("review", "cancelled")).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() => validateTaskTransition("backlog", "done")).toThrow("Invalid task status transition");
    expect(() => validateTaskTransition("ready", "done")).toThrow("Invalid task status transition");
    expect(() => validateTaskTransition("done", "in-progress")).toThrow("Invalid task status transition");
    expect(() => validateTaskTransition("backlog", "in-progress")).toThrow("Invalid task status transition");
  });
});

describe("isValidTaskStatus", () => {
  it("returns true for valid statuses", () => {
    expect(isValidTaskStatus("backlog")).toBe(true);
    expect(isValidTaskStatus("in-progress")).toBe(true);
    expect(isValidTaskStatus("done")).toBe(true);
  });

  it("returns false for invalid statuses", () => {
    expect(isValidTaskStatus("invalid")).toBe(false);
    expect(isValidTaskStatus("")).toBe(false);
  });
});
