import { db } from "../src/db.js";
import { sql } from "drizzle-orm";

async function initDatabase() {
  try {
    console.log("Creating reminders table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        remind_at TIMESTAMPTZ NOT NULL,
        is_done BOOLEAN NOT NULL DEFAULT false,
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

    console.log("Database initialized successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

initDatabase();
