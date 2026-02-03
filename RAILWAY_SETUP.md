# Railway Production Setup Guide

## Required Environment Variables

You need to set these environment variables in your Railway project dashboard:

1. Go to your Railway project: https://railway.app/project/your-project-id
2. Click on your service
3. Go to the "Variables" tab
4. Add the following variables:

### Environment Variables to Add:

```
BOT_TOKEN=8537746992:AAFxPza3Q0hM9OBbYAj_2GjJKVBgSgL2rsA
ANANNAS_API_KEY=sk-cr-6134846cc567450390a1f687998604cf
OPENAI_BASE_URL=https://api.anannas.ai/v1/
DATABASE_URL=postgresql://neondb_owner:npg_hx3ZiHof7Udz@ep-gentle-waterfall-ahsieky4-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## What the new deployment does:

1. **Initializes the database** - Creates the `reminders` table if it doesn't exist
2. **Starts the scheduler** - Runs in the background to check for due reminders
3. **Starts the web server** - Handles API requests from the Telegram bot

## Deployment Steps:

1. Set all environment variables in Railway (see above)
2. Commit and push these changes:
   ```bash
   git add .
   git commit -m "Add startup script and fix Railway deployment"
   git push
   ```
3. Railway will automatically redeploy with the new configuration

## Verify Deployment:

After deployment, check the logs in Railway to ensure:
- "Initializing database..." appears
- "Database initialized successfully!" appears
- "Reminder scheduler started - checking every minute" appears
- The web server starts without errors

## Troubleshooting:

If you still see errors:
1. Double-check all environment variables are set correctly
2. Make sure `start.sh` has execute permissions (Railway handles this automatically)
3. Check Railway logs for any error messages
