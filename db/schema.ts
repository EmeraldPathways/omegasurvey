import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const surveys = sqliteTable("surveys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  questionsJson: text("questions_json").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recipients = sqliteTable(
  "recipients",
  {
    id: text("id").primaryKey(),
    surveyId: integer("survey_id").notNull().references(() => surveys.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    tokenHash: text("token_hash"),
    status: text("status").notNull().default("imported"),
    emailMessageId: text("email_message_id"),
    lastError: text("last_error"),
    sentAt: text("sent_at"),
    openedAt: text("opened_at"),
    submittedAt: text("submitted_at"),
    reminderCount: integer("reminder_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("recipients_survey_email_unique").on(table.surveyId, table.email),
    uniqueIndex("recipients_token_hash_unique").on(table.tokenHash),
  ],
);

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    recipientId: text("recipient_id").notNull().references(() => recipients.id),
    answersJson: text("answers_json").notNull(),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("responses_recipient_unique").on(table.recipientId)],
);
