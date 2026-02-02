import { Elysia, t } from "elysia";
import { askAI } from "./ai.js";
import { getWebhookHandler } from "./bot.js";
import pkg from "../package.json" assert { type: "json" };

const app = new Elysia()
  .post(
    "/ask",
    async ({ body, set }) => {
      const message = body.message?.trim();
      if (!message) {
        set.status = 400;
        return { reply: "Message is required." };
      }

      const reply = await askAI(message);
      return { reply };
    },
    {
      body: t.Object({
        message: t.String(),
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

if (!Bun.env.VERCEL) {
  app.listen(3000);
  console.log("API listening on http://localhost:3000");
}

export default app;
