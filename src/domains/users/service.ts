import { isValidTimezone } from "../../shared/utils/timezone.js";
import { createUser, findUserById, updateUser } from "./repo.js";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

export async function getOrCreateUser(userId: string, timezone?: string) {
  const existingUser = await findUserById(userId);
  if (existingUser) {
    if (timezone && existingUser.timezone !== timezone) {
      await updateUser(userId, { timezone });
      return { ...existingUser, timezone };
    }
    return existingUser;
  }

  const newUser = await createUser(userId, timezone || DEFAULT_TIMEZONE);
  return newUser;
}

export async function getUser(userId: string) {
  return await findUserById(userId);
}

export async function setTodoistToken(userId: string, todoistToken: string | null) {
  await updateUser(userId, { todoistToken });
}

export async function updateTimezone(userId: string, timezone: string) {
  await updateUser(userId, { timezone });
}

export function validateTimezone(timezone: string): boolean {
  return isValidTimezone(timezone);
}

export function getDefaultTimezone(): string {
  return DEFAULT_TIMEZONE;
}
