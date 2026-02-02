import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const textModel = google("gemini-3-flash-preview");
const imageModel = google("gemini-2.5-flash-image");

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversations = new Map<string, Message[]>();
const MAX_HISTORY = 20; // Keep last 20 messages per user

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
    // Use image generation model
    try {
      const result = await generateText({
        model: imageModel,
        prompt: message.replace(/^\/image\s*/i, "").trim(),
      });

      // Check if response contains image data
      // Note: Vercel AI SDK may return files in result.files or embedded data
      // For now, return text response with note about image generation
      return {
        text: result.text || "Image generated (implementation pending for file extraction)",
      };
    } catch (error) {
      return {
        text: "Image generation failed. Please try a text request instead.",
      };
    }
  }

  // Standard text conversation with Google Search
  let history = conversations.get(userId) || [];
  history.push({ role: "user", content: message });

  const prompt = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const { text, sources } = await generateText({
    model: textModel,
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt,
  });

  history.push({ role: "assistant", content: text });

  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }

  conversations.set(userId, history);

  return { text, sources };
}

export function clearHistory(userId: string): void {
  conversations.delete(userId);
}