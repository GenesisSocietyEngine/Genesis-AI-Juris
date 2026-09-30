import { and, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { getDb } from "../db";
import { auditEvents, caseDrafts, customCaseGrants, customCases, users } from "../db/schema";
import { hashOpaqueToken, readSessionCookie } from "./auth-crypto";
import { caseFingerprint, casePublicationFingerprint, canonicalFingerprint, legacyCaseFingerprintV15 } from "./case-integrity";
import { normalizeStoredCaseProtection, verifyCaseProtection } from "./case-protection";
import { buildTaxCaseReportArtifacts, caseReportReceiptBinding, type CaseReportOptions } from "./case-report";
import type { ChatGPTUser } from "./chatgpt-auth";
import { normalizeEmail } from "./custom-case-access";
import { isReportReceiptStale } from "./report-model";
import { isPlatformAdmin } from "./server-authorization";
import { getOrCreateCaseProtectionKey } from "./server-case-protection";
import { studioDeviceScope } from "./studio-device-storage";
import { historyTimestamp, parseStudioReportHistoryRecord, strictHistoryObject, type StudioHistoryReceipt, type StudioReportHistoryRecord } from "./studio-report-history";
import { freezeStudioDraftSnapshot, readStudioAggregate } from "./studio-aggregate";
import { canonicalWebTaxJson } from "./studio-tax-source";
import { hasTaxAttachment } from "./tax-authoring";
import { isTaxReportReceiptStale } from "./tax-report-receipt";
import type { TaxRuntime } from "./tax-runtime/runtime";

type Database = ReturnType<typeof getDb>;
const EVENT = "studio_report_download_started";
const OBJECT = "custom_case_report";
const fingerprint = (value: unknown): value is string => typeof value === "string" && /^sha256-[a-f0-9]{64}$/.test(value);
export class HistoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const OPTIONS = ["language", "presentationMode", "includeDecisionTree", "profileId", "profileLabel", "audience", "confidentiality", "preparedBy", "preparedFor", "matterReference", "includeEconomics", "includeRegisters", "includeSources", "includeAuditTrail", "includeTechnicalIds", "generatedAt", "currentFingerprint", "workspaceFingerprint", "currentPublicationFingerprint", "workspacePublicationFingerprint", "privateCase", "reportReceiptStorageScope", "persistReportReceiptOnDevice", "status", "reviewerName", "reviewerApproved", "redactedNodeIds"];
export function parseHistoryOptions(value: unknown): CaseReportOptions | null {
  if (!strictHistoryObject(value, OPTIONS)
    || !["en", "ru"].includes(String(value.language))
    || value.presentationMode !== undefined && !["decision", "medium", "full"].includes(String(value.presentationMode))
    || value.includeDecisionTree !== undefined && typeof value.includeDecisionTree !== "boolean"
    || typeof value.profileId !== "string" || !/^[a-z0-9_-]{1,128}$/.test(value.profileId)
    || !["client", "internal"].includes(String(value.audience))
    || !["confidential", "internal", "draft"].includes(String(value.confidentiality))
    || !["profileLabel", "preparedBy", "preparedFor", "matterReference"].every(key => typeof value[key] === "string" && value[key].length <= 512 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value[key]))
    || !["includeEconomics", "includeRegisters", "includeSources", "includeAuditTrail", "includeTechnicalIds", "privateCase"].every(key => typeof value[key] === "boolean")
    || !historyTimestamp(value.generatedAt)
    || !["currentFingerprint", "currentPublicationFingerprint"].every(key => fingerprint(value[key]))
    || !["workspaceFingerprint", "workspacePublicationFingerprint"].every(key => value[key] === null || fingerprint(value[key]))
    || value.reportReceiptStorageScope !== null || value.persistReportReceiptOnDevice !== false
    || value.status !== undefined && !["draft", "final"].includes(String(value.status))
    || value.reviewerName !== undefined && (typeof value.reviewerName !== "string" || value.reviewerName.length > 512)
    || value.reviewerApproved !== undefined && typeof value.reviewerApproved !== "boolean"
    || value.redactedNodeIds !== undefined && (!Array.isArray(value.redactedNodeIds) || value.redactedNodeIds.length > 1000 || !value.redactedNodeIds.every(id => typeof id === "string" && id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id)) || new Set(value.redactedNodeIds).size !== value.redactedNodeIds.length)) return null;
  return value as CaseReportOptions;
}

// Capture one immutable account identity and one exact saved artifact. The SQL
// predicate below is used at the write/read boundary, after all expensive work.
export async function historyAuthority(db: Database, identity: ChatGPTUser, request: Request, id: number, expectedScope: string) {
  const email = normalizeEmail(identity.email);
  if (expectedScope !== await studioDeviceScope(email)) throw new HistoryError(409, "The active account changed. Reopen report history.");
  const [actor] = await db.select({ id: users.id, actorId: users.actorId }).from(users).where(eq(users.email, email)).limit(1);
  const [record] = await db.select().from(customCases).where(eq(customCases.id, id)).limit(1);
  if (!actor?.actorId || !record) throw new HistoryError(404, "Saved case not found.");
  const owner = normalizeEmail(record.ownerEmail) === email;
  const [grant] = owner ? [] : await db.select().from(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, id), eq(customCaseGrants.recipientEmail, email))).limit(1);
  if (!owner && (record.isPrivate || isPlatformAdmin(identity) || !grant)) throw new HistoryError(404, "Saved case not found.");
  const [stored] = await db.select({ ...getTableColumns(caseDrafts), payload: sql<string>`cast(${caseDrafts.payload} as text)` }).from(caseDrafts).where(and(eq(caseDrafts.customCaseId, id), eq(caseDrafts.version, record.currentVersion), eq(caseDrafts.fingerprint, record.fingerprint))).orderBy(desc(caseDrafts.updatedAt), desc(caseDrafts.id)).limit(1);
  if (!stored) throw new HistoryError(409, "Save the exact case version before recording its report.");
  let draft;
  try {
    const aggregate = readStudioAggregate(stored.payload, { kind: "draft" });
    if (aggregate.status !== "editable") throw new Error("retained source requires recovery");
    draft = freezeStudioDraftSnapshot(aggregate.draft);
    if (draft.caseId !== record.caseId || draft.version !== record.currentVersion || ![caseFingerprint(draft), legacyCaseFingerprintV15(draft)].includes(record.fingerprint)) throw new Error("binding");
    const protection = normalizeStoredCaseProtection(aggregate.envelope.protection);
    if (protection) {
      const parent = draft.parent;
      if (!await verifyCaseProtection(protection, { caseId: record.caseId, version: record.currentVersion, studioFingerprint: record.fingerprint,
        parentCaseId: parent?.caseId ?? null, parentVersion: parent?.version ?? null, parentFingerprint: parent?.fingerprint ?? null,
        parentCode: protection.parentCode, copyPolicy: protection.copyPolicy }, await getOrCreateCaseProtectionKey(db))) throw new Error("protection");
      if (!owner && protection.copyProtected) throw new HistoryError(404, "Saved case not found.");
    }
  } catch (error) {
    if (error instanceof HistoryError) throw error;
    throw new HistoryError(409, "Saved case integrity verification failed.");
  }
  const token = identity.authSource === "local" ? readSessionCookie(request.headers.get("cookie")) : null;
  if (identity.authSource === "local" && !token) throw new HistoryError(401, "Sign in is required.");
  const tokenHash = token ? await hashOpaqueToken(token) : null;
  const guard = (): SQL => {
    const now = new Date();
    const localSession = tokenHash ? sql`exists(select 1 from auth_sessions s join local_accounts a on a.id=s.account_id
      where a.user_email=${email} and a.status='active' and s.token_hash=${tokenHash} and s.revoked_at is null
      and s.expires_at>${now.toISOString()} and s.last_seen_at>${new Date(now.getTime()-12*60*60_000).toISOString()} and s.created_at>=a.password_changed_at)` : sql`1`;
    const grantGuard = owner ? sql`1` : sql`exists(select 1 from custom_case_grants g where g.id=${grant!.id} and g.custom_case_id=${id} and g.recipient_email=${email})`;
    return sql`exists(select 1 from users u where u.id=${actor.id} and u.actor_id=${actor.actorId} and u.email=${email})
      and ${localSession} and ${grantGuard}
      and exists(select 1 from custom_cases c join case_drafts d on d.custom_case_id=c.id
        where c.id=${id} and c.owner_email=${record.ownerEmail} and c.case_id=${record.caseId} and c.current_version=${record.currentVersion}
        and c.fingerprint=${record.fingerprint} and c.is_private=${Number(record.isPrivate)} and d.id=${stored.id}
        and d.version=c.current_version and d.fingerprint=c.fingerprint and cast(d.payload as text)=${stored.payload}
        and d.id=(select newest.id from case_drafts newest where newest.custom_case_id=c.id and newest.version=c.current_version and newest.fingerprint=c.fingerprint order by newest.updated_at desc,newest.id desc limit 1))`;
  };
  return { email, actorId: actor.actorId, record, draft, guard };
}
type Authority = Awaited<ReturnType<typeof historyAuthority>>;
function scopeWhere(authority: Authority) {
  return sql`${auditEvents.actorEmail}=${authority.email} and ${auditEvents.eventType}=${EVENT} and ${auditEvents.objectType}=${OBJECT}
    and ${auditEvents.objectId}=${String(authority.record.id)} and json_extract(${auditEvents.detail},'$.actorId')=${authority.actorId}`;
}
function historyRecord(row: typeof auditEvents.$inferSelect): StudioReportHistoryRecord {
  const result = parseStudioReportHistoryRecord({ id: row.id, recordedAt: row.createdAt, event: "client_report_download_started", receipt: row.detail.receipt, format: row.detail.format });
  if (!result) throw new HistoryError(409, "Stored report history failed integrity verification.");
  return result;
}
export async function readHistory(db: Database, authority: Authority, limit: number, cursor: number | null) {
  // A scalar guard also distinguishes loss of authority from an empty history.
  const allowed = await db.get<{allowed:number}>(sql`select (${authority.guard()}) as allowed`);
  if (!allowed?.allowed) throw new HistoryError(409, "The account or saved case changed. Reopen report history.");
  const rows = await db.select().from(auditEvents).where(sql`${scopeWhere(authority)} and (${authority.guard()}) ${cursor ? sql`and ${auditEvents.id}<${cursor}` : sql``}`).orderBy(desc(auditEvents.id)).limit(limit+1);
  const stillAllowed = await db.get<{allowed:number}>(sql`select (${authority.guard()}) as allowed`);
  if (!stillAllowed?.allowed) throw new HistoryError(409, "The account or saved case changed. Reopen report history.");
  const records = rows.slice(0, limit).map(historyRecord);
  return { receipts: records, nextCursor: rows.length > limit ? String(records.at(-1)!.id) : null };
}
/** Internal loader seam for held-runtime tests. The route never receives or
 * accepts a runtime, execution snapshot or calculated result from the client. */
const loadHistoryTaxRuntime = async () => (await import("./tax-runtime/worker")).loadWorkerTaxRuntime();
export async function recordHistory(db: Database, authority: Authority, receipt: StudioHistoryReceipt, options: CaseReportOptions, loadRuntime: () => Promise<TaxRuntime> = loadHistoryTaxRuntime) {
  const { draft, record } = authority;
  if (receipt.caseId !== record.caseId || receipt.caseVersion !== record.currentVersion || receipt.profileId !== options.profileId
    || receipt.generatedAt !== options.generatedAt || receipt.status !== (options.status ?? "draft") || receipt.audience !== options.audience
    || options.currentFingerprint !== caseFingerprint(draft) || options.workspaceFingerprint !== record.fingerprint
    || options.currentPublicationFingerprint !== casePublicationFingerprint(draft) || options.workspacePublicationFingerprint !== casePublicationFingerprint(draft)
    || options.privateCase !== record.isPrivate || options.redactedNodeIds?.some(id => !draft.nodes.some(node => node.id === id))) throw new HistoryError(409, "Save the exact case and refresh report settings before recording this report.");
  try {
    if (receipt.receiptSchemaVersion === 3) {
      if (!hasTaxAttachment(draft)) throw new Error("missing tax attachment");
      const current = await buildTaxCaseReportArtifacts(draft, options, loadRuntime);
      if (isTaxReportReceiptStale(receipt, current)) throw new Error("stale tax receipt");
    } else {
      if (hasTaxAttachment(draft) || isReportReceiptStale(receipt, draft, options.profileId, caseReportReceiptBinding(draft, options))) throw new Error("stale");
    }
  } catch { throw new HistoryError(409, "The report no longer matches the saved case or current renderer. Generate it again."); }
  const format: StudioReportHistoryRecord["format"] = { presentationMode: options.presentationMode ?? "full", includeDecisionTree: options.presentationMode === "medium" || (options.includeDecisionTree ?? options.presentationMode !== "decision") };
  const digest = receipt.receiptSchemaVersion === 3
    ? `sha256-${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalWebTaxJson({ schema: "web-tax-report-history-v1", receipt, format })))), byte => byte.toString(16).padStart(2, "0")).join("")}`
    : canonicalFingerprint({ receipt, format });
  const detail = JSON.stringify({ actorId: authority.actorId, receipt, format, receiptDigest: digest });
  const recordedAt = new Date().toISOString();
  const result = await db.run(sql`insert into audit_events(actor_email,event_type,object_type,object_id,detail,created_at)
    select ${authority.email},${EVENT},${OBJECT},${String(record.id)},${detail},${recordedAt}
    where (${authority.guard()}) and not exists(select 1 from audit_events where ${scopeWhere(authority)} and json_extract(detail,'$.receiptDigest')=${digest})`);
  const [row] = await db.select().from(auditEvents).where(sql`${scopeWhere(authority)} and json_extract(${auditEvents.detail},'$.receiptDigest')=${digest} and (${authority.guard()})`).limit(1);
  if (!row) throw new HistoryError(409, "The account, permission or saved case changed before this report could be recorded.");
  return { record: historyRecord(row), alreadyRecorded: result.meta.changes === 0 };
}
