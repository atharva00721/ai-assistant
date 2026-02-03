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
const textModel = openai.chat("glm-4.5v");
// Vision model (same as text model - glm-4.5v supports vision)
const visionModel = textModel;

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
// Remember the last image per user so they can say "search this" afterwards.
const lastImages = new Map<string, string>();
const MAX_HISTORY = 20; // Keep last 20 messages per user
const SYSTEM_PROMPT = `You are FRIDAY, the user's calm, capable AI assistant on Telegram. You are efficient, understated, and precise. You are warm but minimal—no fluff.

Capabilities (the app handles these behind the scenes; you reply naturally):
- Images: You can see user photos. Describe what you see in plain language (objects, text, people, scenes). Answer questions about the image.
- Reminders: If the user asks for a reminder, you confirm briefly.
- Todoist: The app can add/list/complete/delete tasks, plus projects/labels. You get the result and reply with a short, natural confirmation or summary.
- Web search: For explicit searches or time-sensitive info, you get search results. Summarize in your own words, clearly and concisely.
- Notes/Habits/Focus timer: The app handles them; you respond naturally.

Limits and style:
- You cannot browse the web unless results are provided; do not invent sources.
- If something is unclear, ask one short clarifying question.
- Keep replies short and composed. No markdown (no *, _, backticks). No repeated greetings. Avoid sounding like a bot.`;

/** Run main LLM with tool output as context so the main model always replies to the user. */
async function mainLLMRespondWithContext(
  userId: string,
  userMessage: string,
  toolContent: string,
  toolType: "search" | "todoist"
): Promise<string> {
  const contextInstruction =
    toolType === "search"
      ? "The user asked for something from the web. Below are the search results. Reply in your own words—like you’re telling a friend what you found. Short and natural. No markdown, no bullet lists unless it really helps."
      : "The user just did something with their task list (Todoist). Below is what actually happened (e.g. tasks added, list of tasks, something completed). Reply like a real person would: a quick confirmation or a natural comment. No markdown.";
  const system = `${SYSTEM_PROMPT}\n\n${contextInstruction}\n\n---\n${toolContent}`;
  let history = conversations.get(userId) || [];
  history.push({ role: "user", content: userMessage });
  const prompt = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");
  const { text } = await generateText({
    model: textModel,
    system,
    prompt,
  });
  history.push({ role: "assistant", content: text });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  conversations.set(userId, history);
  return text;
}

function resolveTimezone(userTimezone: string): string {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: userTimezone });
    return userTimezone;
  } catch {
    return "UTC";
  }
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

function normalizeAssistantJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

// Explicit "search the web" intent — use Perplexity. Check this BEFORE Todoist.
function detectExplicitWebSearch(message: string): boolean {
  const lower = message.toLowerCase().trim();
  const patterns = [
    /^search\s+(?:for\s+)?/i,
    /^look\s+up\s+/i,
    /^lookup\s+/i,
    /search\s+the\s+web/i,
    /search\s+online/i,
    /google\s+/i,
    /find\s+online/i,
    /look\s+it\s+up/i,
    /search\s+for\s+/i,
  ];
  return patterns.some((re) => re.test(lower));
}

// Narrow: only time-sensitive or explicitly "search" queries use Perplexity. Normal Q&A → main LLM.
function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  // Explicit web search (backup if not caught earlier)
  if (detectExplicitWebSearch(message)) return true;
  // Clearly time-sensitive: latest/recent/current/news
  const timeSensitive = [
    "latest news",
    "recent news",
    "current news",
    "today's news",
    "news about",
    "latest on",
    "current events",
    "latest update",
    "current price",
    "live score",
    "right now",
  ];
  return timeSensitive.some((phrase) => lower.includes(phrase));
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

    const trimmed = normalizeAssistantJson(text);
    
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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return "I need a search query to look up.";
    }
    const searchPrompt = `You have web access. The user asked: "${trimmedQuery}"

Find current, accurate info and reply in plain language—like you’re explaining it to a friend. One short paragraph or a few tight sentences. No bullet spam, no "According to source X…" repeatedly. If it’s facts or numbers, keep them; otherwise keep it readable and concise.`;

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

/**
 * Use the vision model to turn an image + user question into a short web search query,
 * then run a web search and have the main LLM answer using those results.
 */
async function searchImageOnWeb(
  imageDataUrl: string,
  userMessage: string,
  userId: string,
): Promise<string> {
  const { text: rawQuery } = await generateText({
    model: visionModel,
    system:
      "You help turn an image plus the user's question into a short web search query.\n" +
      "- Look at the image and any text on it.\n" +
      "- Infer the product/brand/name or key entities if relevant.\n" +
      "- Reply with ONLY a concise Google-style search query. No explanation, no quotes.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `User message: ${userMessage || "(no extra question, just the image)"}\n` +
              "Return only a short search query string that would help answer it.",
          },
          {
            type: "image",
            image: imageDataUrl,
          },
        ],
      },
    ],
  });

  const cleaned = rawQuery.trim().replace(/^['\"]|['\"]$/g, "");
  const searchQuery =
    cleaned ||
    "identify and search for the main product or object in this image";

  const searchResult = await searchWeb(searchQuery);
  return await mainLLMRespondWithContext(
    userId,
    userMessage || searchQuery,
    searchResult,
    "search",
  );
}

export async function askAI(
  message: string,
  userId: string,
  userTimezone: string = "UTC",
  todoistToken?: string | null,
  imageUrl?: string | null,
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
  const trimmedMessage = message.trim();
  const safeTimezone = resolveTimezone(userTimezone);
  const isImageRequest = detectImageRequest(trimmedMessage);

  if (isImageRequest) {
    return {
      text: "Image generation is not available right now. Ask me for text instead.",
    };
  }

  // If we got an image, remember it so the user can say "search this" afterwards.
  if (imageUrl && imageUrl.startsWith("data:")) {
    lastImages.set(userId, imageUrl);
  }

  // Image + explicit search intent in the SAME message (caption like "search this", "google this shampoo").
  const imageSearchCaptionIntent =
    !!imageUrl &&
    !!searchModel &&
    (detectExplicitWebSearch(trimmedMessage) ||
      /\b(search|google|look\s+up|price|buy|reviews?|where to (buy|get))/i.test(
        trimmedMessage,
      ));

  if (imageSearchCaptionIntent && imageUrl) {
    try {
      const text = await searchImageOnWeb(imageUrl, trimmedMessage, userId);
      return { text };
    } catch (error) {
      console.error("Image + web search error:", error);
      // Fall back to plain image description below.
    }
  }

  // Follow‑up like "search this" after sending an image (no image in this message).
  const refersToPreviousImage =
    !imageUrl &&
    lastImages.has(userId) &&
    /\b(this|this one|this pic|this picture|this photo|this product|this item)\b/i.test(
      trimmedMessage,
    ) &&
    !!searchModel &&
    (detectExplicitWebSearch(trimmedMessage) || /^search\b/i.test(trimmedMessage.trim()));

  if (refersToPreviousImage) {
    const lastImage = lastImages.get(userId)!;
    try {
      const text = await searchImageOnWeb(lastImage, trimmedMessage, userId);
      return { text };
    } catch (error) {
      console.error("Follow-up image search error:", error);
      // If it fails, continue with normal text flow.
    }
  }

  // Image understanding (vision) - user sent a photo but is NOT asking for web search.
  if (imageUrl) {
    try {
      // Ensure imageUrl is a valid data URL
      if (!imageUrl.startsWith("data:")) {
        console.error(
          "Invalid image format - expected data URL, got:",
          imageUrl.substring(0, 100),
        );
        return {
          text:
            "Sorry, I couldn't process that image format. Please try sending the image again.",
        };
      }

      const userPrompt = trimmedMessage || "What's in this image?";
      let history = conversations.get(userId) || [];

      const { text } = await generateText({
        model: visionModel,
        system:
          SYSTEM_PROMPT +
          "\n\nYou can see images. When the user sends a photo, describe what you see naturally—like you're telling a friend. Be specific about objects, text, people, scenes, etc. If they ask a question about the image, answer it.",
        messages: [
          ...history.slice(-10).map((msg) => ({
            role: msg.role,
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          })),
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image", image: imageUrl },
            ],
          },
        ],
      });

      history.push({ role: "user", content: userPrompt });
      history.push({ role: "assistant", content: text });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      conversations.set(userId, history);

      return { text };
    } catch (error: any) {
      console.error("Vision error:", error);
      const errorMsg = error?.message || String(error);
      if (
        errorMsg.includes("图片输入格式") ||
        errorMsg.includes("image") ||
        errorMsg.includes("format")
      ) {
        return {
          text:
            "Sorry, I couldn't process that image format. The image might be corrupted or in an unsupported format. Please try sending a different image.",
        };
      }
      return {
        text:
          "Sorry, I couldn't analyze that image. Try sending it again or describe what you need.",
      };
    }
  }

  // Explicit web search → Perplexity content passed to main LLM, main LLM replies
  if (detectExplicitWebSearch(trimmedMessage) && searchModel) {
    const searchResult = await searchWeb(trimmedMessage);
    const text = await mainLLMRespondWithContext(userId, trimmedMessage, searchResult, "search");
    return { text };
  }

  // Todoist → action result passed to main LLM, main LLM replies
  if (todoistToken) {
    const todoistIntent = await detectTodoistIntent(trimmedMessage);
    if (todoistIntent) {
      const todoistResponse = await processTodoistCommand(todoistIntent, todoistToken);
      const text = await mainLLMRespondWithContext(userId, trimmedMessage, todoistResponse, "todoist");
      return { todoist: text };
    }
  }

  // Quick notes / scratchpad
  const noteIntent = detectNoteIntent(trimmedMessage);
  if (noteIntent) return { note: noteIntent };

  // Habit log / check / streak
  const habitIntent = detectHabitIntent(trimmedMessage);
  if (habitIntent) return { habit: habitIntent };

  // Weather → Perplexity content passed to main LLM, main LLM replies
  if (detectWeatherIntent(trimmedMessage) && searchModel) {
    const weatherResult = await searchWeb(`Current weather and forecast: ${trimmedMessage}`);
    const text = await mainLLMRespondWithContext(userId, trimmedMessage, weatherResult, "search");
    return { text };
  }

  // Focus timer → server will create reminder
  const focusIntent = detectFocusIntent(trimmedMessage);
  if (focusIntent) return { focus: focusIntent };

  // Check if this is a reminder request
  const reminderIntent = await detectReminderIntent(trimmedMessage, safeTimezone);
  if (reminderIntent) {
    return { reminder: reminderIntent };
  }

  // Time-sensitive search → Perplexity content passed to main LLM, main LLM replies
  const isSearchQuery = detectSearchIntent(trimmedMessage);
  if (isSearchQuery && searchModel) {
    const searchResult = await searchWeb(trimmedMessage);
    const text = await mainLLMRespondWithContext(userId, trimmedMessage, searchResult, "search");
    return { text };
  }

  // Standard text conversation
  let history = conversations.get(userId) || [];
  history.push({ role: "user", content: trimmedMessage });

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
