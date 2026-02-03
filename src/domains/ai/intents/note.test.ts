import { describe, expect, test } from "bun:test";
import { detectNoteIntent } from "./note.js";

describe("detectNoteIntent", () => {
  test("detects save intents", () => {
    const intent = detectNoteIntent("Remember that buy milk");
    expect(intent?.action).toBe("save");
    expect(intent?.content).toBe("buy milk");
  });

  test("detects search intents", () => {
    const intent = detectNoteIntent("What did I save about onboarding?");
    expect(intent?.action).toBe("search");
    expect(intent?.query).toBe("onboarding");
  });

  test("returns null when no intent", () => {
    expect(detectNoteIntent("hello there")).toBeNull();
  });
});
