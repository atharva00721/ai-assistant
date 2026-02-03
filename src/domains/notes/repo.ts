import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { notes } from "../../shared/db/schema.js";

export async function createNote(userId: string, content: string) {
  const [note] = await db
    .insert(notes)
    .values({ userId, content })
    .returning();
  return note ?? null;
}

export async function searchNotes(userId: string, query: string, limit: number = 10) {
  return db
    .select({ content: notes.content, createdAt: notes.createdAt })
    .from(notes)
    .where(and(eq(notes.userId, userId), like(notes.content, `%${query}%`)))
    .orderBy(desc(notes.createdAt))
    .limit(limit);
}
