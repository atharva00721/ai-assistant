import { createMemory } from "../ai/memory-repo.js";
import { createNote, searchNotes } from "./repo.js";

export async function handleNoteIntent(params: {
  userId: string;
  action: "save" | "search";
  content?: string;
  query?: string;
}) {
  if (params.action === "save" && params.content) {
    const note = await createNote(params.userId, params.content);
    if (note) {
      await createMemory({
        userId: params.userId,
        kind: "note",
        content: params.content.trim(),
        metadata: { noteId: note.id, source: "note" },
        importance: 2,
      });
    }
    const preview = params.content.slice(0, 80);
    const suffix = params.content.length > 80 ? "…" : "";
    return { reply: `📝 Saved: "${preview}${suffix}"` };
  }

  if (params.action === "search" && params.query) {
    const found = await searchNotes(params.userId, params.query, 10);
    if (found.length === 0) {
      return { reply: `📝 No notes found about "${params.query}".` };
    }
    const lines = found.map((n, i) => `${i + 1}. ${n.content.slice(0, 120)}${n.content.length > 120 ? "…" : ""}`);
    return { reply: `📝 Notes about "${params.query}":\n\n${lines.join("\n")}` };
  }

  return { reply: "Failed to save or search notes." };
}
