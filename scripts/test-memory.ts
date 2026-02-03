import {
  storeConversation,
  getRecentConversations,
  searchSimilarConversations,
  extractMemories,
  getRelevantMemories,
} from "../src/memory";

const testUserId = "test_user_memory_123";

async function testMemorySystem() {
  console.log("🧪 Testing Long-Term Memory System\n");

  try {
    // Test 1: Store conversations
    console.log("1️⃣ Storing test conversations...");
    await storeConversation(testUserId, "user", "Hi! My name is Alex and I love hiking.");
    await storeConversation(testUserId, "assistant", "Nice to meet you, Alex! Hiking is a wonderful activity. Do you have any favorite trails?");
    await storeConversation(testUserId, "user", "Yes! I usually hike in the mountains near Denver. I'm a software engineer by day.");
    await storeConversation(testUserId, "assistant", "That sounds amazing! Denver has beautiful mountain access. How do you balance your tech career with outdoor adventures?");
    console.log("✅ Stored 4 conversations\n");

    // Test 2: Retrieve recent conversations
    console.log("2️⃣ Retrieving recent conversations...");
    const recentConvos = await getRecentConversations(testUserId, 10);
    console.log(`✅ Retrieved ${recentConvos.length} recent conversations:`);
    recentConvos.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. [${conv.role}] ${conv.content.substring(0, 50)}...`);
    });
    console.log("");

    // Test 3: Extract memories from conversation
    console.log("3️⃣ Extracting memories from conversations...");
    const conversationText = recentConvos
      .map((c) => `${c.role}: ${c.content}`)
      .join("\n");
    await extractMemories(testUserId, conversationText);
    console.log("✅ Memory extraction completed\n");

    // Wait a bit for embeddings to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Search for similar conversations
    console.log("4️⃣ Searching for similar conversations...");
    const query = "Tell me about hiking";
    const similarConvos = await searchSimilarConversations(testUserId, query, 3);
    console.log(`✅ Found ${similarConvos.length} similar conversations for "${query}":`);
    similarConvos.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. [${conv.role}] ${conv.content.substring(0, 60)}... (similarity: ${conv.similarity.toFixed(2)})`);
    });
    console.log("");

    // Test 5: Get relevant memories
    console.log("5️⃣ Getting relevant memories...");
    const contextQuery = "What does the user do for work?";
    const memories = await getRelevantMemories(testUserId, contextQuery, 5);
    console.log(`✅ Found ${memories.length} relevant memories for "${contextQuery}":`);
    memories.forEach((mem, idx) => {
      console.log(`   ${idx + 1}. [${mem.category}] ${mem.content} (importance: ${mem.importance}, similarity: ${mem.similarity.toFixed(2)})`);
    });
    console.log("");

    // Test 6: Search with different context
    console.log("6️⃣ Getting relevant memories for different context...");
    const hobbyQuery = "What are the user's hobbies?";
    const hobbyMemories = await getRelevantMemories(testUserId, hobbyQuery, 5);
    console.log(`✅ Found ${hobbyMemories.length} relevant memories for "${hobbyQuery}":`);
    hobbyMemories.forEach((mem, idx) => {
      console.log(`   ${idx + 1}. [${mem.category}] ${mem.content} (importance: ${mem.importance}, similarity: ${mem.similarity.toFixed(2)})`);
    });
    console.log("");

    console.log("🎉 All memory system tests completed successfully!");
    console.log("\n💡 The memory system can now:");
    console.log("   - Store conversations with embeddings");
    console.log("   - Retrieve recent chat history");
    console.log("   - Search for semantically similar past conversations");
    console.log("   - Extract and store important facts about users");
    console.log("   - Retrieve relevant memories based on context");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

testMemorySystem();
