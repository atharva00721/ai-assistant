import { Bot, webhookCallback } from "grammy";
import { createUpdateDeduper } from "./telegram-dedupe.js";

const apiBaseUrl = Bun.env.API_BASE_URL || "http://localhost:3000";

let cachedHandler: ((ctx: any) => Promise<any>) | null = null;

export function getWebhookHandler() {
  if (cachedHandler) return cachedHandler;

  const token = Bun.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is required for webhook.");
  }

  const bot = new Bot(token);
  const isDuplicateUpdate = createUpdateDeduper();

  bot.use((ctx, next) => {
    if (isDuplicateUpdate(ctx.update.update_id)) return;
    return next();
  });

  bot.command("start", async (ctx) => {
    const webAppUrl = `${apiBaseUrl}/app`;
    await ctx.reply(
      "👋 Welcome to your AI Assistant!\n\nSet up your account to get personalized reminders, local time, and more.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚙️ Set up my account", web_app: { url: webAppUrl } }],
          ],
        },
      },
    );
  });

  bot.on("message:photo", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      const photo = ctx.message.photo;
      if (!photo || photo.length === 0) return;
      const largestPhoto = photo[photo.length - 1];
      if (!largestPhoto) return;
      const file = await ctx.api.getFile(largestPhoto.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const caption = ctx.message.caption?.trim() || "";

      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: caption,
          userId,
          imageUrl: fileUrl,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
          username: ctx.from?.username,
          languageCode: ctx.from?.language_code,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API ${response.status} ${response.statusText}: ${errorBody}`);
      }

      const data = (await response.json()) as { reply?: string };
      await ctx.reply(data.reply?.trim() || "No response.");
    } catch (error) {
      console.error("Photo API request failed", { apiBaseUrl, error });
      await ctx.reply("Sorry, I couldn't process that image. Try again.");
    }
  });

  bot.on("message:voice", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      await ctx.reply("🎤 Voice messages aren't supported yet. Please send a text message or photo instead.");
    } catch (error) {
      console.error("Voice message error:", error);
    }
  });

  bot.on("message:text", async (ctx) => {
    const message = ctx.message.text.trim();
    if (message === "/start") return;
    if (!message) return;

    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      const from = ctx.from;
      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          userId,
          firstName: from?.first_name,
          lastName: from?.last_name,
          username: from?.username,
          languageCode: from?.language_code,
        }),
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
    } catch (error) {
      console.error("API request failed", {
        apiBaseUrl,
        error,
      });
      await ctx.reply(
        "API request failed. Check API_BASE_URL and server logs.",
      );
    }
  });

  // Handle callback queries (inline button presses)
  bot.on("callback_query:data", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const userId = ctx.from?.id.toString();
    
    if (!userId) return;

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

  cachedHandler = webhookCallback(bot, "elysia") as (ctx: any) => Promise<any>;
  return cachedHandler;
}
