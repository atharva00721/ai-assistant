export interface NoteIntent {
  action: "save" | "search";
  content?: string;
  query?: string;
}

export function detectNoteIntent(message: string): NoteIntent | null {
  const lower = message.toLowerCase().trim();
  const savePrefixes = ["remember that ", "remember: ", "save note ", "note that ", "note: ", "save: ", "remember "];
  for (const p of savePrefixes) {
    if (lower.startsWith(p)) {
      const content = message.slice(p.length).trim();
      if (content.length > 0) return { action: "save", content };
    }
  }
  if (lower.startsWith("remember ") && !lower.includes("?")) {
    const content = message.slice(9).trim();
    if (content.length > 0) return { action: "save", content };
  }
  const searchPatterns = [
    /what did I save about (.+)/i,
    /what did I note about (.+)/i,
    /my notes about (.+)/i,
    /recall (.+)/i,
    /what (?:do I have )?saved about (.+)/i,
    /find (?:my )?note about (.+)/i,
  ];
  for (const re of searchPatterns) {
    const m = message.match(re);
    if (m?.[1]) return { action: "search", query: m[1].trim().replace(/[?.!]+$/, "") };
  }
  if (lower.includes("what did i save") || lower.includes("my notes about")) {
    const q = message.replace(/\?$/, "").trim().split(/\s+about\s+/i)[1]?.trim();
    if (q) return { action: "search", query: q };
  }
  return null;
}
