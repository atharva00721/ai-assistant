export interface TodoistIntent {
  intent:
    | "ADD_TASK"
    | "ADD_TASKS"
    | "LIST_TASKS"
    | "COMPLETE_TASK"
    | "COMPLETE_ALL_TASKS"
    | "DELETE_TASK"
    | "DELETE_ALL_TASKS"
    | "UPDATE_TASK"
    | "CREATE_PROJECT"
    | "LIST_PROJECTS"
    | "DELETE_PROJECT"
    | "ADD_LABEL"
    | "LIST_LABELS"
    | "DELETE_LABEL"
    | "SEARCH_TASKS"
    | "ADD_COMMENT"
    | "LIST_SECTIONS"
    | "CREATE_SECTION";
  params: Record<string, any>;
}

export function normalizeAssistantJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

export function parseTodoistIntent(text: string): TodoistIntent | null {
  const trimmed = normalizeAssistantJson(text);

  if (trimmed === "NOT_TODOIST" || !trimmed.startsWith("{")) {
    return null;
  }

  const parsed = JSON.parse(trimmed);

  if (parsed.intent && typeof parsed.params === "object") {
    return parsed as TodoistIntent;
  }

  return null;
}
