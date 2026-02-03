import { searchMemories, touchMemories } from "./memory-repo.js";

export function formatMemoryContext(memories: { kind: string; content: string }[]): string {
  if (memories.length === 0) return "No long-term memories yet.";
  return memories.map((memory) => `- [${memory.kind}] ${memory.content}`).join("\n");
}

export async function loadMemoryContext(params: {
  userId: string;
  query: string;
  topK?: number;
}) {
  const memories = await searchMemories({
    userId: params.userId,
    query: params.query,
    topK: params.topK ?? 8,
  });
  const memoryContext = formatMemoryContext(memories);
  return { memories, memoryContext };
}

export async function touchMemoryIds(ids: number[]): Promise<void> {
  await touchMemories(ids);
}
