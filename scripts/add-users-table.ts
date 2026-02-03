import { db } from "../src/db.js";
import { sql } from "drizzle-orm";

async function addUsersTable() {
  try {
    console.log("Checking if users table exists...");
    
    // Check if table exists
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    console.log("Creating users table if it doesn't exist...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("✅ Users table created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create users table:", error);
    process.exit(1);
  }
}

addUsersTable();
