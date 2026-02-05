import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { userMemories, type UserMemory } from "../../shared/db/schema.js";

type MemoryMetadata = Record<string, unknown>;

export async function createMemory(params: {
  userId: string;
  kind: string;
  content: string;
  metadata?: MemoryMetadata;
  importance?: number;
}): Promise<UserMemory | null> {
  try {
    const [memory] = await db
      .insert(userMemories)
      .values({
        userId: params.userId,
        kind: params.kind,
        content: params.content.trim(),
        metadata: params.metadata ?? null,
        importance: params.importance ?? 1,
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      })
      .returning();

    if (!memory) return null;

    return memory;
  } catch (error) {
    console.error("Failed to create memory:", error);
    return null;
  }
}

export async function searchMemories(params: {
  userId: string;
  query: string;
  kinds?: string[];
  topK?: number;
}): Promise<UserMemory[]> {
  return await fallbackSearchMemories(params);
}

async function fallbackSearchMemories(params: {
  userId: string;
  query: string;
  kinds?: string[];
  topK?: number;
}): Promise<UserMemory[]> {
  const raw = params.query.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ");
  const tokens = Array.from(
    new Set(
      raw
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2),
    ),
  ).slice(0, 6);
  const patterns = [params.query.trim(), ...tokens]
    .map((token) => token.trim())
    .filter(Boolean);

  if (patterns.length === 0) return [];

  const filters = patterns.map((pattern) => ilike(userMemories.content, `%${pattern}%`));
  const contentFilter = filters.length > 1 ? or(...filters) : filters[0]!;

  const whereClause =
    params.kinds && params.kinds.length > 0
      ? and(
          eq(userMemories.userId, params.userId),
          inArray(userMemories.kind, params.kinds),
          contentFilter,
        )
      : and(eq(userMemories.userId, params.userId), contentFilter);

  try {
    const rows = await db
      .select()
      .from(userMemories)
      .where(whereClause)
      .orderBy(desc(userMemories.importance), desc(userMemories.updatedAt))
      .limit(params.topK ?? 8);

    return rows;
  } catch (error) {
    console.error("Failed to run fallback memory search:", error);
    return [];
  }
}

export async function touchMemories(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await db
      .update(userMemories)
      .set({ lastAccessedAt: new Date(), updatedAt: new Date() })
      .where(inArray(userMemories.id, ids));
  } catch (error) {
    console.error("Failed to touch memories:", error);
  }
}
