import { Elysia, t } from "elysia";
import { askAI } from "./ai.js";
import { getWebhookHandler } from "./bot.js";
import { validateTelegramWebAppInitData } from "./telegram-webapp.js";
import { WEBAPP_HTML } from "./webapp-html.js";
import pkg from "../package.json" assert { type: "json" };
import { db } from "./db.js";
import { reminders, users, notes, habitLogs } from "./schema.js";
import { createMemory } from "./memory-repo.js";
import { eq, and, gte, lt, sql, desc, like } from "drizzle-orm";

// Helper function to get or create user
async function getOrCreateUser(userId: string, timezone?: string) {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);

  if (existingUser.length > 0) {
    // Update timezone if provided
    if (timezone && existingUser[0]?.timezone !== timezone) {
      await db
        .update(users)
        .set({ timezone, updatedAt: new Date() })
        .where(eq(users.userId, userId));
      return { ...existingUser[0], timezone };
    }
    return existingUser[0];
  }

  // Create new user
  const [newUser] = await db.insert(users).values({
    userId,
    timezone: timezone || "Asia/Kolkata",
  }).returning();

  return newUser;
}

// Helper function to format time in user's timezone
function formatTimeInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatTimeShortInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/** Serve the Web App setup page (inlined so it always works in production). */
function serveWebApp() {
  return new Response(WEBAPP_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const app = new Elysia()
  .post(
    "/ask",
    async ({ body, set }) => {
      const message = (body.message?.trim() || "").trim();
      const userId = body.userId?.trim();
      const timezone = body.timezone?.trim();
      const imageUrl = body.imageUrl?.trim();
      
      if (!message && !imageUrl) {
        set.status = 400;
        return { reply: "Message or image is required." };
      }

      if (!userId) {
        set.status = 400;
        return { reply: "User ID is required." };
      }

      // Get or create user with timezone
      const user = await getOrCreateUser(userId, timezone);
      const userTimezone = user?.timezone || "Asia/Kolkata";
      const todoistToken = user?.todoistToken || null;

      // Handle /todoist_token command
      if (message.toLowerCase().startsWith("/todoist_token")) {
        const tokenMatch = message.match(/\/todoist_token\s+(.+)/);
        if (!tokenMatch || !tokenMatch[1]) {
          if (todoistToken) {
            return { reply: `Your Todoist is connected! ✅\n\nTo update your token, use:\n/todoist_token YOUR_NEW_TOKEN\n\nTo disconnect, use:\n/todoist_disconnect` };
          }
          return { reply: `Connect your Todoist account by setting your API token:\n\n/todoist_token YOUR_API_TOKEN\n\nGet your token from:\nhttps://todoist.com/app/settings/integrations/developer` };
        }

        const newToken = tokenMatch[1].trim();
        await db
          .update(users)
          .set({ todoistToken: newToken, updatedAt: new Date() })
          .where(eq(users.userId, userId));
        
        return { reply: `✅ Todoist connected!\n\nYou can now:\n• "Add task to buy milk tomorrow"\n• "Show my tasks for today"\n• "Complete task about groceries"\n• "Create project called Work"\n• "What are my projects?"\n• "Show urgent tasks"\n\nAnd much more! Just ask naturally.` };
      }

      // Handle /todoist_disconnect command
      if (message.toLowerCase() === "/todoist_disconnect") {
        if (!todoistToken) {
          return { reply: "You don't have a Todoist account connected." };
        }
        
        await db
          .update(users)
          .set({ todoistToken: null, updatedAt: new Date() })
          .where(eq(users.userId, userId));
        
        return { reply: "✅ Todoist disconnected." };
      }

      // Handle /todoist_help command
      if (message.toLowerCase() === "/todoist_help" || message.toLowerCase() === "/todoist") {
        if (!todoistToken) {
          return { reply: `❌ Todoist not connected.\n\nConnect with:\n/todoist_token YOUR_API_TOKEN\n\nGet your token from:\nhttps://todoist.com/app/settings/integrations/developer` };
        }

        return { reply: `🎯 Todoist – ask naturally:\n\n📝 Add tasks:\n• "Add buy milk, eggs, bread"\n• "Add call mom tomorrow"\n• "Add task [description]"\n\n📋 List & search:\n• "Show my tasks" / "Tasks for today"\n• "Show urgent tasks"\n\n✅ Complete:\n• "Mark [task] as done"\n• "Mark all done" / "Complete everything"\n\n🗑️ Delete:\n• "Delete task [name]"\n• "Delete all tasks" / "Clear everything"\n• "Delete all tasks for today"\n\n📁 Projects & labels: "Create project X", "Show projects", etc.\n\n💡 Use normal language – e.g. "add groceries and workout for tomorrow"` };
      }

      // Handle /timezone command
      if (message.toLowerCase().startsWith("/timezone")) {
        const tzMatch = message.match(/\/timezone\s+(.+)/);
        if (!tzMatch || !tzMatch[1]) {
          return { reply: `Your current timezone is: ${userTimezone}\n\nTo change it, use: /timezone <timezone>\nExample: /timezone Asia/Kolkata\n\nCommon timezones:\n- Asia/Kolkata (India/Bangalore)\n- America/New_York\n- Europe/London\n- Asia/Tokyo\n- Australia/Sydney` };
        }

        const newTimezone = tzMatch[1].trim();
        try {
          // Test if timezone is valid
          new Date().toLocaleString('en-US', { timeZone: newTimezone });
          await db
            .update(users)
            .set({ timezone: newTimezone, updatedAt: new Date() })
            .where(eq(users.userId, userId));
          
          const now = new Date();
          const timeInTz = formatTimeInTimezone(now, newTimezone);
          return { reply: `✅ Timezone updated to ${newTimezone}\nCurrent time: ${timeInTz}` };
        } catch (error) {
          return { reply: `Invalid timezone: ${newTimezone}\n\nPlease use a valid timezone like:\n- Asia/Kolkata\n- America/New_York\n- Europe/London\n- Asia/Tokyo` };
        }
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
            const timeStr = formatTimeShortInTimezone(time, userTimezone);
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

      // Convert image URL to base64 if provided, with fallback to original URL.
      let imageDataUrl: string | null = null;
      if (imageUrl) {
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const imageBase64 = Buffer.from(imageBuffer).toString("base64");
            // Detect content type from response or default to jpeg
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            imageDataUrl = `data:${contentType};base64,${imageBase64}`;
          } else {
            console.error(
              "Failed to download image:",
              imageResponse.status,
              imageResponse.statusText,
            );
          }
        } catch (error) {
          console.error("Error downloading image:", error);
        }
      }

      if (imageUrl && !imageDataUrl) {
        console.warn("Falling back to remote image URL for processing.");
      }

      let result;
      try {
        result = await askAI(
          message || "What's in this image?",
          userId,
          userTimezone,
          todoistToken,
          imageDataUrl ?? imageUrl,
        );
      } catch (error) {
        console.error("AI request failed:", error);
        set.status = 500;
        return {
          reply:
            "Sorry, I'm having trouble responding right now. Please try again in a moment.",
        };
      }
      
      if (result.todoist) {
        return { reply: result.todoist };
      }

      // Quick notes: save or search
      if (result.note) {
        try {
          if (result.note.action === "save" && result.note.content) {
            const [note] = await db
              .insert(notes)
              .values({ userId, content: result.note.content })
              .returning();
            if (note) {
              await createMemory({
                userId,
                kind: "note",
                content: result.note.content.trim(),
                metadata: { noteId: note.id, source: "note" },
                importance: 2,
              });
            }
            return { reply: `📝 Saved: "${result.note.content.slice(0, 80)}${result.note.content.length > 80 ? "…" : ""}"` };
          }
          if (result.note.action === "search" && result.note.query) {
            const found = await db
              .select({ content: notes.content, createdAt: notes.createdAt })
              .from(notes)
              .where(and(eq(notes.userId, userId), like(notes.content, `%${result.note.query}%`)))
              .orderBy(desc(notes.createdAt))
              .limit(10);
            if (found.length === 0) return { reply: `📝 No notes found about "${result.note.query}".` };
            const lines = found.map((n, i) => `${i + 1}. ${n.content.slice(0, 120)}${n.content.length > 120 ? "…" : ""}`);
            return { reply: `📝 Notes about "${result.note.query}":\n\n${lines.join("\n")}` };
          }
        } catch (err) {
          console.error("Notes error:", err);
          set.status = 500;
          return { reply: "Failed to save or search notes." };
        }
      }

      // Habit: log, check today, or streak
      if (result.habit) {
        try {
          const name = result.habit.habitName;
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart);
          todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
          if (result.habit.action === "log") {
            await db.insert(habitLogs).values({ userId, habitName: name });
            return { reply: `✅ Logged: ${name}` };
          }
          if (result.habit.action === "check") {
            const todayLogs = await db
              .select()
              .from(habitLogs)
              .where(
                and(
                  eq(habitLogs.userId, userId),
                  eq(habitLogs.habitName, name),
                  gte(habitLogs.loggedAt, todayStart),
                  lt(habitLogs.loggedAt, todayEnd)
                )
              );
            return { reply: todayLogs.length > 0 ? `✅ Yes, you logged "${name}" today.` : `❌ No "${name}" logged today yet.` };
          }
          if (result.habit.action === "streak") {
            const allLogs = await db
              .select({ loggedAt: habitLogs.loggedAt })
              .from(habitLogs)
              .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitName, name)))
              .orderBy(desc(habitLogs.loggedAt));
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
        } catch (err) {
          console.error("Habit error:", err);
          set.status = 500;
          return { reply: "Failed to update habit." };
        }
      }

      if (result.weather) {
        return { reply: result.weather };
      }

      // Focus timer → create reminder
      if (result.focus) {
        try {
          const remindAt = new Date(Date.now() + result.focus.durationMinutes * 60 * 1000);
          const [newReminder] = await db.insert(reminders).values({
            userId,
            message: result.focus.message,
            remindAt,
            isDone: false,
          }).returning();
          const timeStr = formatTimeShortInTimezone(remindAt, userTimezone);
          return {
            reply: `⏱️ Focus timer: ${result.focus.durationMinutes} min\n📅 I’ll remind you at ${timeStr}\n\nUse /list or /cancel ${newReminder?.id} if needed.`,
          };
        } catch (err) {
          console.error("Focus reminder error:", err);
          set.status = 500;
          return { reply: "Failed to set focus timer." };
        }
      }
      
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
          const timeStr = formatTimeInTimezone(reminderTime, userTimezone);
          
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
        message: t.Optional(t.String()),
        userId: t.String(),
        timezone: t.Optional(t.String()),
        imageUrl: t.Optional(t.String()),
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
  .post(
    "/webapp/init",
    async ({ body, set }) => {
      const initData = body.initData?.trim();
      if (!initData) {
        set.status = 400;
        return { error: "initData required" };
      }
      const tgUser = validateTelegramWebAppInitData(initData);
      if (!tgUser) {
        set.status = 401;
        return { error: "Invalid init data" };
      }
      const userId = String(tgUser.id);
      const user = await getOrCreateUser(userId);
      return {
        user: {
          userId: user?.userId,
          timezone: user?.timezone ?? "Asia/Kolkata",
          hasTodoist: !!user?.todoistToken,
        },
      };
    },
    { body: t.Object({ initData: t.String() }) },
  )
  .patch(
    "/webapp/me",
    async ({ body, set }) => {
      const initData = body.initData?.trim();
      if (!initData) {
        set.status = 400;
        return { error: "initData required" };
      }
      const tgUser = validateTelegramWebAppInitData(initData);
      if (!tgUser) {
        set.status = 401;
        return { error: "Invalid init data" };
      }
      const userId = String(tgUser.id);
      const updates: { timezone?: string; updatedAt: Date } = { updatedAt: new Date() };
      if (body.timezone?.trim()) updates.timezone = body.timezone.trim();
      if (Object.keys(updates).length <= 1) {
        set.status = 400;
        return { error: "Nothing to update" };
      }
      await db.update(users).set(updates).where(eq(users.userId, userId));
      const [user] = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
      return { user: { userId: user?.userId, timezone: user?.timezone ?? "Asia/Kolkata" } };
    },
    {
      body: t.Object({
        initData: t.String(),
        timezone: t.Optional(t.String()),
      }),
    },
  )
  .get("/app", serveWebApp)
  .get("/app/", serveWebApp)
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
