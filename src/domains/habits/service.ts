import { getHabitLogs, getHabitLogsForToday, logHabit } from "./repo.js";

export async function handleHabitIntent(params: {
  userId: string;
  action: "log" | "check" | "streak";
  habitName: string;
}) {
  const name = params.habitName;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  if (params.action === "log") {
    await logHabit(params.userId, name);
    return { reply: `✅ Logged: ${name}` };
  }

  if (params.action === "check") {
    const todayLogs = await getHabitLogsForToday(params.userId, name, todayStart, todayEnd);
    return {
      reply: todayLogs.length > 0 ? `✅ Yes, you logged "${name}" today.` : `❌ No "${name}" logged today yet.`,
    };
  }

  if (params.action === "streak") {
    const allLogs = await getHabitLogs(params.userId, name);
    const byDay = new Set<string>();
    for (const row of allLogs) {
      const d = new Date(row.loggedAt);
      byDay.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
    }
    const sortedDays = [...byDay].sort().reverse();
    let streak = 0;
    const todayStr = `${todayStart.getUTCFullYear()}-${todayStart.getUTCMonth()}-${todayStart.getUTCDate()}`;
    for (let i = 0; i < sortedDays.length; i++) {
      const expect = new Date(todayStart);
      expect.setUTCDate(expect.getUTCDate() - i);
      const expectStr = `${expect.getUTCFullYear()}-${expect.getUTCMonth()}-${expect.getUTCDate()}`;
      if (sortedDays[i] === expectStr) streak++;
      else break;
    }
    return { reply: `🔥 ${name} streak: ${streak} day${streak === 1 ? "" : "s"}` };
  }

  return { reply: "Failed to update habit." };
}
