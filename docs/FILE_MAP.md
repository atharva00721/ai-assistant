# File Map

One-sentence purpose of each source file, grouped by area.

## Entry Points
- `src/server.ts` - Starts the HTTP server and listens on the configured port.
- `src/http/app.ts` - Builds the Elysia app and registers all routes.
- `api/index.ts` - Exposes the server fetch handler for platform integrations.
- `index.ts` - Default Bun entry sample (not used by the server runtime).

## Domains
### AI
- `src/domains/ai/index.ts` - Orchestrates AI flow: intent detection, search, and responses.
- `src/domains/ai/clients.ts` - Creates OpenAI and Perplexity clients and models.
- `src/domains/ai/prompts.ts` - Holds system prompts and prompt builders.
- `src/domains/ai/search.ts` - Performs web search via Perplexity.
- `src/domains/ai/image.ts` - Detects image requests and handles image-based search.
- `src/domains/ai/memory.ts` - Loads and formats long-term memory context.
- `src/domains/ai/memory-repo.ts` - Persists and queries memory records using the DB.
- `src/domains/ai/intents/reminder.ts` - Detects reminder intent via LLM prompt.
- `src/domains/ai/intents/note.ts` - Detects note save/search intents.
- `src/domains/ai/intents/habit.ts` - Detects habit log/check/streak intents.
- `src/domains/ai/intents/focus.ts` - Detects focus timer intent and duration.
- `src/domains/ai/intents/search.ts` - Detects explicit, time-sensitive, and weather search intents.
- `src/domains/ai/intents/job-digest.ts` - Detects morning job list intents (add/remove handles, set time, enable/disable).
- `src/domains/ai/http.ts` - `/ask` HTTP route and command handling.

### Automations
- `src/domains/automations/repo.ts` - DB queries for user automations (morning job digest).
- `src/domains/automations/service.ts` - Morning job list logic and message formatting.

### Reminders
- `src/domains/reminders/repo.ts` - DB queries for reminders.
- `src/domains/reminders/service.ts` - Reminder business logic and message formatting.
- `src/domains/reminders/http.ts` - `/snooze` HTTP route.

### Notes
- `src/domains/notes/repo.ts` - DB queries for notes.
- `src/domains/notes/service.ts` - Note save/search logic and memory sync.

### Habits
- `src/domains/habits/repo.ts` - DB queries for habit logs.
- `src/domains/habits/service.ts` - Habit log/check/streak logic.

### Todoist
- `src/domains/todoist/client.ts` - Todoist REST API client.
- `src/domains/todoist/prompt.ts` - Todoist intent detection prompt.
- `src/domains/todoist/parse.ts` - JSON normalization and intent parsing helpers.
- `src/domains/todoist/agent.ts` - LLM-based Todoist intent detection.
- `src/domains/todoist/service.ts` - Executes Todoist intents against the API.
- `src/domains/todoist/commands.ts` - Handles `/todoist_*` command messages.

### Webapp
- `src/domains/webapp/service.ts` - Validates init data and updates webapp user settings.
- `src/domains/webapp/http.ts` - `/webapp/*` routes and `/app` HTML.
- `src/domains/webapp/webapp-html.ts` - Embedded HTML for the Telegram webapp.

### Users
- `src/domains/users/repo.ts` - DB queries for users.
- `src/domains/users/service.ts` - User profile logic (timezone, tokens, creation).

### Health
- `src/domains/health/http.ts` - Health, root, and version endpoints.

## Shared
- `src/shared/db/index.ts` - Drizzle DB initialization and export.
- `src/shared/db/schema.ts` - Database schema definitions.
- `src/shared/utils/timezone.ts` - Timezone validation and formatting helpers.
- `src/shared/types/` - Reserved for shared types (currently empty).

## Compatibility Re-exports
- `src/ai.ts` - Re-export of AI entry points.
- `src/todoist-agent.ts` - Re-export of Todoist agent/service entry points.
- `src/todoist.ts` - Re-export of Todoist client.
- `src/db.ts` - Re-export of shared DB instance.
- `src/schema.ts` - Re-export of shared DB schema.
- `src/memory-repo.ts` - Re-export of memory repository.
- `src/webapp-html.ts` - Re-export of embedded webapp HTML.

## Bot + Telegram
- `src/bot.ts` - Telegram bot webhook handler.
- `src/bot-polling.ts` - Telegram bot polling mode entry point.
- `src/telegram-dedupe.ts` - Update de-duplication helper for Telegram.
- `src/telegram-webapp.ts` - Telegram webapp init data validation.

## Scheduler
- `src/scheduler.ts` - Periodic reminder delivery loop.

## Embeddings & Search
- `src/embeddings.ts` - Embeddings helper for semantic similarity and search.

## Scripts
- `scripts/add-users-table.ts` - DB migration helper to add users table.
- `scripts/embed-webapp.ts` - Builds embedded HTML for the Telegram webapp.
- `scripts/init-db.ts` - Initializes DB schema.
- `scripts/migrate.ts` - Runs Drizzle migrations.
- `scripts/start.ts` - Starts server and scheduler together.
- `scripts/test-reminder.ts` - Manual reminder test helper.
- `scripts/test-search.ts` - Manual web search test helper.
