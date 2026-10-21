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
  productUpdates: integer("product_updates", { mode: "boolean" }).notNull().default(false),
  caseUpdates: integer("case_updates", { mode: "boolean" }).notNull().default(false),
  researchInvites: integer("research_invites", { mode: "boolean" }).notNull().default(false),
  communicationsConsentAt: text("communications_consent_at"),
  privacyNoticeVersion: text("privacy_notice_version").notNull().default("2026-08-21"),
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
  authorName: text("author_name").notNull().default("GENESIS: JURIS"),
  reviewerName: text("reviewer_name").notNull().default("Editorial review pending"),
  legalAsOf: text("legal_as_of"),
  summary: text("summary").notNull().default(""),
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
  studioFingerprint: text("studio_fingerprint"),
  parentCaseId: text("parent_case_id"),
  parentVersion: text("parent_version"),
  parentFingerprint: text("parent_fingerprint"),
  changeSummary: text("change_summary").notNull().default(""),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("case_versions_case_version_uidx").on(table.caseId, table.version),
  uniqueIndex("case_versions_parent_lineage_uidx").on(table.caseId, table.parentCaseId, table.parentVersion, table.parentFingerprint),
  uniqueIndex("case_versions_root_uidx").on(table.caseId).where(sql`${table.parentCaseId} is null`),
]);

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
  contextType: text("context_type").notNull().default("case"),
  contextId: text("context_id"),
  severity: text("severity").notNull().default("suggestion"),
  suggestedCorrection: text("suggested_correction").notNull().default(""),
  citationUrl: text("citation_url"),
  status: text("status").notNull().default("new"),
  moderatorNote: text("moderator_note").notNull().default(""),
  resolvedAt: text("resolved_at"),
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

export const caseDrafts = sqliteTable("case_drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  caseId: text("case_id").notNull(),
  version: text("version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  title: text("title").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("draft"),
  reviewerEmail: text("reviewer_email"),
  reviewerNote: text("reviewer_note").notNull().default(""),
  submittedAt: text("submitted_at"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("case_drafts_user_case_version_uidx").on(table.userEmail, table.caseId, table.version),
  index("case_drafts_status_idx").on(table.status, table.updatedAt),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorEmail: text("actor_email").notNull(),
  eventType: text("event_type").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_events_object_idx").on(table.objectType, table.objectId, table.createdAt)]);
