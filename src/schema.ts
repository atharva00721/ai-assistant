import { pgTable, serial, text, timestamp, boolean, bigint, jsonb, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  todoistToken: text("todoist_token"),
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

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const habitLogs = pgTable("habit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  habitName: text("habit_name").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userMemories = pgTable("user_memories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  importance: integer("importance").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type HabitLog = typeof habitLogs.$inferSelect;
export type NewHabitLog = typeof habitLogs.$inferInsert;
export type UserMemory = typeof userMemories.$inferSelect;
export type NewUserMemory = typeof userMemories.$inferInsert;