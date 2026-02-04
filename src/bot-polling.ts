import { Bot } from "grammy";
import { createUpdateDeduper } from "./telegram-dedupe.js";
import { detectSearchIntent } from "./domains/ai/intents/search.js";
import { hasSearch } from "./domains/ai/clients.js";

const token = Bun.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required");
}

const apiBaseUrl = Bun.env.API_BASE_URL || "http://localhost:3000";
const bot = new Bot(token);
const isDuplicateUpdate = createUpdateDeduper();

bot.use((ctx, next) => {
  if (isDuplicateUpdate(ctx.update.update_id)) return;
  return next();
});

bot.on("message:text", async (ctx) => {
  const message = ctx.message.text.trim();
  if (!message) return;

  const userId = ctx.from?.id.toString();
  if (!userId) return;

  console.log(`Received message from ${userId}: ${message}`);

  try {
    if (hasSearch && detectSearchIntent(message)) {
      await ctx.reply("🔍 Searching the web, this might take a few seconds...");
    }

    // Try to get timezone from Telegram user language (rough estimate)
    // Users can set exact timezone with /timezone command
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

// Handle callback queries (inline button presses)
bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const userId = ctx.from?.id.toString();
  
  if (!userId) return;

  console.log(`Received callback from ${userId}: ${callbackData}`);

  try {
    if (callbackData.startsWith("snooze_")) {
      // Parse: snooze_<reminderId>_<minutes>
      const parts = callbackData.split("_");
      const reminderId = parseInt(parts[1] || "0");
      const minutes = parseInt(parts[2] || "10");

      const response = await fetch(`${apiBaseUrl}/snooze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reminderId, userId, minutes }),
      });

      const data = (await response.json()) as { success: boolean; message: string };
      
      if (data.success) {
        await ctx.answerCallbackQuery({ text: `⏰ Snoozed for ${minutes} minutes!` });
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        await ctx.reply(`⏰ Reminder snoozed for ${minutes} minutes. I'll remind you again!`);
      } else {
        await ctx.answerCallbackQuery({ text: "Failed to snooze reminder" });
      }
    } else if (callbackData.startsWith("done_")) {
      // Parse: done_<reminderId>
      const reminderId = parseInt(callbackData.split("_")[1] || "0");
      
      await ctx.answerCallbackQuery({ text: "✅ Reminder marked as done!" });
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      await ctx.reply("✅ Great! Reminder completed.");
    }
  } catch (error) {
    console.error("Error handling callback:", error);
    await ctx.answerCallbackQuery({ text: "Something went wrong" });
  }
});

console.log("🤖 Bot started in polling mode...");
console.log(`📡 API endpoint: ${apiBaseUrl}/ask`);
console.log("👋 Send a message to your bot to test!");

bot.start();
