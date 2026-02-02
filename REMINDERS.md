# Reminder System Documentation

## Overview

This Telegram AI assistant now includes reminder and scheduled task functionality. Users can set reminders in natural language, and the bot will send notifications at the scheduled time.

## Features

### 1. AI Intent Detection
- The AI automatically detects when users want to set reminders
- Supports natural language: "Remind me to call mom at 3pm tomorrow"
- Returns structured JSON for reminders, plain text for normal conversation

### 2. Database Storage
- PostgreSQL database stores all reminders
- Schema includes:
  - `id`: Primary key
  - `user_id`: Telegram user ID
  - `message`: Reminder message
  - `remind_at`: Timestamp when to send reminder
  - `is_done`: Boolean flag to track sent reminders
  - `created_at`: Timestamp when reminder was created

### 3. Scheduler
- Bun.cron runs every minute
- Checks for due reminders
- Sends notifications via Telegram
- Marks reminders as done after sending

## Setup

### Environment Variables
Required environment variables:
```bash
BOT_TOKEN=your_telegram_bot_token
ANANNAS_API_KEY=your_anannas_api_key
OPENAI_BASE_URL=your_openai_compatible_base_url
DATABASE_URL=postgresql://user:password@host:port/database
```

### Database Initialization
```bash
# Initialize the database schema
bun run db:init
```

### Running the System
You need to run two processes:

1. **API Server** (handles bot webhooks and API requests):
```bash
bun run src/server.ts
```

2. **Scheduler** (checks and sends reminders every minute):
```bash
bun run src/scheduler.ts
```

Or use the npm scripts:
```bash
bun run start     # Start API server
bun run scheduler # Start reminder scheduler
```

## Usage Examples

Users can interact with the bot using natural language:

- "Remind me to call mom at 3pm tomorrow"
- "Set a reminder for my meeting in 2 hours"
- "Schedule a task to buy groceries at 5pm"
- "Remind me to take medicine at 8am"

The AI will:
1. Detect the reminder intent
2. Extract the message and time
3. Store it in the database
4. Confirm the reminder was created

At the scheduled time, the scheduler will:
1. Query for due reminders
2. Send a Telegram message: "🔔 Reminder: [message]"
3. Mark the reminder as done

## Architecture

```
src/
  ai.ts         - AI logic with reminder detection
  db.ts         - Database connection
  schema.ts     - Drizzle ORM schema
  server.ts     - Elysia API server
  bot.ts        - Telegram bot webhook handler
  scheduler.ts  - Bun.cron reminder scheduler

scripts/
  init-db.ts    - Database initialization script
  migrate.ts    - Database migration script
```

## API Endpoints

### POST /ask
Request body:
```json
{
  "message": "Remind me to call mom at 3pm",
  "userId": "123456789"
}
```

Response (for reminders):
```json
{
  "reply": "Got it! I'll remind you to \"call mom\" at [date/time]."
}
```

Response (for normal conversation):
```json
{
  "reply": "AI generated response text"
}
```

## Technical Details

- **Runtime**: Bun (not Node.js)
- **API Framework**: Elysia
- **Bot Framework**: grammY
- **AI**: Vercel AI SDK with OpenAI-compatible provider
- **Database**: PostgreSQL with Drizzle ORM
- **Scheduler**: Bun.cron (no external dependencies)

## Limitations (MVP)

- No authentication beyond Telegram user ID
- No recurring reminders
- No reminder editing/deletion UI
- No timezone handling (uses server timezone)
- No calendar integration
- No Redis/queue system (direct database polling)

## Troubleshooting

### Reminders not being sent
1. Check that the scheduler process is running
2. Verify DATABASE_URL is correct
3. Check scheduler logs for errors
4. Ensure BOT_TOKEN is valid

### AI not detecting reminders
1. Verify ANANNAS_API_KEY is set
2. Check OPENAI_BASE_URL is correct
3. Review AI logs for detection errors

### Database connection issues
1. Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
2. Ensure database server is accessible
3. Check that the reminders table exists (run `bun run db:init`)
