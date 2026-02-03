import { describe, expect, test } from "bun:test";
import { detectHabitIntent } from "./habit.js";

describe("detectHabitIntent", () => {
  test("detects log intent", () => {
    const intent = detectHabitIntent("log meditation today");
    expect(intent).toEqual({ action: "log", habitName: "meditation" });
  });

  test("detects check intent", () => {
    const intent = detectHabitIntent("did I drink water today?");
    expect(intent).toEqual({ action: "check", habitName: "drink water" });
  });

  test("detects streak intent", () => {
    const intent = detectHabitIntent("running streak");
    expect(intent).toEqual({ action: "streak", habitName: "running" });
  });
});
