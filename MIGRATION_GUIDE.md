# Migration Guide: Adding Users Table

## Problem

If you're seeing this error:

```
error: API 500 Internal Server Error: Failed query: select "id", "user_id", "timezone", "created_at", "updated_at" from "users" where "users"."user_id" = $1 limit $2
```

This means your database is missing the `users` table. This table is required for storing user-specific settings like timezone preferences.

## Solution

You need to add the `users` table to your database. There are multiple ways to do this:

### Option 1: Using the Migration Script (Recommended for Production)

If you have Railway CLI or direct database access:

```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="your_postgresql_url"

# Run the migration script
bun run db:add-users-table
```

### Option 2: Run SQL Directly

If you have access to your PostgreSQL database (e.g., via Railway dashboard, pgAdmin, or psql), run this SQL:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Option 3: Re-initialize Database (⚠️ Caution: Only for development)

If you're in development and don't mind losing existing data:

```bash
bun run db:init
```

**Warning**: This will create tables but won't drop existing ones. Make sure to backup your data first.

### Option 4: Use Drizzle Migrations

If you prefer using the migration system:

```bash
bun run db:migrate
```

This will run all migrations in the `drizzle` folder.

## Verification

After running one of the above options, verify the table exists by running:

```sql
SELECT * FROM users LIMIT 1;
```

Or query the table schema:

```sql
\d users
```

## What Changed

The `users` table was added to support:
- ✅ User-specific timezone settings (via `/timezone` command)
- ✅ Persistent user preferences
- ✅ Better user management
- ✅ Automatic user creation on first interaction

## Railway Deployment

For Railway deployments:

1. Go to your Railway dashboard
2. Navigate to your database service
3. Click "Data" → "Query"
4. Paste and run the CREATE TABLE SQL above

Or use Railway CLI:

```bash
railway run bun run db:add-users-table
```

## Next Steps

After fixing the database:
1. Restart your API server
2. Test by sending a message to your Telegram bot
3. Use `/timezone America/New_York` to set your timezone
4. Create a reminder to verify everything works

## Need Help?

If you continue to experience issues, check:
- ✅ DATABASE_URL is correctly set
- ✅ Database connection is working
- ✅ Users table exists with correct schema
- ✅ Server has been restarted after the fix
