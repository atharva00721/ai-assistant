import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const apiKey = Bun.env.ANANNAS_API_KEY;
if (!apiKey) {
  throw new Error("ANANNAS_API_KEY is required.");
}

const openai = createOpenAI({
  baseURL: "https://api.anannas.ai/v1",
  apiKey,
});
const textModel = openai.chat("openai-gpt-oss-20b-1-0");

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversations = new Map<string, Message[]>();
const MAX_HISTORY = 20; // Keep last 20 messages per user
const SYSTEM_PROMPT =
  "You are a friendly texting buddy and assistant. Keep replies warm, helpful, and concise. Ask brief follow-up questions when needed, use a casual tone, and avoid sounding overly formal. Do not use markdown or formatting symbols like *, _, or backticks.";

const REMINDER_DETECTION_PROMPT = `You are a reminder detection system. Analyze if the user wants to set a reminder or schedule a task.

If the user wants to set a reminder, respond with ONLY valid JSON in this exact format:
{
  "type": "reminder",
  "message": "the reminder message",
  "time": "ISO 8601 datetime string"
}

Examples:
- "Remind me to call mom at 3pm tomorrow" -> {"type": "reminder", "message": "call mom", "time": "2026-02-03T15:00:00Z"}
- "Set a reminder for my meeting in 2 hours" -> {"type": "reminder", "message": "meeting", "time": "2026-02-02T16:30:00Z"}
- "Schedule a task to buy groceries at 5pm" -> {"type": "reminder", "message": "buy groceries", "time": "2026-02-02T17:00:00Z"}

If this is NOT a reminder request, respond with the text "NOT_REMINDER".

Current time: ${new Date().toISOString()}
User message: `;

function detectImageRequest(message: string): boolean {
  const imageKeywords = [
    "generate image",
    "create image",
    "make image",
    "draw",
    "picture of",
    "show me",
    "/image",
    "visualize",
  ];
  const lowerMessage = message.toLowerCase();
  return imageKeywords.some((keyword) => lowerMessage.includes(keyword));
}

interface ReminderIntent {
  type: "reminder";
  message: string;
  time: string; // ISO 8601 format
}

async function detectReminderIntent(
  message: string,
): Promise<ReminderIntent | null> {
  try {
    const { text } = await generateText({
      model: textModel,
      prompt: REMINDER_DETECTION_PROMPT + message,
    });

    const trimmed = text.trim();
    
    // Check if it's not a reminder
    if (trimmed === "NOT_REMINDER" || !trimmed.startsWith("{")) {
      return null;
    }

    // Try to parse as JSON
    const parsed = JSON.parse(trimmed);
    
    // Validate the structure
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

export async function askAI(
  message: string,
  userId: string,
): Promise<{ text?: string; imageUrl?: string; sources?: any[]; reminder?: ReminderIntent }> {
  const isImageRequest = detectImageRequest(message);

  if (isImageRequest) {
    return {
      text: "Image generation is not available right now. Ask me for text instead.",
    };
  }

  // Check if this is a reminder request
  const reminderIntent = await detectReminderIntent(message);
  if (reminderIntent) {
    return { reminder: reminderIntent };
  }

  // Standard text conversation
  let history = conversations.get(userId) || [];
  history.push({ role: "user", content: message });

  const prompt = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const { text } = await generateText({
    model: textModel,
    system: SYSTEM_PROMPT,
    prompt,
  });

  history.push({ role: "assistant", content: text });

  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }

  conversations.set(userId, history);

  return { text };
}

export function clearHistory(userId: string): void {
  conversations.delete(userId);
}