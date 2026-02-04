import { detectGmailIntent } from "./intents.js";
import { executeGmailAction } from "./service.js";

export async function handleGmailIntent(message: string, userId: string): Promise<{ isGmailIntent: boolean; reply?: string }> {
  try {
    const intent = await detectGmailIntent(message);
    
    if (!intent.isGmailIntent || !intent.action) {
      return { isGmailIntent: false };
    }

    const result = await executeGmailAction(userId, intent);
    
    return {
      isGmailIntent: true,
      reply: result.message,
    };
  } catch (error) {
    console.error("Gmail agent error:", error);
    return {
      isGmailIntent: true,
      reply: `Sorry, I encountered an error processing your Gmail request: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}