import { generateText } from "ai";
import { searchModel } from "./clients.js";

export async function searchWeb(query: string): Promise<string> {
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
