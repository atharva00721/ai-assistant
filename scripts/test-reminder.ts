import { askAI } from "../src/ai.js";

async function testReminderDetection() {
  console.log("Testing reminder detection...\n");

  const testCases = [
    "Remind me to call mom at 3pm tomorrow",
    "Set a reminder for my meeting in 2 hours",
    "Schedule a task to buy groceries at 5pm",
    "What is the weather like today?", // Should NOT be detected as reminder
    "Hello, how are you?", // Should NOT be detected as reminder
  ];

  const testTimezone = "America/New_York";
  console.log(`Testing with timezone: ${testTimezone}\n`);

  for (const message of testCases) {
    console.log(`Testing: "${message}"`);
    try {
      const result = await askAI(message, "test-user-123", testTimezone);
      
      if (result.reminder) {
        console.log("✓ Detected as REMINDER");
        console.log(`  Message: ${result.reminder.message}`);
        console.log(`  Time (UTC): ${result.reminder.time}`);
        const localTime = new Date(result.reminder.time).toLocaleString('en-US', {
          timeZone: testTimezone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        console.log(`  Time (${testTimezone}): ${localTime}`);
      } else {
        console.log("✓ Normal conversation");
        console.log(`  Response: ${result.text?.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error("✗ Error:", error);
    }
    console.log();
  }

  console.log("Test complete!");
  process.exit(0);
}

testReminderDetection();
