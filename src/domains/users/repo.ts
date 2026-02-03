import { eq } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { users } from "../../shared/db/schema.js";

export async function findUserById(userId: string) {
  const rows = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(userId: string, timezone: string) {
  const [newUser] = await db
    .insert(users)
    .values({ userId, timezone })
    .returning();
  return newUser ?? null;
}

export async function updateUser(userId: string, updates: Partial<typeof users.$inferInsert>) {
  await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.userId, userId));
}
