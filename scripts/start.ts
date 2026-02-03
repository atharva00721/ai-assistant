import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = Bun.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

async function startServer() {
  try {
    // Run migrations
    console.log("Running database migrations...");
    const sql = postgres(databaseUrl, { max: 1 });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await sql.end();
    console.log("✅ Migrations complete!");

    // Start the server
    console.log("Starting server...");
    await import("../src/server.js");
  } catch (error) {
    console.error("Failed to start:", error);
    process.exit(1);
  }
}

startServer();
