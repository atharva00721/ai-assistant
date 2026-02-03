import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = Bun.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

async function ensureTablesExist(sql: any) {
  console.log("Ensuring required tables exist...");
  
  // Create users table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      todoist_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  
  // Create reminders table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      remind_at TIMESTAMPTZ NOT NULL,
      is_done BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `;
  
  console.log("✅ Tables ensured!");
}

async function startServer() {
  let sql;
  try {
    // Connect to database
    sql = postgres(databaseUrl, { max: 1 });
    
    // Ensure tables exist first (bypass migration system issues)
    await ensureTablesExist(sql);
    
    // Try to run migrations (will be idempotent)
    console.log("Running database migrations...");
    const db = drizzle(sql);
    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("✅ Migrations complete!");
    } catch (migrationError) {
      console.warn("⚠️  Migration warning (tables already exist):", migrationError);
      console.log("Continuing with existing tables...");
    }
    
    await sql.end();

    // Start the server
    console.log("Starting server...");
    await import("../src/server.js");
  } catch (error) {
    console.error("Failed to start:", error);
    if (sql) await sql.end();
    process.exit(1);
  }
}

startServer();
