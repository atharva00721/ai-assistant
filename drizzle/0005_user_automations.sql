CREATE TABLE IF NOT EXISTS "user_automations" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "config" jsonb NOT NULL,
  "last_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
