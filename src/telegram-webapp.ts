/**
 * Validate Telegram Web App initData and extract user.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import { createHmac } from "crypto";

const BOT_TOKEN = Bun.env.BOT_TOKEN;

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export function validateTelegramWebAppInitData(initData: string): TelegramWebAppUser | null {
  if (!BOT_TOKEN || !initData?.trim()) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", BOT_TOKEN).update("WebAppData").digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr) as TelegramWebAppUser;
    if (typeof user?.id !== "number") return null;
    return user;
  } catch {
    return null;
  }
}
