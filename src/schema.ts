import { pgTable, serial, text, timestamp, boolean, bigint, vector, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  isDone: boolean("is_done").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Conversations table for storing chat history with embeddings for semantic search
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI embedding dimension
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("conversations_user_id_idx").on(table.userId),
  createdAtIdx: index("conversations_created_at_idx").on(table.createdAt),
}));

// Memories table for storing extracted key facts and context about users
export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(), // e.g., "preference", "fact", "context", "relationship"
  content: text("content").notNull(), // The actual memory/fact
  embedding: vector("embedding", { dimensions: 1536 }),
  source: text("source"), // Optional: reference to conversation ID
  importance: serial("importance").default(1).notNull(), // 1-5, higher = more important
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("memories_user_id_idx").on(table.userId),
  categoryIdx: index("memories_category_idx").on(table.category),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
