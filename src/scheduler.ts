import { db } from "./shared/db/index.js";
import { reminders, users } from "./shared/db/schema.js";
import { and, eq, lte } from "drizzle-orm";
import { Bot } from "grammy";
import { getAllEnabledMorningJobDigests } from "./domains/automations/repo.js";
import {
  formatMorningJobDigestMessage,
  updateMorningJobDigestLastSent,
} from "./domains/automations/service.js";
import type { MorningJobDigestConfig } from "./domains/automations/repo.js";
import { getTimeInTimezone, getDateStringInTimezone } from "./shared/utils/timezone.js";

const botToken = Bun.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Bot(botToken);

function getReminderMessage(reminder: { message: string; kind?: string | null }): string {
  const msg = reminder.message?.trim() || "Time's up";
  if (reminder.kind === "focus_timer") {
    return `⏱️ Time's up! You asked me to remind you: ${msg}\n\nHope the focus session went well.`;
  }
  return `🔔 Hey — you asked me to remind you: ${msg}`;
}

async function sendReminder(reminder: any, user: any) {
  try {
    const now = new Date();
    const remindAt = new Date(reminder.remindAt);
    const minutesPast = Math.floor((now.getTime() - remindAt.getTime()) / 1000 / 60);

    const messageText = getReminderMessage(reminder);

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "⏰ Snooze 10 min", callback_data: `snooze_${reminder.id}_10` },
          { text: "🕐 Snooze 1 hour", callback_data: `snooze_${reminder.id}_60` },
        ],
        [{ text: "✅ Done", callback_data: `done_${reminder.id}` }],
      ],
    };

    await bot.api.sendMessage(reminder.userId, messageText, {
      reply_markup: inlineKeyboard,
    });

    console.log(
      `Sent reminder ${reminder.id} to user ${reminder.userId} (${minutesPast} minutes late)`
    );

    await db
      .update(reminders)
      .set({ isDone: true })
      .where(eq(reminders.id, reminder.id));
  } catch (error) {
    console.error("Failed to send reminder:", error);
  }
}

async function processMorningJobDigests() {
  try {
    const now = new Date();
    const rows = await getAllEnabledMorningJobDigests();
    if (rows.length === 0) return;

    for (const row of rows) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.userId, row.userId))
        .limit(1);
      if (!user) continue;

      const config = row.config as MorningJobDigestConfig;
      if (!config?.time) continue;

      const userTime = getTimeInTimezone(now, user.timezone);
      const todayInUserTz = getDateStringInTimezone(now, user.timezone);
      if (userTime !== config.time) continue;

      const lastSentAt = row.lastSentAt;
      if (lastSentAt) {
        const lastSentDateInUserTz = getDateStringInTimezone(
          new Date(lastSentAt),
          user.timezone,
        );
        if (lastSentDateInUserTz === todayInUserTz) continue;
      }

      const messageText = formatMorningJobDigestMessage(config);
      try {
        await bot.api.sendMessage(row.userId, messageText);
        await updateMorningJobDigestLastSent(row.userId, now);
        console.log(`Sent morning job digest to user ${row.userId}`);
      } catch (err) {
        console.error("Failed to send morning job digest:", err);
      }
    }
  } catch (error) {
    console.error("Morning job digest error:", error);
  }
}

async function processReminders() {
  try {
    const now = new Date();

    const dueReminders = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.isDone, false), lte(reminders.remindAt, now)));

    if (dueReminders.length > 0) {
      console.log(`Processing ${dueReminders.length} due reminders`);
      for (const reminder of dueReminders) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.userId, reminder.userId))
          .limit(1);

        if (!user) {
          console.warn(`User not found for reminder ${reminder.id}`);
          continue;
        }

        await sendReminder(reminder, user);
      }
    }

    await processMorningJobDigests();
  } catch (error) {
    console.error("Scheduler error:", error);
  }
}

const CHECK_INTERVAL_MS = 30 * 1000;

export function startScheduler(): void {
  console.log("🚀 Reminder scheduler started - checking every 30 seconds");
  processReminders();
  setInterval(processReminders, CHECK_INTERVAL_MS);
}

if (import.meta.main) {
  startScheduler();
}
