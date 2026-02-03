import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = Bun.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

async function addMemoryTables() {
  console.log("🔧 Adding memory tables...");

  try {
    // Enable pgvector extension
    console.log("📦 Enabling pgvector extension...");
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log("✅ pgvector extension enabled");

    // Create conversations table
    console.log("📝 Creating conversations table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `);
    console.log("✅ Conversations table created");

    // Create indexes for conversations
    console.log("📇 Creating indexes for conversations...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS conversations_created_at_idx ON conversations(created_at)
    `);
    console.log("✅ Indexes created for conversations");

    // Create memories table
    console.log("🧠 Creating memories table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS memories (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        source TEXT,
        importance INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `);
    console.log("✅ Memories table created");

    // Create indexes for memories
    console.log("📇 Creating indexes for memories...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS memories_category_idx ON memories(category)
    `);
    console.log("✅ Indexes created for memories");

    console.log("🎉 Memory tables added successfully!");
  } catch (error) {
    console.error("❌ Error adding memory tables:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addMemoryTables();
