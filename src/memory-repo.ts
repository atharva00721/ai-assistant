import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "./db.js";
import { userMemories, type UserMemory } from "./schema.js";
import { embedText } from "./embeddings.js";
import { queryMemories, upsertMemoryVector } from "./pinecone-client.js";

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

    const embedding = await embedText(memory.content);
    if (embedding.length > 0) {
      await upsertMemoryVector(memory.id.toString(), params.userId, params.kind, embedding, {
        ...params.metadata,
        importance: params.importance ?? 1,
      });
    }

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
  try {
    const embedding = await embedText(params.query);
    if (embedding.length === 0) {
      return await fallbackSearchMemories(params);
    }

    const matches = await queryMemories({
      userId: params.userId,
      vector: embedding,
      topK: params.topK ?? 8,
      kinds: params.kinds,
    });

    if (matches.length === 0) {
      return await fallbackSearchMemories(params);
    }

    const ids = matches.map((match) => Number(match.id)).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return [];

    const rows = await db
      .select()
      .from(userMemories)
      .where(inArray(userMemories.id, ids))
      .orderBy(desc(userMemories.importance));

    const scoreMap = new Map(matches.map((match) => [Number(match.id), match.score]));
    const sorted = [...rows].sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
    return sorted;
  } catch (error) {
    console.error("Failed to search memories:", error);
    return await fallbackSearchMemories(params);
  }
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

  const rows = await db
    .select()
    .from(userMemories)
    .where(whereClause)
    .orderBy(desc(userMemories.importance), desc(userMemories.updatedAt))
    .limit(params.topK ?? 8);

  return rows;
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
