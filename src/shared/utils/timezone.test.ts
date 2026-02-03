import { describe, expect, test } from "bun:test";
import { isValidTimezone, resolveTimezone, formatTimeInTimezone } from "./timezone.js";

describe("timezone utils", () => {
  test("validates timezones", () => {
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Invalid/Zone")).toBe(false);
  });

  test("resolves with fallback", () => {
    expect(resolveTimezone("Invalid/Zone", "UTC")).toBe("UTC");
  });

  test("formats time in timezone", () => {
    const output = formatTimeInTimezone(new Date("2024-01-01T00:00:00Z"), "UTC");
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
