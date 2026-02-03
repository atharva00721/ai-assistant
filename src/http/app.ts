import { Elysia } from "elysia";
import { registerAiRoutes } from "../domains/ai/http.js";
import { registerReminderRoutes } from "../domains/reminders/http.js";
import { registerWebAppRoutes } from "../domains/webapp/http.js";
import { registerHealthRoutes } from "../domains/health/http.js";
import { registerGithubRoutes } from "../domains/github/http.js";
import { getWebhookHandler } from "../bot.js";

const app = new Elysia();

registerAiRoutes(app);
registerReminderRoutes(app);
registerWebAppRoutes(app);
registerHealthRoutes(app);
registerGithubRoutes(app);

app.post("/webhook", (ctx) => getWebhookHandler()(ctx));

export default app;
