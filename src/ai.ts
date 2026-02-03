import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { detectTodoistIntent, processTodoistCommand } from "./todoist-agent.js";

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
const searchModel = perplexity?.chat("sonar-pro");

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversations = new Map<string, Message[]>();
const MAX_HISTORY = 20; // Keep last 20 messages per user
const SYSTEM_PROMPT =
  "You are a friendly texting buddy and assistant. Keep replies warm, helpful, and concise. Ask brief follow-up questions when needed, use a casual tone, and avoid sounding overly formal. Do not use markdown or formatting symbols like *, _, or backticks.";

function getReminderDetectionPrompt(userTimezone: string): string {
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  
  return `You are a reminder detection system. Analyze if the user wants to set a reminder or schedule a task.

IMPORTANT: The user is in timezone: ${userTimezone}
Current time in their timezone: ${userTime.toLocaleString('en-US', { timeZone: userTimezone, hour12: true })}
Current UTC time: ${now.toISOString()}

If the user wants to set a reminder, respond with ONLY valid JSON in this exact format:
{
  "type": "reminder",
  "message": "the reminder message",
  "time": "ISO 8601 datetime string in UTC"
}

Time parsing rules:
- All times mentioned by the user are in THEIR timezone (${userTimezone})
- Convert the time to UTC for the "time" field
- "in 5 minutes" -> add 5 minutes to current UTC time
- "in 2 hours" -> add 2 hours to current UTC time
- "at 3pm" / "at 15:00" -> today at that time in ${userTimezone} (or tomorrow if time passed), converted to UTC
- "tomorrow at 9am" -> next day at 9am in ${userTimezone}, converted to UTC
- "at 5pm tomorrow" -> next day at 5pm in ${userTimezone}, converted to UTC
- "next Monday" -> upcoming Monday in ${userTimezone}, converted to UTC
- "tonight at 8" -> today at 8pm in ${userTimezone}, converted to UTC
- "noon" or "midnight" -> today at 12pm or 12am in ${userTimezone}, converted to UTC

Message extraction (what to remind about):
- Extract the core action/task, keep it concise
- "Remind me to call mom" -> "call mom"
- "Don't forget to take medicine" -> "take medicine"
- "I need to submit the report by 5pm" -> "submit the report"

If this is NOT a reminder request, respond with the text "NOT_REMINDER".

User message: `;
}

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

// --- Quick notes / scratchpad ---
export interface NoteIntent {
  action: "save" | "search";
  content?: string;
  query?: string;
}

function detectNoteIntent(message: string): NoteIntent | null {
  const lower = message.toLowerCase().trim();
  const savePrefixes = ["remember that ", "remember: ", "save note ", "note that ", "note: ", "save: ", "remember "];
  for (const p of savePrefixes) {
    if (lower.startsWith(p)) {
      const content = message.slice(p.length).trim();
      if (content.length > 0) return { action: "save", content };
    }
  }
  if (lower.startsWith("remember ") && !lower.includes("?")) {
    const content = message.slice(9).trim();
    if (content.length > 0) return { action: "save", content };
  }
  const searchPatterns = [
    /what did I save about (.+)/i,
    /what did I note about (.+)/i,
    /my notes about (.+)/i,
    /recall (.+)/i,
    /what (?:do I have )?saved about (.+)/i,
    /find (?:my )?note about (.+)/i,
  ];
  for (const re of searchPatterns) {
    const m = message.match(re);
    if (m?.[1]) return { action: "search", query: m[1].trim() };
  }
  if (lower.includes("what did i save") || lower.includes("my notes about")) {
    const q = message.replace(/\?$/, "").trim().split(/\s+about\s+/i)[1]?.trim();
    if (q) return { action: "search", query: q };
  }
  return null;
}

// --- Habit log ---
export interface HabitIntent {
  action: "log" | "check" | "streak";
  habitName: string;
}

function detectHabitIntent(message: string): HabitIntent | null {
  const lower = message.toLowerCase().trim();
  const logMatch = message.match(/\b(?:log|logged)\s+(.+?)(?:\s+today)?$/i) || message.match(/\blog\s+(.+)/i);
  if (logMatch?.[1]) return { action: "log", habitName: logMatch[1].trim() };
  const didIMatch = message.match(/\bdid I\s+(.+?)\s+today\??/i);
  if (didIMatch?.[1]) return { action: "check", habitName: didIMatch[1].trim() };
  const streakMatch = message.match(/(?:my\s+)?(.+?)\s+streak\??/i) || message.match(/\bstreak\s+(?:for\s+)?(.+?)\??$/i);
  if (streakMatch?.[1]) return { action: "streak", habitName: streakMatch[1].trim() };
  if (lower.includes("habit") && (lower.includes("log") || lower.includes("did i"))) {
    const parts = message.split(/\s+(?:today|log|did i)\s+/i);
    const name = parts[1]?.trim() || parts[0]?.replace(/habit|log|did i/gi, "").trim();
    if (name && name.length > 1) {
      if (lower.includes("did i")) return { action: "check", habitName: name };
      return { action: "log", habitName: name };
    }
  }
  return null;
}

// --- Weather (first-class intent, uses web search) ---
function detectWeatherIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const weatherWords = ["weather", "temperature", "forecast", "how hot", "how cold", "will it rain", "humidity", "what's the temp"];
  return weatherWords.some((w) => lower.includes(w)) || /weather\s+(?:in|for|today)?/i.test(message);
}

// --- Focus timer (creates reminder) ---
export interface FocusIntent {
  message: string;
  durationMinutes: number;
}

function detectFocusIntent(message: string): FocusIntent | null {
  const lower = message.toLowerCase();
  if (!/\b(?:focus|pomodoro|timer|concentrate|deep work)\b/i.test(lower)) return null;
  const minMatch = message.match(/(\d+)\s*min(?:ute)?s?/i) || message.match(/(\d+)\s*m\b/i);
  const duration = minMatch?.[1] ? Math.min(120, Math.max(1, parseInt(minMatch[1], 10))) : 25;
  return { message: "Focus session done – great job!", durationMinutes: duration };
}

interface ReminderIntent {
  type: "reminder";
  message: string;
  time: string; // ISO 8601 format
}

async function detectReminderIntent(
  message: string,
  userTimezone: string,
): Promise<ReminderIntent | null> {
  try {
    const { text } = await generateText({
      model: textModel,
      prompt: getReminderDetectionPrompt(userTimezone) + message,
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
  userTimezone: string = "UTC",
  todoistToken?: string | null,
): Promise<{
  text?: string;
  imageUrl?: string;
  sources?: any[];
  reminder?: ReminderIntent;
  todoist?: string;
  note?: NoteIntent;
  habit?: HabitIntent;
  weather?: string;
  focus?: FocusIntent;
}> {
  const isImageRequest = detectImageRequest(message);

  if (isImageRequest) {
    return {
      text: "Image generation is not available right now. Ask me for text instead.",
    };
  }

  // Check if this is a Todoist request (highest priority after image)
  if (todoistToken) {
    const todoistIntent = await detectTodoistIntent(message);
    if (todoistIntent) {
      const todoistResponse = await processTodoistCommand(todoistIntent, todoistToken);
      return { todoist: todoistResponse };
    }
  }

  // Quick notes / scratchpad
  const noteIntent = detectNoteIntent(message);
  if (noteIntent) return { note: noteIntent };

  // Habit log / check / streak
  const habitIntent = detectHabitIntent(message);
  if (habitIntent) return { habit: habitIntent };

  // Weather (first-class intent → web search)
  if (detectWeatherIntent(message) && searchModel) {
    const weatherResult = await searchWeb(`Current weather and forecast: ${message}`);
    return { weather: weatherResult };
  }

  // Focus timer → server will create reminder
  const focusIntent = detectFocusIntent(message);
  if (focusIntent) return { focus: focusIntent };

  // Check if this is a reminder request
  const reminderIntent = await detectReminderIntent(message, userTimezone);
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