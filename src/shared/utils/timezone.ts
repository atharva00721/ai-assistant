export function isValidTimezone(timezone: string): boolean {
  try {
    new Date().toLocaleString("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(timezone: string, fallback: string = "UTC"): string {
  return isValidTimezone(timezone) ? timezone : fallback;
}

export function formatTimeInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTimeShortInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
