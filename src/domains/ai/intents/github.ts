import { generateText } from "ai";
import { textModel } from "../clients.js";

export type GithubIntent = {
  action:
    | "create_issue"
    | "comment_pr"
    | "assign_reviewers"
    | "request_changes"
    | "approve_pr"
    | "review_pr_comment"
    | "dismiss_review"
    | "edit_code"
    | "list_repos"
    | "select_repo"
    | "set_default_repo"
    | "list_branches"
    | "list_commits"
    | "get_commit"
    | "compare_commits"
    | "create_branch"
    | "open_pr"
    | "merge_pr"
    | "update_pr_branch";
  repo?: string;
  issue?: { title: string; body?: string; labels?: string[] };
  pr?: {
    number: number;
    comment?: string;
    reviewers?: string[];
    mergeMethod?: "merge" | "squash" | "rebase";
    reviewId?: number;
    baseBranch?: string;
    headBranch?: string;
    title?: string;
    body?: string;
  };
  codeEdit?: {
    branchName?: string;
    commitMessage: string;
    files?: string[];
    instructions: string;
    directCommit?: boolean;
  };
  commit?: {
    sha?: string;
    ref?: string;
    count?: number;
  };
  compare?: {
    base: string;
    head: string;
  };
};

function normalizeAssistantJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

function getGithubIntentPrompt(): string {
  return `You detect GitHub actions the user wants. Output ONLY JSON or NOT_GITHUB.

Supported actions:
- create_issue: create a GitHub issue
- comment_pr: comment on a pull request
- assign_reviewers: request reviewers on a PR
- request_changes: request changes (review) on a PR
- approve_pr: approve a PR review
- review_pr_comment: submit a general review comment on a PR
- dismiss_review: dismiss a review (requires reviewId)
- edit_code: change code and commit or open a PR
- list_repos: list repositories the user can access
- select_repo: show repo list so user can pick a default
- set_default_repo: set default repo for future actions
- list_branches: list branches in a repo
- list_commits: list commits on a branch/ref
- get_commit: show details for a commit SHA
- compare_commits: compare two refs or commit SHAs
- create_branch: create a branch from a base branch
- open_pr: open PR from branch
- merge_pr: merge a PR
- update_pr_branch: update (rebase) a PR branch with base

If action is create_issue:
{"action":"create_issue","repo":"owner/name?","issue":{"title":"...","body":"...","labels":["..."]}}

If action is comment_pr:
{"action":"comment_pr","repo":"owner/name?","pr":{"number":123,"comment":"..."}}

If action is assign_reviewers:
{"action":"assign_reviewers","repo":"owner/name?","pr":{"number":123,"reviewers":["alice","bob"]}}

If action is request_changes:
{"action":"request_changes","repo":"owner/name?","pr":{"number":123,"comment":"..."}}

If action is approve_pr:
{"action":"approve_pr","repo":"owner/name?","pr":{"number":123,"comment":"optional message"}}

If action is review_pr_comment:
{"action":"review_pr_comment","repo":"owner/name?","pr":{"number":123,"comment":"..."}}

If action is dismiss_review:
{"action":"dismiss_review","repo":"owner/name?","pr":{"number":123,"reviewId":456,"comment":"reason"}}

If action is edit_code:
{"action":"edit_code","repo":"owner/name?","codeEdit":{"commitMessage":"...","branchName":"optional","files":["path"],"instructions":"...","directCommit":false}}

If action is list_repos:
{"action":"list_repos"}

If action is select_repo:
{"action":"select_repo"}

If action is set_default_repo:
{"action":"set_default_repo","repo":"owner/name"}

If action is list_branches:
{"action":"list_branches","repo":"owner/name?"}

If action is list_commits:
{"action":"list_commits","repo":"owner/name?","commit":{"ref":"main","count":10}}

If action is get_commit:
{"action":"get_commit","repo":"owner/name?","commit":{"sha":"abcdef1234"}}

If action is compare_commits:
{"action":"compare_commits","repo":"owner/name?","compare":{"base":"main","head":"feature/branch"}}

If action is create_branch:
{"action":"create_branch","repo":"owner/name?","pr":{"baseBranch":"main","headBranch":"feature/name"}}

If action is open_pr:
{"action":"open_pr","repo":"owner/name?","pr":{"title":"...","body":"...","baseBranch":"main","headBranch":"feature/name"}}

If action is merge_pr:
{"action":"merge_pr","repo":"owner/name?","pr":{"number":123,"mergeMethod":"squash"}}

If action is update_pr_branch:
{"action":"update_pr_branch","repo":"owner/name?","pr":{"number":123}}

Notes:
- Strip @ from reviewer usernames.
- If repo not specified, omit it.
- For compare_commits, include base and head (branch, tag, or commit SHA).
- If action is unclear or not GitHub-related, reply NOT_GITHUB.

User message: `;
}

export async function detectGithubIntent(message: string): Promise<GithubIntent | null> {
  if (!textModel) return null;
  try {
    const { text } = await generateText({ model: textModel, prompt: getGithubIntentPrompt() + message });
    const trimmed = normalizeAssistantJson(text);
    if (trimmed === "NOT_GITHUB" || !trimmed.startsWith("{")) return null;
    const parsed = JSON.parse(trimmed);
    if (!parsed?.action) return null;
    return parsed as GithubIntent;
  } catch (error) {
    console.error("Error detecting GitHub intent:", error);
    return null;
  }
}
