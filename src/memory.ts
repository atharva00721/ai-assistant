import { createOpenAI } from "@ai-sdk/openai";
import { embed, generateText } from "ai";
import { db } from "./db";
import { conversations, memories, type NewConversation, type NewMemory } from "./schema";
import { sql, desc, and, eq } from "drizzle-orm";

const apiKey = Bun.env.ANANNAS_API_KEY;
const baseURL = Bun.env.OPENAI_BASE_URL;

if (!apiKey || !baseURL) {
  throw new Error("ANANNAS_API_KEY and OPENAI_BASE_URL are required for memory system.");
}

const openai = createOpenAI({
  baseURL,
  apiKey,
});

const embeddingModel = openai.embedding("text-embedding-3-small");
const textModel = openai.chat("openai-gpt-oss-20b-1-0");

/**
 * Generate embedding for a given text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: text,
    });
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
}

/**
 * Store a conversation message with its embedding
 */
export async function storeConversation(
  userId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    const embedding = await generateEmbedding(content);
    
    const newConversation: NewConversation = {
      userId,
      role,
      content,
      embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
    };

    await db.insert(conversations).values(newConversation);
  } catch (error) {
    console.error("Error storing conversation:", error);
  }
}

/**
 * Retrieve recent conversation history for a user
 */
export async function getRecentConversations(
  userId: string,
  limit: number = 20
): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
  try {
    const results = await db
      .select({
        role: conversations.role,
        content: conversations.content,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    return results.reverse(); // Return in chronological order
  } catch (error) {
    console.error("Error retrieving conversations:", error);
    return [];
  }
}

/**
 * Search for relevant past conversations using semantic similarity
 */
export async function searchSimilarConversations(
  userId: string,
  query: string,
  limit: number = 5
): Promise<Array<{ content: string; role: string; createdAt: Date; similarity: number }>> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    if (queryEmbedding.length === 0) {
      return [];
    }

    // Use cosine similarity to find similar conversations
    const results = await db.execute(sql`
      SELECT 
        content, 
        role, 
        created_at,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM conversations
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `);

    return results.rows.map((row: any) => ({
      content: row.content,
      role: row.role,
      createdAt: new Date(row.created_at),
      similarity: parseFloat(row.similarity),
    }));
  } catch (error) {
    console.error("Error searching similar conversations:", error);
    return [];
  }
}

/**
 * Extract and store important memories/facts from a conversation
 */
export async function extractMemories(
  userId: string,
  conversationContent: string
): Promise<void> {
  try {
    const prompt = `Analyze the following conversation and extract any important facts, preferences, or context about the user that should be remembered for future interactions.

Conversation:
${conversationContent}

For each important fact, respond with a JSON array of objects with this format:
[
  {
    "category": "preference|fact|context|relationship",
    "content": "The actual fact or preference",
    "importance": 1-5 (5 being most important)
  }
]

Only extract genuinely important information that would be useful to remember. If there's nothing important, return an empty array [].

Examples of what to extract:
- User preferences (likes/dislikes)
- Personal facts (job, location, family)
- Important context (ongoing projects, goals)
- Relationships (mentions of specific people)

Examples of what NOT to extract:
- Casual greetings
- Simple yes/no responses without context
- Temporary states (e.g., "I'm hungry right now")

Respond with ONLY the JSON array, no other text.`;

    const { text } = await generateText({
      model: textModel,
      prompt,
    });

    const trimmed = text.trim();
    if (!trimmed.startsWith("[")) {
      return; // No memories to extract
    }

    const extractedMemories = JSON.parse(trimmed);
    
    if (!Array.isArray(extractedMemories) || extractedMemories.length === 0) {
      return;
    }

    // Store each extracted memory
    for (const memory of extractedMemories) {
      if (!memory.category || !memory.content) continue;
      
      const embedding = await generateEmbedding(memory.content);
      
      const newMemory: NewMemory = {
        userId,
        category: memory.category,
        content: memory.content,
        embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
        importance: memory.importance || 3,
      };

      await db.insert(memories).values(newMemory);
    }

    console.log(`✅ Extracted ${extractedMemories.length} memories for user ${userId}`);
  } catch (error) {
    console.error("Error extracting memories:", error);
  }
}

/**
 * Retrieve relevant memories for a given context
 */
export async function getRelevantMemories(
  userId: string,
  context: string,
  limit: number = 5
): Promise<Array<{ content: string; category: string; importance: number; similarity: number }>> {
  try {
    const contextEmbedding = await generateEmbedding(context);
    
    if (contextEmbedding.length === 0) {
      return [];
    }

    const results = await db.execute(sql`
      SELECT 
        content, 
        category, 
        importance,
        1 - (embedding <=> ${JSON.stringify(contextEmbedding)}::vector) as similarity
      FROM memories
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY 
        (1 - (embedding <=> ${JSON.stringify(contextEmbedding)}::vector)) * importance DESC
      LIMIT ${limit}
    `);

    return results.rows.map((row: any) => ({
      content: row.content,
      category: row.category,
      importance: row.importance,
      similarity: parseFloat(row.similarity),
    }));
  } catch (error) {
    console.error("Error retrieving relevant memories:", error);
    return [];
  }
}

/**
 * Get all memories for a user by category
 */
export async function getMemoriesByCategory(
  userId: string,
  category: string
): Promise<Array<{ content: string; importance: number; createdAt: Date }>> {
  try {
    const results = await db
      .select({
        content: memories.content,
        importance: memories.importance,
        createdAt: memories.createdAt,
      })
      .from(memories)
      .where(and(eq(memories.userId, userId), eq(memories.category, category)))
      .orderBy(desc(memories.importance), desc(memories.createdAt));

    return results;
  } catch (error) {
    console.error("Error retrieving memories by category:", error);
    return [];
  }
}

/**
 * Clear old conversation history (keep only last N days)
 */
export async function cleanOldConversations(daysToKeep: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await db.execute(sql`
      DELETE FROM conversations
      WHERE created_at < ${cutoffDate.toISOString()}
    `);

    console.log(`✅ Cleaned conversations older than ${daysToKeep} days`);
  } catch (error) {
    console.error("Error cleaning old conversations:", error);
  }
}
