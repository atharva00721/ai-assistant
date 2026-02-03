/**
 * Todoist AI Agent
 * Detects Todoist intents and processes commands via natural language
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { TodoistClient } from "./todoist.js";

const apiKey = Bun.env.ANANNAS_API_KEY;
const baseURL = Bun.env.OPENAI_BASE_URL;

if (!apiKey || !baseURL) {
  throw new Error("AI API configuration is required for Todoist agent.");
}

const openai = createOpenAI({ baseURL, apiKey });
const textModel = openai.chat("openai-gpt-oss-20b-1-0");

// Todoist command detection prompt
function getTodoistDetectionPrompt(): string {
  return `You are a Todoist command detector. Analyze if the user wants to interact with Todoist (their TASK LIST, projects, labels).
Extract intent and parameters. Respond with ONLY valid JSON, no markdown or extra text.

IMPORTANT: If the user wants to SEARCH THE WEB or look something up on the INTERNET (e.g. "search for SpaceX", "look up X", "google Y", "search the web for Z"), respond NOT_TODOIST. SEARCH_TASKS is ONLY for searching or filtering their Todoist TASK LIST (e.g. "show my urgent tasks", "find my tasks about work", "tasks for today").

INTENTS:
- ADD_TASK: single task (use "content", "due_string", "priority", "description", "project_id")
- ADD_TASKS: MULTIPLE tasks in one message — extract each item as a separate task. Use "tasks": ["item1", "item2", ...]. Optional shared: "due_string", "priority", "project_id"
- LIST_TASKS: show tasks (params: "filter" e.g. "today", "overdue", "p1"; "project_id"; "label")
- COMPLETE_TASK: mark one task done ("task_name" or "task_id")
- COMPLETE_ALL_TASKS: mark ALL matching tasks done. Use "filter" (e.g. "today", "overdue", or empty for all active)
- DELETE_TASK: delete one task ("task_name" or "task_id")
- DELETE_ALL_TASKS: delete ALL tasks. Use "filter" (e.g. "today", "overdue", project name, or empty for everything). Phrases: "delete all", "clear all", "wipe tasks", "remove everything"
- UPDATE_TASK: change a task ("task_name"/"task_id", "content"/"new_content", "due_string", "priority")
- CREATE_PROJECT, LIST_PROJECTS, DELETE_PROJECT
- ADD_LABEL, LIST_LABELS, DELETE_LABEL
- SEARCH_TASKS: search/filter THEIR TODOIST TASKS only (params: "filter" or "query"). NOT for web search.

MULTI-TASK RULES:
- "add X, Y and Z" / "add X, Y, Z" / "remind me to X, Y, Z" → ADD_TASKS with tasks: ["X", "Y", "Z"]
- "add buy milk, eggs, bread" → ADD_TASKS, tasks: ["buy milk", "eggs", "bread"]
- "create tasks: call mom, send email, workout" → ADD_TASKS, tasks: ["call mom", "send email", "workout"]
- One task only → ADD_TASK with content

BULK RULES:
- "delete all (my) tasks" / "clear everything" / "wipe my todo list" → DELETE_ALL_TASKS, params: {}
- "delete all tasks for today" → DELETE_ALL_TASKS, params: {"filter": "today"}
- "mark all done" / "complete everything" / "finish all tasks" → COMPLETE_ALL_TASKS, params: {}
- "complete all tasks for today" → COMPLETE_ALL_TASKS, params: {"filter": "today"}

Response format: {"intent": "...", "params": {...}}

Examples:
"add buy milk, eggs and bread tomorrow" → {"intent": "ADD_TASKS", "params": {"tasks": ["buy milk", "eggs", "bread"], "due_string": "tomorrow"}}
"add task buy groceries" → {"intent": "ADD_TASK", "params": {"content": "buy groceries"}}
"delete all my tasks" → {"intent": "DELETE_ALL_TASKS", "params": {}}
"clear all tasks" → {"intent": "DELETE_ALL_TASKS", "params": {}}
"mark everything as done" → {"intent": "COMPLETE_ALL_TASKS", "params": {}}
"show my tasks" → {"intent": "LIST_TASKS", "params": {}}
"delete the task about groceries" → {"intent": "DELETE_TASK", "params": {"task_name": "groceries"}}
"search for SpaceX" → NOT_TODOIST
"look up the weather" → NOT_TODOIST
"show my urgent tasks" → {"intent": "SEARCH_TASKS", "params": {"filter": "p1"}}

If this is NOT a Todoist request (including any web/internet search), respond with: NOT_TODOIST

User message: `;
}

interface TodoistIntent {
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

export async function detectTodoistIntent(
  message: string
): Promise<TodoistIntent | null> {
  try {
    const { text } = await generateText({
      model: textModel,
      prompt: getTodoistDetectionPrompt() + message,
    });

    const trimmed = text.trim();

    if (trimmed === "NOT_TODOIST" || !trimmed.startsWith("{")) {
      return null;
    }

    const parsed = JSON.parse(trimmed);

    if (parsed.intent && typeof parsed.params === "object") {
      return parsed as TodoistIntent;
    }

    return null;
  } catch (error) {
    console.error("Error detecting Todoist intent:", error);
    return null;
  }
}

export async function processTodoistCommand(
  intent: TodoistIntent,
  todoistToken: string
): Promise<string> {
  const client = new TodoistClient(todoistToken);

  try {
    switch (intent.intent) {
      case "ADD_TASK": {
        const task = await client.createTask({
          content: intent.params.content || intent.params.task_name || "New Task",
          description: intent.params.description,
          due_string: intent.params.due_string || intent.params.due,
          priority: intent.params.priority || 1,
          labels: intent.params.labels || [],
          project_id: intent.params.project_id,
        });
        return `✅ Task created: "${task.content}"${task.due ? `\n📅 Due: ${task.due.string}` : ""}${task.priority > 1 ? `\n⚠️ Priority: ${task.priority}` : ""}\n🔗 ${task.url}`;
      }

      case "ADD_TASKS": {
        let items: string[] = intent.params.tasks;
        if (!items || !Array.isArray(items)) {
          const raw = intent.params.tasks ?? intent.params.content ?? intent.params.task_name;
          if (typeof raw === "string") {
            // Split "buy milk, eggs, and bread" or "X; Y; Z" into array
            items = raw
              .split(/[,;]|\s+and\s+/i)
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
        if (!items || items.length === 0) {
          const single = intent.params.content || intent.params.task_name;
          if (single) {
            const task = await client.createTask({
              content: single,
              due_string: intent.params.due_string || intent.params.due,
              priority: intent.params.priority || 1,
              project_id: intent.params.project_id,
            });
            return `✅ Task created: "${task.content}"${task.due ? `\n📅 Due: ${task.due.string}` : ""}`;
          }
          return "❌ No tasks to add. Say something like: add buy milk, eggs, and bread";
        }
        const due = intent.params.due_string || intent.params.due;
        const priority = intent.params.priority || 1;
        const projectId = intent.params.project_id;
        const created: string[] = [];
        for (const content of items) {
          const trimmed = typeof content === "string" ? content.trim() : String(content).trim();
          if (!trimmed) continue;
          const task = await client.createTask({
            content: trimmed,
            due_string: due,
            priority,
            project_id: projectId,
          });
          created.push(task.content);
        }
        if (created.length === 0) return "❌ No valid tasks to add.";
        if (created.length === 1) return `✅ Task created: "${created[0]}"${due ? `\n📅 Due: ${due}` : ""}`;
        return `✅ Added ${created.length} tasks:\n${created.map((c, i) => `${i + 1}. ${c}`).join("\n")}${due ? `\n📅 Due: ${due}` : ""}`;
      }

      case "LIST_TASKS": {
        const tasks = await client.getTasks({
          filter: intent.params.filter,
          project_id: intent.params.project_id,
          label: intent.params.label,
        });
        
        if (tasks.length === 0) {
          return "📋 No tasks found.";
        }

        let response = `📋 Your tasks (${tasks.length}):\n\n`;
        tasks.slice(0, 20).forEach((task, idx) => {
          const priority = task.priority > 1 ? `${"!".repeat(task.priority - 1)} ` : "";
          const due = task.due ? ` 📅 ${task.due.string}` : "";
          response += `${idx + 1}. ${priority}${task.content}${due}\n`;
        });
        
        if (tasks.length > 20) {
          response += `\n... and ${tasks.length - 20} more`;
        }
        
        return response;
      }

      case "COMPLETE_TASK": {
        // Find task by name or ID
        const tasks = await client.getTasks();
        const taskName = intent.params.task_name || intent.params.content;
        const task = tasks.find(
          (t) =>
            t.id === intent.params.task_id ||
            t.content.toLowerCase().includes(taskName?.toLowerCase() || "")
        );

        if (!task) {
          return `❌ Task not found: "${taskName}"`;
        }

        await client.closeTask(task.id);
        return `✅ Completed: "${task.content}"`;
      }

      case "DELETE_TASK": {
        const tasks = await client.getTasks();
        const taskName = intent.params.task_name || intent.params.content;
        const task = tasks.find(
          (t) =>
            t.id === intent.params.task_id ||
            t.content.toLowerCase().includes(taskName?.toLowerCase() || "")
        );

        if (!task) {
          return `❌ Task not found: "${taskName}"`;
        }

        await client.deleteTask(task.id);
        return `🗑️ Deleted: "${task.content}"`;
      }

      case "DELETE_ALL_TASKS": {
        const filter = intent.params.filter || "";
        const tasks = await client.getTasks(
          filter ? { filter } : undefined
        );
        const active = tasks.filter((t) => !t.is_completed);
        if (active.length === 0) {
          return filter ? `📋 No tasks found for "${filter}". Nothing to delete.` : "📋 No active tasks. Nothing to delete.";
        }
        for (const task of active) {
          await client.deleteTask(task.id);
        }
        return `🗑️ Deleted ${active.length} task${active.length === 1 ? "" : "s"}.`;
      }

      case "COMPLETE_ALL_TASKS": {
        const filter = intent.params.filter || "";
        const tasks = await client.getTasks(
          filter ? { filter } : undefined
        );
        const active = tasks.filter((t) => !t.is_completed);
        if (active.length === 0) {
          return filter ? `📋 No tasks found for "${filter}". Nothing to complete.` : "📋 No active tasks. Nothing to complete.";
        }
        for (const task of active) {
          await client.closeTask(task.id);
        }
        return `✅ Marked ${active.length} task${active.length === 1 ? "" : "s"} as done.`;
      }

      case "UPDATE_TASK": {
        const tasks = await client.getTasks();
        const taskName = intent.params.task_name || intent.params.old_content;
        const task = tasks.find(
          (t) =>
            t.id === intent.params.task_id ||
            t.content.toLowerCase().includes(taskName?.toLowerCase() || "")
        );

        if (!task) {
          return `❌ Task not found: "${taskName}"`;
        }

        const updated = await client.updateTask(task.id, {
          content: intent.params.content || intent.params.new_content,
          description: intent.params.description,
          due_string: intent.params.due_string || intent.params.due,
          priority: intent.params.priority,
          labels: intent.params.labels,
        });
        return `✅ Updated: "${updated.content}"`;
      }

      case "CREATE_PROJECT": {
        const project = await client.createProject({
          name: intent.params.name,
          color: intent.params.color,
          is_favorite: intent.params.is_favorite,
        });
        return `📁 Project created: "${project.name}"\n🔗 ${project.url}`;
      }

      case "LIST_PROJECTS": {
        const projects = await client.getProjects();
        
        if (projects.length === 0) {
          return "📁 No projects found.";
        }

        let response = `📁 Your projects (${projects.length}):\n\n`;
        projects.forEach((project, idx) => {
          const favorite = project.is_favorite ? "⭐ " : "";
          response += `${idx + 1}. ${favorite}${project.name}\n`;
        });
        
        return response;
      }

      case "DELETE_PROJECT": {
        const projects = await client.getProjects();
        const projectName = intent.params.name || intent.params.project_name;
        const project = projects.find(
          (p) =>
            p.id === intent.params.project_id ||
            p.name.toLowerCase().includes(projectName?.toLowerCase() || "")
        );

        if (!project) {
          return `❌ Project not found: "${projectName}"`;
        }

        await client.deleteProject(project.id);
        return `🗑️ Deleted project: "${project.name}"`;
      }

      case "ADD_LABEL": {
        const label = await client.createLabel({
          name: intent.params.name || intent.params.label_name,
          color: intent.params.color,
          is_favorite: intent.params.is_favorite,
        });
        return `🏷️ Label created: "${label.name}"`;
      }

      case "LIST_LABELS": {
        const labels = await client.getLabels();
        
        if (labels.length === 0) {
          return "🏷️ No labels found.";
        }

        let response = `🏷️ Your labels (${labels.length}):\n\n`;
        labels.forEach((label, idx) => {
          const favorite = label.is_favorite ? "⭐ " : "";
          response += `${idx + 1}. ${favorite}${label.name}\n`;
        });
        
        return response;
      }

      case "DELETE_LABEL": {
        const labels = await client.getLabels();
        const labelName = intent.params.name || intent.params.label_name;
        const label = labels.find(
          (l) =>
            l.id === intent.params.label_id ||
            l.name.toLowerCase().includes(labelName?.toLowerCase() || "")
        );

        if (!label) {
          return `❌ Label not found: "${labelName}"`;
        }

        await client.deleteLabel(label.id);
        return `🗑️ Deleted label: "${label.name}"`;
      }

      case "SEARCH_TASKS": {
        const tasks = await client.getTasks({
          filter: intent.params.filter || intent.params.query,
        });
        
        if (tasks.length === 0) {
          return "🔍 No tasks found matching your search.";
        }

        let response = `🔍 Search results (${tasks.length}):\n\n`;
        tasks.slice(0, 15).forEach((task, idx) => {
          const priority = task.priority > 1 ? `${"!".repeat(task.priority - 1)} ` : "";
          const due = task.due ? ` 📅 ${task.due.string}` : "";
          response += `${idx + 1}. ${priority}${task.content}${due}\n`;
        });
        
        if (tasks.length > 15) {
          response += `\n... and ${tasks.length - 15} more`;
        }
        
        return response;
      }

      case "ADD_COMMENT": {
        const comment = await client.createComment({
          content: intent.params.content || intent.params.comment,
          task_id: intent.params.task_id,
          project_id: intent.params.project_id,
        });
        return `💬 Comment added!`;
      }

      case "LIST_SECTIONS": {
        const sections = await client.getSections(intent.params.project_id);
        
        if (sections.length === 0) {
          return "📑 No sections found.";
        }

        let response = `📑 Sections (${sections.length}):\n\n`;
        sections.forEach((section, idx) => {
          response += `${idx + 1}. ${section.name}\n`;
        });
        
        return response;
      }

      case "CREATE_SECTION": {
        const section = await client.createSection({
          name: intent.params.name || intent.params.section_name,
          project_id: intent.params.project_id,
        });
        return `📑 Section created: "${section.name}"`;
      }

      default:
        return "❌ Unknown Todoist command. Please try again.";
    }
  } catch (error: any) {
    console.error("Todoist command error:", error);
    if (error.message?.includes("401") || error.message?.includes("403")) {
      return "❌ Invalid Todoist API token. Please set your token with:\n/todoist_token YOUR_API_TOKEN";
    }
    return `❌ Todoist error: ${error.message || "Unknown error"}`;
  }
}
