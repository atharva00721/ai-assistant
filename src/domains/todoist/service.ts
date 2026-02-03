import { TodoistClient } from "./client.js";
import type { TodoistIntent } from "./parse.js";

function findTaskByIdOrName<T extends { id: string; content: string }>(
  tasks: T[],
  taskId?: string,
  taskName?: string,
): T | undefined {
  if (taskId) return tasks.find((t) => t.id === taskId);
  if (!taskName) return undefined;
  const lowered = taskName.toLowerCase();
  return tasks.find((t) => t.content.toLowerCase().includes(lowered));
}

function findItemByIdOrName<T extends { id: string; name: string }>(
  items: T[],
  itemId?: string,
  itemName?: string,
): T | undefined {
  if (itemId) return items.find((item) => item.id === itemId);
  if (!itemName) return undefined;
  const lowered = itemName.toLowerCase();
  return items.find((item) => item.name.toLowerCase().includes(lowered));
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
        let items: string[] | undefined = Array.isArray(intent.params.tasks)
          ? intent.params.tasks.map((item: unknown) => String(item).trim()).filter(Boolean)
          : undefined;
        if (!items || items.length === 0) {
          const raw = intent.params.tasks ?? intent.params.content ?? intent.params.task_name;
          if (typeof raw === "string") {
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
        const params: Parameters<typeof client.getTasks>[0] = {};
        if (intent.params.filter?.trim()) params.filter = intent.params.filter.trim();
        if (intent.params.project_id) params.project_id = intent.params.project_id;
        if (intent.params.label) params.label = intent.params.label;

        const tasks = await client.getTasks(Object.keys(params).length > 0 ? params : undefined);

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
        const tasks = await client.getTasks();
        const taskName = intent.params.task_name || intent.params.content;
        const taskId = intent.params.task_id;
        const task = findTaskByIdOrName(tasks, taskId, taskName);

        if (!task) {
          return taskName || taskId
            ? `❌ Task not found: "${taskName || taskId}"`
            : "❌ Please specify which task to complete.";
        }

        await client.closeTask(task.id);
        return `✅ Completed: "${task.content}"`;
      }

      case "DELETE_TASK": {
        const tasks = await client.getTasks();
        const taskName = intent.params.task_name || intent.params.content;
        const taskId = intent.params.task_id;
        const task = findTaskByIdOrName(tasks, taskId, taskName);

        if (!task) {
          return taskName || taskId
            ? `❌ Task not found: "${taskName || taskId}"`
            : "❌ Please specify which task to delete.";
        }

        await client.deleteTask(task.id);
        return `🗑️ Deleted: "${task.content}"`;
      }

      case "DELETE_ALL_TASKS": {
        const filter = (intent.params.filter || "").trim();
        const tasks = await client.getTasks(filter ? { filter } : undefined);
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
        const filter = (intent.params.filter || "").trim();
        const tasks = await client.getTasks(filter ? { filter } : undefined);
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
        const taskId = intent.params.task_id;
        const task = findTaskByIdOrName(tasks, taskId, taskName);

        if (!task) {
          return taskName || taskId
            ? `❌ Task not found: "${taskName || taskId}"`
            : "❌ Please specify which task to update.";
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
        const projectId = intent.params.project_id;
        const project = findItemByIdOrName(projects, projectId, projectName);

        if (!project) {
          return projectName || projectId
            ? `❌ Project not found: "${projectName || projectId}"`
            : "❌ Please specify which project to delete.";
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
        const labelId = intent.params.label_id;
        const label = findItemByIdOrName(labels, labelId, labelName);

        if (!label) {
          return labelName || labelId
            ? `❌ Label not found: "${labelName || labelId}"`
            : "❌ Please specify which label to delete.";
        }

        await client.deleteLabel(label.id);
        return `🗑️ Deleted label: "${label.name}"`;
      }

      case "SEARCH_TASKS": {
        const filterQuery = (intent.params.filter || intent.params.query || "").trim();
        const tasks = await client.getTasks(filterQuery ? { filter: filterQuery } : undefined);

        if (tasks.length === 0) {
          return filterQuery ? `🔍 No tasks found matching "${filterQuery}".` : "🔍 No tasks found.";
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
        await client.createComment({
          content: intent.params.content || intent.params.comment,
          task_id: intent.params.task_id,
          project_id: intent.params.project_id,
        });
        return "💬 Comment added!";
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
    if (error.message?.includes("search query is incorrect") || error.message?.includes("400")) {
      return "❌ Invalid search filter. Try simpler filters like 'today', 'overdue', 'p1', or leave it empty to see all tasks.";
    }
    return `❌ Todoist error: ${error.message || "Unknown error"}`;
  }
}
