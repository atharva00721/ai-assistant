import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const apiKey = Bun.env.ANANNAS_API_KEY;
if (!apiKey) {
  throw new Error("ANANNAS_API_KEY is required.");
}

const baseURL = Bun.env.OPENAI_BASE_URL;
if (!baseURL) {
  throw new Error("OPENAI_BASE_URL is required.");
}

const openai = createOpenAI({
  baseURL,
  apiKey,
});
const textModel = openai.chat("openai-gpt-oss-20b-1-0");

// Perplexity client for web search
const perplexityApiKey = Bun.env.PERPLEXITY_API_KEY;
const perplexity = perplexityApiKey
  ? createOpenAI({
      baseURL: "https://api.perplexity.ai",
      apiKey: perplexityApiKey,
    })
  : null;
const searchModel = perplexity?.chat("llama-3.1-sonar-small-128k-online");

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

Time parsing examples:
- "in 5 minutes" -> add 5 minutes to current time
- "in 2 hours" -> add 2 hours to current time
- "at 3pm" / "at 15:00" -> today at that time (or tomorrow if time passed)
- "tomorrow at 9am" -> next day at 9am
- "at 5pm tomorrow" -> next day at 5pm
- "next Monday" -> upcoming Monday
- "in 30 seconds" -> add 30 seconds
- "tonight at 8" -> today at 8pm
- "noon" or "midnight" -> today at 12pm or 12am

Message extraction (what to remind about):
- Extract the core action/task, keep it concise
- "Remind me to call mom" -> "call mom"
- "Don't forget to take medicine" -> "take medicine"
- "I need to submit the report by 5pm" -> "submit the report"

Examples:
- "Remind me to call mom at 3pm tomorrow" -> {"type": "reminder", "message": "call mom", "time": "2026-02-03T15:00:00Z"}
- "Set a reminder for my meeting in 2 hours" -> {"type": "reminder", "message": "meeting", "time": "2026-02-02T16:30:00Z"}
- "Schedule a task to buy groceries at 5pm" -> {"type": "reminder", "message": "buy groceries", "time": "2026-02-02T17:00:00Z"}
- "In 10 minutes remind me to check the oven" -> {"type": "reminder", "message": "check the oven", "time": "2026-02-02T14:10:00Z"}
- "Don't let me forget to call John at noon" -> {"type": "reminder", "message": "call John", "time": "2026-02-02T12:00:00Z"}
- "I need to take my medicine in 30 minutes" -> {"type": "reminder", "message": "take medicine", "time": "2026-02-02T14:30:00Z"}

If this is NOT a reminder request, respond with the text "NOT_REMINDER".

Current time: ${new Date().toISOString()}
Current day: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}
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

function detectSearchIntent(message: string): boolean {
  const searchKeywords = [
    "search",
    "find",
    "lookup",
    "look up",
    "what is",
    "what are",
    "who is",
    "who are",
    "when",
    "where",
    "how",
    "latest",
    "recent",
    "news",
    "current",
    "today",
    "compare",
    "comparison",
    "vs",
    "versus",
    "difference between",
    "explain",
    "research",
    "information about",
    "tell me about",
    "price",
    "cost",
    "weather",
    "forecast",
  ];
  const lowerMessage = message.toLowerCase();
  
  // Check for search keywords
  const hasSearchKeyword = searchKeywords.some((keyword) => 
    lowerMessage.includes(keyword)
  );
  
  // Also check if message ends with a question mark (often informational)
  const isQuestion = message.trim().endsWith("?");
  
  return hasSearchKeyword || isQuestion;
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

async function searchWeb(query: string): Promise<string> {
  if (!searchModel) {
    return "Web search is not available. Please set PERPLEXITY_API_KEY environment variable.";
  }

  try {
    const searchPrompt = `You are a helpful research assistant with access to the web. The user has asked: "${query}"

Please search the web for current, accurate information and provide a clear, natural language summary of your findings. Include relevant details, facts, and context. Avoid just listing links - synthesize the information into a cohesive, informative response.

Keep your response concise but thorough, and cite sources when relevant.`;

    const { text } = await generateText({
      model: searchModel,
      prompt: searchPrompt,
    });

    return text;
  } catch (error) {
    console.error("Error performing web search:", error);
    return "Sorry, I encountered an error while searching the web. Please try again.";
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

  // Check if this is a reminder request (highest priority)
  const reminderIntent = await detectReminderIntent(message);
  if (reminderIntent) {
    return { reminder: reminderIntent };
  }

  // Check if this is a search/informational query
  const isSearchQuery = detectSearchIntent(message);
  if (isSearchQuery && searchModel) {
    const searchResult = await searchWeb(message);
    
    // Add to conversation history for context
    let history = conversations.get(userId) || [];
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: searchResult });
    
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }
    
    conversations.set(userId, history);
    
    return { text: searchResult };
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