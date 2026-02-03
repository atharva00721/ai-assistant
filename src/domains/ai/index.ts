import { generateText } from "ai";
import { detectTodoistIntent } from "../todoist/agent.js";
import { processTodoistCommand } from "../todoist/service.js";
import { textModel, visionModel, searchModel } from "./clients.js";
import { detectImageRequest, isSupportedImageSource, searchImageOnWeb } from "./image.js";
import { loadMemoryContext, touchMemoryIds } from "./memory.js";
import { SYSTEM_PROMPT, buildSystemPrompt } from "./prompts.js";
import { searchWeb } from "./search.js";
import { detectNoteIntent } from "./intents/note.js";
import { detectHabitIntent } from "./intents/habit.js";
import { detectFocusIntent } from "./intents/focus.js";
import { detectExplicitWebSearch } from "./intents/search.js";
import { detectReminderIntent } from "./intents/reminder.js";
import { classifyIntent } from "./intents/classify.js";
import { resolveTimezone } from "../../shared/utils/timezone.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversations = new Map<string, Message[]>();
const lastImages = new Map<string, string>();
const MAX_HISTORY = 20;

async function mainLLMRespondWithContext(
  userId: string,
  userMessage: string,
  toolContent: string,
  toolType: "search" | "todoist",
): Promise<string> {
  const contextInstruction =
    toolType === "search"
      ? "The user asked for something from the web. Below are the search results. Reply in your own words—like you’re telling a friend what you found. Short and natural. No markdown, no bullet lists unless it really helps."
      : "The user just did something with their task list (Todoist). Below is what actually happened (e.g. tasks added, list of tasks, something completed). Reply like a real person would: a quick confirmation or a natural comment. No markdown.";
  const { memories, memoryContext } = await loadMemoryContext({
    userId,
    query: userMessage,
    topK: 8,
  });
  const system = `${buildSystemPrompt(SYSTEM_PROMPT, memoryContext)}\n\n${contextInstruction}\n\n---\n${toolContent}`;
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
  if (memories.length > 0) {
    await touchMemoryIds(memories.map((memory) => memory.id));
  }
  return text;
}

export async function askAI(
  message: string,
  userId: string,
  userTimezone: string = "Asia/Kolkata",
  todoistToken?: string | null,
  imageUrl?: string | null,
): Promise<{
  text?: string;
  imageUrl?: string;
  sources?: any[];
  reminder?: { type: "reminder"; message: string; time: string };
  todoist?: string;
  note?: { action: "save" | "search"; content?: string; query?: string };
  habit?: { action: "log" | "check" | "streak"; habitName: string };
  weather?: string;
  focus?: { message: string; durationMinutes: number };
}> {
  if (!textModel) {
    return {
      text:
        "AI service is not configured. Please set ANANNAS_API_KEY and OPENAI_BASE_URL, then try again.",
    };
  }
  const trimmedMessage = message.trim();
  const safeTimezone = resolveTimezone(userTimezone);
  const isImageRequest = detectImageRequest(trimmedMessage);

  if (isImageRequest) {
    return {
      text: "Image generation is not available right now. Ask me for text instead.",
    };
  }

  if (isSupportedImageSource(imageUrl)) {
    lastImages.set(userId, imageUrl!);
  }

  const imageSearchCaptionIntent =
    isSupportedImageSource(imageUrl) &&
    !!searchModel &&
    (detectExplicitWebSearch(trimmedMessage) ||
      /\b(search|google|look\s+up|price|buy|reviews?|where to (buy|get))/i.test(
        trimmedMessage,
      ));

  if (imageSearchCaptionIntent && imageUrl) {
    try {
      const text = await searchImageOnWeb({
        imageSource: imageUrl,
        userMessage: trimmedMessage,
        userId,
        searchWeb,
        respondWithContext: mainLLMRespondWithContext,
      });
      return { text };
    } catch (error) {
      console.error("Image + web search error:", error);
    }
  }

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
      const text = await searchImageOnWeb({
        imageSource: lastImage,
        userMessage: trimmedMessage,
        userId,
        searchWeb,
        respondWithContext: mainLLMRespondWithContext,
      });
      return { text };
    } catch (error) {
      console.error("Follow-up image search error:", error);
    }
  }

  if (imageUrl) {
    try {
      if (!isSupportedImageSource(imageUrl)) {
        console.error(
          "Invalid image format - expected data URL or http(s) URL, got:",
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
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
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

  if (detectExplicitWebSearch(trimmedMessage) && searchModel) {
    const searchResult = await searchWeb(trimmedMessage);
    const text = await mainLLMRespondWithContext(userId, trimmedMessage, searchResult, "search");
    return { text };
  }

  const intent = await classifyIntent(trimmedMessage, {
    hasTodoist: !!todoistToken,
    hasSearch: !!searchModel,
  });

  switch (intent) {
    case "note": {
      const noteIntent = detectNoteIntent(trimmedMessage);
      if (noteIntent) return { note: noteIntent };
      break;
    }
    case "habit": {
      const habitIntent = detectHabitIntent(trimmedMessage);
      if (habitIntent) return { habit: habitIntent };
      break;
    }
    case "weather":
      if (searchModel) {
        const weatherResult = await searchWeb(`Current weather and forecast: ${trimmedMessage}`);
        const text = await mainLLMRespondWithContext(userId, trimmedMessage, weatherResult, "search");
        return { text };
      }
      break;
    case "search":
      if (searchModel) {
        const searchResult = await searchWeb(trimmedMessage);
        const text = await mainLLMRespondWithContext(userId, trimmedMessage, searchResult, "search");
        return { text };
      }
      break;
    case "focus_timer": {
      const focusIntent = detectFocusIntent(trimmedMessage);
      if (focusIntent) return { focus: focusIntent };
      break;
    }
    case "reminder": {
      const reminderIntent = await detectReminderIntent(trimmedMessage, safeTimezone);
      if (reminderIntent) return { reminder: reminderIntent };
      break;
    }
    case "todoist":
      if (todoistToken) {
        const todoistIntent = await detectTodoistIntent(trimmedMessage);
        if (todoistIntent) {
          const todoistResponse = await processTodoistCommand(todoistIntent, todoistToken);
          const text = await mainLLMRespondWithContext(userId, trimmedMessage, todoistResponse, "todoist");
          return { todoist: text };
        }
      }
      break;
    case "chat":
    default:
      break;
  }

  let history = conversations.get(userId) || [];
  history.push({ role: "user", content: trimmedMessage });

  const prompt = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const { memories, memoryContext } = await loadMemoryContext({
    userId,
    query: trimmedMessage,
    topK: 8,
  });
  const { text } = await generateText({
    model: textModel,
    system: buildSystemPrompt(SYSTEM_PROMPT, memoryContext),
    prompt,
  });

  history.push({ role: "assistant", content: text });

  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }

  conversations.set(userId, history);
  if (memories.length > 0) {
    await touchMemoryIds(memories.map((memory) => memory.id));
  }

  return { text };
}

export function clearHistory(userId: string): void {
  conversations.delete(userId);
}
