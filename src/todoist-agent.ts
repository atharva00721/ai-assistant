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
  return `You are a Todoist command detector. Analyze if the user wants to interact with Todoist.

Detect these intents and respond with ONLY valid JSON:

1. ADD_TASK - User wants to add/create a task
2. LIST_TASKS - User wants to see their tasks
3. COMPLETE_TASK - User wants to mark a task as done
4. DELETE_TASK - User wants to delete/remove a task
5. UPDATE_TASK - User wants to modify a task
6. CREATE_PROJECT - User wants to create a project
7. LIST_PROJECTS - User wants to see their projects
8. ADD_LABEL - User wants to create a label
9. LIST_LABELS - User wants to see their labels
10. SEARCH_TASKS - User wants to search/filter tasks

Response format:
{
  "intent": "ADD_TASK" | "LIST_TASKS" | "COMPLETE_TASK" | etc.,
  "params": {
    // Intent-specific parameters extracted from the message
  }
}

Examples:

User: "add a task to buy groceries tomorrow"
Response: {"intent": "ADD_TASK", "params": {"content": "buy groceries", "due_string": "tomorrow"}}

User: "show me my tasks for today"
Response: {"intent": "LIST_TASKS", "params": {"filter": "today"}}

User: "mark 'buy milk' as done"
Response: {"intent": "COMPLETE_TASK", "params": {"task_name": "buy milk"}}

User: "create a project called Work"
Response: {"intent": "CREATE_PROJECT", "params": {"name": "Work"}}

User: "what are my projects?"
Response: {"intent": "LIST_PROJECTS", "params": {}}

User: "delete the task about groceries"
Response: {"intent": "DELETE_TASK", "params": {"task_name": "groceries"}}

User: "show urgent tasks"
Response: {"intent": "SEARCH_TASKS", "params": {"filter": "p1"}}

If this is NOT a Todoist request, respond with: NOT_TODOIST

User message: `;
}

interface TodoistIntent {
  intent:
    | "ADD_TASK"
    | "LIST_TASKS"
    | "COMPLETE_TASK"
    | "DELETE_TASK"
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
