import { db } from "../src/shared/db/index.js";

console.log("Adding Gmail accounts table...");

try {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      scope TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(user_id)
    );
  `);
  
  console.log("✅ Gmail accounts table created successfully!");
} catch (error) {
  console.error("❌ Failed to create Gmail accounts table:", error);
  process.exit(1);
}