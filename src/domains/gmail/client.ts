import { type GmailAccount } from "../../shared/db/schema.js";
import { refreshAccessToken } from "./oauth.js";
import { updateGmailAccount } from "./repo.js";

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{ mimeType: string; body: { data?: string } }>;
    body?: { data?: string };
  };
  internalDate: string;
}

interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

interface GmailClient {
  listMessages(query?: string, maxResults?: number): Promise<GmailMessage[]>;
  getMessage(messageId: string): Promise<GmailMessage>;
  getThread(threadId: string): Promise<GmailThread>;
  sendMessage(to: string, subject: string, body: string): Promise<void>;
}

export async function createGmailClient(account: GmailAccount): Promise<GmailClient> {
  let accessToken = account.accessToken;

  // Check if token needs refresh
  if (new Date() >= account.expiresAt) {
    try {
      const tokens = await refreshAccessToken(account.refreshToken);
      accessToken = tokens.access_token;
      
      // Update stored tokens
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await updateGmailAccount(account.userId, {
        accessToken,
        expiresAt,
      });
    } catch (error) {
      throw new Error(`Failed to refresh Gmail access token: ${error}`);
    }
  }

  async function gmailRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API error: ${response.status} ${errorText}`);
    }

    return await response.json() as T;
  }

  return {
    async listMessages(query = "", maxResults = 10): Promise<GmailMessage[]> {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("maxResults", maxResults.toString());

      const response = await gmailRequest<{ messages?: Array<{ id: string }> }>(
        `/messages?${params}`
      );

      if (!response.messages) return [];

      // Fetch full message details
      const messages = await Promise.all(
        response.messages.map(msg => 
          gmailRequest<GmailMessage>(`/messages/${msg.id}`)
        )
      );

      return messages;
    },

    async getMessage(messageId: string): Promise<GmailMessage> {
      return await gmailRequest<GmailMessage>(`/messages/${messageId}`);
    },

    async getThread(threadId: string): Promise<GmailThread> {
      return await gmailRequest<GmailThread>(`/threads/${threadId}`);
    },

    async sendMessage(to: string, subject: string, body: string): Promise<void> {
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "",
        body,
      ].join("\n");

      const encodedMessage = btoa(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      await gmailRequest("/messages/send", {
        method: "POST",
        body: JSON.stringify({
          raw: encodedMessage,
        }),
      });
    },
  };
}