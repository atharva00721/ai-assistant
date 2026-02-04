import type { GithubClient } from "./client.js";

export class McpGithubClient implements GithubClient {
  constructor() {
    if (Bun.env.GITHUB_MCP_ENABLED !== "true") {
      throw new Error("GitHub MCP is not enabled");
    }
  }

  private notConfigured(): never {
    throw new Error(
      "GitHub MCP client is not configured. Set up the official GitHub MCP server or disable MCP.",
    );
  }

  async createIssue(): Promise<{ url: string; number: number }> {
    return this.notConfigured();
  }
  async commentOnPr(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async assignReviewers(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async requestChanges(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async approveReview(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async commentReview(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async dismissReview(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async getRepo(): Promise<{ defaultBranch: string }> {
    return this.notConfigured();
  }
  async getBranchSha(): Promise<string> {
    return this.notConfigured();
  }
  async getPr(): Promise<{ url: string; title: string; author?: string }> {
    return this.notConfigured();
  }
  async getFile(): Promise<{ content: string; sha: string }> {
    return this.notConfigured();
  }
  async createBranch(): Promise<void> {
    return this.notConfigured();
  }
  async updateFile(): Promise<void> {
    return this.notConfigured();
  }
  async createPullRequest(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async mergePullRequest(): Promise<{ url: string }> {
    return this.notConfigured();
  }
  async updatePullRequestBranch(): Promise<{ message: string }> {
    return this.notConfigured();
  }
  async listRepos(): Promise<Array<{ fullName: string; private: boolean }>> {
    return this.notConfigured();
  }
}
