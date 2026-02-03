import { createOpenAI } from "@ai-sdk/openai";

const embeddingApiKey = Bun.env.OPENAI_API_KEY ?? Bun.env.ANANNAS_API_KEY;
const embeddingBaseUrl = Bun.env.OPENAI_EMBEDDING_BASE_URL ?? Bun.env.OPENAI_BASE_URL;

if (!embeddingApiKey) {
  throw new Error("OPENAI_API_KEY or ANANNAS_API_KEY is required for embeddings.");
}

if (!embeddingBaseUrl) {
  throw new Error("OPENAI_EMBEDDING_BASE_URL or OPENAI_BASE_URL is required for embeddings.");
}

const embeddingsClient = createOpenAI({
  apiKey: embeddingApiKey,
  baseURL: embeddingBaseUrl,
});

export async function embedText(input: string): Promise<number[]> {
  const normalized = input.trim().slice(0, 2000);
  if (!normalized) return [];

  try {
    const { embeddings } = await embeddingsClient.embeddings.create({
      model: Bun.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: normalized,
    });

    return embeddings[0]?.embedding ?? [];
  } catch (error) {
    console.error("Embedding error:", error);
    return [];
  }
}
