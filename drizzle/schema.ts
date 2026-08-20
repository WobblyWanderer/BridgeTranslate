import {
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const translationJobs = mysqlTable("translation_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceText: text("sourceText").notNull(),
  traitsJson: text("traitsJson").notNull(),
  profileDescription: text("profileDescription"),
  purpose: varchar("purpose", { length: 120 }).notNull(),
  outputStyle: varchar("outputStyle", { length: 80 }).notNull(),
  extraContext: text("extraContext"),
  preserveEmotion: int("preserveEmotion").default(1).notNull(),
  meaningMap: text("meaningMap"),
  translation: text("translation").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const savedProfiles = mysqlTable("saved_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  traitsJson: text("traitsJson").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: int("resourceId"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const formSessions = mysqlTable("form_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceType: varchar("sourceType", { length: 20 }).notNull(),
  sourceName: varchar("sourceName", { length: 255 }),
  sourceUrl: text("sourceUrl"),
  sourceKey: text("sourceKey"),
  sourceMimeType: varchar("sourceMimeType", { length: 120 }),
  formTitle: varchar("formTitle", { length: 255 }).notNull(),
  questionsJson: text("questionsJson").notNull(),
  answersJson: text("answersJson").notNull(),
  missingJson: text("missingJson").notNull(),
  formContextSummary: text("formContextSummary"),
  userContext: text("userContext"),
  triage: mediumtext("triage"),
  answerList: mediumtext("answerList"),
  status: varchar("status", { length: 30 }).default("extracted").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const evidenceItems = mysqlTable("evidence_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  youRef: varchar("youRef", { length: 64 }).notNull().unique(),
  sourceType: varchar("sourceType", { length: 40 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  canonicalName: varchar("canonicalName", { length: 360 }).notNull(),
  sourceUrl: text("sourceUrl"),
  sourceKey: text("sourceKey"),
  sourceMimeType: varchar("sourceMimeType", { length: 120 }),
  sourceHash: varchar("sourceHash", { length: 128 }),
  eventDate: varchar("eventDate", { length: 64 }),
  dateConfidence: varchar("dateConfidence", { length: 30 }).default("unknown").notNull(),
  organisation: varchar("organisation", { length: 255 }),
  itemType: varchar("itemType", { length: 120 }).notNull(),
  sender: varchar("sender", { length: 255 }),
  recipient: varchar("recipient", { length: 255 }),
  subject: text("subject"),
  extractedText: text("extractedText"),
  summary: text("summary"),
  deadlinesJson: text("deadlinesJson").notNull(),
  tagsJson: text("tagsJson").notNull(),
  relatedYouRefsJson: text("relatedYouRefsJson").notNull(),
  reviewStatus: varchar("reviewStatus", { length: 30 }).default("needs_review").notNull(),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type TranslationJob = typeof translationJobs.$inferSelect;
export type InsertTranslationJob = typeof translationJobs.$inferInsert;
export type SavedProfile = typeof savedProfiles.$inferSelect;
export type InsertSavedProfile = typeof savedProfiles.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type FormSession = typeof formSessions.$inferSelect;
export type InsertFormSession = typeof formSessions.$inferInsert;
export type EvidenceItem = typeof evidenceItems.$inferSelect;
export type InsertEvidenceItem = typeof evidenceItems.$inferInsert;

export const schema = { users, translationJobs, savedProfiles, auditLogs, formSessions, evidenceItems };
