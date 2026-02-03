import { isValidTimezone } from "../../shared/utils/timezone.js";
import { createUser, findUserById, updateUser } from "./repo.js";
import { decryptSecret, encryptSecret } from "../../shared/utils/crypto.js";

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

export async function setGithubToken(
  userId: string,
  token: string | null,
  authType: "pat" | "oauth",
) {
  if (!token) {
    await updateUser(userId, { githubToken: null, githubAuthType: null });
    return;
  }
  const key = Bun.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is required to store GitHub tokens");
  }
  const encrypted = encryptSecret(token, key);
  await updateUser(userId, { githubToken: encrypted, githubAuthType: authType });
}

export async function setGithubRepo(userId: string, repo: string | null) {
  await updateUser(userId, { githubRepo: repo });
}

export async function setGithubUsername(userId: string, username: string | null) {
  await updateUser(userId, { githubUsername: username });
}

export function decryptGithubToken(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  const key = Bun.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is required to use GitHub tokens");
  }
  return decryptSecret(encrypted, key);
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
