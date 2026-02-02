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

export async function askAI(
  message: string,
  userId: string,
): Promise<{ text?: string; imageUrl?: string; sources?: any[] }> {
  const isImageRequest = detectImageRequest(message);

  if (isImageRequest) {
    return {
      text: "Image generation is not available right now. Ask me for text instead.",
    };
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