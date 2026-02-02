# ai-assistant

A Telegram AI assistant with reminder and scheduled task functionality.

## Features

- AI-powered conversations using OpenAI-compatible API
- Reminder and scheduled task detection
- Automatic reminder notifications via Telegram
- PostgreSQL database for persistent storage
- Cron-based scheduler for reminder delivery

## Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **API Framework**: Elysia
- **Bot Framework**: grammY
- **AI SDK**: Vercel AI SDK
- **Database**: PostgreSQL
- **ORM**: Drizzle

## Environment Variables

Create a `.env` file with the following variables:

```bash
BOT_TOKEN=your_telegram_bot_token
ANANNAS_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.anannas.ai/v1
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
API_BASE_URL=http://localhost:3000
```

## Installation

```bash
bun install
```

## Database Setup

Initialize the database schema:

```bash
bun run scripts/init-db.ts
```

## Running the Application

Start the API server:

```bash
bun run src/server.ts
```

Start the scheduler (in a separate terminal):

```bash
bun run src/scheduler.ts
```

## Usage

### Setting Reminders

Send messages to your Telegram bot like:
- "Remind me to call mom at 3pm tomorrow"
- "Set a reminder for my meeting in 2 hours"
- "Schedule a task to buy groceries at 5pm"

The AI will detect the intent and create a reminder. You'll receive a notification via Telegram at the scheduled time.

### Regular Conversations

Send any other message to have a normal conversation with the AI assistant.

## Project Structure

```
src/
  ai.ts        - AI logic with reminder intent detection
  bot.ts       - Telegram bot integration
  db.ts        - Database connection
  schema.ts    - Database schema definitions
  server.ts    - Elysia API server
  scheduler.ts - Bun.cron reminder scheduler
scripts/
  init-db.ts   - Database initialization script
```
