export function getTodoistDetectionPrompt(): string {
  return `You detect if the user is talking about their TASK LIST (Todoist): adding tasks, listing, completing, deleting, projects, labels. Output ONLY valid JSON: {"intent": "...", "params": {...}} or NOT_TODOIST.

REMINDER vs TASK: If the user said "remind me to X", "remind me at 5pm", "don't forget to X", "notify me at" — they want a one-off REMINDER (notification), not a task in a list. Reply NOT_TODOIST for those.

You do NOT handle web search or general chat. If the message is about browsing or "look up X", reply NOT_TODOIST.
SEARCH_TASKS = filter/search THEIR task list only (e.g. "show urgent tasks", "tasks for today"), NOT the internet.

INTENTS and params:
- ADD_TASK: one task → "content", optional "due_string", "priority", "project_id"
- ADD_TASKS: multiple items in one message → "tasks": ["a", "b", "c"], optional shared "due_string", "priority", "project_id"
- LIST_TASKS: show tasks → "filter" (e.g. "today", "overdue", "p1") or empty
- COMPLETE_TASK: mark one done → "task_name" or "task_id"
- COMPLETE_ALL_TASKS: mark all (optionally filtered) done → "filter" or {}
- DELETE_TASK: remove one → "task_name" or "task_id"
- DELETE_ALL_TASKS: remove all / clear list → "filter" or {} (phrases: "delete all", "clear everything", "wipe my tasks")
- UPDATE_TASK: change a task → "task_name"/"task_id", "content"/"new_content", "due_string", "priority"
- CREATE_PROJECT, LIST_PROJECTS, DELETE_PROJECT → "name" or "project_id" as needed
- ADD_LABEL, LIST_LABELS, DELETE_LABEL → "name" or "label_id" as needed
- SEARCH_TASKS: filter their tasks only → "filter" or "query"

Multi-task: "add X, Y and Z" / "add X, Y, Z" → ADD_TASKS, tasks: ["X","Y","Z"]. One task → ADD_TASK.
Bulk: "delete all", "clear all", "mark everything done" → DELETE_ALL_TASKS or COMPLETE_ALL_TASKS, params {} or {"filter": "today"}.

Examples:
"add buy milk, eggs, bread tomorrow" → {"intent": "ADD_TASKS", "params": {"tasks": ["buy milk", "eggs", "bread"], "due_string": "tomorrow"}}
"add task buy groceries" → {"intent": "ADD_TASK", "params": {"content": "buy groceries"}}
"delete all my tasks" / "clear everything" → {"intent": "DELETE_ALL_TASKS", "params": {}}
"mark all done" → {"intent": "COMPLETE_ALL_TASKS", "params": {}}
"show my tasks" → {"intent": "LIST_TASKS", "params": {}}
"delete the task about groceries" → {"intent": "DELETE_TASK", "params": {"task_name": "groceries"}}
"search for SpaceX" / "look up weather" → NOT_TODOIST
"show my urgent tasks" → {"intent": "SEARCH_TASKS", "params": {"filter": "p1"}}

If not about their task list or if it's web search, reply: NOT_TODOIST. Do not include extra text.

User message: `;
}
