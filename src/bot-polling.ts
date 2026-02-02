import { Bot } from "grammy";

const token = Bun.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required");
}

const apiBaseUrl = Bun.env.API_BASE_URL || "http://localhost:3000";
const bot = new Bot(token);

bot.on("message:text", async (ctx) => {
  const message = ctx.message.text.trim();
  if (!message) return;

  const userId = ctx.from?.id.toString();
  if (!userId) return;

  console.log(`Received message from ${userId}: ${message}`);

  try {
    const response = await fetch(`${apiBaseUrl}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, userId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `API ${response.status} ${response.statusText}: ${errorBody}`,
      );
    }

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

    console.log(`Replied to ${userId}`);
  } catch (error) {
    console.error("API request failed", {
      apiBaseUrl,
      error,
    });
    await ctx.reply(
      "Sorry, something went wrong. Please try again.",
    );
  }
});

console.log("🤖 Bot started in polling mode...");
console.log(`📡 API endpoint: ${apiBaseUrl}/ask`);
console.log("👋 Send a message to your bot to test!");

bot.start();
