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
    expect(detectFocusIntent("hello"))
      .toBeNull();
  });
});
