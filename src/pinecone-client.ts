type PineconeVector = {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
};

type PineconeQueryMatch = {
  id: string;
  score: number;
};

function resolvePineconeBaseUrl(): string {
  const explicitHost = Bun.env.PINECONE_INDEX_HOST;
  if (explicitHost) {
    return explicitHost.startsWith("http") ? explicitHost : `https://${explicitHost}`;
  }

  const indexName = Bun.env.PINECONE_INDEX_NAME;
  const region = Bun.env.PINECONE_REGION ?? Bun.env.PINECONE_ENVIRONMENT;

  if (!indexName || !region) {
    throw new Error(
      "PINECONE_INDEX_NAME and PINECONE_REGION (or PINECONE_ENVIRONMENT) are required.",
    );
  }

  return `https://${indexName}.svc.${region}.pinecone.io`;
}

function getPineconeApiKey(): string {
  const apiKey = Bun.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is required.");
  }
  return apiKey;
}

async function pineconeFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = resolvePineconeBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Api-Key": getPineconeApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Pinecone error ${response.status}: ${errorBody}`);
  }

  return (await response.json()) as T;
}

export async function upsertMemoryVector(
  id: string,
  userId: string,
  kind: string,
  embedding: number[],
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (embedding.length === 0) return;

  const payload: { vectors: PineconeVector[] } = {
    vectors: [
      {
        id,
        values: embedding,
        metadata: {
          userId,
          kind,
          ...metadata,
        },
      },
    ],
  };

  await pineconeFetch("/vectors/upsert", payload);
}

export async function queryMemories(params: {
  userId: string;
  vector: number[];
  topK: number;
  kinds?: string[];
}): Promise<PineconeQueryMatch[]> {
  if (params.vector.length === 0) return [];

  const filter: Record<string, unknown> = { userId: params.userId };
  if (params.kinds && params.kinds.length > 0) {
    filter.kind = { $in: params.kinds };
  }

  const response = await pineconeFetch<{ matches?: PineconeQueryMatch[] }>(
    "/query",
    {
      vector: params.vector,
      topK: params.topK,
      includeMetadata: false,
      filter,
    },
  );

  return response.matches ?? [];
}

export async function describePineconeIndexStats(): Promise<Record<string, unknown>> {
  // This is a lightweight, read-only call that verifies:
  // - Your Pinecone API key is valid
  // - The index host / region configuration works
  // - The index is reachable from this server
  // NOTE: The correct HTTP path uses an underscore, not a hyphen.
  // See: https://docs.pinecone.io/reference/api/latest/data-plane#tag/Query-Operations/operation/DescribeIndexStats
  return await pineconeFetch<Record<string, unknown>>("/describe_index_stats", {});
}
