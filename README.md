# ai-assistant

A Telegram AI assistant with reminder and scheduled task functionality.

## Features

- 🤖 AI-powered conversations using OpenAI-compatible API
- 🔍 **Web search powered by Perplexity** for real-time information
- 🔔 Reminder and scheduled task detection
- 📋 List upcoming reminders with `/list`
- ❌ Cancel reminders with `/cancel <id>`
- ⏰ Snooze functionality with interactive buttons
- 🧠 Advanced natural language time parsing
- ✨ Beautiful message formatting
- 📱 Automatic reminder notifications via Telegram
- 💾 PostgreSQL database for persistent storage
- ⚡ Efficient scheduler for reminder delivery

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

## Quick Commands

- `/list` - Show all upcoming reminders
- `/cancel <id>` - Cancel a specific reminder
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
  init-db.ts   - Database initialization script
  test-search.ts - Test script for web search functionality
```
