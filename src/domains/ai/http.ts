import { Elysia, t } from "elysia";
import { askAI } from "./index.js";
import { buildTodoistConnectedReply, buildTodoistHelpReply, buildTodoistTokenPrompt, isTodoistDisconnect, isTodoistHelp, parseTodoistTokenCommand } from "../todoist/commands.js";
import { handleListReminders, handleCancelReminderCommand, createReminderFromAI, createFocusReminder } from "../reminders/service.js";
import { handleNoteIntent } from "../notes/service.js";
import { handleHabitIntent } from "../habits/service.js";
import { getOrCreateUser, setTodoistToken, updateTimezone, validateTimezone, getDefaultTimezone } from "../users/service.js";
import { formatTimeInTimezone } from "../../shared/utils/timezone.js";

export function registerAiRoutes(app: Elysia) {
  return app.post(
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

      const user = await getOrCreateUser(userId, timezone);
      const userTimezone = user?.timezone || getDefaultTimezone();
      const todoistToken = user?.todoistToken || null;

      if (message.toLowerCase().startsWith("/todoist_token")) {
        const parsedToken = parseTodoistTokenCommand(message);
        if (!parsedToken) {
          return { reply: buildTodoistTokenPrompt(!!todoistToken) };
        }

        await setTodoistToken(userId, parsedToken);
        return { reply: buildTodoistConnectedReply() };
      }

      if (isTodoistDisconnect(message)) {
        if (!todoistToken) {
          return { reply: "You don't have a Todoist account connected." };
        }

        await setTodoistToken(userId, null);
        return { reply: "✅ Todoist disconnected." };
      }

      if (isTodoistHelp(message)) {
        return { reply: buildTodoistHelpReply(!!todoistToken) };
      }

      if (message.toLowerCase().startsWith("/timezone")) {
        const tzMatch = message.match(/\/timezone\s+(.+)/);
        if (!tzMatch || !tzMatch[1]) {
          return {
            reply: `Your current timezone is: ${userTimezone}\n\nTo change it, use: /timezone <timezone>\nExample: /timezone Asia/Kolkata\n\nCommon timezones:\n- Asia/Kolkata (India/Bangalore)\n- America/New_York\n- Europe/London\n- Asia/Tokyo\n- Australia/Sydney`,
          };
        }

        const newTimezone = tzMatch[1].trim();
        if (!validateTimezone(newTimezone)) {
          return {
            reply: `Invalid timezone: ${newTimezone}\n\nPlease use a valid timezone like:\n- Asia/Kolkata\n- America/New_York\n- Europe/London\n- Asia/Tokyo`,
          };
        }

        await updateTimezone(userId, newTimezone);
        const now = new Date();
        const timeInTz = formatTimeInTimezone(now, newTimezone);
        return { reply: `✅ Timezone updated to ${newTimezone}\nCurrent time: ${timeInTz}` };
      }

      if (
        message.toLowerCase() === "/list" ||
        message.toLowerCase().includes("list my reminders") ||
        message.toLowerCase().includes("show my reminders")
      ) {
        try {
          return await handleListReminders(userId, userTimezone);
        } catch (error) {
          console.error("Error listing reminders:", error);
          set.status = 500;
          return { reply: "Failed to list reminders. Please try again." };
        }
      }

      if (message.toLowerCase().startsWith("/cancel")) {
        try {
          return await handleCancelReminderCommand(message, userId);
        } catch (error) {
          console.error("Error canceling reminder:", error);
          set.status = 500;
          return { reply: "Failed to cancel reminder. Please try again." };
        }
      }

      let imageDataUrl: string | null = null;
      if (imageUrl) {
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const imageBase64 = Buffer.from(imageBuffer).toString("base64");
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

      if (result.note) {
        try {
          return await handleNoteIntent({
            userId,
            action: result.note.action,
            content: result.note.content,
            query: result.note.query,
          });
        } catch (err) {
          console.error("Notes error:", err);
          set.status = 500;
          return { reply: "Failed to save or search notes." };
        }
      }

      if (result.habit) {
        try {
          return await handleHabitIntent({
            userId,
            action: result.habit.action,
            habitName: result.habit.habitName,
          });
        } catch (err) {
          console.error("Habit error:", err);
          set.status = 500;
          return { reply: "Failed to update habit." };
        }
      }

      if (result.weather) {
        return { reply: result.weather };
      }

      if (result.focus) {
        try {
          return await createFocusReminder({
            userId,
            message: result.focus.message,
            durationMinutes: result.focus.durationMinutes,
            userTimezone,
          });
        } catch (err) {
          console.error("Focus reminder error:", err);
          set.status = 500;
          return { reply: "Failed to set focus timer." };
        }
      }

      if (result.reminder) {
        try {
          return await createReminderFromAI({
            userId,
            message: result.reminder.message,
            timeIso: result.reminder.time,
            userTimezone,
          });
        } catch (error) {
          console.error("Error creating reminder:", error);
          set.status = 500;
          return { reply: "Failed to create reminder. Please try again." };
        }
      }

      if (result.jobDigest) {
        return { reply: result.jobDigest };
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
  );
}
