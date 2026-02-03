import type { MorningJobDigestConfig } from "./repo.js";
import {
  findMorningJobDigest,
  upsertMorningJobDigest,
  updateMorningJobDigestLastSent,
} from "./repo.js";

const DEFAULT_TIME = "09:00";

function normalizeHandle(handle: string): string {
  const trimmed = handle.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : "";
}

export function formatMorningJobDigestMessage(config: MorningJobDigestConfig): string {
  const handles = config.twitterHandles?.length
    ? config.twitterHandles.map((h) => (h.startsWith("@") ? h : `@${h}`))
    : [];
  if (handles.length === 0) {
    return "☀️ Good morning!\n\nYour job list is empty. Add Twitter handles and I'll remind you to reach out every morning.";
  }
  const list = handles.map((h, i) => `${i + 1}. ${h}`).join("\n");
  return `☀️ Good morning! Here’s your list of Twitter accounts to reach out to for jobs today:\n\n${list}\n\nGo get ’em.`;
}

export async function getMorningJobDigestState(userId: string): Promise<{
  enabled: boolean;
  time: string;
  handles: string[];
  reply: string;
}> {
  const row = await findMorningJobDigest(userId);
  const config = (row?.config as MorningJobDigestConfig) || {
    time: DEFAULT_TIME,
    twitterHandles: [],
  };
  const handles = Array.isArray(config.twitterHandles) ? config.twitterHandles : [];
  const time = config.time || DEFAULT_TIME;
  const enabled = row?.enabled ?? false;

  if (handles.length === 0 && !enabled) {
    return {
      enabled: false,
      time,
      handles: [],
      reply:
        "You don’t have a morning job list yet. Say something like:\n• \"Add @recruiter to my morning job list\"\n• \"Send me my job list every day at 9am\"",
    };
  }

  const listStr =
    handles.length > 0 ? handles.map((h) => (h.startsWith("@") ? h : `@${h}`)).join(", ") : "—";
  const status = enabled ? `on (I'll text you at ${time})` : "off";
  return {
    enabled,
    time,
    handles,
    reply: `Morning job list: ${status}\nTime: ${time}\nHandles: ${listStr}\n\nAdd/remove handles or say "enable/disable morning job digest".`,
  };
}

export async function addHandleToMorningJobDigest(
  userId: string,
  handle: string,
): Promise<{ reply: string }> {
  const normalized = normalizeHandle(handle);
  if (!normalized) {
    return { reply: "Give me a Twitter handle (e.g. @someone or someone)." };
  }

  const row = await findMorningJobDigest(userId);
  const config: MorningJobDigestConfig = row?.config
    ? { ...(row.config as MorningJobDigestConfig) }
    : { time: DEFAULT_TIME, twitterHandles: [] };
  if (!Array.isArray(config.twitterHandles)) config.twitterHandles = [];
  const existing = config.twitterHandles.map((h) => (h.startsWith("@") ? h : `@${h}`));
  if (existing.includes(normalized)) {
    return { reply: `${normalized} is already on your list.` };
  }
  config.twitterHandles = [...config.twitterHandles, normalized];
  await upsertMorningJobDigest(userId, config, row?.enabled ?? true);
  return {
    reply: `Added ${normalized} to your morning job list. You now have ${config.twitterHandles.length} account(s). Say "send my job list at 9am" to get a reminder every day.`,
  };
}

export async function removeHandleFromMorningJobDigest(
  userId: string,
  handle: string,
): Promise<{ reply: string }> {
  const normalized = normalizeHandle(handle);
  if (!normalized) {
    return { reply: "Which handle should I remove? (e.g. @someone)" };
  }

  const row = await findMorningJobDigest(userId);
  if (!row) {
    return { reply: "You don't have a morning job list yet." };
  }
  const config = { ...(row.config as MorningJobDigestConfig) };
  if (!Array.isArray(config.twitterHandles)) config.twitterHandles = [];
  const before = config.twitterHandles.length;
  config.twitterHandles = config.twitterHandles.filter((h) => {
    const n = h.startsWith("@") ? h : `@${h}`;
    return n !== normalized;
  });
  if (config.twitterHandles.length === before) {
    return { reply: `${normalized} wasn't on your list.` };
  }
  await upsertMorningJobDigest(userId, config, row.enabled);
  return {
    reply: `Removed ${normalized}. You have ${config.twitterHandles.length} account(s) left.`,
  };
}

export async function setMorningJobDigestTime(
  userId: string,
  timeStr: string,
): Promise<{ reply: string }> {
  // Accept "9", "9am", "09:00", "9:00"
  const normalized = timeStr.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  let hour: number;
  let minute: number;
  if (match) {
    hour = parseInt(match[1], 10);
    const minPart = match[2];
    minute = minPart ? parseInt(minPart, 10) : 0;
    const ampm = (match[3] || "").toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (!ampm && hour <= 12) hour = hour === 12 ? 12 : hour; // 9 = 9am, 12 = noon
  } else {
    return { reply: "Use a time like 9am, 9:00, or 09:00." };
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { reply: "That time doesn’t look right. Try e.g. 9am or 09:00." };
  }
  const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  const row = await findMorningJobDigest(userId);
  const config: MorningJobDigestConfig = row?.config
    ? { ...(row.config as MorningJobDigestConfig) }
    : { time: DEFAULT_TIME, twitterHandles: [] };
  config.time = time;
  await upsertMorningJobDigest(userId, config, true); // setting a time turns the digest on
  return {
    reply: `I’ll send your morning job list at ${time} every day.`,
  };
}

export async function setMorningJobDigestEnabled(
  userId: string,
  enabled: boolean,
): Promise<{ reply: string }> {
  const row = await findMorningJobDigest(userId);
  const config: MorningJobDigestConfig = row?.config
    ? { ...(row.config as MorningJobDigestConfig) }
    : { time: DEFAULT_TIME, twitterHandles: [] };
  await upsertMorningJobDigest(userId, config, enabled);
  return {
    reply: enabled
      ? `Morning job digest is on. I’ll send your list at ${config.time} every day.`
      : "Morning job digest is off. Say \"enable morning job digest\" to turn it back on.",
  };
}

export {
  updateMorningJobDigestLastSent,
  findMorningJobDigest,
};
export type { MorningJobDigestConfig };
