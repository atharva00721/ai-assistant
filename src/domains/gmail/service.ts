import { createGmailClient } from "./client.js";
import { findGmailAccount } from "./repo.js";
import { type GmailIntent } from "./intents.js";
import { generateText } from "ai";
import { openai } from "../ai/clients.js";

interface GmailActionResult {
  success: boolean;
  message: string;
  data?: any;
}

function extractEmailBody(payload: any): string {
  // Handle multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
    // Fallback to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
  }
  
  // Single part message
  if (payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  
  return "No content available";
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function formatDate(internalDate: string): string {
  const date = new Date(parseInt(internalDate));
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

export async function executeGmailAction(userId: string, intent: GmailIntent): Promise<GmailActionResult> {
  try {
    const account = await findGmailAccount(userId);
    if (!account) {
      return {
        success: false,
        message: "Gmail not connected. Use /gmail_connect to get started.",
      };
    }

    const client = await createGmailClient(account);

    switch (intent.action) {
      case "list": {
        const messages = await client.listMessages("", intent.limit || 10);
        
        if (messages.length === 0) {
          return {
            success: true,
            message: "📭 Your inbox is empty!",
          };
        }

        const formatted = messages.map(msg => {
          const from = getHeader(msg.payload.headers, "from");
          const subject = getHeader(msg.payload.headers, "subject");
          const date = formatDate(msg.internalDate);
          
          return `📧 **${subject}**\n👤 From: ${from}\n📅 ${date}\n💬 ${msg.snippet}\n`;
        }).join("\n");

        return {
          success: true,
          message: `📥 Your recent emails:\n\n${formatted}`,
          data: messages,
        };
      }

      case "search": {
        if (!intent.query) {
          return {
            success: false,
            message: "Please specify what to search for.",
          };
        }

        const messages = await client.listMessages(intent.query, intent.limit || 10);
        
        if (messages.length === 0) {
          return {
            success: true,
            message: `🔍 No emails found matching "${intent.query}"`,
          };
        }

        const formatted = messages.map(msg => {
          const from = getHeader(msg.payload.headers, "from");
          const subject = getHeader(msg.payload.headers, "subject");
          const date = formatDate(msg.internalDate);
          
          return `📧 **${subject}**\n👤 From: ${from}\n📅 ${date}\n💬 ${msg.snippet}\n`;
        }).join("\n");

        return {
          success: true,
          message: `🔍 Search results for "${intent.query}":\n\n${formatted}`,
          data: messages,
        };
      }

      case "send": {
        if (!intent.recipient) {
          return {
            success: false,
            message: "Please specify the recipient email address.",
          };
        }

        const subject = intent.subject || "Message from AI Assistant";
        const body = intent.body || "This message was sent via AI Assistant.";

        await client.sendMessage(intent.recipient, subject, body);

        return {
          success: true,
          message: `✅ Email sent to ${intent.recipient}\n📧 Subject: ${subject}`,
        };
      }

      case "summarize": {
        const query = intent.query || "is:unread";
        const messages = await client.listMessages(query, intent.limit || 20);

        if (messages.length === 0) {
          return {
            success: true,
            message: "📭 No emails to summarize!",
          };
        }

        // Prepare email data for summarization
        const emailData = messages.slice(0, 10).map(msg => {
          const from = getHeader(msg.payload.headers, "from");
          const subject = getHeader(msg.payload.headers, "subject");
          const date = formatDate(msg.internalDate);
          
          return {
            from,
            subject,
            date,
            snippet: msg.snippet,
          };
        });

        // Generate summary using AI
        const summary = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: `Summarize these emails in a concise, organized way. Group by topic/sender if relevant:\n\n${JSON.stringify(emailData, null, 2)}`,
          temperature: 0.3,
        });

        return {
          success: true,
          message: `📊 Email Summary (${messages.length} emails):\n\n${summary.text}`,
          data: messages,
        };
      }

      default:
        return {
          success: false,
          message: "Sorry, I don't understand that Gmail action.",
        };
    }
  } catch (error) {
    console.error("Gmail action error:", error);
    return {
      success: false,
      message: `Gmail error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}