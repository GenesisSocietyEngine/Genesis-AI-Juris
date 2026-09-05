import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// P1 validation workspaces. Confidential data planes still require the frozen
// per-tenant resource manifest and are never enabled by these shared-DB rows.
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("team"),
  status: text("status").notNull().default("active"),
  revision: integer("revision").notNull().default(1),
  createdByActorId: text("created_by_actor_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  check("organizations_status_check", sql`${t.status} in ('provisioning','active','suspended','closed')`),
  check("organizations_kind_check", sql`${t.kind} in ('personal','team')`),
  check("organizations_revision_check", sql`${t.revision} >= 1`),
]);

export const organizationMemberships = sqliteTable("organization_memberships", {
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  actorId: text("actor_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("organization_memberships_user_uidx").on(t.organizationId, t.userId),
  uniqueIndex("organization_memberships_actor_uidx").on(t.organizationId, t.actorId),
  foreignKey({ columns: [t.userId, t.actorId], foreignColumns: [users.id, users.actorId] }),
  check("organization_memberships_role_check", sql`${t.role} in ('org_owner','org_admin','member','auditor')`),
  check("organization_memberships_status_check", sql`${t.status} in ('active','suspended','removed')`),
  check("organization_memberships_revision_check", sql`${t.revision} >= 1`),
]);

// An immutable, total mapping preserves the already sealed dossier/audit rows.
// Every descendant has an existing composite dossier FK. The forward migration
// adds a deferred binding commitment, so even a new dossier cannot be unscoped.
export const dossierOrganizationBindings = sqliteTable("dossier_organization_bindings", {
  dossierId: text("dossier_id").primaryKey().references(() => dossiers.id),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  createdByActorId: text("created_by_actor_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("dossier_organization_bindings_scope_uidx").on(t.organizationId, t.dossierId)]);

export const dossierOrganizationCommitments = sqliteTable("dossier_organization_commitments", {
  dossierId: text("dossier_id").primaryKey().references(() => dossiers.id),
}, (t) => [foreignKey({ columns: [t.dossierId], foreignColumns: [dossierOrganizationBindings.dossierId] })]);
export const organizationCasGuards = sqliteTable("organization_cas_guards", {
  changed: integer("changed").notNull(),
}, (t) => [check("organization_cas_guards_check", sql`${t.changed}=1`)]);
export const organizationAuthorityChecks = sqliteTable("organization_authority_checks", {
  valid: integer("valid").notNull(),
}, (t) => [check("organization_authority_checks_check", sql`${t.valid}=1`)]);

export const organizationInvitations = sqliteTable("organization_invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  tokenDigest: text("token_digest").notNull(),
  recipientActorId: text("recipient_actor_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("pending"),
  invitedByActorId: text("invited_by_actor_id").notNull(),
  inviterRevision: integer("inviter_revision").notNull(),
  organizationRevision: integer("organization_revision").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("organization_invitations_digest_uidx").on(t.tokenDigest),
  check("organization_invitations_role_check", sql`${t.role} in ('org_admin','member','auditor')`),
  check("organization_invitations_status_check", sql`${t.status} in ('pending','accepted','revoked')`),
]);

export const organizationLifecycleRequests = sqliteTable("organization_lifecycle_requests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  command: text("command").notNull(),
  requestedByActorId: text("requested_by_actor_id").notNull(),
  requesterRevision: integer("requester_revision").notNull(),
  organizationRevision: integer("organization_revision").notNull(),
  status: text("status").notNull().default("pending"),
  approvedByActorId: text("approved_by_actor_id"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [check("organization_lifecycle_command_check", sql`${t.command} in ('suspend','resume','close')`)]);

export const organizationSecurityEvents = sqliteTable("organization_security_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  sequence: integer("sequence").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  organizationRevision: integer("organization_revision").notNull(),
  membershipRevision: integer("membership_revision").notNull(),
  previousDigest: text("previous_digest"),
  digest: text("digest").notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (t) => [uniqueIndex("organization_security_events_sequence_uidx").on(t.organizationId, t.sequence)]);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Stable opaque authority identifier for dossier contracts. Authentication
  // continues to use the existing account/session model.
  actorId: text("actor_id"),
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
}, (table) => [
  uniqueIndex("users_email_uidx").on(table.email),
  uniqueIndex("users_actor_id_uidx").on(table.actorId),
  uniqueIndex("users_actor_identity_uidx").on(table.id, table.actorId),
]);

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
  consumedBy: text("consumed_by"),
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
  consumedBy: text("consumed_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("password_reset_tokens_hash_uidx").on(table.tokenHash),
  uniqueIndex("password_reset_tokens_active_account_uidx").on(table.accountId).where(sql`${table.usedAt} is null`),
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

// Short-lived, tenant-wide leases bound concurrent provider calls. They never
// contain prompts, graph content or raw account identifiers; subjectHash is the
// same pseudonymous HMAC value used by the authentication audit trail.
export const studioAILeases = sqliteTable("studio_ai_leases", {
  id: text("id").primaryKey(),
  subjectHash: text("subject_hash").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("studio_ai_leases_expiry_idx").on(table.expiresAt),
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
  index("custom_cases_owner_updated_idx").on(table.ownerEmail, table.updatedAt, table.id),
  index("custom_cases_private_updated_idx").on(table.isPrivate, table.updatedAt, table.id),
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

// Short-lived operational telemetry. This table deliberately excludes user,
// session, case, event, fingerprint, URL, query and content identifiers. The
// random request UUID is retained only to correlate these coarse records with
// Cloudflare Worker logs during the 14-day operational window.
export const operationalEvents = sqliteTable("operational_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schema: text("schema").notNull(),
  occurredAt: text("occurred_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  requestId: text("request_id").notNull(),
  eventName: text("event_name").notNull(),
  route: text("route").notNull(),
  outcome: text("outcome").notNull(),
  reason: text("reason").notNull(),
  responseClass: text("response_class").notNull(),
  latencyMs: integer("latency_ms"),
  operation: text("operation"),
  logicalRepository: text("logical_repository"),
  commandCount: integer("command_count"),
  sampleWeight: integer("sample_weight").notNull().default(1),
  deploymentVersion: text("deployment_version").notNull(),
  webCommit: text("web_commit").notNull(),
  bundleRevision: integer("bundle_revision").notNull(),
  runtimeRevision: text("runtime_revision").notNull(),
  playedCaseSchemaRevision: integer("played_case_schema_revision").notNull(),
}, (table) => [
  index("operational_events_expiry_idx").on(table.expiresAt),
  index("operational_events_occurred_idx").on(table.occurredAt),
  index("operational_events_event_outcome_occurred_idx").on(table.eventName, table.outcome, table.occurredAt),
  index("operational_events_route_occurred_idx").on(table.route, table.occurredAt),
  check("operational_events_schema_check", sql`${table.schema} = 'genesis.juris.observability.v1'`),
  check("operational_events_request_id_check", sql`length(${table.requestId}) = 36 and lower(${table.requestId}) = ${table.requestId}`),
  check("operational_events_event_name_check", sql`${table.eventName} in ('replay.internal_failure','played_case.revision_mismatch','played_case.fingerprint_mismatch','historical_bundle.lookup_miss')`),
  check("operational_events_route_check", sql`${table.route} in ('play_sessions','admin')`),
  check("operational_events_outcome_check", sql`${table.outcome} in ('expected_rejection','internal_failure')`),
  check("operational_events_reason_check", sql`${table.reason} in ('stored_state_divergence','stored_revision_divergence','stored_fingerprint_divergence','runtime_exception','stale_client','requested_identity_mismatch','stored_identity_mismatch','canonical_source_mismatch','manifest_integrity','case_unavailable','version_unavailable','stored_version_unavailable')`),
  check("operational_events_response_class_check", sql`${table.responseClass} in ('none','2xx','3xx','4xx','5xx','exception')`),
  check("operational_events_latency_check", sql`${table.latencyMs} is null or (${table.latencyMs} >= 0 and ${table.latencyMs} <= 120000)`),
  check("operational_events_operation_check", sql`${table.operation} is null or ${table.operation} in ('request','read','insert','purge','start','decision','advance_time','abandon','import','load','save','replay')`),
  check("operational_events_repository_check", sql`${table.logicalRepository} is null or ${table.logicalRepository} in ('none','operational_events','play_sessions','play_events','cases','case_versions')`),
  check("operational_events_command_count_check", sql`${table.commandCount} is null or (${table.commandCount} >= 0 and ${table.commandCount} <= 1000)`),
  check("operational_events_sample_weight_check", sql`${table.sampleWeight} = 1`),
  check("operational_events_release_revision_check", sql`${table.bundleRevision} >= 0 and ${table.playedCaseSchemaRevision} >= 0`),
  check("operational_events_retention_check", sql`unixepoch(${table.expiresAt}) is not null and unixepoch(${table.occurredAt}) is not null and unixepoch(${table.expiresAt}) - unixepoch(${table.occurredAt}) = 1209600`),
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

// Decision-centric dossier persistence is additive and remains feature-off until
// its routes, private DOSSIER_DOCUMENTS R2 binding, and authorization gates ship.
// D1 stores governed metadata and abstract object references only—never bytes.
export const dossiers = sqliteTable("dossiers", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  title: text("title").notNull(),
  dossierTypeRegistry: text("dossier_type_registry").notNull(),
  dossierTypeId: text("dossier_type_id").notNull(),
  dossierTypeVersion: text("dossier_type_version").notNull(),
  terminology: text("terminology").notNull().default("matter"),
  ownerUserId: integer("owner_user_id").notNull().references(() => users.id),
  ownerActorId: text("owner_actor_id").notNull(),
  // Reserved only for a future real organisation-membership model. It is not
  // populated from users.organisation, an email domain, or deployment context.
  organisationId: text("organisation_id"),
  jurisdictions: text("jurisdictions", { mode: "json" }).$type<string[]>().notNull(),
  classification: text("classification").notNull().default("confidential"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("draft"),
  statusReason: text("status_reason"),
  keyDeadlineAt: text("key_deadline_at"),
  keyDeadlineTimezone: text("key_deadline_timezone"),
  revision: integer("revision").notNull().default(1),
  closedAt: text("closed_at"),
  closedByActorRef: text("closed_by_actor_ref"),
  closureReason: text("closure_reason"),
  archivedAt: text("archived_at"),
  archivedByActorRef: text("archived_by_actor_ref"),
  archiveReason: text("archive_reason"),
  archiveAdminOverride: integer("archive_admin_override", { mode: "boolean" }).notNull().default(false),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossiers_reference_uidx").on(table.reference),
  uniqueIndex("dossiers_revision_status_uidx").on(table.id, table.revision, table.status),
  index("dossiers_owner_status_updated_idx").on(table.ownerUserId, table.status, table.updatedAt),
  index("dossiers_status_deadline_idx").on(table.status, table.keyDeadlineAt),
  foreignKey({ name: "dossiers_owner_actor_fk", columns: [table.ownerUserId, table.ownerActorId], foreignColumns: [users.id, users.actorId] }),
  check("dossiers_terminology_check", sql`${table.terminology} in ('matter','dossier','engagement','case')`),
  check("dossiers_no_fake_organisation_check", sql`${table.organisationId} is null`),
  check("dossiers_classification_check", sql`${table.classification} in ('public','internal','confidential','strictly_confidential')`),
  check("dossiers_priority_check", sql`${table.priority} in ('low','normal','high','urgent')`),
  check("dossiers_status_check", sql`${table.status} in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')`),
  check("dossiers_revision_check", sql`${table.revision} >= 1`),
  check("dossiers_deadline_pair_check", sql`(${table.keyDeadlineAt} is null) = (${table.keyDeadlineTimezone} is null)`),
  check("dossiers_jurisdictions_check", sql`json_valid(${table.jurisdictions}) and json_type(${table.jurisdictions}) = 'array' and json_array_length(${table.jurisdictions}) between 1 and 20`),
  check("dossiers_closure_check", sql`${table.status} <> 'closed' or (${table.closedAt} is not null and ${table.closedByActorRef} is not null and ${table.closureReason} is not null)`),
  check("dossiers_archive_check", sql`${table.status} <> 'archived' or (${table.archivedAt} is not null and ${table.archivedByActorRef} is not null and ${table.archiveReason} is not null)`),
]);

export const dossierParticipants = sqliteTable("dossier_participants", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  userId: integer("user_id").notNull().references(() => users.id),
  actorId: text("actor_id").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_participants_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_participants_authority_uidx").on(table.dossierId, table.id, table.userId, table.actorId),
  uniqueIndex("dossier_participants_user_uidx").on(table.dossierId, table.userId),
  uniqueIndex("dossier_participants_active_owner_uidx").on(table.dossierId).where(sql`${table.role} = 'owner' and ${table.status} = 'active'`),
  index("dossier_participants_user_status_idx").on(table.userId, table.status, table.dossierId),
  index("dossier_participants_dossier_role_idx").on(table.dossierId, table.role, table.status),
  foreignKey({ name: "dossier_participants_actor_fk", columns: [table.userId, table.actorId], foreignColumns: [users.id, users.actorId] }),
  check("dossier_participants_role_check", sql`${table.role} in ('owner','contributor','reviewer','viewer')`),
  check("dossier_participants_status_check", sql`${table.status} in ('active','removed')`),
]);

export const dossierStatusTransitions = sqliteTable("dossier_status_transitions", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  revisionBefore: integer("revision_before").notNull(),
  revisionAfter: integer("revision_after").notNull(),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  approvedOutputId: text("approved_output_id"),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorRef: text("actor_ref").notNull(),
  actorRole: text("actor_role").notNull(),
  occurredAt: text("occurred_at").notNull(),
  reason: text("reason"),
  comment: text("comment"),
  platformAdminOverride: integer("platform_admin_override", { mode: "boolean" }).notNull().default(false),
  hadCurrentOutput: integer("had_current_output", { mode: "boolean" }).notNull().default(false),
  hadReviewerApproval: integer("had_reviewer_approval", { mode: "boolean" }).notNull().default(false),
  consequences: text("consequences", { mode: "json" }).$type<string[]>().notNull().default([]),
}, (table) => [
  uniqueIndex("dossier_status_transitions_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_status_transitions_revision_uidx").on(table.dossierId, table.revisionAfter),
  index("dossier_status_transitions_dossier_occurred_idx").on(table.dossierId, table.occurredAt),
  index("dossier_status_transitions_approved_output_idx").on(table.dossierId, table.approvedOutputId, table.revisionAfter),
  foreignKey({ name: "dossier_status_transitions_approved_output_fk", columns: [table.dossierId, table.approvedOutputId], foreignColumns: [dossierGovernedOutputs.dossierId, dossierGovernedOutputs.id] }),
  // A transition is immutable history; it cannot reference the dossier's
  // mutable current revision/status tuple. Exact pre-recording and application
  // are instead paired by the transition/dossier guards in the SQL migration.
  check("dossier_status_transitions_revision_check", sql`${table.revisionBefore} >= 1 and ${table.revisionAfter} = ${table.revisionBefore} + 1`),
  check("dossier_status_transitions_previous_check", sql`${table.previousStatus} in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')`),
  check("dossier_status_transitions_new_check", sql`${table.newStatus} in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')`),
  check("dossier_status_transitions_approved_output_check", sql`(${table.newStatus} = 'output_approved') = (${table.approvedOutputId} is not null)`),
  check("dossier_status_transitions_role_check", sql`${table.actorRole} in ('owner','contributor','reviewer','viewer','platform_admin')`),
]);

// A transition first creates a deferred commitment. The certification is
// emitted only by the exact dossier status application, so a transaction that
// records history without applying it cannot commit.
export const dossierStatusApplicationCertifications = sqliteTable("dossier_status_application_certifications", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  transitionId: text("transition_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_status_application_certifications_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_status_application_certifications_transition_uidx").on(table.dossierId, table.transitionId),
  index("dossier_status_application_certifications_created_idx").on(table.dossierId, table.createdAt),
  foreignKey({
    name: "dossier_status_application_certifications_transition_fk",
    columns: [table.dossierId, table.transitionId],
    foreignColumns: [dossierStatusTransitions.dossierId, dossierStatusTransitions.id],
  }),
]);

// The certification foreign key is DEFERRABLE INITIALLY DEFERRED in SQL so the
// canonical writer may record transition, apply status, audit, and receipt in
// one atomic transaction while any omitted application fails at COMMIT.
export const dossierStatusApplicationCommitments = sqliteTable("dossier_status_application_commitments", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  transitionId: text("transition_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_status_application_commitments_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_status_application_commitments_transition_uidx").on(table.dossierId, table.transitionId),
  index("dossier_status_application_commitments_created_idx").on(table.dossierId, table.createdAt),
  foreignKey({
    name: "dossier_status_application_commitments_transition_fk",
    columns: [table.dossierId, table.transitionId],
    foreignColumns: [dossierStatusTransitions.dossierId, dossierStatusTransitions.id],
  }),
  foreignKey({
    name: "dossier_status_application_commitments_certification_fk",
    columns: [table.dossierId, table.transitionId],
    foreignColumns: [dossierStatusApplicationCertifications.dossierId, dossierStatusApplicationCertifications.transitionId],
  }),
]);

export const dossierDocuments = sqliteTable("dossier_documents", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  sourceOrigin: text("source_origin").notNull(),
  // Every logical document begins as a non-exportable assembly row. It becomes
  // governed only when its contract-complete current-version binding exists.
  isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
  classification: text("classification").notNull(),
  status: text("status").notNull().default("received"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  externalSystemReference: text("external_system_reference"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_documents_scope_uidx").on(table.dossierId, table.id),
  index("dossier_documents_dossier_status_updated_idx").on(table.dossierId, table.status, table.updatedAt),
  index("dossier_documents_provisional_created_idx").on(table.dossierId, table.isProvisional, table.createdAt),
  check("dossier_documents_origin_check", sql`${table.sourceOrigin} in ('internal_upload','external_reference','import')`),
  check("dossier_documents_provisional_check", sql`${table.isProvisional} in (false, true)`),
  check("dossier_documents_classification_check", sql`${table.classification} in ('public','internal','confidential','strictly_confidential')`),
  check("dossier_documents_status_check", sql`${table.status} in ('received','under_review','accepted_source','superseded','rejected')`),
]);

export const dossierUploadIntents = sqliteTable("dossier_upload_intents", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorRef: text("actor_ref").notNull(),
  idempotencyKeyHash: text("idempotency_key_hash").notNull(),
  requestBindingDigest: text("request_binding_digest").notNull(),
  expectedDossierRevision: integer("expected_dossier_revision").notNull(),
  temporaryObjectReference: text("temporary_object_reference").notNull(),
  committedObjectReference: text("committed_object_reference"),
  expectedMediaType: text("expected_media_type").notNull(),
  expectedByteLength: integer("expected_byte_length").notNull(),
  expectedContentSha256: text("expected_content_sha256"),
  measuredMediaType: text("measured_media_type"),
  measuredByteLength: integer("measured_byte_length"),
  measuredContentSha256: text("measured_content_sha256"),
  state: text("state").notNull().default("pending"),
  failureCode: text("failure_code"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  committedAt: text("committed_at"),
}, (table) => [
  uniqueIndex("dossier_upload_intents_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_upload_intents_state_scope_uidx").on(table.dossierId, table.id, table.state),
  uniqueIndex("dossier_upload_intents_idempotency_uidx").on(table.dossierId, table.actorRef, table.idempotencyKeyHash),
  uniqueIndex("dossier_upload_intents_temporary_object_uidx").on(table.temporaryObjectReference),
  index("dossier_upload_intents_cleanup_idx").on(table.state, table.expiresAt),
  index("dossier_upload_intents_document_created_idx").on(table.dossierId, table.documentId, table.createdAt),
  foreignKey({ name: "dossier_upload_intents_document_fk", columns: [table.dossierId, table.documentId], foreignColumns: [dossierDocuments.dossierId, dossierDocuments.id] }).onDelete("cascade"),
  check("dossier_upload_intents_revision_check", sql`${table.expectedDossierRevision} >= 1`),
  check("dossier_upload_intents_media_check", sql`${table.expectedMediaType} in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown')`),
  check("dossier_upload_intents_size_check", sql`${table.expectedByteLength} between 1 and 100000000`),
  check("dossier_upload_intents_state_check", sql`${table.state} in ('pending','expired','committed','deleting','deleted')`),
  check("dossier_upload_intents_idempotency_hash_check", sql`length(${table.idempotencyKeyHash}) = 71 and substr(${table.idempotencyKeyHash}, 1, 7) = 'sha256-' and substr(${table.idempotencyKeyHash}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_upload_intents_request_binding_check", sql`length(${table.requestBindingDigest}) = 71 and substr(${table.requestBindingDigest}, 1, 7) = 'sha256-' and substr(${table.requestBindingDigest}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_upload_intents_hash_check", sql`${table.expectedContentSha256} is null or (length(${table.expectedContentSha256}) = 71 and substr(${table.expectedContentSha256}, 1, 7) = 'sha256-' and substr(${table.expectedContentSha256}, 8) not glob '*[^0-9a-f]*')`),
  check("dossier_upload_intents_measured_check", sql`(${table.measuredMediaType} is null and ${table.measuredByteLength} is null and ${table.measuredContentSha256} is null) or (${table.measuredMediaType} in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown') and ${table.measuredByteLength} between 1 and 100000000 and length(${table.measuredContentSha256}) = 71 and substr(${table.measuredContentSha256}, 1, 7) = 'sha256-' and substr(${table.measuredContentSha256}, 8) not glob '*[^0-9a-f]*')`),
  check("dossier_upload_intents_failure_code_check", sql`${table.failureCode} is null or (length(${table.failureCode}) between 1 and 100 and ${table.failureCode} not glob '*[^A-Z0-9_]*')`),
]);

export const dossierDocumentVersions = sqliteTable("dossier_document_versions", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  binaryObjectReference: text("binary_object_reference").notNull(),
  originalFilename: text("original_filename").notNull(),
  mediaType: text("media_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  contentSha256: text("content_sha256").notNull(),
  uploaderUserId: integer("uploader_user_id").references(() => users.id, { onDelete: "set null" }),
  uploaderActorRef: text("uploader_actor_ref").notNull(),
  uploadIntentId: text("upload_intent_id"),
  uploadedAt: text("uploaded_at").notNull(),
  predecessorVersionId: text("predecessor_version_id"),
  sourceNote: text("source_note"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_document_versions_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_document_versions_document_scope_uidx").on(table.dossierId, table.documentId, table.id),
  uniqueIndex("dossier_document_versions_snapshot_binding_uidx").on(table.dossierId, table.documentId, table.id, table.contentSha256),
  uniqueIndex("dossier_document_versions_ordinal_uidx").on(table.dossierId, table.documentId, table.ordinal),
  uniqueIndex("dossier_document_versions_object_uidx").on(table.binaryObjectReference),
  index("dossier_document_versions_document_uploaded_idx").on(table.dossierId, table.documentId, table.uploadedAt),
  index("dossier_document_versions_hash_idx").on(table.contentSha256),
  foreignKey({ name: "dossier_document_versions_document_fk", columns: [table.dossierId, table.documentId], foreignColumns: [dossierDocuments.dossierId, dossierDocuments.id] }),
  foreignKey({ name: "dossier_document_versions_predecessor_fk", columns: [table.dossierId, table.documentId, table.predecessorVersionId], foreignColumns: [table.dossierId, table.documentId, table.id] }),
  foreignKey({ name: "dossier_document_versions_upload_intent_fk", columns: [table.dossierId, table.uploadIntentId], foreignColumns: [dossierUploadIntents.dossierId, dossierUploadIntents.id] }),
  check("dossier_document_versions_ordinal_check", sql`${table.ordinal} >= 1`),
  check("dossier_document_versions_media_check", sql`${table.mediaType} in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown')`),
  check("dossier_document_versions_size_check", sql`${table.byteLength} between 1 and 100000000`),
  check("dossier_document_versions_hash_check", sql`length(${table.contentSha256}) = 71 and substr(${table.contentSha256}, 1, 7) = 'sha256-' and substr(${table.contentSha256}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_document_versions_predecessor_check", sql`(${table.ordinal} = 1 and ${table.predecessorVersionId} is null) or (${table.ordinal} > 1 and ${table.predecessorVersionId} is not null)`),
]);

export const dossierUploadVersionCommitments = sqliteTable("dossier_upload_version_commitments", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentVersionId: text("document_version_id").notNull(),
  uploadIntentId: text("upload_intent_id").notNull(),
  requiredState: text("required_state").notNull().default("committed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_upload_version_commitments_version_uidx").on(table.dossierId, table.documentVersionId),
  index("dossier_upload_version_commitments_intent_idx").on(table.dossierId, table.uploadIntentId),
  foreignKey({
    name: "dossier_upload_version_commitments_version_fk",
    columns: [table.dossierId, table.documentVersionId],
    foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.id],
  }),
  foreignKey({
    name: "dossier_upload_version_commitments_intent_state_fk",
    columns: [table.dossierId, table.uploadIntentId, table.requiredState],
    foreignColumns: [dossierUploadIntents.dossierId, dossierUploadIntents.id, dossierUploadIntents.state],
  }),
  check("dossier_upload_version_commitments_state_check", sql`${table.requiredState} = 'committed'`),
]);

// The mutable current pointer is separate from immutable version metadata, which
// also avoids a cyclic document/version definition in Drizzle.
export const dossierDocumentCurrentVersions = sqliteTable("dossier_document_current_versions", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
}, (table) => [
  uniqueIndex("dossier_document_current_versions_document_uidx").on(table.dossierId, table.documentId),
  uniqueIndex("dossier_document_current_versions_version_uidx").on(table.dossierId, table.documentId, table.documentVersionId),
  foreignKey({ name: "dossier_document_current_versions_document_fk", columns: [table.dossierId, table.documentId], foreignColumns: [dossierDocuments.dossierId, dossierDocuments.id] }),
  foreignKey({ name: "dossier_document_current_versions_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
]);

export const dossierExtractionJobs = sqliteTable("dossier_extraction_jobs", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  status: text("status").notNull().default("queued"),
  extractorVersion: text("extractor_version").notNull(),
  attempt: integer("attempt").notNull().default(1),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: text("lease_expires_at"),
  errorCode: text("error_code"),
  errorDetailCode: text("error_detail_code"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("dossier_extraction_jobs_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_extraction_jobs_attempt_uidx").on(table.dossierId, table.documentVersionId, table.extractorVersion, table.attempt),
  index("dossier_extraction_jobs_status_lease_idx").on(table.status, table.leaseExpiresAt),
  index("dossier_extraction_jobs_version_created_idx").on(table.dossierId, table.documentVersionId, table.createdAt),
  foreignKey({ name: "dossier_extraction_jobs_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
  check("dossier_extraction_jobs_status_check", sql`${table.status} in ('queued','processing','ready','failed','not_extractable')`),
  check("dossier_extraction_jobs_attempt_check", sql`${table.attempt} >= 1 and ${table.attempt} <= 10`),
  check("dossier_extraction_jobs_error_check", sql`${table.errorCode} is null or ${table.errorCode} in ('unsupported_type','image_only','active_content','malformed','size_limit','internal_error')`),
  check("dossier_extraction_jobs_lease_pair_check", sql`(${table.leaseOwner} is null) = (${table.leaseExpiresAt} is null)`),
]);

export const dossierExtractionResults = sqliteTable("dossier_extraction_results", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  extractionJobId: text("extraction_job_id").notNull(),
  extractorVersion: text("extractor_version").notNull(),
  extractedTextObjectReference: text("extracted_text_object_reference").notNull(),
  extractedTextSha256: text("extracted_text_sha256").notNull(),
  extractedTextByteLength: integer("extracted_text_byte_length").notNull(),
  characterCount: integer("character_count").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_extraction_results_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_extraction_results_version_extractor_uidx").on(table.dossierId, table.documentVersionId, table.extractorVersion),
  uniqueIndex("dossier_extraction_results_job_uidx").on(table.dossierId, table.extractionJobId),
  uniqueIndex("dossier_extraction_results_object_uidx").on(table.extractedTextObjectReference),
  index("dossier_extraction_results_version_created_idx").on(table.dossierId, table.documentVersionId, table.createdAt),
  foreignKey({ name: "dossier_extraction_results_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
  foreignKey({ name: "dossier_extraction_results_job_fk", columns: [table.dossierId, table.extractionJobId], foreignColumns: [dossierExtractionJobs.dossierId, dossierExtractionJobs.id] }),
  check("dossier_extraction_results_hash_check", sql`length(${table.extractedTextSha256}) = 71 and substr(${table.extractedTextSha256}, 1, 7) = 'sha256-' and substr(${table.extractedTextSha256}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_extraction_results_bounds_check", sql`${table.extractedTextByteLength} between 0 and 100000000 and ${table.characterCount} between 0 and 100000000`),
]);

export const dossierExtractionPageMaps = sqliteTable("dossier_extraction_page_maps", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  extractionResultId: text("extraction_result_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  sectionId: text("section_id"),
  heading: text("heading"),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  checksum: text("checksum").notNull(),
}, (table) => [
  uniqueIndex("dossier_extraction_page_maps_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_extraction_page_maps_range_uidx").on(table.dossierId, table.extractionResultId, table.pageNumber, table.startOffset, table.endOffset),
  index("dossier_extraction_page_maps_version_page_idx").on(table.dossierId, table.documentVersionId, table.pageNumber),
  foreignKey({ name: "dossier_extraction_page_maps_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
  foreignKey({ name: "dossier_extraction_page_maps_result_fk", columns: [table.dossierId, table.extractionResultId], foreignColumns: [dossierExtractionResults.dossierId, dossierExtractionResults.id] }),
  check("dossier_extraction_page_maps_page_check", sql`${table.pageNumber} >= 1`),
  check("dossier_extraction_page_maps_offsets_check", sql`${table.startOffset} >= 0 and ${table.endOffset} >= ${table.startOffset}`),
  check("dossier_extraction_page_maps_checksum_check", sql`length(${table.checksum}) = 71 and substr(${table.checksum}, 1, 7) = 'sha256-' and substr(${table.checksum}, 8) not glob '*[^0-9a-f]*'`),
]);

export const dossierSourceAnchors = sqliteTable("dossier_source_anchors", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  pageNumber: integer("page_number"),
  section: text("section"),
  heading: text("heading"),
  paragraph: text("paragraph"),
  characterStart: integer("character_start"),
  characterEnd: integer("character_end"),
  excerpt: text("excerpt"),
  anchorChecksum: text("anchor_checksum").notNull(),
  extractionVersion: text("extraction_version"),
  creator: text("creator").notNull(),
  reviewState: text("review_state").notNull().default("pending"),
  reviewerUserId: integer("reviewer_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewerActorRef: text("reviewer_actor_ref"),
  reviewedAt: text("reviewed_at"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_source_anchors_scope_uidx").on(table.dossierId, table.id),
  index("dossier_source_anchors_version_review_idx").on(table.dossierId, table.documentVersionId, table.reviewState),
  index("dossier_source_anchors_dossier_created_idx").on(table.dossierId, table.createdAt),
  foreignKey({ name: "dossier_source_anchors_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
  foreignKey({ name: "dossier_source_anchors_extraction_fk", columns: [table.dossierId, table.documentVersionId, table.extractionVersion], foreignColumns: [dossierExtractionResults.dossierId, dossierExtractionResults.documentVersionId, dossierExtractionResults.extractorVersion] }),
  foreignKey({ name: "dossier_source_anchors_reviewer_actor_fk", columns: [table.reviewerUserId, table.reviewerActorRef], foreignColumns: [users.id, users.actorId] }),
  check("dossier_source_anchors_page_check", sql`${table.pageNumber} is null or ${table.pageNumber} >= 1`),
  check("dossier_source_anchors_character_pair_check", sql`(${table.characterStart} is null and ${table.characterEnd} is null) or (${table.characterStart} >= 0 and ${table.characterEnd} >= ${table.characterStart})`),
  check("dossier_source_anchors_checksum_check", sql`length(${table.anchorChecksum}) = 71 and substr(${table.anchorChecksum}, 1, 7) = 'sha256-' and substr(${table.anchorChecksum}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_source_anchors_creator_check", sql`${table.creator} in ('human','ai_proposal','import')`),
  check("dossier_source_anchors_review_check", sql`${table.reviewState} in ('pending','accepted','rejected','superseded')`),
  check("dossier_source_anchors_reviewer_pair_check", sql`((${table.reviewState} in ('accepted','rejected')) = (${table.reviewerUserId} is not null and ${table.reviewerActorRef} is not null and ${table.reviewedAt} is not null))`),
]);

export const dossierProfessionalAssertions = sqliteTable("dossier_professional_assertions", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  assertionType: text("assertion_type").notNull(),
  statement: text("statement").notNull(),
  status: text("status").notNull().default("needs_review"),
  originatingProposalId: text("originating_proposal_id"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedByActorRef: text("reviewed_by_actor_ref"),
  reviewedAt: text("reviewed_at"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_professional_assertions_scope_uidx").on(table.dossierId, table.id),
  index("dossier_professional_assertions_status_updated_idx").on(table.dossierId, table.status, table.updatedAt),
  foreignKey({ name: "dossier_professional_assertions_proposal_fk", columns: [table.dossierId, table.originatingProposalId], foreignColumns: [dossierAIProposals.dossierId, dossierAIProposals.id] }),
  foreignKey({ name: "dossier_professional_assertions_reviewer_actor_fk", columns: [table.reviewedByUserId, table.reviewedByActorRef], foreignColumns: [users.id, users.actorId] }),
  check("dossier_professional_assertions_type_check", sql`${table.assertionType} in ('fact','evidence','rule','assumption','date','contradiction')`),
  check("dossier_professional_assertions_status_check", sql`${table.status} in ('accepted','needs_review','rejected','superseded')`),
  check("dossier_professional_assertions_reviewer_pair_check", sql`(${table.status} <> 'needs_review') or (${table.reviewedByUserId} is null and ${table.reviewedByActorRef} is null and ${table.reviewedAt} is null)`),
]);

export const dossierAssertionSources = sqliteTable("dossier_assertion_sources", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  assertionId: text("assertion_id").notNull(),
  sourceAnchorId: text("source_anchor_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_assertion_sources_uidx").on(table.dossierId, table.assertionId, table.sourceAnchorId),
  index("dossier_assertion_sources_anchor_idx").on(table.dossierId, table.sourceAnchorId, table.assertionId),
  foreignKey({ name: "dossier_assertion_sources_assertion_fk", columns: [table.dossierId, table.assertionId], foreignColumns: [dossierProfessionalAssertions.dossierId, dossierProfessionalAssertions.id] }),
  foreignKey({ name: "dossier_assertion_sources_anchor_fk", columns: [table.dossierId, table.sourceAnchorId], foreignColumns: [dossierSourceAnchors.dossierId, dossierSourceAnchors.id] }),
]);

export const dossierEvidenceLinks = sqliteTable("dossier_evidence_links", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  sourceAnchorId: text("source_anchor_id").notNull(),
  assertionId: text("assertion_id"),
  decisionPackageReferenceId: text("decision_package_reference_id"),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  relation: text("relation").notNull(),
  professionalMeaning: text("professional_meaning").notNull(),
  originatingProposalId: text("originating_proposal_id"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  reviewedByUserId: integer("reviewed_by_user_id").notNull().references(() => users.id),
  reviewedByActorRef: text("reviewed_by_actor_ref").notNull(),
  reviewedAt: text("reviewed_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_evidence_links_scope_uidx").on(table.dossierId, table.id),
  index("dossier_evidence_links_target_idx").on(table.dossierId, table.targetType, table.targetId),
  index("dossier_evidence_links_package_target_idx").on(table.dossierId, table.decisionPackageReferenceId, table.targetType, table.targetId),
  index("dossier_evidence_links_anchor_idx").on(table.dossierId, table.sourceAnchorId),
  foreignKey({ name: "dossier_evidence_links_anchor_fk", columns: [table.dossierId, table.sourceAnchorId], foreignColumns: [dossierSourceAnchors.dossierId, dossierSourceAnchors.id] }),
  foreignKey({ name: "dossier_evidence_links_assertion_fk", columns: [table.dossierId, table.assertionId], foreignColumns: [dossierProfessionalAssertions.dossierId, dossierProfessionalAssertions.id] }),
  foreignKey({ name: "dossier_evidence_links_package_fk", columns: [table.dossierId, table.decisionPackageReferenceId], foreignColumns: [dossierDecisionPackageReferences.dossierId, dossierDecisionPackageReferences.id] }),
  foreignKey({ name: "dossier_evidence_links_reviewer_actor_fk", columns: [table.reviewedByUserId, table.reviewedByActorRef], foreignColumns: [users.id, users.actorId] }),
  check("dossier_evidence_links_target_check", sql`${table.targetType} in ('professional_assertion','authority_rule','graph_node','graph_edge','parameter_assumption','deadline','report_section')`),
  check("dossier_evidence_links_graph_package_check", sql`((${table.targetType} in ('graph_node','graph_edge')) and ${table.decisionPackageReferenceId} is not null) or ((${table.targetType} not in ('graph_node','graph_edge')) and ${table.decisionPackageReferenceId} is null)`),
  check("dossier_evidence_links_relation_check", sql`${table.relation} in ('supports','contradicts','qualifies','supersedes','source_for')`),
]);

export const dossierInformationRequests = sqliteTable("dossier_information_requests", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  question: text("question").notNull(),
  ownerUserId: integer("owner_user_id").notNull().references(() => users.id),
  ownerActorRef: text("owner_actor_ref").notNull(),
  requestedFromParticipantId: text("requested_from_participant_id"),
  priority: text("priority").notNull().default("normal"),
  dueAt: text("due_at"),
  timezone: text("timezone"),
  status: text("status").notNull().default("open"),
  reason: text("reason").notNull(),
  readinessReasonCode: text("readiness_reason_code").notNull(),
  satisfyingDocumentId: text("satisfying_document_id"),
  satisfyingEvidenceLinkId: text("satisfying_evidence_link_id"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_information_requests_scope_uidx").on(table.dossierId, table.id),
  index("dossier_information_requests_status_due_idx").on(table.dossierId, table.status, table.dueAt),
  foreignKey({ name: "dossier_information_requests_participant_fk", columns: [table.dossierId, table.requestedFromParticipantId], foreignColumns: [dossierParticipants.dossierId, dossierParticipants.id] }),
  foreignKey({ name: "dossier_information_requests_document_fk", columns: [table.dossierId, table.satisfyingDocumentId], foreignColumns: [dossierDocuments.dossierId, dossierDocuments.id] }),
  foreignKey({ name: "dossier_information_requests_evidence_fk", columns: [table.dossierId, table.satisfyingEvidenceLinkId], foreignColumns: [dossierEvidenceLinks.dossierId, dossierEvidenceLinks.id] }),
  foreignKey({ name: "dossier_information_requests_owner_actor_fk", columns: [table.ownerUserId, table.ownerActorRef], foreignColumns: [users.id, users.actorId] }),
  check("dossier_information_requests_priority_check", sql`${table.priority} in ('low','normal','high','urgent')`),
  check("dossier_information_requests_status_check", sql`${table.status} in ('open','received','waived','cancelled')`),
  check("dossier_information_requests_due_pair_check", sql`(${table.dueAt} is null) = (${table.timezone} is null)`),
  check("dossier_information_requests_reason_code_check", sql`${table.readinessReasonCode} in ('INFORMATION_REQUEST_OPEN','INFORMATION_REQUEST_OVERDUE')`),
  check("dossier_information_requests_received_check", sql`${table.status} <> 'received' or ${table.satisfyingDocumentId} is not null or ${table.satisfyingEvidenceLinkId} is not null`),
]);

export const dossierDecisionPackageReferences = sqliteTable("dossier_decision_package_references", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  packageId: text("package_id").notNull(),
  packageVersion: text("package_version").notNull(),
  packageFingerprint: text("package_fingerprint").notNull(),
  parentPackageId: text("parent_package_id"),
  parentPackageVersion: text("parent_package_version"),
  parentPackageFingerprint: text("parent_package_fingerprint"),
  sourceSnapshotId: text("source_snapshot_id"),
  sourceDossierRevision: integer("source_dossier_revision").notNull(),
  state: text("state").notNull().default("current"),
  graphValidationStatus: text("graph_validation_status").notNull().default("not_run"),
  graphDigest: text("graph_digest").notNull(),
  simulationRunReferences: text("simulation_run_references", { mode: "json" }).$type<string[]>().notNull().default([]),
  approvalState: text("approval_state").notNull().default("draft"),
  packageTypeRegistry: text("package_type_registry").notNull(),
  packageTypeId: text("package_type_id").notNull(),
  packageTypeVersion: text("package_type_version").notNull(),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_decision_packages_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_decision_packages_version_uidx").on(table.dossierId, table.packageId, table.packageVersion, table.packageFingerprint),
  index("dossier_decision_packages_state_updated_idx").on(table.dossierId, table.state, table.updatedAt),
  foreignKey({ name: "dossier_decision_packages_snapshot_fk", columns: [table.dossierId, table.sourceSnapshotId], foreignColumns: [dossierSnapshots.dossierId, dossierSnapshots.id] }),
  check("dossier_decision_packages_revision_check", sql`${table.sourceDossierRevision} >= 1`),
  check("dossier_decision_packages_state_check", sql`${table.state} in ('current','stale')`),
  check("dossier_decision_packages_graph_status_check", sql`${table.graphValidationStatus} in ('not_run','valid','invalid')`),
  check("dossier_decision_packages_approval_check", sql`${table.approvalState} in ('draft','reviewed','approved','published')`),
  check("dossier_decision_packages_fingerprint_check", sql`length(${table.packageFingerprint}) = 71 and substr(${table.packageFingerprint}, 1, 7) = 'sha256-' and substr(${table.packageFingerprint}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_decision_packages_parent_fingerprint_check", sql`${table.parentPackageFingerprint} is null or (length(${table.parentPackageFingerprint}) = 71 and substr(${table.parentPackageFingerprint}, 1, 7) = 'sha256-' and substr(${table.parentPackageFingerprint}, 8) not glob '*[^0-9a-f]*')`),
  check("dossier_decision_packages_parent_tuple_check", sql`(${table.parentPackageId} is null and ${table.parentPackageVersion} is null and ${table.parentPackageFingerprint} is null) or (${table.parentPackageId} is not null and ${table.parentPackageVersion} is not null and ${table.parentPackageFingerprint} is not null)`),
  check("dossier_decision_packages_graph_digest_check", sql`length(${table.graphDigest}) = 71 and substr(${table.graphDigest}, 1, 7) = 'sha256-' and substr(${table.graphDigest}, 8) not glob '*[^0-9a-f]*'`),
]);

export const dossierDeadlineReferences = sqliteTable("dossier_deadline_references", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  deadlineKind: text("deadline_kind").notNull(),
  title: text("title").notNull(),
  dueAt: text("due_at").notNull(),
  timezone: text("timezone").notNull(),
  critical: integer("critical", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("open"),
  decisionPackageReferenceId: text("decision_package_reference_id"),
  simulationDeadlineId: text("simulation_deadline_id"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  updatedByActorRef: text("updated_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_deadline_references_scope_uidx").on(table.dossierId, table.id),
  index("dossier_deadline_references_status_due_idx").on(table.dossierId, table.status, table.dueAt),
  foreignKey({ name: "dossier_deadline_references_package_fk", columns: [table.dossierId, table.decisionPackageReferenceId], foreignColumns: [dossierDecisionPackageReferences.dossierId, dossierDecisionPackageReferences.id] }),
  check("dossier_deadline_references_kind_check", sql`${table.deadlineKind} in ('workspace','projected_simulation')`),
  check("dossier_deadline_references_status_check", sql`${table.status} in ('open','completed','waived','cancelled')`),
  check("dossier_deadline_references_projection_check", sql`(${table.deadlineKind} = 'workspace' and ${table.decisionPackageReferenceId} is null and ${table.simulationDeadlineId} is null) or (${table.deadlineKind} = 'projected_simulation' and ${table.decisionPackageReferenceId} is not null and ${table.simulationDeadlineId} is not null)`),
]);

export const dossierDeadlineSources = sqliteTable("dossier_deadline_sources", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  deadlineReferenceId: text("deadline_reference_id").notNull(),
  sourceAnchorId: text("source_anchor_id").notNull(),
}, (table) => [
  uniqueIndex("dossier_deadline_sources_uidx").on(table.dossierId, table.deadlineReferenceId, table.sourceAnchorId),
  index("dossier_deadline_sources_anchor_idx").on(table.dossierId, table.sourceAnchorId),
  foreignKey({ name: "dossier_deadline_sources_deadline_fk", columns: [table.dossierId, table.deadlineReferenceId], foreignColumns: [dossierDeadlineReferences.dossierId, dossierDeadlineReferences.id] }),
  foreignKey({ name: "dossier_deadline_sources_anchor_fk", columns: [table.dossierId, table.sourceAnchorId], foreignColumns: [dossierSourceAnchors.dossierId, dossierSourceAnchors.id] }),
]);

export const dossierAIProposalJobs = sqliteTable("dossier_ai_proposal_jobs", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  expectedDossierRevision: integer("expected_dossier_revision").notNull(),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => users.id),
  requestedByActorRef: text("requested_by_actor_ref").notNull(),
  idempotencyKeyHash: text("idempotency_key_hash").notNull(),
  requestDigest: text("request_digest").notNull(),
  status: text("status").notNull().default("queued"),
  attempt: integer("attempt").notNull().default(1),
  modelProvider: text("model_provider").notNull(),
  modelName: text("model_name").notNull(),
  modelConfigurationDigest: text("model_configuration_digest").notNull(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: text("lease_expires_at"),
  providerReceiptDigest: text("provider_receipt_digest"),
  errorCode: text("error_code"),
  errorDetailCode: text("error_detail_code"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("dossier_ai_proposal_jobs_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_ai_proposal_jobs_idempotency_uidx").on(table.dossierId, table.requestedByActorRef, table.idempotencyKeyHash),
  uniqueIndex("dossier_ai_proposal_jobs_request_uidx").on(table.dossierId, table.expectedDossierRevision, table.requestDigest),
  index("dossier_ai_proposal_jobs_status_lease_idx").on(table.status, table.leaseExpiresAt),
  index("dossier_ai_proposal_jobs_dossier_created_idx").on(table.dossierId, table.createdAt),
  foreignKey({ name: "dossier_ai_proposal_jobs_requester_actor_fk", columns: [table.requestedByUserId, table.requestedByActorRef], foreignColumns: [users.id, users.actorId] }),
  check("dossier_ai_proposal_jobs_revision_check", sql`${table.expectedDossierRevision} >= 1`),
  check("dossier_ai_proposal_jobs_status_check", sql`${table.status} in ('queued','processing','ready','failed')`),
  check("dossier_ai_proposal_jobs_attempt_check", sql`${table.attempt} between 1 and 5`),
  check("dossier_ai_proposal_jobs_model_check", sql`length(trim(${table.modelProvider})) between 1 and 120 and length(trim(${table.modelName})) between 1 and 200`),
  check("dossier_ai_proposal_jobs_idempotency_hash_check", sql`length(${table.idempotencyKeyHash}) = 71 and substr(${table.idempotencyKeyHash}, 1, 7) = 'sha256-' and substr(${table.idempotencyKeyHash}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_ai_proposal_jobs_request_digest_check", sql`length(${table.requestDigest}) = 71 and substr(${table.requestDigest}, 1, 7) = 'sha256-' and substr(${table.requestDigest}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_ai_proposal_jobs_configuration_digest_check", sql`length(${table.modelConfigurationDigest}) = 71 and substr(${table.modelConfigurationDigest}, 1, 7) = 'sha256-' and substr(${table.modelConfigurationDigest}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_ai_proposal_jobs_provider_receipt_check", sql`${table.providerReceiptDigest} is null or (length(${table.providerReceiptDigest}) = 71 and substr(${table.providerReceiptDigest}, 1, 7) = 'sha256-' and substr(${table.providerReceiptDigest}, 8) not glob '*[^0-9a-f]*')`),
  check("dossier_ai_proposal_jobs_lease_pair_check", sql`(${table.leaseOwner} is null) = (${table.leaseExpiresAt} is null)`),
  check("dossier_ai_proposal_jobs_lease_owner_check", sql`${table.leaseOwner} is null or length(${table.leaseOwner}) between 1 and 200`),
  check("dossier_ai_proposal_jobs_error_check", sql`${table.errorCode} is null or ${table.errorCode} in ('rate_limited','provider_unavailable','invalid_response','safety_rejected','timeout','internal_error')`),
  check("dossier_ai_proposal_jobs_error_detail_check", sql`${table.errorDetailCode} is null or (length(${table.errorDetailCode}) between 1 and 120 and ${table.errorDetailCode} not glob '*[^a-z0-9_]*')`),
]);

export const dossierAIProposalJobSources = sqliteTable("dossier_ai_proposal_job_sources", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  jobId: text("job_id").notNull(),
  jobAttempt: integer("job_attempt").notNull(),
  leaseOwner: text("lease_owner").notNull(),
  sourceOrdinal: integer("source_ordinal").notNull(),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  extractionResultId: text("extraction_result_id").notNull(),
  contextStart: integer("context_start").notNull(),
  contextEnd: integer("context_end").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_ai_proposal_job_sources_version_uidx").on(table.dossierId, table.jobId, table.documentVersionId),
  uniqueIndex("dossier_ai_proposal_job_sources_ordinal_uidx").on(table.dossierId, table.jobId, table.sourceOrdinal),
  index("dossier_ai_proposal_job_sources_result_idx").on(table.dossierId, table.extractionResultId, table.jobId),
  foreignKey({ name: "dossier_ai_proposal_job_sources_job_fk", columns: [table.dossierId, table.jobId], foreignColumns: [dossierAIProposalJobs.dossierId, dossierAIProposalJobs.id] }),
  foreignKey({ name: "dossier_ai_proposal_job_sources_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
  foreignKey({ name: "dossier_ai_proposal_job_sources_result_fk", columns: [table.dossierId, table.extractionResultId], foreignColumns: [dossierExtractionResults.dossierId, dossierExtractionResults.id] }),
  check("dossier_ai_proposal_job_sources_ordinal_check", sql`${table.sourceOrdinal} between 1 and 8`),
  check("dossier_ai_proposal_job_sources_fence_check", sql`${table.jobAttempt} between 1 and 5 and length(${table.leaseOwner}) between 1 and 200`),
  check("dossier_ai_proposal_job_sources_range_check", sql`${table.contextStart} >= 0 and ${table.contextEnd} > ${table.contextStart} and ${table.contextEnd} - ${table.contextStart} <= 24000`),
]);

export const dossierAIProposals = sqliteTable("dossier_ai_proposals", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  generationJobId: text("generation_job_id"),
  proposalType: text("proposal_type").notNull(),
  proposedValue: text("proposed_value", { mode: "json" }).$type<unknown>().notNull(),
  confidenceCategory: text("confidence_category"),
  confidenceScore: real("confidence_score"),
  modelProvider: text("model_provider"),
  modelName: text("model_name"),
  modelConfigurationDigest: text("model_configuration_digest"),
  reviewState: text("review_state").notNull().default("pending"),
  reviewingUserId: integer("reviewing_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewingActorRef: text("reviewing_actor_ref"),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  acceptedObjectType: text("accepted_object_type"),
  acceptedObjectId: text("accepted_object_id"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_ai_proposals_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_ai_proposals_materialization_uidx").on(
    table.dossierId,
    table.id,
    table.reviewState,
    table.acceptedObjectType,
    table.acceptedObjectId,
  ),
  index("dossier_ai_proposals_review_created_idx").on(table.dossierId, table.reviewState, table.createdAt),
  index("dossier_ai_proposals_job_created_idx").on(table.dossierId, table.generationJobId, table.createdAt),
  foreignKey({ name: "dossier_ai_proposals_job_fk", columns: [table.dossierId, table.generationJobId], foreignColumns: [dossierAIProposalJobs.dossierId, dossierAIProposalJobs.id] }),
  foreignKey({ name: "dossier_ai_proposals_reviewer_actor_fk", columns: [table.reviewingUserId, table.reviewingActorRef], foreignColumns: [users.id, users.actorId] }),
  check("dossier_ai_proposals_type_check", sql`${table.proposalType} in ('document_metadata','participant','dated_event','deadline','fact','authority_rule','contradiction','information_request','evidence_link','graph_change','assumption','dossier_summary')`),
  check("dossier_ai_proposals_confidence_check", sql`${table.confidenceCategory} is null or ${table.confidenceCategory} in ('low','medium','high')`),
  check("dossier_ai_proposals_score_check", sql`${table.confidenceScore} is null or ${table.confidenceScore} between 0 and 1`),
  check("dossier_ai_proposals_review_check", sql`${table.reviewState} in ('pending','accepted','rejected','superseded')`),
  check("dossier_ai_proposals_accepted_type_check", sql`${table.acceptedObjectType} is null or ${table.acceptedObjectType} in ('participant','document','professional_assertion','evidence_link','information_request','deadline_reference','decision_package_reference')`),
  check("dossier_ai_proposals_accepted_pair_check", sql`(${table.acceptedObjectType} is null) = (${table.acceptedObjectId} is null)`),
  check("dossier_ai_proposals_model_receipt_check", sql`(${table.modelProvider} is null and ${table.modelName} is null and ${table.modelConfigurationDigest} is null) or (${table.modelProvider} is not null and ${table.modelName} is not null and length(${table.modelConfigurationDigest}) = 71 and substr(${table.modelConfigurationDigest}, 1, 7) = 'sha256-' and substr(${table.modelConfigurationDigest}, 8) not glob '*[^0-9a-f]*')`),
]);

// Origin-bearing authoritative children are written before the proposal review
// row is finalized. This deferred commitment makes their exact accepted
// proposal tuple mandatory at COMMIT while keeping that production order.
export const dossierProposalMaterializationCommitments = sqliteTable("dossier_proposal_materialization_commitments", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  proposalId: text("proposal_id").notNull(),
  requiredState: text("required_state").notNull().default("accepted"),
  acceptedObjectType: text("accepted_object_type").notNull(),
  acceptedObjectId: text("accepted_object_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_proposal_materialization_commitments_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_proposal_materialization_commitments_proposal_uidx").on(table.dossierId, table.proposalId),
  uniqueIndex("dossier_proposal_materialization_commitments_object_uidx").on(table.dossierId, table.acceptedObjectType, table.acceptedObjectId),
  index("dossier_proposal_materialization_commitments_created_idx").on(table.dossierId, table.createdAt),
  foreignKey({
    name: "dossier_proposal_materialization_commitments_proposal_fk",
    columns: [table.dossierId, table.proposalId, table.requiredState, table.acceptedObjectType, table.acceptedObjectId],
    foreignColumns: [
      dossierAIProposals.dossierId,
      dossierAIProposals.id,
      dossierAIProposals.reviewState,
      dossierAIProposals.acceptedObjectType,
      dossierAIProposals.acceptedObjectId,
    ],
  }),
  check("dossier_proposal_materialization_commitments_state_check", sql`${table.requiredState} = 'accepted'`),
  check("dossier_proposal_materialization_commitments_type_check", sql`${table.acceptedObjectType} in ('professional_assertion','evidence_link')`),
]);

export const dossierAIProposalVersions = sqliteTable("dossier_ai_proposal_versions", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  proposalId: text("proposal_id").notNull(),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
}, (table) => [
  uniqueIndex("dossier_ai_proposal_versions_uidx").on(table.dossierId, table.proposalId, table.documentVersionId),
  foreignKey({ name: "dossier_ai_proposal_versions_proposal_fk", columns: [table.dossierId, table.proposalId], foreignColumns: [dossierAIProposals.dossierId, dossierAIProposals.id] }),
  foreignKey({ name: "dossier_ai_proposal_versions_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id] }),
]);

export const dossierAIProposalAnchors = sqliteTable("dossier_ai_proposal_anchors", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  proposalId: text("proposal_id").notNull(),
  sourceAnchorId: text("source_anchor_id").notNull(),
}, (table) => [
  uniqueIndex("dossier_ai_proposal_anchors_uidx").on(table.dossierId, table.proposalId, table.sourceAnchorId),
  foreignKey({ name: "dossier_ai_proposal_anchors_proposal_fk", columns: [table.dossierId, table.proposalId], foreignColumns: [dossierAIProposals.dossierId, dossierAIProposals.id] }),
  foreignKey({ name: "dossier_ai_proposal_anchors_anchor_fk", columns: [table.dossierId, table.sourceAnchorId], foreignColumns: [dossierSourceAnchors.dossierId, dossierSourceAnchors.id] }),
]);

export const dossierSnapshots = sqliteTable("dossier_snapshots", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  dossierRevision: integer("dossier_revision").notNull(),
  simulationInputs: text("simulation_inputs", { mode: "json" }).$type<unknown>().notNull(),
  deterministicReceipts: text("deterministic_receipts", { mode: "json" }).$type<unknown>().notNull(),
  status: text("status").notNull(),
  readiness: text("readiness", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  approverRecords: text("approver_records", { mode: "json" }).$type<Array<{ reviewer_actor_id: string; approved_at: string; output_id: string | null }>>().notNull().default([]),
  locale: text("locale").notNull(),
  audience: text("audience").notNull(),
  classification: text("classification").notNull(),
  redactionProfileId: text("redaction_profile_id").notNull(),
  contractVersion: text("contract_version").notNull(),
  reportModelSchemaVersion: integer("report_model_schema_version").notNull(),
  rendererVersion: text("renderer_version").notNull(),
  buildVersion: text("build_version").notNull(),
  // The immutable canonical snapshot payload lives in private object storage.
  // D1 retains only its opaque locator, exact length, and canonical digest so a
  // sealed historical manifest never resolves through later-mutable rows.
  manifestObjectReference: text("manifest_object_reference").notNull(),
  manifestByteLength: integer("manifest_byte_length").notNull(),
  manifestDigest: text("manifest_digest").notNull(),
  sealed: integer("sealed", { mode: "boolean" }).notNull().default(false),
  sealedAt: text("sealed_at"),
  sealedByActorRef: text("sealed_by_actor_ref"),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_snapshots_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_snapshots_manifest_uidx").on(table.dossierId, table.manifestDigest),
  uniqueIndex("dossier_snapshots_manifest_object_uidx").on(table.manifestObjectReference),
  index("dossier_snapshots_revision_created_idx").on(table.dossierId, table.dossierRevision, table.createdAt),
  check("dossier_snapshots_revision_check", sql`${table.dossierRevision} >= 1`),
  check("dossier_snapshots_status_check", sql`${table.status} in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')`),
  check("dossier_snapshots_audience_check", sql`${table.audience} in ('internal','client')`),
  check("dossier_snapshots_classification_check", sql`${table.classification} in ('public','internal','confidential','strictly_confidential')`),
  check("dossier_snapshots_manifest_object_check", sql`length(${table.manifestObjectReference}) >= 32 and instr(${table.manifestObjectReference}, '://') = 0 and instr(${table.manifestObjectReference}, '..') = 0 and instr(${table.manifestObjectReference}, char(92)) = 0`),
  check("dossier_snapshots_manifest_length_check", sql`${table.manifestByteLength} between 1 and 100000000`),
  check("dossier_snapshots_manifest_check", sql`length(${table.manifestDigest}) = 71 and substr(${table.manifestDigest}, 1, 7) = 'sha256-' and substr(${table.manifestDigest}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_snapshots_generator_check", sql`${table.reportModelSchemaVersion} >= 1`),
  check("dossier_snapshots_seal_check", sql`(${table.sealed} = false and ${table.sealedAt} is null and ${table.sealedByActorRef} is null) or (${table.sealed} = true and ${table.sealedAt} is not null and ${table.sealedByActorRef} is not null)`),
]);

export const dossierSnapshotDocumentVersions = sqliteTable("dossier_snapshot_document_versions", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  snapshotId: text("snapshot_id").notNull(),
  documentId: text("document_id").notNull(),
  documentVersionId: text("document_version_id").notNull(),
  contentSha256: text("content_sha256").notNull(),
}, (table) => [
  uniqueIndex("dossier_snapshot_documents_uidx").on(table.dossierId, table.snapshotId, table.documentId),
  index("dossier_snapshot_documents_version_idx").on(table.dossierId, table.documentVersionId),
  foreignKey({ name: "dossier_snapshot_documents_snapshot_fk", columns: [table.dossierId, table.snapshotId], foreignColumns: [dossierSnapshots.dossierId, dossierSnapshots.id] }),
  foreignKey({ name: "dossier_snapshot_documents_version_fk", columns: [table.dossierId, table.documentId, table.documentVersionId, table.contentSha256], foreignColumns: [dossierDocumentVersions.dossierId, dossierDocumentVersions.documentId, dossierDocumentVersions.id, dossierDocumentVersions.contentSha256] }),
]);

export const dossierSnapshotAssertions = sqliteTable("dossier_snapshot_assertions", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  snapshotId: text("snapshot_id").notNull(),
  assertionId: text("assertion_id").notNull(),
}, (table) => [
  uniqueIndex("dossier_snapshot_assertions_uidx").on(table.dossierId, table.snapshotId, table.assertionId),
  foreignKey({ name: "dossier_snapshot_assertions_snapshot_fk", columns: [table.dossierId, table.snapshotId], foreignColumns: [dossierSnapshots.dossierId, dossierSnapshots.id] }),
  foreignKey({ name: "dossier_snapshot_assertions_assertion_fk", columns: [table.dossierId, table.assertionId], foreignColumns: [dossierProfessionalAssertions.dossierId, dossierProfessionalAssertions.id] }),
]);

export const dossierSnapshotAnchors = sqliteTable("dossier_snapshot_anchors", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  snapshotId: text("snapshot_id").notNull(),
  sourceAnchorId: text("source_anchor_id").notNull(),
}, (table) => [
  uniqueIndex("dossier_snapshot_anchors_uidx").on(table.dossierId, table.snapshotId, table.sourceAnchorId),
  foreignKey({ name: "dossier_snapshot_anchors_snapshot_fk", columns: [table.dossierId, table.snapshotId], foreignColumns: [dossierSnapshots.dossierId, dossierSnapshots.id] }),
  foreignKey({ name: "dossier_snapshot_anchors_anchor_fk", columns: [table.dossierId, table.sourceAnchorId], foreignColumns: [dossierSourceAnchors.dossierId, dossierSourceAnchors.id] }),
]);

export const dossierSnapshotDecisionPackages = sqliteTable("dossier_snapshot_decision_packages", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  snapshotId: text("snapshot_id").notNull(),
  decisionPackageReferenceId: text("decision_package_reference_id").notNull(),
  packageId: text("package_id").notNull(),
  packageVersion: text("package_version").notNull(),
  graphDigest: text("graph_digest").notNull(),
  simulationReceiptIds: text("simulation_receipt_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
}, (table) => [
  uniqueIndex("dossier_snapshot_packages_uidx").on(table.dossierId, table.snapshotId, table.decisionPackageReferenceId),
  foreignKey({ name: "dossier_snapshot_packages_snapshot_fk", columns: [table.dossierId, table.snapshotId], foreignColumns: [dossierSnapshots.dossierId, dossierSnapshots.id] }),
  foreignKey({ name: "dossier_snapshot_packages_package_fk", columns: [table.dossierId, table.decisionPackageReferenceId], foreignColumns: [dossierDecisionPackageReferences.dossierId, dossierDecisionPackageReferences.id] }),
  check("dossier_snapshot_packages_graph_digest_check", sql`length(${table.graphDigest}) = 71 and substr(${table.graphDigest}, 1, 7) = 'sha256-' and substr(${table.graphDigest}, 8) not glob '*[^0-9a-f]*'`),
]);

export const dossierGovernedOutputs = sqliteTable("dossier_governed_outputs", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  snapshotId: text("snapshot_id").notNull(),
  snapshotDigest: text("snapshot_digest").notNull(),
  format: text("format").notNull(),
  contentReference: text("content_reference").notNull(),
  contentSha256: text("content_sha256").notNull(),
  filename: text("filename").notNull(),
  generatorSchemaVersion: integer("generator_schema_version").notNull(),
  generatorBuildVersion: text("generator_build_version").notNull(),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_governed_outputs_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_governed_outputs_content_uidx").on(table.contentReference),
  index("dossier_governed_outputs_snapshot_created_idx").on(table.dossierId, table.snapshotId, table.createdAt),
  foreignKey({ name: "dossier_governed_outputs_snapshot_fk", columns: [table.dossierId, table.snapshotId], foreignColumns: [dossierSnapshots.dossierId, dossierSnapshots.id] }),
  check("dossier_governed_outputs_snapshot_digest_check", sql`length(${table.snapshotDigest}) = 71 and substr(${table.snapshotDigest}, 1, 7) = 'sha256-' and substr(${table.snapshotDigest}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_governed_outputs_format_check", sql`${table.format} in ('pdf','json_manifest','markdown')`),
  check("dossier_governed_outputs_content_reference_check", sql`length(${table.contentReference}) >= 32 and instr(${table.contentReference}, '://') = 0 and instr(${table.contentReference}, '..') = 0 and instr(${table.contentReference}, char(92)) = 0`),
  check("dossier_governed_outputs_content_hash_check", sql`length(${table.contentSha256}) = 71 and substr(${table.contentSha256}, 1, 7) = 'sha256-' and substr(${table.contentSha256}, 8) not glob '*[^0-9a-f]*'`),
  check("dossier_governed_outputs_generator_check", sql`${table.generatorSchemaVersion} >= 1`),
]);

export const dossierOutputStateEvents = sqliteTable("dossier_output_state_events", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  outputId: text("output_id").notNull(),
  sequence: integer("sequence").notNull(),
  state: text("state").notNull(),
  reason: text("reason"),
  occurredAt: text("occurred_at").notNull(),
  actorRef: text("actor_ref").notNull(),
}, (table) => [
  uniqueIndex("dossier_output_states_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_output_states_sequence_uidx").on(table.dossierId, table.outputId, table.sequence),
  index("dossier_output_states_output_occurred_idx").on(table.dossierId, table.outputId, table.occurredAt),
  foreignKey({ name: "dossier_output_states_output_fk", columns: [table.dossierId, table.outputId], foreignColumns: [dossierGovernedOutputs.dossierId, dossierGovernedOutputs.id] }),
  check("dossier_output_states_sequence_check", sql`${table.sequence} >= 1`),
  check("dossier_output_states_state_check", sql`${table.state} in ('current','stale')`),
  check("dossier_output_states_reason_check", sql`(${table.state} = 'current' and ${table.reason} is null) or (${table.state} = 'stale' and ${table.reason} is not null)`),
]);

export const dossierOutputApprovals = sqliteTable("dossier_output_approvals", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  outputId: text("output_id").notNull(),
  reviewerParticipantId: text("reviewer_participant_id").notNull(),
  reviewerUserId: integer("reviewer_user_id").notNull().references(() => users.id),
  reviewerActorRef: text("reviewer_actor_ref").notNull(),
  approvedAt: text("approved_at").notNull(),
  approvalDigest: text("approval_digest").notNull(),
}, (table) => [
  uniqueIndex("dossier_output_approvals_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_output_approvals_reviewer_uidx").on(table.dossierId, table.outputId, table.reviewerParticipantId),
  index("dossier_output_approvals_output_approved_idx").on(table.dossierId, table.outputId, table.approvedAt),
  foreignKey({ name: "dossier_output_approvals_output_fk", columns: [table.dossierId, table.outputId], foreignColumns: [dossierGovernedOutputs.dossierId, dossierGovernedOutputs.id] }),
  foreignKey({ name: "dossier_output_approvals_participant_fk", columns: [table.dossierId, table.reviewerParticipantId], foreignColumns: [dossierParticipants.dossierId, dossierParticipants.id] }),
  foreignKey({ name: "dossier_output_approvals_authority_fk", columns: [table.dossierId, table.reviewerParticipantId, table.reviewerUserId, table.reviewerActorRef], foreignColumns: [dossierParticipants.dossierId, dossierParticipants.id, dossierParticipants.userId, dossierParticipants.actorId] }),
  check("dossier_output_approvals_digest_check", sql`length(${table.approvalDigest}) = 71 and substr(${table.approvalDigest}, 1, 7) = 'sha256-' and substr(${table.approvalDigest}, 8) not glob '*[^0-9a-f]*'`),
]);

export const dossierRevisionReceipts = sqliteTable("dossier_revision_receipts", {
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  resultingRevision: integer("resulting_revision").notNull(),
  createdByActorRef: text("created_by_actor_ref").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_revision_receipts_revision_uidx").on(table.dossierId, table.resultingRevision),
  index("dossier_revision_receipts_created_idx").on(table.dossierId, table.createdAt),
  check("dossier_revision_receipts_revision_check", sql`${table.resultingRevision} >= 1`),
]);

export const dossierAuditEvents = sqliteTable("dossier_audit_events", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  dossierRevision: integer("dossier_revision").notNull(),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  objectRefType: text("object_ref_type").notNull(),
  objectRefId: text("object_ref_id").notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorRef: text("actor_ref").notNull(),
  actorRole: text("actor_role").notNull(),
  occurredAt: text("occurred_at").notNull(),
  summaryCode: text("summary_code").notNull(),
  detail: text("detail", { mode: "json" }).$type<unknown>().notNull().default({}),
  previousEventId: text("previous_event_id"),
  eventDigest: text("event_digest").notNull(),
}, (table) => [
  uniqueIndex("dossier_audit_events_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_audit_events_sequence_uidx").on(table.dossierId, table.sequence),
  uniqueIndex("dossier_audit_events_digest_uidx").on(table.dossierId, table.eventDigest),
  index("dossier_audit_events_mutation_idx").on(
    table.dossierId,
    table.dossierRevision,
    table.eventType,
    table.objectRefType,
    table.objectRefId,
    table.actorRef,
    table.occurredAt,
  ),
  index("dossier_audit_events_object_occurred_idx").on(table.dossierId, table.objectRefType, table.objectRefId, table.occurredAt),
  index("dossier_audit_events_occurred_idx").on(table.dossierId, table.occurredAt),
  foreignKey({ name: "dossier_audit_events_revision_receipt_fk", columns: [table.dossierId, table.dossierRevision], foreignColumns: [dossierRevisionReceipts.dossierId, dossierRevisionReceipts.resultingRevision] }),
  foreignKey({ name: "dossier_audit_events_previous_fk", columns: [table.dossierId, table.previousEventId], foreignColumns: [table.dossierId, table.id] }),
  check("dossier_audit_events_sequence_check", sql`${table.sequence} >= 1 and ((${table.sequence} = 1 and ${table.previousEventId} is null) or (${table.sequence} > 1 and ${table.previousEventId} is not null))`),
  check("dossier_audit_events_revision_check", sql`${table.dossierRevision} >= 1`),
  check("dossier_audit_events_type_check", sql`${table.eventType} in ('dossier_created','dossier_updated','dossier_status_transitioned','participant_changed','document_created','document_version_created','source_anchor_reviewed','assertion_reviewed','evidence_link_changed','information_request_changed','proposal_reviewed','proposal_generation_completed','decision_package_linked','snapshot_created','output_generated','output_approved','output_marked_stale','legacy_case_migration_requested','admin_archive_override')`),
  check("dossier_audit_events_object_type_check", sql`${table.objectRefType} in ('dossier','participant','status_transition','document','document_version','source_anchor','professional_assertion','evidence_link','information_request','deadline_reference','decision_package_reference','ai_proposal','dossier_snapshot','governed_output','audit_event')`),
  check("dossier_audit_events_role_check", sql`${table.actorRole} in ('owner','contributor','reviewer','viewer','platform_admin','system','import')`),
  check("dossier_audit_events_digest_check", sql`length(${table.eventDigest}) = 71 and substr(${table.eventDigest}, 1, 7) = 'sha256-' and substr(${table.eventDigest}, 8) not glob '*[^0-9a-f]*'`),
]);

// Multiple legitimate events may share the same semantic tuple (for example,
// distinct zero-candidate AI jobs completed in one millisecond). Claims point
// to one immutable tuple certification instead of forcing audit-row uniqueness.
export const dossierAuditCertifications = sqliteTable("dossier_audit_certifications", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  dossierRevision: integer("dossier_revision").notNull(),
  eventType: text("event_type").notNull(),
  objectRefType: text("object_ref_type").notNull(),
  objectRefId: text("object_ref_id").notNull(),
  actorRef: text("actor_ref").notNull(),
  occurredAt: text("occurred_at").notNull(),
  auditEventId: text("audit_event_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_audit_certifications_scope_uidx").on(table.dossierId, table.id),
  uniqueIndex("dossier_audit_certifications_tuple_uidx").on(
    table.dossierId,
    table.dossierRevision,
    table.eventType,
    table.objectRefType,
    table.objectRefId,
    table.actorRef,
    table.occurredAt,
  ),
  index("dossier_audit_certifications_event_idx").on(table.dossierId, table.auditEventId),
  foreignKey({
    name: "dossier_audit_certifications_event_fk",
    columns: [table.dossierId, table.auditEventId],
    foreignColumns: [dossierAuditEvents.dossierId, dossierAuditEvents.id],
  }),
  check("dossier_audit_certifications_revision_check", sql`${table.dossierRevision} >= 1`),
]);

// Every dossier revision is committed by the dossier row itself and must end
// with the matching immutable revision receipt. The migration makes this
// foreign key deferred so the receipt can remain the final application write.
export const dossierRevisionCommitments = sqliteTable("dossier_revision_commitments", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  resultingRevision: integer("resulting_revision").notNull(),
  actorRef: text("actor_ref").notNull(),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dossier_revision_commitments_revision_uidx").on(table.dossierId, table.resultingRevision),
  index("dossier_revision_commitments_created_idx").on(table.dossierId, table.createdAt),
  foreignKey({
    name: "dossier_revision_commitments_receipt_fk",
    columns: [table.dossierId, table.resultingRevision],
    foreignColumns: [dossierRevisionReceipts.dossierId, dossierRevisionReceipts.resultingRevision],
  }),
  check("dossier_revision_commitments_revision_check", sql`${table.resultingRevision} >= 1`),
]);

// Domain triggers populate exact audit obligations. The composite foreign key
// is DEFERRABLE INITIALLY DEFERRED in SQL, so mutation, audit and receipt can be
// written atomically while an omitted or cross-certified audit fails at COMMIT.
export const dossierRequiredAudits = sqliteTable("dossier_required_audits", {
  id: text("id").primaryKey(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  dossierRevision: integer("dossier_revision").notNull(),
  claimPhase: text("claim_phase").notNull(),
  eventType: text("event_type").notNull(),
  objectRefType: text("object_ref_type").notNull(),
  objectRefId: text("object_ref_id").notNull(),
  actorRef: text("actor_ref").notNull(),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("dossier_required_audits_revision_idx").on(table.dossierId, table.dossierRevision, table.claimPhase),
  index("dossier_required_audits_object_idx").on(table.dossierId, table.objectRefType, table.objectRefId),
  foreignKey({
    name: "dossier_required_audits_event_fk",
    columns: [
      table.dossierId,
      table.dossierRevision,
      table.eventType,
      table.objectRefType,
      table.objectRefId,
      table.actorRef,
      table.occurredAt,
    ],
    foreignColumns: [
      dossierAuditCertifications.dossierId,
      dossierAuditCertifications.dossierRevision,
      dossierAuditCertifications.eventType,
      dossierAuditCertifications.objectRefType,
      dossierAuditCertifications.objectRefId,
      dossierAuditCertifications.actorRef,
      dossierAuditCertifications.occurredAt,
    ],
  }),
  check("dossier_required_audits_revision_check", sql`${table.dossierRevision} >= 1`),
  check("dossier_required_audits_phase_check", sql`${table.claimPhase} in ('revision','same_revision')`),
]);
