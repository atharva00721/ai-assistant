# ai-assistant

A Telegram AI assistant with reminder and scheduled task functionality.

## Features

- 🤖 AI-powered conversations using OpenAI-compatible API
- 🔍 **Web search powered by Perplexity** for real-time information
- 🔔 Reminder and scheduled task detection
- 🌍 User-specific timezone support for accurate reminder times
- 📋 List upcoming reminders with `/list`
- ❌ Cancel reminders with `/cancel <id>`
- ⏰ Snooze functionality with interactive buttons
- 🧠 Advanced natural language time parsing
- ✨ Beautiful message formatting
- 📱 Automatic reminder notifications via Telegram
- 💾 PostgreSQL database for persistent storage
- ⚡ Efficient scheduler for reminder delivery
- 🧩 GitHub actions: create issues, comment on PRs, assign reviewers, request changes
- 🛠️ Codex-powered code edits with confirm-before-write

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
PERPLEXITY_API_KEY=your_perplexity_api_key  # Optional: for web search
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
API_BASE_URL=http://localhost:3000
GITHUB_TOKEN_ENCRYPTION_KEY=base64_32byte_key
GITHUB_OAUTH_CLIENT_ID=your_github_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/github/oauth/callback
OPENAI_CODEX_API_KEY=your_openai_api_key
OPENAI_CODEX_MODEL=gpt-5.2-codex
GITHUB_MCP_ENABLED=false
```

## Installation

```bash
bun install
```

## Database Setup

Initialize the database schema (creates both `users` and `reminders` tables):

```bash
bun run db:init
```

Or run migrations:

```bash
bun run db:migrate
```

If you're upgrading from an older version that only had the `reminders` table, run:

```bash
bun run db:add-users-table
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

### GitHub Connection Test

Run a quick read-only check against GitHub:

```bash
GITHUB_TEST_TOKEN=your_token \
GITHUB_TEST_REPO=owner/name \
bun run test:github
```

### Telegram bot mode

Use **one** bot mode at a time:

- **Webhook mode** (recommended for production): configure Telegram to send updates to `/webhook` on your API server.
- **Polling mode** (local/dev): run `bun run src/bot-polling.ts`.

Running multiple polling processes (or multiple bot instances with the same token) can cause duplicate replies because each process receives the same update.

## Usage

### Setting Reminders

Send messages to your Telegram bot like:
- "Remind me to call mom at 3pm tomorrow"
- "Set a reminder for my meeting in 2 hours"
- "Schedule a task to buy groceries at 5pm"
- "In 10 minutes remind me to check the oven"
- "Don't let me forget to take medicine at noon"

The AI will detect the intent and create a reminder. You'll receive a notification via Telegram at the scheduled time with interactive snooze buttons.

### Managing Reminders

**List all reminders**:
```
/list
```

**Cancel a reminder**:
```
/cancel <id>
```

**Set your timezone**:
```
/timezone America/New_York
```

**View current timezone**:
```
/timezone
```

Common timezones:
- `America/New_York` (Eastern Time)
- `America/Chicago` (Central Time)
- `America/Denver` (Mountain Time)
- `America/Los_Angeles` (Pacific Time)
- `Europe/London`
- `Europe/Paris`
- `Asia/Tokyo`
- `Asia/Shanghai`
- `Australia/Sydney`

**Snooze a reminder**: When you receive a reminder, use the inline buttons to snooze for 10 minutes or 1 hour.

### Web Search

Ask informational or search-related questions to get real-time information from the web:
- "What's the latest news about AI?"
- "Who won the Super Bowl?"
- "Compare iPhone vs Android"
- "How does photosynthesis work?"
- "What's the weather like today?"

The assistant will automatically detect search queries and use Perplexity to provide up-to-date, accurate information with natural language summaries.

### Regular Conversations

Send any other message to have a normal conversation with the AI assistant.

### GitHub Commands

- `/github connect` - Start GitHub OAuth flow
- `/github token <PAT>` - Save a GitHub personal access token
- `/github repo owner/name` - Set default repo
- `/github status` - Show GitHub connection status

## Quick Commands

- `/list` - Show all upcoming reminders
- `/cancel <id>` - Cancel a specific reminder
- `/timezone [timezone]` - Set or view your timezone
- `/github connect` - Connect GitHub
- `/github token <PAT>` - Save a GitHub token
- `/github repo owner/name` - Set default repo
- `/github status` - Show GitHub status
- Normal text - Chat with AI or create reminders

## Project Structure

```
src/
  ai.ts        - AI logic with Perplexity search, reminder detection, and conversations
  bot.ts       - Telegram bot integration
  db.ts        - Database connection
  schema.ts    - Database schema definitions
  server.ts    - Elysia API server with /ask endpoint
  scheduler.ts - Bun.cron reminder scheduler
scripts/
  init-db.ts         - Database initialization script (creates users and reminders tables)
  migrate.ts         - Run Drizzle migrations
  add-users-table.ts - Add missing users table (for upgrades)
  test-search.ts     - Test script for web search functionality
```
