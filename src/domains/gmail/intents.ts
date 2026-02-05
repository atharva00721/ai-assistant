import { generateText } from "ai";
import { openai } from "../ai/clients.js";

export const GMAIL_INTENT_PROMPT = `You are a Gmail intent classifier. Given a user message, determine if it's a Gmail-related action and extract the details.

Respond with JSON in this format:
{
  "isGmailIntent": boolean,
  "action": "list" | "search" | "send" | "summarize" | "read" | null,
  "query": string | null,
  "recipient": string | null,
  "subject": string | null,
  "body": string | null,
  "limit": number | null
}

Actions:
- list: Show recent emails ("show my emails", "what's in my inbox", "last email", "latest email", "most recent email")
- search: Search for specific emails ("emails about project X", "find emails from john")
- send: Send a new email ("send email to john@example.com")
- summarize: Summarize emails ("summarize my unread emails")
- read: Read a specific email (when referencing a specific message)

Special cases:
- For "last email", "latest email", "most recent email" → use "list" action with limit: 1
- For "recent emails" without number → use limit: 5-10
- For "all emails" → use higher limit like 50

Examples:
"Show my recent emails" → {"isGmailIntent": true, "action": "list", "query": null, "recipient": null, "subject": null, "body": null, "limit": 10}
"What's the last email I received?" → {"isGmailIntent": true, "action": "list", "query": null, "recipient": null, "subject": null, "body": null, "limit": 1}
"Search emails about project Alpha" → {"isGmailIntent": true, "action": "search", "query": "project Alpha", "recipient": null, "subject": null, "body": null, "limit": 10}
"Send email to john@example.com about meeting" → {"isGmailIntent": true, "action": "send", "query": null, "recipient": "john@example.com", "subject": "meeting", "body": null, "limit": null}
"What's the weather?" → {"isGmailIntent": false, "action": null, "query": null, "recipient": null, "subject": null, "body": null, "limit": null}`;

export interface GmailIntent {
  isGmailIntent: boolean;
  action: "list" | "search" | "send" | "summarize" | "read" | null;
  query: string | null;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  limit: number | null;
}

export async function detectGmailIntent(message: string): Promise<GmailIntent> {
  try {
    const model = openai("gpt-4o-mini");
    if (!model) {
      throw new Error("OpenAI model initialization failed");
    }
    const result = await generateText({
      model,
      system: GMAIL_INTENT_PROMPT,
      prompt: `Classify this message: "${message}"`,
      temperature: 0,
    });

    const parsed = JSON.parse(result.text);
    return {
      isGmailIntent: !!parsed.isGmailIntent,
      action: parsed.action || null,
      query: parsed.query || null,
      recipient: parsed.recipient || null,
      subject: parsed.subject || null,
      body: parsed.body || null,
      limit: parsed.limit || null,
    };
  } catch (error) {
    console.error("Failed to detect Gmail intent:", error);
    return {
      isGmailIntent: false,
      action: null,
      query: null,
      recipient: null,
      subject: null,
      body: null,
      limit: null,
    };
  }
}