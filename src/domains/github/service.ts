import { splitRepo, type GithubClient } from "./client.js";
import { RestGithubClient } from "./rest-client.js";
import { McpGithubClient } from "./mcp-client.js";
import { applyV4ADiffToText } from "../../shared/utils/apply-patch.js";
import { createPendingAction, deletePendingAction, getPendingActionById } from "./pending-actions-repo.js";
import { decryptGithubToken, getUser } from "../users/service.js";
import type { GithubIntent } from "../ai/intents/github.js";

const MAX_EDIT_FILES = 5;
const PENDING_EXPIRES_MINUTES = 30;

function getGithubClient(token: string): GithubClient {
  if (Bun.env.GITHUB_MCP_ENABLED === "true") {
    try {
      return new McpGithubClient();
    } catch (err) {
      console.warn("MCP not configured, falling back to REST:", err);
    }
  }
  return new RestGithubClient(token);
}

function buildConfirmKeyboard(actionId: number) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Confirm", callback_data: `gh_confirm_${actionId}` },
        { text: "❌ Cancel", callback_data: `gh_cancel_${actionId}` },
      ],
    ],
  };
}

function getTokenOrThrow(user: any): string {
  const token = decryptGithubToken(user?.githubToken);
  if (!token) throw new Error("GitHub not connected");
  return token;
}

function normalizeReviewers(reviewers?: string[]) {
  if (!Array.isArray(reviewers)) return [];
  return reviewers
    .map((r) => r.replace(/^@/, "").trim())
    .filter(Boolean);
}

async function runCodexApplyPatch(params: {
  files: Array<{ path: string; content: string }>;
  instructions: string;
}): Promise<
  Array<{
    path: string;
    diff: string;
  }>
> {
  const baseUrl = Bun.env.OPENAI_CODEX_BASE_URL || "https://api.openai.com/v1";
  const apiKey = Bun.env.OPENAI_CODEX_API_KEY || Bun.env.OPENAI_API_KEY || Bun.env.ANANNAS_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_CODEX_API_KEY (or OPENAI_API_KEY) is required for code edits");
  }

  const model = Bun.env.OPENAI_CODEX_MODEL || "gpt-5.2-codex";
  const filesBlock = params.files
    .map((f) => `File: ${f.path}\n---\n${f.content}`)
    .join("\n\n");

  const input = `You are a coding agent. Produce apply_patch tool calls only.\n\n` +
    `Update existing files only. Do not create or delete files.\n` +
    `Files:\n${filesBlock}\n\n` +
    `Instructions:\n${params.instructions}`;

  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      tools: [{ type: "apply_patch" }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Responses API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const output = Array.isArray(data.output)
    ? data.output
    : Array.isArray(data.response?.output)
      ? data.response.output
      : [];
  const calls = output.filter((item: any) => item?.type === "apply_patch_call");
  if (calls.length === 0) {
    throw new Error("No apply_patch_call operations returned");
  }

  const diffs: Array<{ path: string; diff: string }> = [];
  for (const call of calls) {
    const op = call?.operation;
    if (!op || op.type !== "update_file") {
      throw new Error("Only update_file operations are supported in v1");
    }
    if (!op.path || !op.diff) {
      throw new Error("apply_patch_call missing path or diff");
    }
    diffs.push({ path: op.path, diff: op.diff });
  }

  return diffs;
}

export async function handleGithubIntent(params: {
  user: any;
  intent: GithubIntent;
}): Promise<{ reply: string; replyMarkup?: any }> {
  const { user, intent } = params;
  const repo = intent.repo || user?.githubRepo;
  if (!repo) {
    return { reply: "Please set a default repo with /github repo owner/name" };
  }
  if (user?.githubRepo && intent.repo && intent.repo !== user.githubRepo) {
    return { reply: `This bot is limited to a single repo in v1. Use /github repo ${intent.repo} to switch.` };
  }

  if (!user?.githubToken) {
    return { reply: "GitHub is not connected. Use /github connect or /github token <PAT>." };
  }
  const token = getTokenOrThrow(user);
  const client = getGithubClient(token);
  const { owner, repo: repoName } = splitRepo(repo);
  const expiresAt = new Date(Date.now() + PENDING_EXPIRES_MINUTES * 60 * 1000);

  if (intent.action === "create_issue" && intent.issue) {
    if (!intent.issue.title) {
      return { reply: "Please provide an issue title." };
    }
    const payload = { action: "create_issue", owner, repo: repoName, issue: intent.issue };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `🧾 Issue preview\nTitle: ${intent.issue.title}\nBody: ${intent.issue.body || "(empty)"}\nLabels: ${intent.issue.labels?.join(", ") || "(none)"}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending!.id) };
  }

  if (intent.action === "comment_pr" && intent.pr?.number && intent.pr?.comment) {
    const payload = { action: "comment_pr", owner, repo: repoName, pr: intent.pr };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `💬 PR #${intent.pr.number} comment preview:\n${intent.pr.comment}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending!.id) };
  }

  if (intent.action === "assign_reviewers" && intent.pr?.number) {
    const reviewers = normalizeReviewers(intent.pr.reviewers);
    if (reviewers.length === 0) {
      return { reply: "Please specify at least one reviewer (e.g., @alice)." };
    }
    const payload = { action: "assign_reviewers", owner, repo: repoName, pr: { number: intent.pr.number, reviewers } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `👀 Assign reviewers on PR #${intent.pr.number}: ${reviewers.join(", ")}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending!.id) };
  }

  if (intent.action === "request_changes" && intent.pr?.number) {
    const comment = intent.pr.comment || "Requesting changes.";
    const payload = { action: "request_changes", owner, repo: repoName, pr: { number: intent.pr.number, comment } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `🛑 Request changes on PR #${intent.pr.number}:\n${comment}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending!.id) };
  }

  if (intent.action === "edit_code" && intent.codeEdit) {
    const files = intent.codeEdit.files || [];
    if (!intent.codeEdit.instructions) {
      return { reply: "Please describe the code changes you want me to make." };
    }
    if (files.length === 0) {
      return { reply: "Please specify the file(s) to edit (e.g., \"edit README.md\")." };
    }
    if (files.length > MAX_EDIT_FILES) {
      return { reply: `Too many files. Max ${MAX_EDIT_FILES} files per edit.` };
    }

    const repoInfo = await client.getRepo({ owner, repo: repoName });
    const baseBranch = repoInfo.defaultBranch;

    const fileContents = await Promise.all(
      files.map(async (path) => {
        const file = await client.getFile({ owner, repo: repoName, path, ref: baseBranch });
        const content = Buffer.from(file.content, "base64").toString("utf8");
        return { path, content, sha: file.sha };
      }),
    );

    const diffs = await runCodexApplyPatch({
      files: fileContents.map((f) => ({ path: f.path, content: f.content })),
      instructions: intent.codeEdit.instructions,
    });

    const updatedFiles = fileContents.map((file) => {
      const patches = diffs.filter((d) => d.path === file.path);
      if (patches.length === 0) {
        throw new Error(`No patch returned for ${file.path}`);
      }
      let updated = file.content;
      for (const patch of patches) {
        updated = applyV4ADiffToText(updated, patch.diff);
      }
      const mergedDiff = patches.map((p) => p.diff).join("\n");
      return { ...file, updatedContent: updated, diff: mergedDiff };
    });

    const preview = updatedFiles
      .map((f) => `--- ${f.path}\n${f.diff}`)
      .join("\n\n");

    const branchName = intent.codeEdit.branchName || `codex/${Date.now()}`;
    const commitMessage =
      intent.codeEdit.commitMessage || `Update ${files.length === 1 ? files[0] : `${files.length} files`}`;

    const payload = {
      action: "edit_code",
      owner,
      repo: repoName,
      branchName,
      baseBranch,
      commitMessage,
      directCommit: !!intent.codeEdit.directCommit,
      files: updatedFiles.map((f) => ({
        path: f.path,
        sha: f.sha,
        contentBase64: Buffer.from(f.updatedContent, "utf8").toString("base64"),
      })),
    };

    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };

    const reply = `🧪 Code edit preview (apply_patch diff):\n${preview}\n\nCommit: ${commitMessage}\nBranch: ${branchName}\nMode: ${intent.codeEdit.directCommit ? "direct commit" : "PR"}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending!.id) };
  }

  return { reply: "I couldn't understand the GitHub request. Try: create issue, comment on PR, assign reviewers, request changes, or edit code." };
}

export async function confirmGithubAction(params: {
  userId: string;
  actionId: number;
}): Promise<{ reply: string }> {
  const pending = await getPendingActionById(params.actionId);
  if (!pending || pending.userId !== params.userId) {
    return { reply: "Pending action not found or expired." };
  }
  if (pending.type !== "github") {
    return { reply: "Pending action type mismatch." };
  }

  if (pending.expiresAt && new Date(pending.expiresAt) < new Date()) {
    await deletePendingAction(pending.id);
    return { reply: "Pending action expired. Please try again." };
  }

  const payload = pending.payload as any;
  const userId = pending.userId;

  const user = await getUser(userId);
  if (!user) {
    await deletePendingAction(pending.id);
    return { reply: "User not found." };
  }
  const token = getTokenOrThrow(user);
  const client = getGithubClient(token);

  let reply = "Done.";

  try {
    switch (payload.action) {
      case "create_issue": {
        const out = await client.createIssue({
          owner: payload.owner,
          repo: payload.repo,
          title: payload.issue.title,
          body: payload.issue.body,
          labels: payload.issue.labels,
        });
        reply = `✅ Issue created: ${out.url}`;
        break;
      }
      case "comment_pr": {
        const out = await client.commentOnPr({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          body: payload.pr.comment,
        });
        reply = `✅ Comment posted: ${out.url}`;
        break;
      }
      case "assign_reviewers": {
        const out = await client.assignReviewers({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          reviewers: payload.pr.reviewers,
        });
        reply = `✅ Reviewers requested: ${out.url}`;
        break;
      }
      case "request_changes": {
        const out = await client.requestChanges({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          body: payload.pr.comment,
        });
        reply = `✅ Changes requested: ${out.url}`;
        break;
      }
      case "edit_code": {
        const repoInfo = await client.getRepo({ owner: payload.owner, repo: payload.repo });
        const baseBranch = payload.baseBranch || repoInfo.defaultBranch;

        if (payload.directCommit) {
          for (const file of payload.files) {
            await client.updateFile({
              owner: payload.owner,
              repo: payload.repo,
              path: file.path,
              message: payload.commitMessage,
              contentBase64: file.contentBase64,
              sha: file.sha,
              branch: baseBranch,
            });
          }
          reply = `✅ Committed directly to ${baseBranch}.`;
          break;
        }

        const baseShaValue = await client.getBranchSha({
          owner: payload.owner,
          repo: payload.repo,
          branch: baseBranch,
        });

        await client.createBranch({
          owner: payload.owner,
          repo: payload.repo,
          branch: payload.branchName,
          fromSha: baseShaValue,
        });

        for (const file of payload.files) {
          await client.updateFile({
            owner: payload.owner,
            repo: payload.repo,
            path: file.path,
            message: payload.commitMessage,
            contentBase64: file.contentBase64,
            sha: file.sha,
            branch: payload.branchName,
          });
        }

        const pr = await client.createPullRequest({
          owner: payload.owner,
          repo: payload.repo,
          title: payload.commitMessage,
          body: "Created by AI assistant.",
          head: payload.branchName,
          base: baseBranch,
        });
        reply = `✅ PR opened: ${pr.url}`;
        break;
      }
      default:
        reply = "Unknown action.";
    }
  } finally {
    await deletePendingAction(pending.id);
  }

  return { reply };
}

export async function cancelGithubAction(params: { userId: string; actionId: number }) {
  const pending = await getPendingActionById(params.actionId);
  if (!pending || pending.userId !== params.userId) {
    return { reply: "Pending action not found or already canceled." };
  }
  await deletePendingAction(pending.id);
  return { reply: "Canceled." };
}
