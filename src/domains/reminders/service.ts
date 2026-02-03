import { formatTimeInTimezone, formatTimeShortInTimezone } from "../../shared/utils/timezone.js";
import {
  createReminder,
  findActiveReminder,
  findReminderForSnooze,
  listUpcomingReminders,
  markReminderDone,
  snoozeReminder,
} from "./repo.js";

export async function handleListReminders(userId: string, userTimezone: string) {
  const now = new Date();
  const userReminders = await listUpcomingReminders(userId, now);

  if (userReminders.length === 0) {
    return { reply: "You have no upcoming reminders." };
  }

  let reply = `📋 Your upcoming reminders (${userReminders.length}):\n\n`;
  userReminders.forEach((reminder, idx) => {
    const time = new Date(reminder.remindAt);
    const timeStr = formatTimeShortInTimezone(time, userTimezone);
    reply += `${idx + 1}. "${reminder.message || ""}"\n   📅 ${timeStr}\n   🆔 ID: ${reminder.id}\n\n`;
  });
  reply += "Use /cancel <id> to cancel a reminder";
  return { reply };
}

export async function handleCancelReminderCommand(message: string, userId: string) {
  const idMatch = message.match(/\/cancel\s+(\d+)/);
  if (!idMatch || !idMatch[1]) {
    return { reply: "Please specify a reminder ID: /cancel <id>\nUse /list to see your reminders." };
  }

  const reminderId = parseInt(idMatch[1], 10);
  const reminder = await findActiveReminder(userId, reminderId);

  if (!reminder) {
    return { reply: "Reminder not found or already completed. Use /list to see your reminders." };
  }

  await markReminderDone(reminderId);
  return { reply: `✅ Cancelled reminder: "${reminder.message}"` };
}

export async function createReminderFromAI(params: {
  userId: string;
  message: string;
  timeIso: string;
  userTimezone: string;
}) {
  const remindAt = new Date(params.timeIso);
  const newReminder = await createReminder({
    userId: params.userId,
    message: params.message,
    remindAt,
  });

  const timeStr = formatTimeInTimezone(remindAt, params.userTimezone);
  return {
    reply: `✅ Reminder set!\n\n"${params.message}"\n📅 ${timeStr}\n🆔 ID: ${newReminder?.id}\n\nUse /list to see all reminders\nUse /cancel ${newReminder?.id} to cancel`,
  };
}

export async function createFocusReminder(params: {
  userId: string;
  message: string;
  durationMinutes: number;
  userTimezone: string;
}) {
  const remindAt = new Date(Date.now() + params.durationMinutes * 60 * 1000);
  const newReminder = await createReminder({
    userId: params.userId,
    message: params.message,
    remindAt,
  });
  const timeStr = formatTimeShortInTimezone(remindAt, params.userTimezone);
  return {
    reply: `⏱️ Focus timer: ${params.durationMinutes} min\n📅 I’ll remind you at ${timeStr}\n\nUse /list or /cancel ${newReminder?.id} if needed.`,
  };
}

export async function handleSnooze(params: {
  reminderId: number;
  userId: string;
  minutes: number;
}) {
  const reminder = await findReminderForSnooze(params.userId, params.reminderId);
  if (!reminder) {
    return { success: false, status: 404, message: "Reminder not found" };
  }

  const newTime = new Date(Date.now() + params.minutes * 60 * 1000);
  await snoozeReminder(params.reminderId, newTime);
  return {
    success: true,
    status: 200,
    message: `Snoozed for ${params.minutes} minutes`,
    newTime: newTime.toISOString(),
  };
}
