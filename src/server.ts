import { Elysia, t } from "elysia";
import { askAI } from "./ai.js";
import { getWebhookHandler } from "./bot.js";
import pkg from "../package.json" assert { type: "json" };

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

const port = Bun.env.PORT || 3000;
app.listen(port);
console.log(`API listening on port ${port}`);

export default app;
