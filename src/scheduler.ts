import { db } from "./db.js";
import { reminders } from "./schema.js";
import { lte, eq, and } from "drizzle-orm";
import { Bot } from "grammy";

const token = Bun.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required for scheduler.");
}

const bot = new Bot(token);

async function checkAndSendReminders() {
  try {
    const now = new Date();

    // Query for reminders that are due and not done
    const dueReminders = await db
      .select()
      .from(reminders)
      .where(and(lte(reminders.remindAt, now), eq(reminders.isDone, false)));

    console.log(`Found ${dueReminders.length} due reminders`);

    for (const reminder of dueReminders) {
      try {
        // Send reminder message via Telegram
        await bot.api.sendMessage(
          reminder.userId,
          `🔔 Reminder: ${reminder.message}`
        );

        // Mark as done
        await db
          .update(reminders)
          .set({ isDone: true })
          .where(eq(reminders.id, reminder.id));

        console.log(`Sent reminder ${reminder.id} to user ${reminder.userId}`);
      } catch (error) {
        console.error(`Failed to send reminder ${reminder.id}:`, error);
        // Continue to next reminder even if this one fails
      }
    }
  } catch (error) {
    console.error("Error in checkAndSendReminders:", error);
  }
}

// Run every minute
Bun.cron("* * * * *", checkAndSendReminders);

console.log("Reminder scheduler started - checking every minute");

// Keep the process alive
setInterval(() => {}, 1000 * 60 * 60); // Keep alive for 1 hour intervals
