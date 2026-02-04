import { splitRepo, type GithubClient } from "./client.js";
import { RestGithubClient } from "./rest-client.js";
import { applyPatchToText, applyV4ADiffToText } from "../../shared/utils/apply-patch.js";
import { createPendingAction, deletePendingAction, getPendingActionById } from "./pending-actions-repo.js";
import { decryptGithubToken, getUser, setGithubRepo } from "../users/service.js";
import type { GithubIntent } from "../ai/intents/github.js";

const MAX_EDIT_FILES = 5;
const PENDING_EXPIRES_MINUTES = 30;

function getGithubClient(token: string): GithubClient {
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

function normalizeRepoName(repo?: string): string | null {
  if (!repo) return null;
  const trimmed = repo.trim();
  if (!trimmed) return null;
  if (/^(this|current|default)\s*repo$/i.test(trimmed)) return null;
  if (!trimmed.includes("/")) return null;
  const { owner, repo: repoName } = splitRepo(trimmed);
  if (!owner || !repoName) return null;
  return `${owner.toLowerCase()}/${repoName.toLowerCase()}`;
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
  const baseUrl = Bun.env.OPENAI_CODEX_BASE_URL || "https://ai-gateway.vercel.sh/v1";
  const apiKey = Bun.env.OPENAI_CODEX_API_KEY || Bun.env.OPENAI_API_KEY || Bun.env.ANANNAS_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_CODEX_API_KEY (or OPENAI_API_KEY) is required for code edits");
  }

  const model = Bun.env.OPENAI_CODEX_MODEL || "gpt-5.2-codex";
  const filesBlock = params.files
    .map((f) => `File: ${f.path}\n---\n${f.content}`)
    .join("\n\n");


    const applyPatchToolInput = `You are a coding agent. Produce apply_patch tool calls only.\n\n` +
    `Update existing files only. Do not create or delete files.\n` +
    `Files:\n${filesBlock}\n\n` +
    `Instructions:\n${params.instructions}`;

  async function callApplyPatchTool(): Promise<Array<{ path: string; diff: string }>> {
    const res = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: applyPatchToolInput,
        tools: [{ type: "apply_patch" }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`OpenAI Responses API ${res.status}: ${text}`), {
        status: res.status,
        bodyText: text,
      });
    }

    const data: any = await res.json();
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

  async function callFunctionToolFallback(): Promise<Array<{ path: string; diff: string }>> {
    // Some OpenAI-compatible gateways (like OpenAI Gateway) don't implement native `apply_patch`,
    // but they do support standard function calling. Ask for the same data via a function tool.
    const input =
      `You are a coding agent.\n` +
      `Update existing files only. Do not create or delete files.\n` +
      `Call the apply_patch tool exactly once, with a NON-EMPTY patches array.\n\n` +
      `The diff MUST be a V4A diff compatible with applyV4ADiffToText:\n` +
      `- Must contain at least one hunk starting with @@\n` +
      `- Hunk lines must begin with one of: space, +, -\n` +
      `- Include enough exact context lines (prefixed with space) so the diff applies cleanly\n\n` +
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
        temperature: 0,
        tools: [
          {
            type: "function",
            name: "apply_patch",
            description: "Return patches for existing files",
            parameters: {
              type: "object",
              properties: {
                patches: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      diff: { type: "string" },
                    },
                    required: ["path", "diff"],
                  },
                },
              },
              required: ["patches"],
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI Responses API ${res.status}: ${text}`);
    }

    const data: any = await res.json();
    const output = Array.isArray(data.output)
      ? data.output
      : Array.isArray(data.response?.output)
        ? data.response.output
        : [];

    const fc = output.find((item: any) => item?.type === "function_call" && item?.name === "apply_patch");
    const argsText = fc?.arguments;
    if (typeof argsText !== "string") {
      throw new Error("Codex function fallback returned no apply_patch function_call arguments");
    }
    let args: any;
    try {
      args = JSON.parse(argsText);
    } catch {
      throw new Error(`Codex function fallback returned invalid JSON arguments: ${argsText.slice(0, 500)}`);
    }
    const patches = args?.patches;
    if (!Array.isArray(patches) || patches.length === 0) {
      throw new Error("Codex function fallback returned empty patches");
    }
    for (const p of patches) {
      if (!p || typeof p.path !== "string" || typeof p.diff !== "string") {
        throw new Error("Codex function fallback patches must have { path: string, diff: string }");
      }
      if (!p.diff.trim()) {
        throw new Error(`Codex function fallback returned empty diff for ${p.path}`);
      }
    }
    return patches as Array<{ path: string; diff: string }>;
  }

  try {
    return await callApplyPatchTool();
  } catch (err: any) {
    const msg = String(err?.message || "");
    const bodyText = String(err?.bodyText || "");
    // Observed on some OpenAI-compatible gateways:
    // "tools.0.type: Invalid input: expected \"function\""
    const functionToolError =
      msg.includes('expected "function"')
      || msg.includes("expected \\\"function\\\"")
      || bodyText.includes('expected "function"')
      || bodyText.includes("expected \\\"function\\\"");
    if (err?.status === 400 && functionToolError) {
      return await callFunctionToolFallback();
    }
    throw err;
  }
}

export async function handleGithubIntent(params: {
  user: any;
  intent: GithubIntent;
}): Promise<{ reply: string; replyMarkup?: any }> {
  const { user, intent } = params;
  if (!user?.githubToken) {
    return { reply: "GitHub is not connected. Use /github connect or /github token <PAT>." };
  }
  const token = getTokenOrThrow(user);
  const client = getGithubClient(token);

  if (intent.action === "list_repos") {
    const repos = await client.listRepos({ perPage: 30 });
    if (repos.length === 0) {
      return { reply: "No repos found for your account." };
    }
    const lines = repos.map((r, i) => `${i + 1}. ${r.fullName}${r.private ? " (private)" : ""}`);
    return { reply: `📦 Your repos:\n\n${lines.join("\n")}\n\nSet default with: /github repo owner/name` };
  }

  const normalizedIntentRepo = normalizeRepoName(intent.repo);
  const normalizedUserRepo = normalizeRepoName(user?.githubRepo);

  let repo = normalizedUserRepo;

  // If the user explicitly mentioned a repo in this request, prefer it
  if (normalizedIntentRepo) {
    repo = normalizedIntentRepo;
    // If it's different from the saved default, automatically switch the default repo
    if (!normalizedUserRepo || normalizedUserRepo !== normalizedIntentRepo) {
      try {
        await setGithubRepo(user.userId, normalizedIntentRepo);
      } catch (err) {
        console.error("Failed to update default GitHub repo:", err);
      }
    }
  }

  if (!repo) {
    return { reply: "Please set a default repo with /github repo owner/name" };
  }
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

  if (intent.action === "create_branch") {
    const headBranch = intent.pr?.headBranch?.trim();
    if (!headBranch) {
      return { reply: "Please specify a branch name to create (e.g., feature/my-branch)." };
    }
    const baseBranch =
      intent.pr?.baseBranch?.trim() ||
      (await client.getRepo({ owner, repo: repoName })).defaultBranch;
    const payload = { action: "create_branch", owner, repo: repoName, headBranch, baseBranch };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `🌿 Create branch\nBase: ${baseBranch}\nNew: ${headBranch}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
  }

  if (intent.action === "open_pr") {
    const headBranch = intent.pr?.headBranch?.trim();
    const title = intent.pr?.title?.trim();
    if (!headBranch || !title) {
      return { reply: "Please specify head branch and PR title." };
    }
    const baseBranch =
      intent.pr?.baseBranch?.trim() ||
      (await client.getRepo({ owner, repo: repoName })).defaultBranch;
    const body = intent.pr?.body?.trim() || "";
    const payload = { action: "open_pr", owner, repo: repoName, headBranch, baseBranch, title, body };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `🔀 Open PR\nTitle: ${title}\nBase: ${baseBranch}\nHead: ${headBranch}\nBody: ${body || "(empty)"}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
  }

  if (intent.action === "merge_pr" && intent.pr?.number) {
    const mergeMethod = intent.pr.mergeMethod || "squash";
    const payload = { action: "merge_pr", owner, repo: repoName, pr: { number: intent.pr.number, mergeMethod } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `✅ Merge PR #${intent.pr.number} (${mergeMethod})`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
  }

  if (intent.action === "update_pr_branch" && intent.pr?.number) {
    const payload = { action: "update_pr_branch", owner, repo: repoName, pr: { number: intent.pr.number } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `🔁 Update PR branch for #${intent.pr.number} (rebase with base)`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
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

  if (intent.action === "approve_pr" && intent.pr?.number) {
    const comment = intent.pr.comment || "";
    const payload = { action: "approve_pr", owner, repo: repoName, pr: { number: intent.pr.number, comment } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `✅ Approve PR #${intent.pr.number}${comment ? ` with comment:\n${comment}` : ""}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
  }

  if (intent.action === "review_pr_comment" && intent.pr?.number && intent.pr?.comment) {
    const payload = { action: "review_pr_comment", owner, repo: repoName, pr: { number: intent.pr.number, comment: intent.pr.comment } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `📝 Review comment on PR #${intent.pr.number}:\n${intent.pr.comment}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
  }

  if (intent.action === "dismiss_review" && intent.pr?.number) {
    const reviewId = intent.pr.reviewId;
    const comment = intent.pr.comment || "Dismissed review.";
    if (!reviewId) {
      return { reply: "Please provide the review ID to dismiss (e.g., review 1234)." };
    }
    const payload = { action: "dismiss_review", owner, repo: repoName, pr: { number: intent.pr.number, reviewId, comment } };
    const pending = await createPendingAction({ userId: user.userId, type: "github", payload, expiresAt });
    if (!pending) return { reply: "Failed to create pending action." };
    const reply = `🧹 Dismiss review ${reviewId} on PR #${intent.pr.number}:\n${comment}`;
    return { reply, replyMarkup: buildConfirmKeyboard(pending.id) };
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
        if (patch.diff.includes("*** Begin Patch")) {
          updated = applyPatchToText(updated, patch.diff, file.path).updatedText;
        } else {
          updated = applyV4ADiffToText(updated, patch.diff);
        }
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
      case "approve_pr": {
        const out = await client.approveReview({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          body: payload.pr.comment || undefined,
        });
        reply = `✅ PR approved: ${out.url}`;
        break;
      }
      case "review_pr_comment": {
        const out = await client.commentReview({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          body: payload.pr.comment,
        });
        reply = `✅ Review comment submitted: ${out.url}`;
        break;
      }
      case "dismiss_review": {
        const out = await client.dismissReview({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          reviewId: payload.pr.reviewId,
          message: payload.pr.comment || "Dismissed review.",
        });
        reply = `✅ Review dismissed: ${out.url}`;
        break;
      }
      case "create_branch": {
        const baseSha = await client.getBranchSha({
          owner: payload.owner,
          repo: payload.repo,
          branch: payload.baseBranch,
        });
        await client.createBranch({
          owner: payload.owner,
          repo: payload.repo,
          branch: payload.headBranch,
          fromSha: baseSha,
        });
        reply = `✅ Branch created: ${payload.headBranch}`;
        break;
      }
      case "open_pr": {
        const pr = await client.createPullRequest({
          owner: payload.owner,
          repo: payload.repo,
          title: payload.title,
          body: payload.body,
          head: payload.headBranch,
          base: payload.baseBranch,
        });
        reply = `✅ PR opened: ${pr.url}`;
        break;
      }
      case "merge_pr": {
        const out = await client.mergePullRequest({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
          mergeMethod: payload.pr.mergeMethod || "squash",
        });
        reply = `✅ PR merged: ${out.url}`;
        break;
      }
      case "update_pr_branch": {
        const out = await client.updatePullRequestBranch({
          owner: payload.owner,
          repo: payload.repo,
          number: payload.pr.number,
        });
        reply = `✅ PR branch updated: ${out.message}`;
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
