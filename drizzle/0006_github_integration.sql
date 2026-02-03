ALTER TABLE "users" ADD COLUMN "github_token" text;
ALTER TABLE "users" ADD COLUMN "github_auth_type" text;
ALTER TABLE "users" ADD COLUMN "github_repo" text;
ALTER TABLE "users" ADD COLUMN "github_username" text;

CREATE TABLE "pending_actions" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
