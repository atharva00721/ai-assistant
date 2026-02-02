import { Elysia, t } from "elysia";
import { askAI } from "./ai.js";
import { getWebhookHandler } from "./bot.js";
import pkg from "../package.json" assert { type: "json" };
import { db } from "./db.js";
import { reminders } from "./schema.js";

const app = new Elysia()
  .post(
    "/ask",
    async ({ body, set }) => {
      const message = body.message?.trim();
      const userId = body.userId?.trim();
      
      if (!message) {
        set.status = 400;
        return { reply: "Message is required." };
      }

      if (!userId) {
        set.status = 400;
        return { reply: "User ID is required." };
      }

      const result = await askAI(message, userId);
      
      // Check if this is a reminder intent
      if (result.reminder) {
        try {
          // Insert reminder into database
          await db.insert(reminders).values({
            userId,
            message: result.reminder.message,
            remindAt: new Date(result.reminder.time),
            isDone: false,
          });

          const reminderTime = new Date(result.reminder.time);
          return {
            reply: `Got it! I'll remind you to "${result.reminder.message}" at ${reminderTime.toLocaleString()}.`,
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
