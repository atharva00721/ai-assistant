import { generateText } from "ai";
import { resolveTimezone } from "../../shared/utils/timezone.js";
import { textModel } from "../clients.js";

interface ReminderIntent {
  type: "reminder";
  message: string;
  time: string;
}

function normalizeAssistantJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

function getReminderDetectionPrompt(userTimezone: string): string {
  const now = new Date();
  const safeTimezone = resolveTimezone(userTimezone);
  const userTime = new Date(
    now.toLocaleString("en-US", { timeZone: safeTimezone })
  );
  return `You detect if the user wants to set a REMINDER or scheduled task. No other intent.

User timezone: ${safeTimezone}
Current time there: ${userTime.toLocaleString("en-US", {
    timeZone: safeTimezone,
    hour12: true,
  })}
UTC now: ${now.toISOString()}

If they want a reminder, reply with ONLY this JSON (no other text):
{"type": "reminder", "message": "short reminder text", "time": "ISO 8601 in UTC"}

Rules:
- All times the user says are in timezone ${safeTimezone}. Convert to UTC for "time".
- "in 5 min" / "in 2 hours" → add to current UTC.
- "at 3pm", "at 15:00", "tonight at 8", "noon", "midnight" → that time today (or tomorrow if past) in ${safeTimezone}, then to UTC.
- "tomorrow 9am", "next Monday" → that day in ${safeTimezone}, then to UTC.
- "message": only the thing to be reminded (e.g. "Remind me to call mom" → "call mom"; "Don't forget medicine" → "take medicine").

If it is NOT a reminder/schedule request, reply with exactly: NOT_REMINDER

User message: `;
}

export async function detectReminderIntent(
  message: string,
  userTimezone: string,
): Promise<ReminderIntent | null> {
  if (!textModel) {
    return null;
  }
  try {
    const { text } = await generateText({
      model: textModel,
      prompt: getReminderDetectionPrompt(userTimezone) + message,
    });

    const trimmed = normalizeAssistantJson(text);

    if (trimmed === "NOT_REMINDER" || !trimmed.startsWith("{")) {
      return null;
    }

    const parsed = JSON.parse(trimmed);

    if (
      parsed.type === "reminder" &&
      typeof parsed.message === "string" &&
      typeof parsed.time === "string"
    ) {
      return parsed as ReminderIntent;
    }

    return null;
  } catch (error) {
    console.error("Error detecting reminder intent:", error);
    return null;
  }
}
