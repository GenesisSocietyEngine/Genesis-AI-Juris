import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  licenseTier: text("license_tier").notNull().default("community"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("users_email_uidx").on(table.email)]);

export const localAccounts = sqliteTable("local_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  passwordAlgorithm: text("password_algorithm").notNull().default("pbkdf2-hmac-sha256"),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordIterations: integer("password_iterations").notNull().default(600_000),
  status: text("status").notNull().default("active"),
  passwordChangedAt: text("password_changed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("local_accounts_user_email_uidx").on(table.userEmail),
  check("local_accounts_algorithm_check", sql`${table.passwordAlgorithm} = 'pbkdf2-hmac-sha256'`),
  check("local_accounts_iterations_check", sql`${table.passwordIterations} >= 600000`),
  check("local_accounts_status_check", sql`${table.status} in ('active', 'disabled')`),
]);

export const authSessions = sqliteTable("auth_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => localAccounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("auth_sessions_token_hash_uidx").on(table.tokenHash),
  index("auth_sessions_account_expiry_idx").on(table.accountId, table.expiresAt),
  index("auth_sessions_expiry_revoked_idx").on(table.expiresAt, table.revokedAt),
]);

export const accountRecoveryCodes = sqliteTable("account_recovery_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => localAccounts.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("account_recovery_codes_hash_uidx").on(table.codeHash),
  uniqueIndex("account_recovery_codes_active_account_uidx").on(table.accountId).where(sql`${table.usedAt} is null`),
  index("account_recovery_codes_account_created_idx").on(table.accountId, table.createdAt),
]);

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => localAccounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("password_reset_tokens_hash_uidx").on(table.tokenHash),
  index("password_reset_tokens_account_expiry_idx").on(table.accountId, table.expiresAt),
]);

export const authRateLimitEvents = sqliteTable("auth_rate_limit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scope: text("scope").notNull(),
  subjectHash: text("subject_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("auth_rate_limit_scope_subject_created_idx").on(table.scope, table.subjectHash, table.createdAt),
  index("auth_rate_limit_created_idx").on(table.createdAt),
]);

export const authAuditEvents = sqliteTable("auth_audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").references(() => localAccounts.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  subjectHash: text("subject_hash").notNull(),
  success: integer("success", { mode: "boolean" }).notNull().default(false),
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("auth_audit_event_created_idx").on(table.eventType, table.createdAt),
  index("auth_audit_account_created_idx").on(table.accountId, table.createdAt),
]);

export const platformSecrets = sqliteTable("platform_secrets", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  rotatedAt: text("rotated_at"),
});

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
  index("cases_status_title_idx").on(table.status, table.title),
]);

export const caseVersions = sqliteTable("case_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull().references(() => cases.id),
  sourceCustomCaseId: integer("source_custom_case_id").references(() => customCases.id, { onDelete: "set null" }),
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
  index("case_versions_source_custom_case_idx").on(table.sourceCustomCaseId),
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
  customCaseId: integer("custom_case_id").references(() => customCases.id),
  audience: text("audience").notNull().default("central"),
  status: text("status").notNull().default("new"),
  moderatorNote: text("moderator_note").notNull().default(""),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("case_feedback_case_idx").on(table.caseId, table.caseVersion, table.createdAt),
  index("case_feedback_custom_case_idx").on(table.customCaseId, table.createdAt),
  index("case_feedback_user_created_idx").on(table.userEmail, table.createdAt),
]);

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
}, (table) => [
  uniqueIndex("update_reads_update_user_uidx").on(table.updateId, table.userEmail),
  index("update_reads_user_update_idx").on(table.userEmail, table.updateId),
]);

export const customCases = sqliteTable("custom_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  caseId: text("case_id").notNull(),
  title: text("title").notNull(),
  currentVersion: text("current_version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("custom"),
  promotedAt: text("promoted_at"),
  promotedByEmail: text("promoted_by_email"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("custom_cases_owner_case_uidx").on(table.ownerEmail, table.caseId),
  index("custom_cases_visibility_idx").on(table.isPrivate, table.status, table.updatedAt),
]);

export const customCaseGrants = sqliteTable("custom_case_grants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customCaseId: integer("custom_case_id").notNull().references(() => customCases.id),
  recipientEmail: text("recipient_email").notNull(),
  grantedByEmail: text("granted_by_email").notNull(),
  canReshare: integer("can_reshare", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("custom_case_grants_case_recipient_uidx").on(table.customCaseId, table.recipientEmail),
  index("custom_case_grants_recipient_idx").on(table.recipientEmail, table.createdAt),
]);

export const caseDrafts = sqliteTable("case_drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customCaseId: integer("custom_case_id").references(() => customCases.id),
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
  index("case_drafts_custom_case_idx").on(table.customCaseId, table.updatedAt),
  index("case_drafts_custom_version_fingerprint_idx").on(table.customCaseId, table.version, table.fingerprint),
]);

export const playSessions = sqliteTable("play_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionKey: text("session_key").notNull(),
  userEmail: text("user_email").notNull(),
  caseId: text("case_id").notNull(),
  caseVersion: text("case_version").notNull(),
  caseFingerprint: text("case_fingerprint").notNull(),
  customCaseId: integer("custom_case_id").references(() => customCases.id, { onDelete: "set null" }),
  state: text("state", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("active"),
  revision: integer("revision").notNull().default(0),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastEventAt: text("last_event_at"),
  completedAt: text("completed_at"),
  expiresAt: text("expires_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("play_sessions_session_key_uidx").on(table.sessionKey),
  index("play_sessions_user_status_updated_idx").on(table.userEmail, table.status, table.updatedAt),
  index("play_sessions_case_version_idx").on(table.caseId, table.caseVersion, table.caseFingerprint, table.startedAt),
  index("play_sessions_custom_case_idx").on(table.customCaseId, table.updatedAt),
  check("play_sessions_status_check", sql`${table.status} in ('active', 'completed', 'abandoned', 'expired')`),
  check("play_sessions_revision_check", sql`${table.revision} >= 0`),
]);

export const playEvents = sqliteTable("play_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playSessionId: integer("play_session_id").notNull().references(() => playSessions.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull(),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("play_events_session_event_uidx").on(table.playSessionId, table.eventId),
  uniqueIndex("play_events_session_sequence_uidx").on(table.playSessionId, table.sequence),
  index("play_events_session_occurred_idx").on(table.playSessionId, table.occurredAt),
  check("play_events_sequence_check", sql`${table.sequence} >= 0`),
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
