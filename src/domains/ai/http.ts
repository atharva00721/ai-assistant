import { Elysia, t } from "elysia";
import { askAI } from "./index.js";
import { detectGithubIntent } from "./intents/github.js";
import { buildTodoistConnectedReply, buildTodoistHelpReply, buildTodoistTokenPrompt, isTodoistDisconnect, isTodoistHelp, parseTodoistTokenCommand } from "../todoist/commands.js";
import { handleListReminders, handleCancelReminderCommand, createReminderFromAI, createFocusReminder } from "../reminders/service.js";
import { handleNoteIntent } from "../notes/service.js";
import { handleHabitIntent } from "../habits/service.js";
import { getOrCreateUser, setTodoistToken, updateTimezone, validateTimezone, getDefaultTimezone, setGithubToken, setGithubRepo, setGithubUsername } from "../users/service.js";
import { formatTimeInTimezone } from "../../shared/utils/timezone.js";
import { handleGithubIntent } from "../github/service.js";
import { fetchGithubUsername } from "../github/auth.js";
import { splitRepo } from "../github/client.js";

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

      if (message.toLowerCase().startsWith("/github")) {
        const apiBaseUrl = Bun.env.API_BASE_URL || "http://localhost:3000";
        const parts = message.trim().split(/\s+/);
        const sub = (parts[1] || "").toLowerCase();

        if (sub === "connect") {
          const url = `${apiBaseUrl}/github/oauth/start?userId=${encodeURIComponent(userId)}`;
          return { reply: `Connect GitHub: ${url}` };
        }

        if (sub === "token") {
          const token = parts[2];
          if (!token) {
            return { reply: "Usage: /github token <PAT>" };
          }
          try {
            await setGithubToken(userId, token, "pat");
            const username = await fetchGithubUsername(token);
            if (username) await setGithubUsername(userId, username);
            return { reply: "✅ GitHub token saved." };
          } catch (err: any) {
            console.error("GitHub token save failed:", err);
            return { reply: err?.message || "Failed to save GitHub token." };
          }
        }

        if (sub === "repo") {
          const rawRepo = parts[2];
          if (!rawRepo) {
            return { reply: "Usage: /github repo owner/name" };
          }

          try {
            let owner: string;
            let repoName: string;

            if (rawRepo.includes("/")) {
              // owner/name or full GitHub URL
              const parsed = splitRepo(rawRepo);
              owner = parsed.owner;
              repoName = parsed.repo;
            } else if (user?.githubUsername) {
              // Infer owner from connected GitHub username
              owner = user.githubUsername;
              repoName = rawRepo.trim();
            } else {
              return {
                reply:
                  "Repo must be in owner/name format (e.g., /github repo owner/name). " +
                  "You can also connect GitHub first so I can infer the owner.",
              };
            }

            const normalized = `${owner.toLowerCase()}/${repoName.toLowerCase()}`;
            await setGithubRepo(userId, normalized);
            return { reply: `✅ Default repo set to ${normalized}` };
          } catch (err) {
            console.error("GitHub repo parse failed:", err);
            return { reply: "Repo must be in owner/name format, e.g., /github repo owner/name" };
          }
        }

        if (sub === "user") {
          if (!user?.githubToken) {
            return { reply: "GitHub not connected. Use /github connect or /github token <PAT>." };
          }
          try {
            const out = await handleGithubIntent({ user, intent: { action: "list_repos" } });
            return { reply: `GitHub user: ${user?.githubUsername || "(unknown)"}\nRepo: ${user?.githubRepo || "(not set)"}\n\n${out.reply}` };
          } catch (err) {
            console.error("GitHub user list error:", err);
            return { reply: "Failed to list repos. Check token permissions." };
          }
        }

        if (sub === "repos") {
          if (!user?.githubToken) {
            return { reply: "GitHub not connected. Use /github connect or /github token <PAT>." };
          }
          try {
            const out = await handleGithubIntent({ user, intent: { action: "list_repos" } });
            return { reply: out.reply };
          } catch (err) {
            console.error("GitHub repos list error:", err);
            return { reply: "Failed to list repos. Check token permissions." };
          }
        }

        if (sub === "status") {
          const status = user?.githubToken ? "connected" : "not connected";
          return {
            reply: `GitHub: ${status}\nRepo: ${user?.githubRepo || "(not set)"}\nUser: ${user?.githubUsername || "(unknown)"}`,
          };
        }

        const fallbackText = parts.slice(1).join(" ").trim();
        if (fallbackText) {
          try {
            const fallbackIntent = await detectGithubIntent(fallbackText);
            if (fallbackIntent) {
              const out = await handleGithubIntent({ user, intent: fallbackIntent });
              return { reply: out.reply, replyMarkup: out.replyMarkup };
            }
          } catch (error) {
            console.error("GitHub fallback intent error:", error);
          }
        }

        return {
          reply:
            "GitHub commands: /github connect | /github token <PAT> | /github repo owner/name | /github status | /github repos | /github user\n\n" +
            "Tip: You can also say /github create an issue titled 'Bug' or /github comment on PR #123.",
        };
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

      if (result.github) {
        try {
          const out = await handleGithubIntent({ user, intent: result.github });
          return { reply: out.reply, replyMarkup: out.replyMarkup };
        } catch (error) {
          console.error("GitHub intent error:", error);
          set.status = 500;
          return { reply: "GitHub request failed. Check credentials or try again." };
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
  );
}
