# Telegram Testing Guide

## Prerequisites

1. **Telegram Bot Token**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` command
   - Follow prompts to create your bot
   - Copy the bot token (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **PostgreSQL Database**
   - Local PostgreSQL installed, OR
   - Cloud PostgreSQL (e.g., Supabase, Railway, ElephantSQL)
   - Get your DATABASE_URL (format: `postgresql://user:password@host:port/database`)

3. **AI API Credentials**
   - ANANNAS_API_KEY
   - OPENAI_BASE_URL

## Step-by-Step Setup

### 1. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` with your values:

```bash
BOT_TOKEN=your_bot_token_from_botfather
ANANNAS_API_KEY=your_anannas_api_key
OPENAI_BASE_URL=https://api.anannas.ai/v1
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
API_BASE_URL=http://localhost:3000
```

### 2. Initialize Database

```bash
# Install dependencies
bun install

# Create reminders table
bun run db:init
```

You should see:
```
Creating reminders table...
Database initialized successfully!
```

### 3. Start the Services

Open **TWO terminal windows**:

**Terminal 1 - API Server:**
```bash
bun run start
```

You should see:
```
API listening on port 3000
```

**Terminal 2 - Reminder Scheduler:**
```bash
bun run scheduler
```

You should see:
```
Reminder scheduler started - checking every minute
Found 0 due reminders
```

### 4. Set Up Telegram Webhook (for Production)

If deploying to a server with a public URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-domain.com/webhook"}'
```

### 5. Testing Locally (Polling Mode)

For local testing, create a simple polling bot script:

Create `src/bot-polling.ts`:

```typescript
import { Bot } from "grammy";

const token = Bun.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required");
}

const apiBaseUrl = Bun.env.API_BASE_URL || "http://localhost:3000";
const bot = new Bot(token);

bot.on("message:text", async (ctx) => {
  const message = ctx.message.text.trim();
  if (!message) return;

  const userId = ctx.from?.id.toString();
  if (!userId) return;

  try {
    const response = await fetch(`${apiBaseUrl}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, userId }),
    });

    const data = await response.json();
    await ctx.reply(data.reply || "No response.");
  } catch (error) {
    console.error("Error:", error);
    await ctx.reply("Sorry, something went wrong.");
  }
});

console.log("Bot started in polling mode...");
bot.start();
```

Then run:
```bash
bun run src/bot-polling.ts
```

## Testing Scenarios

### Test 1: Normal Conversation
1. Open your bot in Telegram (search for your bot's username)
2. Send: `Hello, how are you?`
3. **Expected**: AI responds with friendly text

### Test 2: Create a Reminder (Immediate)
1. Send: `Remind me to test this in 2 minutes`
2. **Expected**: Bot replies with confirmation like:
   ```
   Got it! I'll remind you to "test this" at [time].
   ```
3. Wait 2 minutes
4. **Expected**: Bot sends you:
   ```
   🔔 Reminder: test this
   ```

### Test 3: Create a Reminder (Specific Time)
1. Send: `Remind me to call mom at 3pm tomorrow`
2. **Expected**: Confirmation message
3. At 3pm tomorrow: Receive reminder notification

### Test 4: Multiple Reminders
1. Send: `Set a reminder for meeting in 1 minute`
2. Send: `Remind me to take medicine in 2 minutes`
3. **Expected**: Both confirmations
4. **Expected**: Receive both reminders at the correct times

### Test 5: Non-Reminder Messages
1. Send: `What's the weather like?`
2. Send: `Tell me a joke`
3. **Expected**: Normal AI conversation (no reminders created)

## Verification

### Check Database
Connect to your PostgreSQL database and verify reminders:

```sql
-- See all reminders
SELECT * FROM reminders ORDER BY created_at DESC;

-- See pending reminders
SELECT * FROM reminders WHERE is_done = false ORDER BY remind_at;

-- See completed reminders
SELECT * FROM reminders WHERE is_done = true ORDER BY remind_at DESC;
```

### Check Logs

**Server logs** (Terminal 1):
- Should show incoming `/ask` requests
- Should show reminder creation

**Scheduler logs** (Terminal 2):
- Shows "Found X due reminders" every minute
- Shows "Sent reminder {id} to user {userId}" when sending

## Troubleshooting

### Bot Not Responding

**Issue**: Send messages but no response

**Solutions**:
1. Check BOT_TOKEN is correct
2. Verify API server is running on port 3000
3. Check API_BASE_URL in .env
4. Look for errors in Terminal 1 (server logs)
5. Try polling mode instead of webhook

**Test connection**:
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"message":"test","userId":"123"}'
```

### Reminders Not Sending

**Issue**: Reminders created but not delivered

**Solutions**:
1. Verify scheduler is running (Terminal 2)
2. Check DATABASE_URL is correct
3. Verify reminders exist in database
4. Check BOT_TOKEN in scheduler
5. Look for errors in Terminal 2 (scheduler logs)

**Manual test**:
```bash
# Create a test reminder for 1 minute from now
# Then watch the scheduler logs
```

### AI Not Detecting Reminders

**Issue**: Reminder messages treated as normal conversation

**Solutions**:
1. Verify ANANNAS_API_KEY is set
2. Check OPENAI_BASE_URL is correct
3. Test with clear reminder phrases:
   - "Remind me to..."
   - "Set a reminder for..."
   - "Schedule a task to..."

**Test detection**:
```bash
bun run scripts/test-reminder.ts
```

### Database Connection Failed

**Issue**: Cannot connect to database

**Solutions**:
1. Check DATABASE_URL format
2. Verify database server is running
3. Check firewall/network access
4. Ensure database exists

**Test connection**:
```bash
# Try connecting with psql
psql $DATABASE_URL
```

## Local Development Workflow

1. **Start services**:
   ```bash
   # Terminal 1
   bun run start
   
   # Terminal 2
   bun run scheduler
   
   # Terminal 3 (if using polling)
   bun run src/bot-polling.ts
   ```

2. **Make changes** to code

3. **Restart** the relevant service:
   - Changed `src/ai.ts` or `src/server.ts`? Restart Terminal 1
   - Changed `src/scheduler.ts`? Restart Terminal 2
   - Changed `src/bot-polling.ts`? Restart Terminal 3

4. **Test** in Telegram

5. **Check logs** for errors

6. **Verify database** if needed

## Production Deployment

For production, you need:

1. **Public URL** with HTTPS
2. **Set webhook**:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://your-domain.com/webhook"}'
   ```
3. **Run both processes**:
   - API server (handles webhook)
   - Scheduler (sends reminders)

Platforms like Railway, Fly.io, or Render can run both as separate services.

## Quick Test Commands

```bash
# Test AI endpoint directly
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"message":"Remind me to test in 2 minutes","userId":"test123"}'

# Check health
curl http://localhost:3000/health

# Test reminder detection
bun run scripts/test-reminder.ts

# Initialize database
bun run db:init
```

## Example Test Session

```
You: Hello!
Bot: Hey! How can I help you today?

You: Remind me to check email in 2 minutes
Bot: Got it! I'll remind you to "check email" at 2:35 PM.

[2 minutes later]
Bot: 🔔 Reminder: check email

You: Thanks! Set another reminder to call John at 5pm
Bot: Got it! I'll remind you to "call John" at 5:00 PM.

You: What's 2+2?
Bot: 2+2 equals 4!
```

## Tips

1. **Use clear time expressions**:
   - ✅ "in 5 minutes"
   - ✅ "at 3pm tomorrow"
   - ✅ "in 2 hours"
   - ❌ "soon" (AI may not understand)

2. **Check scheduler logs** to see when reminders are being processed

3. **Test with short intervals** first (1-2 minutes) to verify quickly

4. **Monitor database** to see reminders being created and marked as done

5. **Keep both services running** - server AND scheduler

## Success Indicators

✅ Bot responds to normal messages
✅ Bot confirms reminder creation
✅ Reminders appear in database
✅ Scheduler logs show "Found X due reminders"
✅ Reminders are delivered at correct time
✅ Reminders marked as `is_done = true` after sending

Happy testing! 🎉
