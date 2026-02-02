import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const model = google("gemini-3-flash-preview");

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversations = new Map<string, Message[]>();
const MAX_HISTORY = 20; // Keep last 20 messages per user

export async function askAI(
  message: string,
  userId: string,
): Promise<string> {
  // Get or create conversation history
  let history = conversations.get(userId) || [];

  // Add user message
  history.push({ role: "user", content: message });

  // Build prompt with history
  const prompt = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const { text } = await generateText({
    model,
    prompt,
  });

  // Add assistant response to history
  history.push({ role: "assistant", content: text });

  // Keep only last MAX_HISTORY messages
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }

  // Save updated history
  conversations.set(userId, history);

  return text;
}

export function clearHistory(userId: string): void {
  conversations.delete(userId);
}
