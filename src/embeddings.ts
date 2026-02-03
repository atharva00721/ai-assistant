import { createOpenAI } from "@ai-sdk/openai";

const embeddingApiKey = Bun.env.OPENAI_API_KEY ?? Bun.env.ANANNAS_API_KEY;
const embeddingBaseUrl =
  Bun.env.OPENAI_EMBEDDING_BASE_URL ?? Bun.env.OPENAI_BASE_URL;
const hasEmbeddingConfig = Boolean(embeddingApiKey && embeddingBaseUrl);

const embeddingsClient = hasEmbeddingConfig
  ? createOpenAI({
      apiKey: embeddingApiKey as string,
      baseURL: embeddingBaseUrl as string,
    })
  : null;

export async function embedText(input: string): Promise<number[]> {
  const normalized = input.trim().slice(0, 2000);
  if (!normalized) return [];
  if (!embeddingsClient) {
    return [];
  }

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
