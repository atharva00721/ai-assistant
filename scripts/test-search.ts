import { askAI } from "../src/ai.js";

console.log("Testing Perplexity web search integration...\n");

const testQueries = [
  "What is the latest news about AI?",
  "Who won the Super Bowl?",
  "What's the weather like today?",
  "Compare iPhone vs Android",
  "How does photosynthesis work?",
];

async function runTests() {
  const userId = "test-user-search";
  
  for (const query of testQueries) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Query: "${query}"`);
    console.log("=".repeat(60));
    
    try {
      const result = await askAI(query, userId);
      
      if (result.text) {
        console.log(`\nResponse:\n${result.text}\n`);
      } else if (result.reminder) {
        console.log("(Detected as reminder request, not search)");
      } else {
        console.log("No text response received");
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("Test completed!");
  console.log("=".repeat(60));
}

runTests().catch(console.error);
