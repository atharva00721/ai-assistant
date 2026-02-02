import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const model = google("gemini-3-flash-preview");

export async function askAI(message: string): Promise<string> {
  const { text } = await generateText({
    model,
    prompt: message,
  });

  return text;
}
