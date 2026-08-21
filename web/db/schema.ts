import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  professionalRole: text("professional_role").notNull().default("practitioner"),
  organisation: text("organisation").notNull().default(""),
  jurisdiction: text("jurisdiction").notNull().default(""),
  practiceAreas: text("practice_areas", { mode: "json" }).$type<string[]>().notNull().default([]),
  experienceLevel: text("experience_level").notNull().default("mid"),
  locale: text("locale").notNull().default("en"),
  productUpdates: integer("product_updates", { mode: "boolean" }).notNull().default(true),
  caseUpdates: integer("case_updates", { mode: "boolean" }).notNull().default(true),
  researchInvites: integer("research_invites", { mode: "boolean" }).notNull().default(false),
  verifiedPractitioner: integer("verified_practitioner", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("users_email_uidx").on(table.email)]);

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(),
  currentVersion: text("current_version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  title: text("title").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  practiceArea: text("practice_area").notNull(),
  sector: text("sector").notNull(),
  difficulty: text("difficulty").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  status: text("status").notNull().default("published"),
  reviewLevel: text("review_level").notNull().default("canonical"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  centrallyManaged: integer("centrally_managed", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("cases_classification_idx").on(table.jurisdiction, table.practiceArea, table.difficulty),
  index("cases_status_idx").on(table.status, table.updatedAt),
]);

export const caseVersions = sqliteTable("case_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull().references(() => cases.id),
  version: text("version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  parentVersion: text("parent_version"),
  changeSummary: text("change_summary").notNull().default(""),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("case_versions_case_version_uidx").on(table.caseId, table.version)]);

export const caseSubscriptions = sqliteTable("case_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  caseId: text("case_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("case_subscriptions_user_case_uidx").on(table.userEmail, table.caseId)]);

export const caseFeedback = sqliteTable("case_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull(),
  caseVersion: text("case_version").notNull(),
  userEmail: text("user_email").notNull(),
  source: text("source").notNull(),
  category: text("category").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  studioFingerprint: text("studio_fingerprint"),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("case_feedback_case_idx").on(table.caseId, table.caseVersion, table.createdAt)]);

export const updates = sqliteTable("updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("product"),
  caseId: text("case_id"),
  targetJurisdictions: text("target_jurisdictions", { mode: "json" }).$type<string[]>().notNull().default([]),
  targetPracticeAreas: text("target_practice_areas", { mode: "json" }).$type<string[]>().notNull().default([]),
  targetRoles: text("target_roles", { mode: "json" }).$type<string[]>().notNull().default([]),
  publishedAt: text("published_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("updates_published_idx").on(table.publishedAt, table.expiresAt)]);

export const updateReads = sqliteTable("update_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  updateId: integer("update_id").notNull().references(() => updates.id),
  userEmail: text("user_email").notNull(),
  readAt: text("read_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("update_reads_update_user_uidx").on(table.updateId, table.userEmail)]);
