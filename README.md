# ai-assistant

A Telegram AI assistant with reminder and scheduled task functionality.

## Features

- 🤖 AI-powered conversations using OpenAI-compatible API
- 🔍 **Web search powered by Perplexity** for real-time information
- 🧠 **Long-term memory system** - remembers conversations and learns about you
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
- 🔍 Semantic search through past conversations
- 📝 Automatic extraction of important facts and preferences

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
```

## Installation

```bash
bun install
```

## Database Setup

Initialize the database schema (creates `users`, `reminders`, `conversations`, and `memories` tables):

```bash
bun run db:init
```

Or run migrations:

```bash
bun run db:migrate
```

If you're upgrading from an older version:

```bash
# Add users table (if missing)
bun run db:add-users-table

# Add long-term memory tables (conversations and memories)
bun run db:add-memory-tables
```

**Note**: The long-term memory feature requires the `pgvector` extension for PostgreSQL. The migration script will attempt to enable it automatically.

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

### Long-Term Memory

The assistant now remembers your conversations and learns about you over time!

**View what the bot remembers**:
```
/memories
```

Shows a summary of stored facts, preferences, and context about you.

**Manually extract memories**:
```
/extract
```

Analyzes recent conversations and extracts important information. Memory extraction also happens automatically every 10 messages.

**Features**:
- 💾 Persistent conversation storage
- 🔍 Semantic search through past conversations
- 🧠 Automatic fact and preference extraction
- 📝 Context-aware responses based on your history
- 🔒 All data stored in your private database

See [LONG_TERM_MEMORY.md](LONG_TERM_MEMORY.md) for detailed documentation.

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

## Quick Commands

- `/list` - Show all upcoming reminders
- `/cancel <id>` - Cancel a specific reminder
- `/timezone [timezone]` - Set or view your timezone
- `/memories` - View what the bot remembers about you
- `/extract` - Manually extract memories from recent conversations
- Normal text - Chat with AI or create reminders

## Project Structure

```
src/
  ai.ts        - AI logic with Perplexity search, reminder detection, memory integration, and conversations
  memory.ts    - Long-term memory system with embeddings and semantic search
  bot.ts       - Telegram bot integration
  db.ts        - Database connection
  schema.ts    - Database schema definitions (users, reminders, conversations, memories)
  server.ts    - Elysia API server with /ask endpoint and memory commands
  scheduler.ts - Bun.cron reminder scheduler
scripts/
  init-db.ts            - Database initialization script
  migrate.ts            - Run Drizzle migrations
  add-users-table.ts    - Add missing users table (for upgrades)
  add-memory-tables.ts  - Add long-term memory tables (conversations and memories)
  test-search.ts        - Test script for web search functionality
  test-memory.ts        - Test script for memory system
```
