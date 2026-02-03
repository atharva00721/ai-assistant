import { generateText } from "ai";
import { textModel } from "../clients.js";

export type GithubIntent = {
  action:
    | "create_issue"
    | "comment_pr"
    | "assign_reviewers"
    | "request_changes"
    | "edit_code";
  repo?: string;
  issue?: { title: string; body?: string; labels?: string[] };
  pr?: { number: number; comment?: string; reviewers?: string[] };
  codeEdit?: {
    branchName?: string;
    commitMessage: string;
    files?: string[];
    instructions: string;
    directCommit?: boolean;
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
- edit_code: change code and commit or open a PR

If action is create_issue:
{"action":"create_issue","repo":"owner/name?","issue":{"title":"...","body":"...","labels":["..."]}}

If action is comment_pr:
{"action":"comment_pr","repo":"owner/name?","pr":{"number":123,"comment":"..."}}

If action is assign_reviewers:
{"action":"assign_reviewers","repo":"owner/name?","pr":{"number":123,"reviewers":["alice","bob"]}}

If action is request_changes:
{"action":"request_changes","repo":"owner/name?","pr":{"number":123,"comment":"..."}}

If action is edit_code:
{"action":"edit_code","repo":"owner/name?","codeEdit":{"commitMessage":"...","branchName":"optional","files":["path"],"instructions":"...","directCommit":false}}

Notes:
- Strip @ from reviewer usernames.
- If repo not specified, omit it.
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
