# Quick Start Guide - Testing in Telegram

Get your reminder bot running in **5 minutes**!

## Prerequisites

1. **Get a Telegram Bot Token**
   - Open Telegram
   - Search for `@BotFather`
   - Send `/newbot`
   - Follow instructions
   - Copy your bot token

2. **Get a PostgreSQL Database**
   
   **Option A - Free Cloud Database (Easiest)**:
   - [Supabase](https://supabase.com) - Free tier, instant setup
   - [ElephantSQL](https://www.elephantsql.com) - Free 20MB
   - [Railway](https://railway.app) - Free trial
   
   **Option B - Local PostgreSQL**:
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   createdb ai_assistant
   
   # Linux
   sudo apt install postgresql
   sudo -u postgres createdb ai_assistant
   ```

## Setup (5 Steps)

### 1. Install Dependencies
```bash
bun install
```

### 2. Create .env File
```bash
cp .env.example .env
```

Edit `.env`:
```bash
BOT_TOKEN=paste_your_bot_token_here
ANANNAS_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.anannas.ai/v1
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
API_BASE_URL=http://localhost:3000
```

### 3. Initialize Database
```bash
bun run db:init
```

### 4. Start All Services

**Option A - Three Separate Terminals (Recommended for Testing)**:

Terminal 1 - API Server:
```bash
bun run start
```

Terminal 2 - Scheduler:
```bash
bun run scheduler
```

Terminal 3 - Bot (Polling):
```bash
bun run bot
```

**Option B - Single Command (using tmux/screen)**:
```bash
# Install tmux if needed
brew install tmux  # macOS
# or
sudo apt install tmux  # Linux

# Run all services
tmux new-session -d -s api 'bun run start'
tmux new-session -d -s scheduler 'bun run scheduler'
tmux new-session -d -s bot 'bun run bot'

# View logs
tmux attach -t api        # Ctrl+B then D to detach
tmux attach -t scheduler
tmux attach -t bot
```

### 5. Test in Telegram

1. Open Telegram
2. Search for your bot by username
3. Start a chat
4. Send: `Hello!`
   - Should get a friendly AI response
5. Send: `Remind me to test this in 2 minutes`
   - Should get confirmation
   - Wait 2 minutes
   - Should receive: "🔔 Reminder: test this"

## Test Commands

Try these in your Telegram bot:

```
Hello!
→ Normal conversation

Remind me to call mom in 5 minutes
→ Creates a reminder

Set a reminder for meeting at 3pm
→ Creates a reminder

Schedule a task to buy groceries tomorrow at noon
→ Creates a reminder

What's the weather like?
→ Normal conversation
```

## Verify It's Working

### ✅ Checklist

- [ ] Bot responds to normal messages
- [ ] Bot confirms reminder creation
- [ ] Reminder appears in database
- [ ] Reminder is delivered after specified time
- [ ] Scheduler logs show activity

### Check Database

```bash
# Connect to your database
psql $DATABASE_URL

# View all reminders
SELECT id, user_id, message, remind_at, is_done FROM reminders ORDER BY created_at DESC;

# Exit
\q
```

### Check Logs

Each terminal should show:

**Terminal 1 (API Server)**:
```
API listening on port 3000
```

**Terminal 2 (Scheduler)**:
```
Reminder scheduler started - checking every minute
Found 0 due reminders
Found 1 due reminders
Sent reminder 1 to user 123456789
```

**Terminal 3 (Bot)**:
```
🤖 Bot started in polling mode...
Received message from 123456789: Hello!
Replied to 123456789
```

## Troubleshooting

### Bot Not Responding

```bash
# 1. Check if API server is running
curl http://localhost:3000/health
# Should return: {"ok":true}

# 2. Test API directly
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"message":"test","userId":"123"}'

# 3. Check BOT_TOKEN
echo $BOT_TOKEN  # Should show your token
```

### Reminders Not Sending

```bash
# 1. Check if scheduler is running
# Look at Terminal 2 logs

# 2. Check database
psql $DATABASE_URL -c "SELECT * FROM reminders WHERE is_done = false;"

# 3. Manually test scheduler
bun run src/scheduler.ts
```

### Database Connection Failed

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# If fails, check DATABASE_URL format:
# postgresql://username:password@host:port/database
```

## Quick Commands Reference

```bash
# Start services
bun run start       # API server
bun run scheduler   # Reminder scheduler
bun run bot         # Telegram bot (polling)

# Database
bun run db:init     # Initialize database

# Testing
bun run test:reminder  # Test reminder detection

# Health check
curl http://localhost:3000/health

# Stop all (if using tmux)
tmux kill-session -t api
tmux kill-session -t scheduler
tmux kill-session -t bot
```

## Example Test Flow

1. **Start all services** (3 terminals)

2. **Open Telegram** and find your bot

3. **Test normal chat**:
   ```
   You: Hello!
   Bot: Hey! How can I help you today?
   ```

4. **Create a reminder**:
   ```
   You: Remind me to check email in 1 minute
   Bot: Got it! I'll remind you to "check email" at 2:45 PM.
   ```

5. **Wait 1 minute**:
   ```
   Bot: 🔔 Reminder: check email
   ```

6. **Check database**:
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM reminders;"
   ```
   You should see your reminder with `is_done = true`

## Next Steps

Once everything works:

1. **Test more complex reminders**:
   - "Remind me tomorrow at 9am to take medicine"
   - "Set a reminder for my meeting in 3 hours"
   - "Schedule a task to call John at 5pm"

2. **Check scheduler behavior**:
   - Create multiple reminders
   - Observe scheduler logs
   - Verify all reminders are delivered

3. **Deploy to production** (see TELEGRAM_TESTING_GUIDE.md)

## Need Help?

Check these files:
- `TELEGRAM_TESTING_GUIDE.md` - Comprehensive testing guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `README.md` - Full documentation
- `REMINDERS.md` - Reminder system documentation

## Success! 🎉

If you received a reminder notification in Telegram, everything is working!

You now have:
✅ AI-powered Telegram bot
✅ Reminder detection
✅ Scheduled notifications
✅ PostgreSQL storage
✅ Automatic reminder delivery

Happy reminding! 🔔
