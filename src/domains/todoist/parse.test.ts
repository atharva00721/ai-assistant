import { describe, expect, test } from "bun:test";
import { normalizeAssistantJson, parseTodoistIntent } from "./parse.js";

describe("todoist parse", () => {
  test("normalizes fenced json", () => {
    const text = "```json\n{\"intent\":\"LIST_TASKS\",\"params\":{}}\n```";
    expect(normalizeAssistantJson(text)).toBe("{\"intent\":\"LIST_TASKS\",\"params\":{}}" );
  });

  test("parses valid intent", () => {
    const parsed = parseTodoistIntent('{"intent":"LIST_TASKS","params":{}}');
    expect(parsed?.intent).toBe("LIST_TASKS");
  });

  test("returns null for NOT_TODOIST", () => {
    expect(parseTodoistIntent("NOT_TODOIST")).toBeNull();
  });
});
