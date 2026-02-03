export type JobDigestIntent =
  | { action: "show" }
  | { action: "add_handle"; handle: string }
  | { action: "remove_handle"; handle: string }
  | { action: "set_time"; time: string }
  | { action: "enable" }
  | { action: "disable" };

/** Extract Twitter handle from message: @handle or "handle" after add/remove. */
function extractHandle(message: string, addOrRemove: "add" | "remove"): string | null {
  const lower = message.toLowerCase().trim();
  // "add @foo to my job list", "add @foo", "add foo to morning list"
  const addMatch = message.match(
    /(?:add|put)\s+(@?\w[\w.]*)\s*(?:to\s+(?:my\s+)?(?:morning\s+)?(?:job\s+)?list)?/i,
  );
  if (addOrRemove === "add" && addMatch?.[1]) return addMatch[1].trim();
  const removeMatch = message.match(
    /(?:remove|delete|drop)\s+(@?\w[\w.]*)\s*(?:from\s+(?:my\s+)?(?:morning\s+)?(?:job\s+)?list)?/i,
  );
  if (addOrRemove === "remove" && removeMatch?.[1]) return removeMatch[1].trim();
  return null;
}

/** Extract time: "at 9am", "at 9:00", "every day at 9", "9am" */
function extractTime(message: string): string | null {
  const m = message.match(
    /(?:at|@|every\s+(?:day\s+)?at?)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:every|daily|morning)/i,
  );
  if (m?.[1]) return m[1].trim();
  if (m?.[2]) return m[2].trim();
  const simple = message.match(/(\d{1,2})\s*(?:am|pm|:00)?/i);
  if (simple?.[1]) return simple[1] + (message.toLowerCase().includes("pm") ? "pm" : "am");
  return null;
}

export function detectJobDigestIntent(message: string): JobDigestIntent | null {
  const lower = message.toLowerCase().trim();

  // Show / list / what's my ...
  if (
    /(?:show|list|get|what'?s?|what is)\s+(?:my\s+)?(?:morning\s+)?(?:job\s+)?(?:list|digest|twitter)/i.test(
      message,
    ) ||
    lower === "morning job list" ||
    lower === "job list" ||
    /(?:who|which)\s+(?:twitter\s+)?(?:accounts?|handles?)\s+(?:to\s+)?(?:text|dm|message)/i.test(
      message,
    )
  ) {
    return { action: "show" };
  }

  // Enable
  if (
    /(?:enable|turn on|start)\s+(?:my\s+)?(?:morning\s+)?(?:job\s+)?(?:list|digest)/i.test(
      message,
    ) ||
    /(?:send|text)\s+me\s+(?:my\s+)?(?:job\s+)?list\s+(?:every\s+(?:day\s+)?)?(?:at|@)/i.test(
      message,
    )
  ) {
    const time = extractTime(message);
    if (time) return { action: "set_time", time };
    return { action: "enable" };
  }

  // Disable
  if (
    /(?:disable|turn off|stop)\s+(?:my\s+)?(?:morning\s+)?(?:job\s+)?(?:list|digest)/i.test(
      message,
    )
  ) {
    return { action: "disable" };
  }

  // Set time: "send my job list at 9am", "morning digest at 8:30"
  if (
    /(?:at|@)\s*\d|(?:send|get)\s+(?:my\s+)?(?:morning\s+)?(?:job\s+)?list\s+(?:every\s+)?(?:day\s+)?(?:at|@)/i.test(
      message,
    )
  ) {
    const time = extractTime(message);
    if (time) return { action: "set_time", time };
  }

  // Add handle
  if (
    /(?:add|put)\s+@?\w/.test(message) &&
    /(?:job|morning|twitter|list|digest|text\s+for\s+job)/i.test(message)
  ) {
    const handle = extractHandle(message, "add");
    if (handle) return { action: "add_handle", handle };
  }
  if (/add\s+@?\w[\w.]*\s+to\s+my\s+(?:morning\s+)?(?:job\s+)?list/i.test(message)) {
    const handle = message.match(/add\s+(@?\w[\w.]*)\s+to/i)?.[1];
    if (handle) return { action: "add_handle", handle };
  }

  // Remove handle
  if (
    /(?:remove|delete|drop)\s+@?\w/.test(message) &&
    /(?:job|morning|twitter|list|digest)/i.test(message)
  ) {
    const handle = extractHandle(message, "remove");
    if (handle) return { action: "remove_handle", handle };
  }

  return null;
}
