import { describe, expect, test } from "bun:test";
import { detectFocusIntent } from "./focus.js";

describe("detectFocusIntent", () => {
  test("defaults to 25 minutes", () => {
    const intent = detectFocusIntent("start a focus session");
    expect(intent?.durationMinutes).toBe(25);
  });

  test("parses explicit minutes", () => {
    const intent = detectFocusIntent("focus for 45 min");
    expect(intent?.durationMinutes).toBe(45);
  });

  test("returns null if not a focus request", () => {
    expect(detectFocusIntent("hello")).toBeNull();
  });

  test("returns null for reminder phrasing so reminder intent can handle it", () => {
    expect(detectFocusIntent("remind me in 10 min")).toBeNull();
    expect(detectFocusIntent("don't forget to call, set a timer for 5 min")).toBeNull();
  });
});
