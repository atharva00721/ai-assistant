import { db } from "../src/db.js";
import { sql } from "drizzle-orm";

async function initDatabase() {
  try {
    console.log("Creating users table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        todoist_token TEXT,
        github_token TEXT,
        github_auth_type TEXT,
        github_repo TEXT,
        github_username TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Creating reminders table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        remind_at TIMESTAMPTZ NOT NULL,
        is_done BOOLEAN NOT NULL DEFAULT false,
        kind TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_reminders_is_done ON reminders(is_done);
    `);

    console.log("Creating pending_actions table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pending_actions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Creating gmail_accounts table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gmail_accounts (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        scope TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Database initialized successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

initDatabase();
