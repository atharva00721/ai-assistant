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

    try {
      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = (await response.json()) as { reply?: string };
      const reply = data.reply?.trim() || "No response.";
      await ctx.reply(reply);
    } catch {
      await ctx.reply("Failed to reach the API.");
    }
  });

  cachedHandler = webhookCallback(bot, "elysia") as (ctx: any) => Promise<any>;
  return cachedHandler;
}
