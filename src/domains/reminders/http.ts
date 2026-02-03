import { Elysia, t } from "elysia";
import { handleSnooze } from "./service.js";

export function registerReminderRoutes(app: Elysia) {
  return app.post(
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
        const result = await handleSnooze({ reminderId, userId, minutes });
        if (!result.success) {
          set.status = result.status;
          return { success: false, message: result.message };
        }
        return {
          success: true,
          message: result.message,
          newTime: result.newTime,
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
  );
}
