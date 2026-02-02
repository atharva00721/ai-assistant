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

  for (const message of testCases) {
    console.log(`Testing: "${message}"`);
    try {
      const result = await askAI(message, "test-user-123");
      
      if (result.reminder) {
        console.log("✓ Detected as REMINDER");
        console.log(`  Message: ${result.reminder.message}`);
        console.log(`  Time: ${result.reminder.time}`);
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
