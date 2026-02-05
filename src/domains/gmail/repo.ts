import { eq } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { gmailAccounts, type GmailAccount, type NewGmailAccount } from "../../shared/db/schema.js";

export async function findGmailAccount(userId: string): Promise<GmailAccount | null> {
  const rows = await db
    .select()
    .from(gmailAccounts)
    .where(eq(gmailAccounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createGmailAccount(data: NewGmailAccount): Promise<GmailAccount> {
  const [account] = await db
    .insert(gmailAccounts)
    .values(data)
    .returning();
  return account;
}

export async function updateGmailAccount(userId: string, updates: Partial<NewGmailAccount>): Promise<void> {
  await db
    .update(gmailAccounts)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(gmailAccounts.userId, userId));
}

export async function deleteGmailAccount(userId: string): Promise<void> {
  await db
    .delete(gmailAccounts)
    .where(eq(gmailAccounts.userId, userId));
}