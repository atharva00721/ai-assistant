import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";

const embeddingApiKey = Bun.env.OPENAI_API_KEY ?? Bun.env.ANANNAS_API_KEY;
const embeddingBaseUrl =
  Bun.env.OPENAI_EMBEDDING_BASE_URL ?? Bun.env.OPENAI_BASE_URL;
const hasEmbeddingConfig = Boolean(embeddingApiKey && embeddingBaseUrl);

const openai = hasEmbeddingConfig
  ? createOpenAI({
      apiKey: embeddingApiKey as string,
      baseURL: embeddingBaseUrl as string,
    })
  : null;
const embeddingModel = openai?.embedding(
  Bun.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
);

export async function embedText(input: string): Promise<number[]> {
  const normalized = input.trim().slice(0, 2000);
  if (!normalized) return [];
  if (!embeddingModel) {
    return [];
  }

  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: normalized,
    });

    return embedding ?? [];
  } catch (error) {
    console.error("Embedding error:", error);
    return [];
  }
}
