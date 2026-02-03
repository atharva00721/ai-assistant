# Long-Term Memory System

The AI assistant now features a comprehensive long-term memory system that allows it to remember conversations, extract important facts, and provide contextual responses based on past interactions.

## Overview

The memory system consists of two main components:

1. **Conversation History Storage**: All messages are stored in a PostgreSQL database with vector embeddings for semantic search
2. **Memory Extraction**: Important facts, preferences, and context are automatically extracted and stored for quick retrieval

## Features

### 🗄️ Persistent Conversation Storage
- All conversations are stored in the database and persist across server restarts
- Each message is embedded using OpenAI's embedding model for semantic search
- Automatically retrieves recent conversation history (last 20 messages by default)

### 🔍 Semantic Search
- Find relevant past conversations using similarity search
- Automatically triggered when users reference past conversations (e.g., "remember when we talked about...")
- Uses vector embeddings with cosine similarity for accurate results

### 🧠 Intelligent Memory Extraction
- Automatically extracts important facts from conversations every 10 messages
- Categories include:
  - **Preferences**: User likes/dislikes
  - **Facts**: Personal information (job, location, etc.)
  - **Context**: Ongoing projects, goals
  - **Relationships**: Mentions of specific people

- Each memory has an importance score (1-5) for prioritization
- Memories are also embedded for semantic retrieval

### 📝 Context-Aware Responses
- Retrieves relevant memories before generating responses
- Provides context to the AI about the user's preferences and past conversations
- Automatically includes references to past conversations when relevant

## Database Schema

### Conversations Table
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI embedding
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Memories Table
```sql
CREATE TABLE memories (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'preference', 'fact', 'context', 'relationship'
  content TEXT NOT NULL,
  embedding vector(1536),
  source TEXT,  -- Optional reference to conversation
  importance INTEGER DEFAULT 1,  -- 1-5 scale
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Setup

### 1. Install pgvector Extension

The memory system requires the `pgvector` extension for PostgreSQL:

```sql
CREATE EXTENSION vector;
```

### 2. Run Migration Script

Run the migration script to create the necessary tables:

```bash
bun run db:add-memory-tables
```

This will:
- Enable the pgvector extension
- Create the `conversations` table
- Create the `memories` table
- Add necessary indexes for performance

### 3. Environment Variables

The memory system uses the same API keys as the main bot:

```bash
ANANNAS_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.anannas.ai/v1
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: Disable memory features if needed
MEMORY_ENABLED=true  # Default: true
MEMORY_EXTRACTION_ENABLED=true  # Default: true
```

## Usage

### Telegram Bot Commands

#### View Stored Memories
```
/memories
```
Shows a summary of what the bot remembers about you, organized by category (preferences, facts, context, relationships).

#### Manually Extract Memories
```
/extract
```
Analyzes your last 10 conversations and extracts important facts. Memory extraction also happens automatically every 10 messages.

### API Endpoints

The memory system integrates seamlessly with the existing `/ask` endpoint. No changes needed for basic usage.

## How It Works

### 1. Message Processing Flow

```
User sends message
    ↓
Store in conversations table with embedding
    ↓
Retrieve relevant context:
  - Recent conversation history (last 20 messages)
  - Relevant memories (semantic search)
  - Similar past conversations (if user references them)
    ↓
Generate response with context
    ↓
Store response in conversations table
    ↓
Extract memories (every 10 messages)
```

### 2. Memory Extraction Process

The system uses GPT to analyze conversations and extract structured information:

```typescript
Input: "Hi! My name is Alex and I love hiking."
        "I'm a software engineer in Denver."

Extracted Memories:
[
  {
    category: "fact",
    content: "User's name is Alex",
    importance: 5
  },
  {
    category: "preference", 
    content: "User loves hiking",
    importance: 4
  },
  {
    category: "fact",
    content: "User is a software engineer",
    importance: 4
  },
  {
    category: "fact",
    content: "User lives in Denver",
    importance: 3
  }
]
```

### 3. Semantic Search

When a user asks something like "What did we talk about regarding my hobbies?":

1. Generate embedding for the query
2. Search conversations table using cosine similarity
3. Return most relevant conversations (similarity > 0.75)
4. Include in context for response generation

### 4. Context Injection

Before generating a response, the system builds context:

```
Context about the user:
[preference] Loves hiking
[fact] Software engineer in Denver
[context] Working on a new project

Relevant past conversation:
user: I usually hike in the mountains near Denver
assistant: That sounds amazing! Denver has beautiful mountain access.

Recent conversation history:
user: Hey, how's it going?
assistant: Hi! Good to hear from you again!
...
```

## API Reference

### Memory Functions

```typescript
// Store a conversation message
await storeConversation(userId: string, role: "user" | "assistant", content: string)

// Get recent conversation history
await getRecentConversations(userId: string, limit?: number)

// Search for similar conversations
await searchSimilarConversations(userId: string, query: string, limit?: number)

// Extract memories from conversation
await extractMemories(userId: string, conversationContent: string)

// Get relevant memories for a context
await getRelevantMemories(userId: string, context: string, limit?: number)

// Get memories by category
await getMemoriesByCategory(userId: string, category: string)

// Clean old conversations (maintenance)
await cleanOldConversations(daysToKeep?: number)
```

## Performance Considerations

### Indexes
The system creates indexes on:
- `conversations(user_id)` - Fast user-specific queries
- `conversations(created_at)` - Efficient time-based sorting
- `memories(user_id)` - Fast user-specific memory retrieval
- `memories(category)` - Quick category filtering

### Vector Operations
- Embedding generation: ~100-200ms per message
- Similarity search: ~50-100ms (depends on data size)
- Indexed for fast nearest neighbor search using pgvector

### Storage
- Average conversation: ~100 bytes text + 6KB embedding
- Average memory: ~50 bytes text + 6KB embedding
- 1000 messages ≈ 6MB storage

## Maintenance

### Cleanup Old Conversations

To prevent database bloat, you can periodically clean old conversations:

```typescript
import { cleanOldConversations } from "./src/memory";

// Keep only last 30 days
await cleanOldConversations(30);
```

Add this to a cron job or scheduled task for automatic cleanup.

### Monitoring

Key metrics to monitor:
- Database size (conversations and memories tables)
- Embedding API usage and costs
- Query performance (should be <200ms)
- Memory extraction rate (should extract 1-3 memories per 10 messages)

## Troubleshooting

### pgvector Extension Not Available

If you get an error about the vector type:

```sql
-- Manually enable the extension
CREATE EXTENSION IF NOT EXISTS vector;
```

Some managed PostgreSQL services may not support pgvector. Check with your provider.

### Embeddings Not Generating

Check that:
1. `ANANNAS_API_KEY` is set correctly
2. The embedding model is available: `text-embedding-3-small`
3. Network connectivity to the API endpoint

### High Memory Usage

If memory usage is high:
1. Reduce `MAX_HISTORY` constant in `ai.ts` (default: 20)
2. Run `cleanOldConversations()` more frequently
3. Consider archiving old memories to a separate table

### Slow Queries

If queries are slow:
1. Verify indexes are created: `\d conversations` in psql
2. Consider partitioning by user_id for large datasets
3. Use connection pooling for database access

## Future Enhancements

Potential improvements for the memory system:

1. **Memory Consolidation**: Merge similar or redundant memories
2. **Memory Decay**: Lower importance of old, unused memories
3. **Cross-User Insights**: Learn patterns across users (with privacy considerations)
4. **Memory Categories**: Add more categories (skills, schedules, etc.)
5. **Conflict Resolution**: Handle contradicting memories
6. **Memory Export**: Allow users to download their memory data
7. **Selective Forgetting**: Allow users to delete specific memories

## Privacy & Data

### Data Storage
- All data is stored in your PostgreSQL database
- No data is sent to third parties except for embedding generation
- Embeddings are numerical vectors and don't expose original text

### User Control
- Users can view their memories with `/memories`
- Users can manually trigger extraction with `/extract`
- Memory extraction can be disabled with `MEMORY_EXTRACTION_ENABLED=false`
- The entire memory system can be disabled with `MEMORY_ENABLED=false`

### Data Retention
- Conversations are stored indefinitely by default
- Use `cleanOldConversations()` for automatic cleanup
- Consider implementing data retention policies based on your needs

## Testing

Run the test suite to verify the memory system:

```bash
bun run test:memory
```

This will:
1. Store test conversations
2. Retrieve recent conversations
3. Extract memories
4. Search for similar conversations
5. Retrieve relevant memories by context

Expected output:
```
🧪 Testing Long-Term Memory System

1️⃣ Storing test conversations...
✅ Stored 4 conversations

2️⃣ Retrieving recent conversations...
✅ Retrieved 4 recent conversations

3️⃣ Extracting memories from conversations...
✅ Memory extraction completed

4️⃣ Searching for similar conversations...
✅ Found 3 similar conversations

5️⃣ Getting relevant memories...
✅ Found 2 relevant memories

🎉 All memory system tests completed successfully!
```

## Example Interaction

```
User: Hi! I'm Sarah. I love photography and I'm planning a trip to Japan next month.
Bot: That's exciting, Sarah! Japan is incredible for photography. Have you picked out specific spots yet?

[Memory extraction happens in background]
[Stored: name=Sarah, hobby=photography, plan=trip to Japan]

--- 30 messages later ---

User: What camera settings should I use for the temples?
Bot: Great question! Based on our earlier conversation about your Japan trip...
     [Bot has context about the trip and photography interest]
     For temple photography, I'd recommend...

--- Later ---

User: /memories
Bot: 🧠 Memory Summary

     What I remember about you:

     **Facts:**
     1. Your name is Sarah
     2. Planning a trip to Japan next month

     **Preferences:**
     1. Loves photography
     2. Interested in temple photography

     **Context:**
     1. Researching camera settings for upcoming trip
```

## Benefits

### For Users
- **Continuity**: Conversations feel natural and connected
- **Personalization**: Responses are tailored to your preferences and history
- **Convenience**: No need to repeat information
- **Control**: View and manage what the bot remembers

### For Developers
- **Scalability**: Database-backed, not limited by memory
- **Flexibility**: Easy to query and analyze conversation patterns
- **Maintainability**: Clean separation of concerns
- **Extensibility**: Easy to add new memory categories or features

## Architecture

```
┌─────────────────────────────────────────────┐
│                User Message                  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           Store with Embedding              │
│         (conversations table)                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│        Retrieve Context                      │
│  ├─ Recent history (time-based)             │
│  ├─ Relevant memories (similarity)          │
│  └─ Past conversations (if referenced)      │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Generate Response                    │
│       (with full context)                    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│    Store Response with Embedding            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│   Extract Memories (every 10 messages)      │
│        (memories table)                      │
└─────────────────────────────────────────────┘
```

## Comparison with Traditional Approaches

| Feature | In-Memory Map | Session Storage | Long-Term Memory |
|---------|---------------|-----------------|------------------|
| Persistence | ❌ Lost on restart | ⚠️ Lost after timeout | ✅ Permanent |
| Scalability | ❌ RAM limited | ⚠️ Limited | ✅ Database-backed |
| Semantic Search | ❌ Not available | ❌ Not available | ✅ Vector similarity |
| Fact Extraction | ❌ Manual | ❌ Manual | ✅ Automatic |
| Context Retrieval | ❌ Linear scan | ❌ Linear scan | ✅ Indexed queries |
| Multi-Server | ❌ Not shared | ⚠️ Needs sync | ✅ Shared database |

## Cost Considerations

### Embedding API Costs
- Cost per message: ~$0.00001 (text-embedding-3-small)
- 10,000 messages ≈ $0.10
- Embeddings are generated once and stored

### Database Costs
- Storage: ~6KB per message (mostly embedding)
- 100,000 messages ≈ 600MB
- Query costs: Minimal with proper indexing

### Optimization Tips
1. Only embed important messages (skip short acknowledgments)
2. Batch embedding generation when possible
3. Use cheaper embedding models for less critical data
4. Implement conversation cleanup for old data

## Conclusion

The long-term memory system transforms the AI assistant from a stateless chatbot into an intelligent companion that remembers and learns from every interaction. By combining conversation storage, semantic search, and intelligent fact extraction, users get a personalized experience that improves over time.

## Support

For issues, questions, or contributions:
- Check the troubleshooting section above
- Review the test script: `scripts/test-memory.ts`
- Examine the implementation: `src/memory.ts`
- Test with: `bun run test:memory`