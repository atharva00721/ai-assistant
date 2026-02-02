import { Elysia, t } from "elysia";
import { askAI } from "./ai";
import { handleWebhook } from "./bot";

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
  .post("/webhook", (ctx) => handleWebhook(ctx));

if (!Bun.env.VERCEL) {
  app.listen(3000);
  console.log("API listening on http://localhost:3000");
}

export default app;
