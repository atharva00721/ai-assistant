export type GithubReviewEvent = "REQUEST_CHANGES" | "COMMENT";

export interface GithubClient {
  createIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
  }): Promise<{ url: string; number: number }>;

  commentOnPr(params: {
    owner: string;
    repo: string;
    number: number;
    body: string;
  }): Promise<{ url: string }>;

  assignReviewers(params: {
    owner: string;
    repo: string;
    number: number;
    reviewers: string[];
  }): Promise<{ url: string }>;

  requestChanges(params: {
    owner: string;
    repo: string;
    number: number;
    body: string;
  }): Promise<{ url: string }>;

  approveReview(params: {
    owner: string;
    repo: string;
    number: number;
    body?: string;
  }): Promise<{ url: string }>;

  commentReview(params: {
    owner: string;
    repo: string;
    number: number;
    body: string;
  }): Promise<{ url: string }>;

  dismissReview(params: {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    message: string;
  }): Promise<{ url: string }>;

  getRepo(params: { owner: string; repo: string }): Promise<{ defaultBranch: string }>;

  getBranchSha(params: { owner: string; repo: string; branch: string }): Promise<string>;

  getPr(params: {
    owner: string;
    repo: string;
    number: number;
  }): Promise<{ url: string; title: string; author?: string }>

  getFile(params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }): Promise<{ content: string; sha: string }>;

  createBranch(params: {
    owner: string;
    repo: string;
    branch: string;
    fromSha: string;
  }): Promise<void>;

  updateFile(params: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    contentBase64: string;
    sha: string;
    branch: string;
  }): Promise<void>;

  createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    head: string;
    base: string;
  }): Promise<{ url: string }>;

  mergePullRequest(params: {
    owner: string;
    repo: string;
    number: number;
    mergeMethod: "merge" | "squash" | "rebase";
  }): Promise<{ url: string }>;

  updatePullRequestBranch(params: {
    owner: string;
    repo: string;
    number: number;
  }): Promise<{ message: string }>;

  listRepos(params: { perPage?: number }): Promise<Array<{ fullName: string; private: boolean }>>;
}

export function splitRepo(repo: string): { owner: string; repo: string } {
  const trimmed = repo.trim().replace(/^https?:\/\/github.com\//i, "");
  const parts = trimmed.split("/");
  if (parts.length < 2) {
    throw new Error("Repo must be in owner/name format");
  }
  return { owner: parts[0], repo: parts[1] };
}
