import { Elysia } from "elysia";
import pkg from "../../../package.json" assert { type: "json" };

export function registerHealthRoutes(app: Elysia) {
  app.get("/", () => ({ ok: true }));
  app.get("/health", () => ({ ok: true }));
  app.get("/version", () => ({
    version:
      (pkg as { version?: string }).version ??
      Bun.env.VERCEL_GIT_COMMIT_SHA ??
      "unknown",
  }));
  return app;
}
