type PineconeRecord = {
  id: string;
  metadata?: Record<string, unknown>;
} & Record<string, unknown>;

type PineconeQueryMatch = {
  id: string;
  score: number;
};

function isPineconeConfigured(): boolean {
  // Prefer explicit host when provided
  if (Bun.env.PINECONE_INDEX_HOST) {
    return Boolean(
      Bun.env.PINECONE_API_KEY &&
        Bun.env.PINECONE_NAMESPACE &&
        Bun.env.PINECONE_TEXT_FIELD,
    );
  }

  const indexName = Bun.env.PINECONE_INDEX_NAME;
  const region = Bun.env.PINECONE_REGION ?? Bun.env.PINECONE_ENVIRONMENT;

  return Boolean(
    Bun.env.PINECONE_API_KEY &&
      Bun.env.PINECONE_NAMESPACE &&
      Bun.env.PINECONE_TEXT_FIELD &&
      indexName &&
      region,
  );
}

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

function getPineconeNamespace(): string {
  const namespace = Bun.env.PINECONE_NAMESPACE;
  if (!namespace) {
    throw new Error("PINECONE_NAMESPACE is required.");
  }
  return namespace;
}

function getPineconeTextField(): string {
  const textField = Bun.env.PINECONE_TEXT_FIELD;
  if (!textField) {
    throw new Error("PINECONE_TEXT_FIELD is required.");
  }
  return textField;
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

export async function upsertMemoryRecord(
  id: string,
  userId: string,
  kind: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const trimmedContent = content.trim();
  if (!trimmedContent) return;

  // If Pinecone isn't configured, skip the vector upsert
  if (!isPineconeConfigured()) return;

  const textField = getPineconeTextField();
  const payload: { records: PineconeRecord[] } = {
    records: [
      {
        id,
        [textField]: trimmedContent,
        metadata: {
          userId,
          kind,
          ...metadata,
        },
      },
    ],
  };

  const namespace = getPineconeNamespace();
  await pineconeFetch(`/records/namespaces/${namespace}/upsert`, payload);
}

export async function queryMemories(params: {
  userId: string;
  query: string;
  topK: number;
  kinds?: string[];
}): Promise<PineconeQueryMatch[]> {
  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) return [];

  // If Pinecone isn't configured, signal no vector matches so callers can fall back
  if (!isPineconeConfigured()) return [];

  const filter: Record<string, unknown> = { userId: params.userId };
  if (params.kinds && params.kinds.length > 0) {
    filter.kind = { $in: params.kinds };
  }

  const textField = getPineconeTextField();
  const namespace = getPineconeNamespace();
  const response = await pineconeFetch<{ matches?: PineconeQueryMatch[] }>(
    `/records/namespaces/${namespace}/query`,
    {
      topK: params.topK,
      includeMetadata: false,
      filter,
      query: {
        inputs: {
          [textField]: trimmedQuery,
        },
      },
    },
  );

  return response.matches ?? [];
}

export async function describePineconeIndexStats(): Promise<Record<string, unknown>> {
  return await pineconeFetch<Record<string, unknown>>("/describe_index_stats", {});
}
