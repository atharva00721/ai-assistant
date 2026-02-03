export interface HabitIntent {
  action: "log" | "check" | "streak";
  habitName: string;
}

export function detectHabitIntent(message: string): HabitIntent | null {
  const lower = message.toLowerCase().trim();
  const logMatch = message.match(/\b(?:log|logged)\s+(.+?)(?:\s+today)?$/i) || message.match(/\blog\s+(.+)/i);
  if (logMatch?.[1]) return { action: "log", habitName: logMatch[1].trim() };
  const didIMatch = message.match(/\bdid I\s+(.+?)\s+today\??/i);
  if (didIMatch?.[1]) return { action: "check", habitName: didIMatch[1].trim() };
  const streakMatch = message.match(/(?:my\s+)?(.+?)\s+streak\??/i) || message.match(/\bstreak\s+(?:for\s+)?(.+?)\??$/i);
  if (streakMatch?.[1]) return { action: "streak", habitName: streakMatch[1].trim() };
  if (lower.includes("habit") && (lower.includes("log") || lower.includes("did i"))) {
    const parts = message.split(/\s+(?:today|log|did i)\s+/i);
    const name = parts[1]?.trim() || parts[0]?.replace(/habit|log|did i/gi, "").trim();
    if (name && name.length > 1) {
      if (lower.includes("did i")) return { action: "check", habitName: name };
      return { action: "log", habitName: name };
    }
  }
  return null;
}
