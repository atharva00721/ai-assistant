import { Bot, webhookCallback } from "grammy";

const apiBaseUrl = Bun.env.API_BASE_URL || "http://localhost:3000";

let cachedHandler: ((ctx: any) => Promise<any>) | null = null;

export function getWebhookHandler() {
  if (cachedHandler) return cachedHandler;

  const token = Bun.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is required for webhook.");
  }

  const bot = new Bot(token);

  bot.on("message:text", async (ctx) => {
    const message = ctx.message.text.trim();
    if (!message) return;

    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, userId }),
      });

      const data = (await response.json()) as {
        reply?: string;
        imageUrl?: string;
        sources?: Array<{ url: string; title?: string }>;
      };

      if (data.imageUrl) {
        // Send image
        await ctx.replyWithPhoto(data.imageUrl, {
          caption: data.reply || undefined,
        });
      } else {
        // Send text with optional sources
        let reply = data.reply?.trim() || "No response.";
        
        // Append sources if available
        if (data.sources && data.sources.length > 0) {
          reply += "\n\n📚 Sources:\n";
          data.sources.slice(0, 3).forEach((source, idx) => {
            reply += `${idx + 1}. ${source.title || source.url}\n`;
          });
        }
        
        await ctx.reply(reply);
      }
    } catch {
      await ctx.reply("Failed to reach the API.");
    }
  });

  cachedHandler = webhookCallback(bot, "elysia") as (ctx: any) => Promise<any>;
  return cachedHandler;
}
