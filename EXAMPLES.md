# Reminder System - Usage Examples

## Creating Reminders

### Basic Reminder
```
You: Remind me to call mom at 3pm

Bot: ✅ Reminder set!

"call mom"
📅 Wed, Feb 3, 3:00 PM
🆔 ID: 15

Use /list to see all reminders
Use /cancel 15 to cancel
```

### Natural Language Variations

**Relative times**:
```
You: In 10 minutes remind me to check the oven
Bot: ✅ Reminder set! [creates reminder for 10 minutes from now]

You: Remind me in 2 hours to take medicine
Bot: ✅ Reminder set! [creates reminder for 2 hours from now]

You: Set a reminder for 30 seconds from now
Bot: ✅ Reminder set! [creates reminder for 30 seconds from now]
```

**Specific times**:
```
You: Remind me to attend meeting at 2:30pm
Bot: ✅ Reminder set! [today at 2:30 PM]

You: Don't let me forget to call John at noon
Bot: ✅ Reminder set! [today at 12:00 PM]

You: I need to submit report at midnight
Bot: ✅ Reminder set! [today at 12:00 AM]
```

**Future dates**:
```
You: Remind me tomorrow at 9am to check email
Bot: ✅ Reminder set! [tomorrow at 9:00 AM]

You: Set a reminder for next Monday at 10am
Bot: ✅ Reminder set! [next Monday at 10:00 AM]

You: Schedule task to buy groceries tomorrow at 5pm
Bot: ✅ Reminder set! [tomorrow at 5:00 PM]
```

**Natural expressions**:
```
You: Don't forget to water plants at 6pm
Bot: ✅ Reminder set!

You: I need to call dentist tomorrow morning at 9
Bot: ✅ Reminder set!

You: Make sure I take medicine in 4 hours
Bot: ✅ Reminder set!
```

## Listing Reminders

### View All Reminders
```
You: /list

Bot: 📋 Your upcoming reminders (4):

1. "call mom"
   📅 Feb 3, 3:00 PM
   🆔 ID: 15

2. "check the oven"
   📅 Feb 3, 3:15 PM
   🆔 ID: 16

3. "take medicine"
   📅 Feb 3, 8:00 PM
   🆔 ID: 17

4. "meeting with team"
   📅 Feb 4, 10:00 AM
   🆔 ID: 18

Use /cancel <id> to cancel a reminder
```

### Alternative Ways to List
```
You: show my reminders
Bot: [Shows list of reminders]

You: list my reminders
Bot: [Shows list of reminders]
```

### No Reminders
```
You: /list

Bot: You have no upcoming reminders.
```

## Canceling Reminders

### Cancel by ID
```
You: /cancel 15

Bot: ✅ Cancelled reminder: "call mom"
```

### Reminder Not Found
```
You: /cancel 999

Bot: Reminder not found or already completed. Use /list to see your reminders.
```

### Missing ID
```
You: /cancel

Bot: Please specify a reminder ID: /cancel <id>
Use /list to see your reminders.
```

## Receiving Reminders

### Reminder Notification
When the scheduled time arrives, you receive:

```
Bot: 🔔 REMINDER

"call mom"

📅 Scheduled: Feb 3, 3:00 PM
🆔 ID: 15

[⏰ Snooze 10 min] [⏰ Snooze 1 hour]
[✅ Done]
```

### Snooze for 10 Minutes
Click the "⏰ Snooze 10 min" button:

```
Bot: ⏰ Reminder snoozed for 10 minutes. I'll remind you again!
```

In 10 minutes, you'll receive the reminder again.

### Snooze for 1 Hour
Click the "⏰ Snooze 1 hour" button:

```
Bot: ⏰ Reminder snoozed for 60 minutes. I'll remind you again!
```

In 1 hour, you'll receive the reminder again.

### Mark as Done
Click the "✅ Done" button:

```
Bot: ✅ Great! Reminder completed.
```

The reminder is marked as complete and won't appear again.

## Real-World Workflows

### Morning Routine
```
You: Remind me to take vitamins at 8am
Bot: ✅ Reminder set! [ID: 20]

You: Remind me to check email at 9am
Bot: ✅ Reminder set! [ID: 21]

You: Set a reminder for standup meeting at 10am
Bot: ✅ Reminder set! [ID: 22]

You: /list
Bot: [Shows all 3 reminders with times and IDs]
```

At 8am:
```
Bot: 🔔 REMINDER

"take vitamins"
...
[Click Done]
```

At 9am:
```
Bot: 🔔 REMINDER

"check email"
...
[Click Snooze 10 min because you're busy]
```

At 9:10am:
```
Bot: 🔔 REMINDER

"check email"
...
[Now you're ready, click Done]
```

### Changed Plans
```
You: Remind me to call dentist at 2pm
Bot: ✅ Reminder set! [ID: 25]

You: Remind me to pick up package at 3pm
Bot: ✅ Reminder set! [ID: 26]

[You realize you won't be available at 3pm]

You: /list
Bot: [Shows both reminders]

You: /cancel 26
Bot: ✅ Cancelled reminder: "pick up package"

You: Remind me to pick up package tomorrow at 10am
Bot: ✅ Reminder set! [ID: 27]
```

### Quick Reminders
```
You: In 5 minutes remind me to call back
Bot: ✅ Reminder set! [ID: 30]

[5 minutes later]
Bot: 🔔 REMINDER

"call back"
...
[Click Done after making the call]
```

### Checking Before Bed
```
You: /list

Bot: 📋 Your upcoming reminders (2):

1. "morning workout"
   📅 Feb 4, 7:00 AM
   🆔 ID: 31

2. "team meeting"
   📅 Feb 4, 11:00 AM
   🆔 ID: 32

Use /cancel <id> to cancel a reminder
```

## Normal Conversations

The bot still functions as an AI assistant:

```
You: What's the weather like today?
Bot: [AI provides weather information]

You: Tell me a joke
Bot: [AI tells a joke]

You: How do I cook pasta?
Bot: [AI explains how to cook pasta]
```

The bot automatically distinguishes between reminder requests and normal conversation.

## Edge Cases

### Past Time (Same Day)
```
You: Remind me at 10am
[Current time is 2pm]

Bot: ✅ Reminder set!
[Creates reminder for 10am tomorrow, not today]
```

### Vague Time
```
You: Remind me later
Bot: [Treats as normal conversation since time is not specific]
Can you specify when you'd like to be reminded?
```

### Multiple Reminders at Same Time
```
You: Remind me to call mom at 3pm
Bot: ✅ Reminder set! [ID: 40]

You: Remind me to call dad at 3pm
Bot: ✅ Reminder set! [ID: 41]

[At 3pm, you receive both reminders back-to-back]
```

## Tips for Best Results

### ✅ Good Patterns
- "Remind me to [action] at [time]"
- "In [duration] remind me to [action]"
- "Set a reminder for [action] [time]"
- "Don't let me forget to [action] at [time]"
- "I need to [action] at [time]"

### 📝 Time Formats That Work
- Relative: "in 5 minutes", "in 2 hours", "in 30 seconds"
- Specific: "at 3pm", "at 15:00", "noon", "midnight"
- Future: "tomorrow at 9am", "next Monday", "tonight at 8"

### 💡 Pro Tips
1. Use `/list` regularly to see what's coming up
2. Cancel reminders you no longer need to keep the list clean
3. Use snooze when you're busy but still need the reminder
4. Include enough context in your reminder message to know what it's about
5. Be specific with times for better accuracy

## Command Summary

| Action | Command/Text | Result |
|--------|--------------|--------|
| Create reminder | "Remind me to X at Y" | Creates reminder |
| List reminders | `/list` | Shows all upcoming reminders |
| Cancel reminder | `/cancel <id>` | Deletes specific reminder |
| Snooze reminder | Click button in notification | Delays reminder by X minutes |
| Complete reminder | Click "Done" in notification | Marks reminder as done |
| Chat normally | Any other text | AI conversation |

## Demo Script

Try this sequence to test all features:

```bash
# 1. Create some reminders
You: Remind me to test feature A in 2 minutes
You: Remind me to test feature B in 3 minutes
You: Remind me to test feature C tomorrow at 9am

# 2. List them
You: /list
# Should see all 3 reminders

# 3. Cancel one
You: /cancel <id of feature C>
# Should confirm cancellation

# 4. List again
You: /list
# Should see only 2 reminders now

# 5. Wait for reminder
# After 2 minutes, receive reminder for feature A
# Click "Snooze 10 min" button

# 6. Wait for reminder again
# After 10 minutes, receive reminder for feature A again
# Click "Done" button

# 7. Normal chat
You: What's the capital of France?
# Should get AI response about Paris
```

## Success! 🎉

You now have a fully functional reminder system with:
- Natural language understanding
- List and cancel capabilities
- Snooze functionality
- Beautiful formatting
- Seamless AI integration

Enjoy never forgetting anything again! 🔔
