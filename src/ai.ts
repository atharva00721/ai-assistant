import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  storeConversation,
  getRecentConversations,
  searchSimilarConversations,
  extractMemories,
  getRelevantMemories,
} from "./memory";

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
const searchModel = perplexity?.chat("sonar");

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 20; // Keep last 20 messages per user
const SYSTEM_PROMPT =
  "You are a friendly texting buddy and assistant. Keep replies warm, helpful, and concise. Ask brief follow-up questions when needed, use a casual tone, and avoid sounding overly formal. Do not use markdown or formatting symbols like *, _, or backticks.";

// Enable/disable memory features
const MEMORY_ENABLED = Bun.env.MEMORY_ENABLED !== "false"; // Enabled by default
const MEMORY_EXTRACTION_ENABLED = Bun.env.MEMORY_EXTRACTION_ENABLED !== "false";

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
): Promise<{ text?: string; imageUrl?: string; sources?: any[]; reminder?: ReminderIntent }> {
  const isImageRequest = detectImageRequest(message);

  if (isImageRequest) {
    return {
      text: "Image generation is not available right now. Ask me for text instead.",
    };
  }

  // Check if this is a reminder request (highest priority)
  const reminderIntent = await detectReminderIntent(message, userTimezone);
  if (reminderIntent) {
    return { reminder: reminderIntent };
  }

  // Store user message in memory if enabled
  if (MEMORY_ENABLED) {
    await storeConversation(userId, "user", message);
  }

  // Check if this is a search/informational query
  const isSearchQuery = detectSearchIntent(message);
  if (isSearchQuery && searchModel) {
    const searchResult = await searchWeb(message);
    
    // Store assistant response in memory
    if (MEMORY_ENABLED) {
      await storeConversation(userId, "assistant", searchResult);
    }
    
    return { text: searchResult };
  }

  // Get conversation context from memory
  let history: Message[] = [];
  let contextPrefix = "";
  
  if (MEMORY_ENABLED) {
    try {
      // Get recent conversation history from database
      const recentConversations = await getRecentConversations(userId, MAX_HISTORY);
      history = recentConversations.map((conv) => ({
        role: conv.role as "user" | "assistant",
        content: conv.content,
      }));

      // Get relevant memories for context
      const relevantMemories = await getRelevantMemories(userId, message, 5);
      
      if (relevantMemories.length > 0) {
        const memoryContext = relevantMemories
          .filter((mem) => mem.similarity > 0.7) // Only high similarity
          .map((mem) => `[${mem.category}] ${mem.content}`)
          .join("\n");
        
        if (memoryContext) {
          contextPrefix = `Context about the user:\n${memoryContext}\n\n`;
        }
      }

      // Search for similar past conversations if the query seems to reference something
      if (message.toLowerCase().includes("remember") || 
          message.toLowerCase().includes("you said") ||
          message.toLowerCase().includes("we talked") ||
          message.toLowerCase().includes("earlier")) {
        const similarConversations = await searchSimilarConversations(userId, message, 3);
        
        if (similarConversations.length > 0) {
          const references = similarConversations
            .filter((conv) => conv.similarity > 0.75)
            .map((conv) => `${conv.role}: ${conv.content}`)
            .join("\n");
          
          if (references) {
            contextPrefix += `Relevant past conversation:\n${references}\n\n`;
          }
        }
      }
    } catch (error) {
      console.error("Error retrieving memory context:", error);
      // Fall back to empty history
    }
  }

  // Build prompt with context
  const conversationHistory = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const fullPrompt = contextPrefix + conversationHistory;

  const { text } = await generateText({
    model: textModel,
    system: SYSTEM_PROMPT,
    prompt: fullPrompt,
  });

  // Store assistant response in memory
  if (MEMORY_ENABLED) {
    await storeConversation(userId, "assistant", text);
    
    // Extract memories from the conversation periodically
    if (MEMORY_EXTRACTION_ENABLED) {
      // Extract memories every 5 messages (to avoid too frequent extractions)
      const conversationCount = history.length;
      if (conversationCount % 10 === 0) {
        // Create a summary of recent conversation for memory extraction
        const recentExchange = `User: ${message}\nAssistant: ${text}`;
        
        // Run memory extraction asynchronously (don't wait)
        extractMemories(userId, recentExchange).catch((err) => {
          console.error("Error extracting memories:", err);
        });
      }
    }
  }

  return { text };
}

export function clearHistory(userId: string): void {
  // This function is kept for backward compatibility
  // Conversation history is now stored in the database
  console.log(`Note: Conversation history for ${userId} is now stored in database`);
}

/**
 * Manually trigger memory extraction for recent conversations
 */
export async function extractRecentMemories(userId: string): Promise<number> {
  if (!MEMORY_ENABLED || !MEMORY_EXTRACTION_ENABLED) {
    return 0;
  }

  try {
    const recentConversations = await getRecentConversations(userId, 10);
    
    if (recentConversations.length === 0) {
      return 0;
    }

    const conversationText = recentConversations
      .map((conv) => `${conv.role}: ${conv.content}`)
      .join("\n");

    await extractMemories(userId, conversationText);
    return recentConversations.length;
  } catch (error) {
    console.error("Error extracting recent memories:", error);
    return 0;
  }
}

/**
 * Get a summary of stored memories for a user
 */
export async function getMemorySummary(userId: string): Promise<string> {
  if (!MEMORY_ENABLED) {
    return "Memory feature is not enabled.";
  }

  try {
    const categories = ["preference", "fact", "context", "relationship"];
    const summaryParts: string[] = [];

    for (const category of categories) {
      const memories = await getRelevantMemories(userId, category, 5);
      
      if (memories.length > 0) {
        summaryParts.push(`\n**${category.charAt(0).toUpperCase() + category.slice(1)}s:**`);
        memories.forEach((mem, idx) => {
          summaryParts.push(`${idx + 1}. ${mem.content}`);
        });
      }
    }

    if (summaryParts.length === 0) {
      return "No memories stored yet. Keep chatting to build up your memory!";
    }

    return "What I remember about you:" + summaryParts.join("\n");
  } catch (error) {
    console.error("Error getting memory summary:", error);
    return "Error retrieving memory summary.";
  }
}