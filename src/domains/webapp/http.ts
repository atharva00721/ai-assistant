import { Elysia, t } from "elysia";
import { WEBAPP_HTML } from "./webapp-html.js";
import { initWebApp, updateWebAppUser } from "./service.js";

function serveWebApp() {
  return new Response(WEBAPP_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function registerWebAppRoutes(app: Elysia) {
  app.post(
    "/webapp/init",
    async ({ body, set }) => {
      const initData = body.initData?.trim();
      if (!initData) {
        set.status = 400;
        return { error: "initData required" };
      }
      const result = await initWebApp(initData);
      if (!result) {
        set.status = 401;
        return { error: "Invalid init data" };
      }
      return result;
    },
    { body: t.Object({ initData: t.String() }) },
  );

  app.patch(
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
      const updates: { timezone?: string; updatedAt: Date } = { updatedAt: new Date() };
      if (body.timezone?.trim()) updates.timezone = body.timezone.trim();
      if (Object.keys(updates).length <= 1) {
        set.status = 400;
        return { error: "Nothing to update" };
      }

      const result = await updateWebAppUser({ initData, timezone: updates.timezone });
      if (!result) {
        set.status = 401;
        return { error: "Invalid init data" };
      }
      return result;
    },
    {
      body: t.Object({
        initData: t.String(),
        timezone: t.Optional(t.String()),
      }),
    },
  );

  app.get("/app", serveWebApp);
  app.get("/app/", serveWebApp);

  return app;
}
