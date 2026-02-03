import { validateTelegramWebAppInitData } from "../../telegram-webapp.js";
import { getOrCreateUser, getUser, updateTimezone } from "../users/service.js";

export async function initWebApp(initData: string) {
  const tgUser = validateTelegramWebAppInitData(initData);
  if (!tgUser) return null;
  const userId = String(tgUser.id);
  const user = await getOrCreateUser(userId);
  return {
    user: {
      userId: user?.userId,
      timezone: user?.timezone ?? "Asia/Kolkata",
      hasTodoist: !!user?.todoistToken,
    },
  };
}

export async function updateWebAppUser(params: {
  initData: string;
  timezone?: string;
}) {
  const tgUser = validateTelegramWebAppInitData(params.initData);
  if (!tgUser) return null;
  const userId = String(tgUser.id);

  if (params.timezone) {
    await updateTimezone(userId, params.timezone.trim());
  }

  const user = await getUser(userId);
  return {
    user: {
      userId: user?.userId,
      timezone: user?.timezone ?? "Asia/Kolkata",
    },
  };
}
