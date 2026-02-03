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

/** Current time in timezone as "HH:mm" (24h). */
export function getTimeInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Date in timezone as "YYYY-MM-DD" for daily digest tracking. */
export function getDateStringInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, "-");
}
