import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getTodoistDetectionPrompt } from "./prompt.js";
import { parseTodoistIntent, type TodoistIntent } from "./parse.js";

const apiKey = Bun.env.ANANNAS_API_KEY;
const baseURL = Bun.env.OPENAI_BASE_URL;

if (!apiKey || !baseURL) {
  throw new Error("AI API configuration is required for Todoist agent.");
}

const openai = createOpenAI({ baseURL, apiKey });
const textModel = openai.chat("openai-gpt-oss-20b-1-0");

export async function detectTodoistIntent(
  message: string
): Promise<TodoistIntent | null> {
  try {
    const { text } = await generateText({
      model: textModel,
      prompt: getTodoistDetectionPrompt() + message,
    });

    return parseTodoistIntent(text);
  } catch (error) {
    console.error("Error detecting Todoist intent:", error);
    return null;
  }
}
