# Reminder System Improvements

## Overview
Enhanced the reminder system with practical features that make it more useful and user-friendly.

## New Features

### 1. 📋 List Reminders
**Command**: `/list` or "list my reminders" or "show my reminders"

View all your upcoming reminders with:
- Reminder message
- Scheduled time (formatted nicely)
- Reminder ID (for canceling)
- Total count of pending reminders

**Example**:
```
You: /list

Bot: 📋 Your upcoming reminders (3):

1. "call mom"
   📅 Feb 3, 3:00 PM
   🆔 ID: 15

2. "take medicine"
   📅 Feb 3, 8:00 PM
   🆔 ID: 16

3. "meeting with team"
   📅 Feb 4, 10:00 AM
   🆔 ID: 17

Use /cancel <id> to cancel a reminder
```

### 2. ❌ Cancel Reminders
**Command**: `/cancel <id>`

Delete unwanted reminders using their ID (found via `/list`).

**Example**:
```
You: /cancel 15

Bot: ✅ Cancelled reminder: "call mom"
```

### 3. 🧠 Improved Natural Language Understanding
Enhanced the AI's ability to understand diverse time expressions:

**Relative times**:
- "in 5 minutes"
- "in 2 hours"
- "in 30 seconds"

**Specific times**:
- "at 3pm"
- "at 15:00"
- "noon" / "midnight"
- "tonight at 8"

**Future dates**:
- "tomorrow at 9am"
- "at 5pm tomorrow"
- "next Monday"

**Natural expressions**:
- "Don't forget to..." → Creates reminder
- "I need to..." → Creates reminder
- "Don't let me forget..." → Creates reminder

**Better message extraction**:
- Removes filler words
- Extracts core action
- Keeps it concise

### 4. ⏰ Snooze Functionality
When a reminder arrives, you get interactive buttons:

**Buttons**:
- ⏰ Snooze 10 min
- ⏰ Snooze 1 hour
- ✅ Done

**How it works**:
1. Reminder notification appears with buttons
2. Click "Snooze 10 min" to delay 10 minutes
3. Click "Snooze 1 hour" to delay 1 hour
4. Click "Done" to acknowledge and dismiss
5. Buttons disappear after interaction

**Example**:
```
Bot: 🔔 REMINDER

"call mom"

📅 Scheduled: Feb 3, 3:00 PM
🆔 ID: 15

[⏰ Snooze 10 min] [⏰ Snooze 1 hour]
[✅ Done]
```

Click "Snooze 10 min":
```
Bot: ⏰ Reminder snoozed for 10 minutes. I'll remind you again!
```

### 5. ✨ Better Formatting
**Reminder creation confirmation**:
```
✅ Reminder set!

"call mom"
📅 Wed, Feb 3, 3:00 PM
🆔 ID: 15

Use /list to see all reminders
Use /cancel 15 to cancel
```

**Reminder notifications**:
```
🔔 REMINDER

"call mom"

📅 Scheduled: Feb 3, 3:00 PM
🆔 ID: 15
```

**Benefits**:
- Clear visual hierarchy
- Emoji indicators
- Formatted timestamps
- Actionable information (ID for canceling)

## Technical Implementation

### New API Endpoints

**POST /snooze**
```json
{
  "reminderId": 15,
  "userId": "123456789",
  "minutes": 10
}
```

Response:
```json
{
  "success": true,
  "message": "Snoozed for 10 minutes",
  "newTime": "2026-02-03T15:10:00Z"
}
```

### Enhanced /ask Endpoint
Now handles:
- `/list` command
- `/cancel <id>` command
- Natural reminder requests
- Regular AI conversations

### Bot Improvements
- Callback query handlers for inline buttons
- Better error messages
- Type-safe responses

### Scheduler Enhancements
- Sends reminders with inline keyboards
- Formatted messages with markdown
- Shows scheduled time in notifications

## Usage Examples

### Create a Reminder
```
You: Remind me to call mom in 30 minutes
Bot: ✅ Reminder set!

"call mom"
📅 Wed, Feb 3, 3:30 PM
🆔 ID: 15

Use /list to see all reminders
Use /cancel 15 to cancel
```

### List All Reminders
```
You: /list
Bot: [Shows all pending reminders with times and IDs]
```

### Cancel a Reminder
```
You: /cancel 15
Bot: ✅ Cancelled reminder: "call mom"
```

### Receive a Reminder
```
Bot: 🔔 REMINDER

"call mom"

📅 Scheduled: Feb 3, 3:30 PM
🆔 ID: 15

[Interactive buttons appear]
```

### Snooze a Reminder
```
[Click "Snooze 10 min" button]
Bot: ⏰ Reminder snoozed for 10 minutes. I'll remind you again!
```

## Benefits

1. **Better Control**: List and cancel reminders at any time
2. **Flexibility**: Snooze reminders when you're busy
3. **Clarity**: Clear formatting makes everything easy to read
4. **Natural**: Understands more ways to express time
5. **Interactive**: Inline buttons for quick actions

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/list` | Show all upcoming reminders | `/list` |
| `/cancel <id>` | Cancel a specific reminder | `/cancel 15` |
| Reminder text | Create a new reminder | "Remind me to call mom at 3pm" |
| Normal text | Chat with AI | "What's the weather?" |

## Inline Buttons

When you receive a reminder, you can:
- ⏰ **Snooze 10 min** - Delay by 10 minutes
- ⏰ **Snooze 1 hour** - Delay by 1 hour
- ✅ **Done** - Mark as complete

## Comparison: Before vs After

### Before
```
Bot: 🔔 Reminder: call mom
```

### After
```
🔔 REMINDER

"call mom"

📅 Scheduled: Feb 3, 3:00 PM
🆔 ID: 15

[⏰ Snooze 10 min] [⏰ Snooze 1 hour]
[✅ Done]
```

### Before
```
You: Remind me to call mom at 3pm
Bot: Got it! I'll remind you to "call mom" at 2/3/2026, 3:00:00 PM.
```

### After
```
You: Remind me to call mom at 3pm

Bot: ✅ Reminder set!

"call mom"
📅 Wed, Feb 3, 3:00 PM
🆔 ID: 15

Use /list to see all reminders
Use /cancel 15 to cancel
```

## Still Lean MVP

Despite these improvements, the system remains a lean MVP:
- No authentication beyond Telegram user ID
- No recurring reminders
- No complex scheduling rules
- No external dependencies (Redis, queues, etc.)
- Simple PostgreSQL polling every minute
- Straightforward code structure

## Future Ideas (Not Implemented)

Potential enhancements for later:
- Recurring reminders (daily, weekly, monthly)
- Reminder categories/tags
- Location-based reminders
- Reminder priorities
- Shared reminders
- Calendar integration
- Voice message reminders
- Attachment support

## Conclusion

These improvements make the reminder system significantly more useful while maintaining its simplicity and lean architecture. Users can now:
- See what reminders they have
- Cancel unwanted reminders
- Snooze reminders when busy
- Use more natural language
- Enjoy better-formatted messages

All while keeping the codebase clean, maintainable, and easy to understand.
