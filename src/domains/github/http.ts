import { Elysia, t } from "elysia";
import { randomBytes } from "crypto";
import { createPendingAction, deletePendingAction, findPendingActionByTypeAndState } from "./pending-actions-repo.js";
import { setGithubToken, setGithubUsername } from "../users/service.js";
import { fetchGithubUsername } from "./auth.js";
import { confirmGithubAction, cancelGithubAction, selectGithubRepo } from "./service.js";

export function registerGithubRoutes(app: Elysia) {
  app.get("/github/oauth/start", async ({ query, set }) => {
    const userId = String(query.userId || "").trim();
    if (!userId) {
      set.status = 400;
      return "userId required";
    }

    const clientId = Bun.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      set.status = 500;
      return "GitHub OAuth not configured";
    }

    const state = randomBytes(16).toString("hex");
    await createPendingAction({
      userId,
      type: "github_oauth",
      payload: { state, userId },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const redirectUri = Bun.env.GITHUB_OAUTH_REDIRECT_URI;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri || "",
      state,
      scope: "repo",
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    set.status = 302;
    set.headers["Location"] = url;
    return "Redirecting";
  });

  app.get("/github/oauth/callback", async ({ query, set }) => {
    const code = String(query.code || "");
    const state = String(query.state || "");

    if (!code || !state) {
      set.status = 400;
      return "Missing code or state";
    }

    const pending = await findPendingActionByTypeAndState("github_oauth", state);
    if (!pending) {
      set.status = 400;
      return "Invalid or expired state";
    }

    const clientId = Bun.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = Bun.env.GITHUB_OAUTH_CLIENT_SECRET;
    const redirectUri = Bun.env.GITHUB_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      set.status = 500;
      return "GitHub OAuth not configured";
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri || undefined,
        state,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      set.status = 500;
      return `OAuth exchange failed: ${text}`;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      set.status = 500;
      return "OAuth token missing";
    }

    try {
      await setGithubToken(pending.userId, accessToken, "oauth");
      const username = await fetchGithubUsername(accessToken);
      if (username) await setGithubUsername(pending.userId, username);
    } catch (err: any) {
      set.status = 500;
      return err?.message || "Failed to save GitHub token";
    }

    await deletePendingAction(pending.id);
    return "GitHub connected. You can close this window.";
  });

  app.post(
    "/github/confirm",
    async ({ body, set }) => {
      if (!body.userId || !body.actionId) {
        set.status = 400;
        return { reply: "userId and actionId required" };
      }
      return await confirmGithubAction({ userId: body.userId, actionId: body.actionId });
    },
    {
      body: t.Object({
        userId: t.String(),
        actionId: t.Number(),
      }),
    },
  );

  app.post(
    "/github/cancel",
    async ({ body, set }) => {
      if (!body.userId || !body.actionId) {
        set.status = 400;
        return { reply: "userId and actionId required" };
      }
      return await cancelGithubAction({ userId: body.userId, actionId: body.actionId });
    },
    {
      body: t.Object({
        userId: t.String(),
        actionId: t.Number(),
      }),
    },
  );

  app.post(
    "/github/repo/select",
    async ({ body, set }) => {
      if (!body.userId || !body.actionId) {
        set.status = 400;
        return { reply: "userId and actionId required" };
      }
      return await selectGithubRepo({ userId: body.userId, actionId: body.actionId });
    },
    {
      body: t.Object({
        userId: t.String(),
        actionId: t.Number(),
      }),
    },
  );

  return app;
}
