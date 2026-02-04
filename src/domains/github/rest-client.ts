import type { GithubClient } from "./client.js";

export class RestGithubClient implements GithubClient {
  private token: string;
  private baseUrl: string;

  constructor(token: string) {
    this.token = token;
    this.baseUrl = Bun.env.GITHUB_API_BASE_URL || "https://api.github.com";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "accept": "application/vnd.github+json",
        "authorization": `Bearer ${this.token}`,
        "user-agent": "ai-assistant-bot",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async createIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
  }): Promise<{ url: string; number: number }> {
    const data = await this.request<{ html_url: string; number: number }>(
      `/repos/${params.owner}/${params.repo}/issues`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          labels: params.labels,
        }),
      },
    );
    return { url: data.html_url, number: data.number };
  }

  async commentOnPr(params: {
    owner: string;
    repo: string;
    number: number;
    body: string;
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/issues/${params.number}/comments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: params.body }),
      },
    );
    return { url: data.html_url };
  }

  async assignReviewers(params: {
    owner: string;
    repo: string;
    number: number;
    reviewers: string[];
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/requested_reviewers`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewers: params.reviewers }),
      },
    );
    return { url: data.html_url };
  }

  async requestChanges(params: {
    owner: string;
    repo: string;
    number: number;
    body: string;
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/reviews`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: params.body, event: "REQUEST_CHANGES" }),
      },
    );
    return { url: data.html_url };
  }

  async approveReview(params: {
    owner: string;
    repo: string;
    number: number;
    body?: string | undefined;
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/reviews`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: params.body, event: "APPROVE" }),
      },
    );
    return { url: data.html_url };
  }

  async commentReview(params: {
    owner: string;
    repo: string;
    number: number;
    body: string;
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/reviews`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: params.body, event: "COMMENT" }),
      },
    );
    return { url: data.html_url };
  }

  async dismissReview(params: {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    message: string;
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/reviews/${params.reviewId}/dismissals`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: params.message }),
      },
    );
    return { url: data.html_url };
  }

  async getRepo(params: { owner: string; repo: string }): Promise<{ defaultBranch: string }> {
    const data = await this.request<{ default_branch: string }>(
      `/repos/${params.owner}/${params.repo}`,
    );
    return { defaultBranch: data.default_branch };
  }

  async getBranchSha(params: { owner: string; repo: string; branch: string }): Promise<string> {
    const data = await this.request<{ object?: { sha?: string } }>(
      `/repos/${params.owner}/${params.repo}/git/refs/heads/${params.branch}`,
    );
    const sha = data.object?.sha;
    if (!sha) throw new Error("Missing branch SHA");
    return sha;
  }

  async getPr(params: {
    owner: string;
    repo: string;
    number: number;
  }): Promise<{ url: string; title: string; author?: string }> {
    const data = await this.request<{ html_url: string; title: string; user?: { login?: string } }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}`,
    );
    return { url: data.html_url, title: data.title, author: data.user?.login };
  }

  async getFile(params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string | undefined;
  }): Promise<{ content: string; sha: string }> {
    const refSuffix = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : "";
    const data = await this.request<{ content: string; sha: string }>(
      `/repos/${params.owner}/${params.repo}/contents/${params.path}${refSuffix}`,
    );
    return { content: data.content, sha: data.sha };
  }

  async createBranch(params: {
    owner: string;
    repo: string;
    branch: string;
    fromSha: string;
  }): Promise<void> {
    await this.request(`/repos/${params.owner}/${params.repo}/git/refs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${params.branch}`, sha: params.fromSha }),
    });
  }

  async updateFile(params: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    contentBase64: string;
    sha: string;
    branch: string;
  }): Promise<void> {
    await this.request(`/repos/${params.owner}/${params.repo}/contents/${params.path}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        content: params.contentBase64,
        sha: params.sha,
        branch: params.branch,
      }),
    });
  }

  async createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string | undefined;
    head: string;
    base: string;
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          head: params.head,
          base: params.base,
        }),
      },
    );
    return { url: data.html_url };
  }

  async mergePullRequest(params: {
    owner: string;
    repo: string;
    number: number;
    mergeMethod: "merge" | "squash" | "rebase";
  }): Promise<{ url: string }> {
    const data = await this.request<{ html_url: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/merge`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merge_method: params.mergeMethod }),
      },
    );
    return { url: data.html_url };
  }

  async updatePullRequestBranch(params: {
    owner: string;
    repo: string;
    number: number;
  }): Promise<{ message: string }> {
    const data = await this.request<{ message: string }>(
      `/repos/${params.owner}/${params.repo}/pulls/${params.number}/update-branch`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    return { message: data.message };
  }

  async listRepos(params: { perPage?: number }): Promise<Array<{ fullName: string; private: boolean }>> {
    const perPage = params.perPage ?? 50;
    const data = await this.request<Array<{ full_name: string; private: boolean }>>(
      `/user/repos?per_page=${perPage}&sort=updated`,
    );
    return data.map((repo) => ({ fullName: repo.full_name, private: repo.private }));
  }

  async listBranches(params: {
    owner: string;
    repo: string;
    perPage?: number;
  }): Promise<Array<{ name: string }>> {
    const perPage = params.perPage ?? 30;
    const data = await this.request<Array<{ name: string }>>(
      `/repos/${params.owner}/${params.repo}/branches?per_page=${perPage}`,
    );
    return data.map((branch) => ({ name: branch.name }));
  }

  async listCommits(params: {
    owner: string;
    repo: string;
    ref?: string;
    perPage?: number;
  }): Promise<Array<{ sha: string; message: string; author?: string; url: string }>> {
    const perPage = params.perPage ?? 10;
    const refParam = params.ref ? `&sha=${encodeURIComponent(params.ref)}` : "";
    const data = await this.request<
      Array<{ sha: string; html_url: string; commit: { message: string; author?: { name?: string } } }>
    >(`/repos/${params.owner}/${params.repo}/commits?per_page=${perPage}${refParam}`);
    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit?.message || "",
      author: commit.commit?.author?.name,
      url: commit.html_url,
    }));
  }

  async getCommit(params: {
    owner: string;
    repo: string;
    sha: string;
  }): Promise<{ sha: string; message: string; author?: string; url: string }> {
    const data = await this.request<{
      sha: string;
      html_url: string;
      commit: { message: string; author?: { name?: string } };
    }>(`/repos/${params.owner}/${params.repo}/commits/${params.sha}`);
    return {
      sha: data.sha,
      message: data.commit?.message || "",
      author: data.commit?.author?.name,
      url: data.html_url,
    };
  }

  async compareCommits(params: {
    owner: string;
    repo: string;
    base: string;
    head: string;
  }): Promise<{
    aheadBy: number;
    behindBy: number;
    totalCommits: number;
    commits: Array<{ sha: string; message: string; author?: string; url: string }>;
    files: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
  }> {
    const data = await this.request<{
      ahead_by: number;
      behind_by: number;
      total_commits: number;
      commits: Array<{
        sha: string;
        html_url: string;
        commit: { message: string; author?: { name?: string } };
      }>;
      files: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
    }>(`/repos/${params.owner}/${params.repo}/compare/${params.base}...${params.head}`);
    return {
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      totalCommits: data.total_commits,
      commits: (data.commits || []).map((commit) => ({
        sha: commit.sha,
        message: commit.commit?.message || "",
        author: commit.commit?.author?.name,
        url: commit.html_url,
      })),
      files: data.files || [],
    };
  }
}
