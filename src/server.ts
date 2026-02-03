import { Elysia, t } from "elysia";
import { askAI } from "./ai.js";
import { getWebhookHandler } from "./bot.js";
import pkg from "../package.json" assert { type: "json" };
import { db } from "./db.js";
import { reminders, users } from "./schema.js";
import { eq, and, gte } from "drizzle-orm";

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
    timezone: timezone || "UTC",
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

const app = new Elysia()
  .post(
    "/ask",
    async ({ body, set }) => {
      const message = body.message?.trim();
      const userId = body.userId?.trim();
      const timezone = body.timezone?.trim();
      
      if (!message) {
        set.status = 400;
        return { reply: "Message is required." };
      }

      if (!userId) {
        set.status = 400;
        return { reply: "User ID is required." };
      }

      // Get or create user with timezone
      const user = await getOrCreateUser(userId, timezone);
      const userTimezone = user?.timezone || "UTC";
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
          return { reply: `Your current timezone is: ${userTimezone}\n\nTo change it, use: /timezone <timezone>\nExample: /timezone America/New_York\n\nCommon timezones:\n- America/New_York\n- America/Chicago\n- America/Denver\n- America/Los_Angeles\n- Europe/London\n- Europe/Paris\n- Asia/Tokyo\n- Asia/Shanghai\n- Australia/Sydney` };
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
          return { reply: `Invalid timezone: ${newTimezone}\n\nPlease use a valid timezone like:\n- America/New_York\n- America/Los_Angeles\n- Europe/London\n- Asia/Tokyo` };
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

      const result = await askAI(message, userId, userTimezone, todoistToken);
      
      // Check if this is a Todoist response
      if (result.todoist) {
        return { reply: result.todoist };
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
        message: t.String(),
        userId: t.String(),
        timezone: t.Optional(t.String()),
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
