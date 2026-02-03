import { describe, expect, test } from "bun:test";
import { detectExplicitWebSearch, detectSearchIntent, detectWeatherIntent } from "./search.js";

describe("search intent detection", () => {
  test("detects explicit search", () => {
    expect(detectExplicitWebSearch("search for iPhone"))
      .toBe(true);
  });

  test("detects time-sensitive search", () => {
    expect(detectSearchIntent("latest news about AI"))
      .toBe(true);
  });

  test("detects weather intent", () => {
    expect(detectWeatherIntent("what's the weather in nyc"))
      .toBe(true);
  });
});
