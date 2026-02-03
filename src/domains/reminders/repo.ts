import { and, eq, gte } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { reminders, type ReminderKind } from "../../shared/db/schema.js";

export async function listUpcomingReminders(userId: string, now: Date) {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.isDone, false), gte(reminders.remindAt, now)))
    .orderBy(reminders.remindAt);
}

export async function findActiveReminder(userId: string, reminderId: number) {
  const rows = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId), eq(reminders.isDone, false)));
  return rows[0] ?? null;
}

export async function createReminder(params: {
  userId: string;
  message: string;
  remindAt: Date;
  kind?: ReminderKind;
}) {
  const [newReminder] = await db
    .insert(reminders)
    .values({
      userId: params.userId,
      message: params.message,
      remindAt: params.remindAt,
      isDone: false,
      kind: params.kind ?? null,
    })
    .returning();
  return newReminder ?? null;
}

export async function markReminderDone(reminderId: number) {
  await db.update(reminders).set({ isDone: true }).where(eq(reminders.id, reminderId));
}

export async function findReminderForSnooze(userId: string, reminderId: number) {
  const rows = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)));
  return rows[0] ?? null;
}

export async function snoozeReminder(reminderId: number, newTime: Date) {
  await db
    .update(reminders)
    .set({ remindAt: newTime, isDone: false })
    .where(eq(reminders.id, reminderId));
}
