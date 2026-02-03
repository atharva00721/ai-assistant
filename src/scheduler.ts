import { db } from "./db.js";
import { reminders, users } from "./schema.js";
import { lte, eq, and } from "drizzle-orm";
import { Bot } from "grammy";

const token = Bun.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required for scheduler.");
}

const bot = new Bot(token);

// Helper function to format time in user's timezone
function formatTimeInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

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
        // Get user timezone
        const user = await db
          .select()
          .from(users)
          .where(eq(users.userId, reminder.userId))
          .limit(1);
        
        const userTimezone = user[0]?.timezone || "UTC";
        const scheduledTime = new Date(reminder.remindAt);
        const timeStr = formatTimeInTimezone(scheduledTime, userTimezone);

        // Send reminder message via Telegram with inline keyboard
        await bot.api.sendMessage(
          reminder.userId,
          `🔔 *REMINDER*\n\n"${reminder.message}"\n\n📅 Scheduled: ${timeStr}\n🆔 ID: ${reminder.id}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⏰ Snooze 10 min", callback_data: `snooze_${reminder.id}_10` },
                  { text: "⏰ Snooze 1 hour", callback_data: `snooze_${reminder.id}_60` },
                ],
                [
                  { text: "✅ Done", callback_data: `done_${reminder.id}` },
                ]
              ]
            }
          }
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

// Run every minute using setInterval (60 seconds)
// Note: Bun.cron exists but may not be in @types/bun yet
const INTERVAL_MS = 60 * 1000; // 60 seconds

console.log("Reminder scheduler started - checking every minute");

// Run immediately on startup
checkAndSendReminders();

// Then run every minute
setInterval(checkAndSendReminders, INTERVAL_MS);
