/**
 * Todoist REST API v2 Integration
 * Complete control over Todoist with all API features
 */

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  section_id?: string;
  parent_id?: string;
  order: number;
  labels: string[];
  priority: number; // 1-4 (1=normal, 4=urgent)
  due?: {
    date: string;
    string: string;
    datetime?: string;
    timezone?: string;
  };
  url: string;
  comment_count: number;
  is_completed: boolean;
  created_at: string;
  creator_id: string;
}

interface TodoistProject {
  id: string;
  name: string;
  comment_count: number;
  order: number;
  color: string;
  is_shared: boolean;
  is_favorite: boolean;
  parent_id?: string;
  is_inbox_project: boolean;
  is_team_inbox: boolean;
  view_style: string;
  url: string;
}

interface TodoistSection {
  id: string;
  project_id: string;
  order: number;
  name: string;
}

interface TodoistLabel {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

interface TodoistComment {
  id: string;
  task_id?: string;
  project_id?: string;
  content: string;
  posted_at: string;
}

export class TodoistClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<T> {
    const url = `${TODOIST_API_BASE}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Todoist API error (${response.status}): ${errorText}`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  }

  async getTasks(params?: {
    project_id?: string;
    section_id?: string;
    label?: string;
    filter?: string;
    lang?: string;
    ids?: string[];
  }): Promise<TodoistTask[]> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.append("project_id", params.project_id);
    if (params?.section_id) searchParams.append("section_id", params.section_id);
    if (params?.label) searchParams.append("label", params.label);
    if (params?.filter) searchParams.append("filter", params.filter);
    if (params?.lang) searchParams.append("lang", params.lang);
    if (params?.ids) searchParams.append("ids", params.ids.join(","));

    const query = searchParams.toString();
    return this.request<TodoistTask[]>(`/tasks${query ? `?${query}` : ""}`);
  }

  async getTask(taskId: string): Promise<TodoistTask> {
    return this.request<TodoistTask>(`/tasks/${taskId}`);
  }

  async createTask(data: {
    content: string;
    description?: string;
    project_id?: string;
    section_id?: string;
    parent_id?: string;
    order?: number;
    labels?: string[];
    priority?: number;
    due_string?: string;
    due_date?: string;
    due_datetime?: string;
    due_lang?: string;
    assignee_id?: string;
  }): Promise<TodoistTask> {
    return this.request<TodoistTask>("/tasks", "POST", data);
  }

  async updateTask(
    taskId: string,
    data: {
      content?: string;
      description?: string;
      labels?: string[];
      priority?: number;
      due_string?: string;
      due_date?: string;
      due_datetime?: string;
      due_lang?: string;
      assignee_id?: string;
    }
  ): Promise<TodoistTask> {
    return this.request<TodoistTask>(`/tasks/${taskId}`, "POST", data);
  }

  async closeTask(taskId: string): Promise<void> {
    await this.request<void>(`/tasks/${taskId}/close`, "POST");
  }

  async reopenTask(taskId: string): Promise<void> {
    await this.request<void>(`/tasks/${taskId}/reopen`, "POST");
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>(`/tasks/${taskId}`, "DELETE");
  }

  async getProjects(): Promise<TodoistProject[]> {
    return this.request<TodoistProject[]>("/projects");
  }

  async getProject(projectId: string): Promise<TodoistProject> {
    return this.request<TodoistProject>(`/projects/${projectId}`);
  }

  async createProject(data: {
    name: string;
    parent_id?: string;
    color?: string;
    is_favorite?: boolean;
    view_style?: "list" | "board";
  }): Promise<TodoistProject> {
    return this.request<TodoistProject>("/projects", "POST", data);
  }

  async updateProject(
    projectId: string,
    data: {
      name?: string;
      color?: string;
      is_favorite?: boolean;
      view_style?: "list" | "board";
    }
  ): Promise<TodoistProject> {
    return this.request<TodoistProject>(`/projects/${projectId}`, "POST", data);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request<void>(`/projects/${projectId}`, "DELETE");
  }

  async getSections(projectId?: string): Promise<TodoistSection[]> {
    const query = projectId ? `?project_id=${projectId}` : "";
    return this.request<TodoistSection[]>(`/sections${query}`);
  }

  async createSection(data: {
    name: string;
    project_id: string;
  }): Promise<TodoistSection> {
    return this.request<TodoistSection>("/sections", "POST", data);
  }

  async updateSection(
    sectionId: string,
    data: {
      name: string;
    }
  ): Promise<TodoistSection> {
    return this.request<TodoistSection>(`/sections/${sectionId}`, "POST", data);
  }

  async deleteSection(sectionId: string): Promise<void> {
    await this.request<void>(`/sections/${sectionId}`, "DELETE");
  }

  async getLabels(): Promise<TodoistLabel[]> {
    return this.request<TodoistLabel[]>("/labels");
  }

  async createLabel(data: {
    name: string;
    color?: string;
    order?: number;
    is_favorite?: boolean;
  }): Promise<TodoistLabel> {
    return this.request<TodoistLabel>("/labels", "POST", data);
  }

  async updateLabel(
    labelId: string,
    data: {
      name?: string;
      color?: string;
      order?: number;
      is_favorite?: boolean;
    }
  ): Promise<TodoistLabel> {
    return this.request<TodoistLabel>(`/labels/${labelId}`, "POST", data);
  }

  async deleteLabel(labelId: string): Promise<void> {
    await this.request<void>(`/labels/${labelId}`, "DELETE");
  }

  async getComments(params?: {
    task_id?: string;
    project_id?: string;
  }): Promise<TodoistComment[]> {
    const searchParams = new URLSearchParams();
    if (params?.task_id) searchParams.append("task_id", params.task_id);
    if (params?.project_id) searchParams.append("project_id", params.project_id);

    const query = searchParams.toString();
    return this.request<TodoistComment[]>(`/comments${query ? `?${query}` : ""}`);
  }

  async createComment(data: {
    content: string;
    task_id?: string;
    project_id?: string;
  }): Promise<TodoistComment> {
    return this.request<TodoistComment>("/comments", "POST", data);
  }

  async updateComment(
    commentId: string,
    data: {
      content: string;
    }
  ): Promise<TodoistComment> {
    return this.request<TodoistComment>(`/comments/${commentId}`, "POST", data);
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.request<void>(`/comments/${commentId}`, "DELETE");
  }
}
