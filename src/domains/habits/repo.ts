import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { habitLogs } from "../../shared/db/schema.js";

export async function logHabit(userId: string, habitName: string) {
  await db.insert(habitLogs).values({ userId, habitName });
}

export async function getHabitLogsForToday(userId: string, habitName: string, todayStart: Date, todayEnd: Date) {
  return db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitName, habitName), gte(habitLogs.loggedAt, todayStart), lt(habitLogs.loggedAt, todayEnd)));
}

export async function getHabitLogs(userId: string, habitName: string) {
  return db
    .select({ loggedAt: habitLogs.loggedAt })
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitName, habitName)))
    .orderBy(desc(habitLogs.loggedAt));
}
