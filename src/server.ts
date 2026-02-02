import { Elysia, t } from "elysia";
import { askAI } from "./ai.js";
import { getWebhookHandler } from "./bot.js";
import pkg from "../package.json" assert { type: "json" };
import { db } from "./db.js";
import { reminders } from "./schema.js";
import { eq, and, gte } from "drizzle-orm";

const app = new Elysia()
  .post(
    "/ask",
    async ({ body, set }) => {
      const message = body.message?.trim();
      const userId = body.userId?.trim();
      
      if (!message) {
        set.status = 400;
        return { reply: "Message is required." };
      }

      if (!userId) {
        set.status = 400;
        return { reply: "User ID is required." };
      }

      // Handle /list command
      if (message.toLowerCase() === "/list" || message.toLowerCase().includes("list my reminders") || message.toLowerCase().includes("show my reminders")) {
        try {
          const now = new Date();
          const userReminders = await db
            .select()
            .from(reminders)
            .where(
              and(
                eq(reminders.userId, userId),
                eq(reminders.isDone, false),
                gte(reminders.remindAt, now)
              )
            )
            .orderBy(reminders.remindAt);

          if (userReminders.length === 0) {
            return { reply: "You have no upcoming reminders." };
          }

          let reply = `📋 Your upcoming reminders (${userReminders.length}):\n\n`;
          userReminders.forEach((reminder, idx) => {
            const time = new Date(reminder.remindAt);
            const timeStr = time.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            reply += `${idx + 1}. "${reminder.message || ""}"\n   📅 ${timeStr}\n   🆔 ID: ${reminder.id}\n\n`;
          });
          reply += "Use /cancel <id> to cancel a reminder";
          
          return { reply };
        } catch (error) {
          console.error("Error listing reminders:", error);
          set.status = 500;
          return { reply: "Failed to list reminders. Please try again." };
        }
      }

      // Handle /cancel command
      if (message.toLowerCase().startsWith("/cancel")) {
        try {
          const idMatch = message.match(/\/cancel\s+(\d+)/);
          if (!idMatch || !idMatch[1]) {
            return { reply: "Please specify a reminder ID: /cancel <id>\nUse /list to see your reminders." };
          }

          const reminderId = parseInt(idMatch[1]);
          const reminder = await db
            .select()
            .from(reminders)
            .where(
              and(
                eq(reminders.id, reminderId),
                eq(reminders.userId, userId),
                eq(reminders.isDone, false)
              )
            );

          if (reminder.length === 0) {
            return { reply: "Reminder not found or already completed. Use /list to see your reminders." };
          }

          await db
            .update(reminders)
            .set({ isDone: true })
            .where(eq(reminders.id, reminderId));

          return { reply: `✅ Cancelled reminder: "${reminder[0]?.message}"` };
        } catch (error) {
          console.error("Error canceling reminder:", error);
          set.status = 500;
          return { reply: "Failed to cancel reminder. Please try again." };
        }
      }

      const result = await askAI(message, userId);
      
      // Check if this is a reminder intent
      if (result.reminder) {
        try {
          // Insert reminder into database
          const [newReminder] = await db.insert(reminders).values({
            userId,
            message: result.reminder.message,
            remindAt: new Date(result.reminder.time),
            isDone: false,
          }).returning();

          const reminderTime = new Date(result.reminder.time);
          const timeStr = reminderTime.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          return {
            reply: `✅ Reminder set!\n\n"${result.reminder.message}"\n📅 ${timeStr}\n🆔 ID: ${newReminder?.id}\n\nUse /list to see all reminders\nUse /cancel ${newReminder?.id} to cancel`,
          };
        } catch (error) {
          console.error("Error creating reminder:", error);
          set.status = 500;
          return { reply: "Failed to create reminder. Please try again." };
        }
      }

      return {
        reply: result.text || "No response.",
        imageUrl: result.imageUrl,
        sources: result.sources,
      };
    },
    {
      body: t.Object({
        message: t.String(),
        userId: t.String(),
      }),
    },
  )
  .post(
    "/snooze",
    async ({ body, set }) => {
      const reminderId = body.reminderId;
      const userId = body.userId;
      const minutes = body.minutes || 10;

      if (!reminderId || !userId) {
        set.status = 400;
        return { success: false, message: "Reminder ID and User ID required" };
      }

      try {
        const reminder = await db
          .select()
          .from(reminders)
          .where(
            and(
              eq(reminders.id, reminderId),
              eq(reminders.userId, userId)
            )
          );

        if (reminder.length === 0) {
          set.status = 404;
          return { success: false, message: "Reminder not found" };
        }

        const newTime = new Date(Date.now() + minutes * 60 * 1000);
        await db
          .update(reminders)
          .set({ 
            remindAt: newTime,
            isDone: false 
          })
          .where(eq(reminders.id, reminderId));

        return { 
          success: true, 
          message: `Snoozed for ${minutes} minutes`,
          newTime: newTime.toISOString()
        };
      } catch (error) {
        console.error("Error snoozing reminder:", error);
        set.status = 500;
        return { success: false, message: "Failed to snooze reminder" };
      }
    },
    {
      body: t.Object({
        reminderId: t.Number(),
        userId: t.String(),
        minutes: t.Optional(t.Number()),
      }),
    },
  )
  .get("/", () => ({ ok: true }))
  .get("/health", () => ({ ok: true }))
  .get("/version", () => ({
    version:
      (pkg as { version?: string }).version ??
      Bun.env.VERCEL_GIT_COMMIT_SHA ??
      "unknown",
  }))
  .post("/webhook", (ctx) => getWebhookHandler()(ctx));

const port = Number(Bun.env.PORT) || 3000;
app.listen(port);
console.log(`API listening on port ${port}`);

export default app;
