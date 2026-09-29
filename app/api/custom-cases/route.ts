import { and, desc, eq, exists, getTableColumns, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, caseDrafts, caseFeedback, customCaseGrants, customCases, users } from "../../../db/schema";
import { normalizeStoredCaseProtection, verifyCaseProtection } from "../../case-protection";
import { caseFingerprint, casePublicationFingerprint, legacyCaseFingerprintV15, normalizeStudioDraft } from "../../case-integrity";
import { canShareCustomCase, canViewCustomCase, normalizeEmail, normalizeLicenseTier } from "../../custom-case-access";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { getOrCreateCaseProtectionKey } from "../../server-case-protection";
import { isPlatformAdmin } from "../../server-authorization";
import type { CaseProtectionV1 } from "../../types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const email = normalizeEmail(identity.email);
  const admin = isPlatformAdmin(identity);
  const db = getDb();
  const [profile] = await db.select({ licenseTier: users.licenseTier }).from(users).where(eq(users.email, email)).limit(1);
  const licenseTier = normalizeLicenseTier(profile?.licenseTier);
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");

  if (idParam) {
    const id = Number(idParam);
    const [record] = Number.isInteger(id) && id > 0 ? await db.select().from(customCases).where(eq(customCases.id, id)).limit(1) : [];
    const [viewerGrant] = record ? await db.select().from(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, record.id), eq(customCaseGrants.recipientEmail, email))).limit(1) : [];
    if (!record || !canViewCustomCase({ viewerEmail: email, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(viewerGrant) })) {
      return privateJson({ error: "Custom case not found." }, 404);
    }
    const [draft] = await db.select().from(caseDrafts).where(and(eq(caseDrafts.customCaseId, record.id), eq(caseDrafts.version, record.currentVersion), eq(caseDrafts.fingerprint, record.fingerprint))).orderBy(desc(caseDrafts.updatedAt)).limit(1);
    if (!draft) return privateJson({ error: "Custom case version not found." }, 404);
    let publicationFingerprint: string;
    try {
      const storedDraft = normalizeStudioDraft(draft.payload);
      const currentFingerprint = caseFingerprint(storedDraft);
      const legacyFingerprint = legacyCaseFingerprintV15(storedDraft);
      if (draft.fingerprint !== record.fingerprint || (record.fingerprint !== currentFingerprint && record.fingerprint !== legacyFingerprint)) {
        return privateJson({ error: "Custom case publication binding failed integrity verification." }, 409);
      }
      publicationFingerprint = casePublicationFingerprint(storedDraft);
    } catch {
      return privateJson({ error: "Custom case publication binding failed integrity verification." }, 409);
    }
    let protection: CaseProtectionV1 | null;
    try {
      protection = normalizeStoredCaseProtection(draft.payload.protection);
      if (protection) {
        const parent = storedParentIdentity(draft.payload);
        const key = await getOrCreateCaseProtectionKey(db);
        const valid = await verifyCaseProtection(protection, {
          caseId: record.caseId,
          version: record.currentVersion,
          studioFingerprint: record.fingerprint,
          parentCaseId: parent?.caseId ?? null,
          parentVersion: parent?.version ?? null,
          parentFingerprint: parent?.fingerprint ?? null,
          parentCode: protection.parentCode,
          copyPolicy: protection.copyPolicy,
        }, key);
        if (!valid) return privateJson({ error: "Custom case protection failed integrity verification." }, 409);
      }
    } catch {
      return privateJson({ error: "Custom case protection failed integrity verification." }, 409);
    }
    const owner = normalizeEmail(record.ownerEmail) === email;
    const shares = owner || (admin && !record.isPrivate)
      ? await db.select({ recipientEmail: customCaseGrants.recipientEmail, canReshare: customCaseGrants.canReshare, grantedByEmail: customCaseGrants.grantedByEmail, createdAt: customCaseGrants.createdAt }).from(customCaseGrants).where(eq(customCaseGrants.customCaseId, record.id))
      : [];
    const feedback = owner
      ? await db.select({ id: caseFeedback.id, category: caseFeedback.category, rating: caseFeedback.rating, comment: caseFeedback.comment, severity: caseFeedback.severity, suggestedCorrection: caseFeedback.suggestedCorrection, citationUrl: caseFeedback.citationUrl, contextType: caseFeedback.contextType, contextId: caseFeedback.contextId, audience: caseFeedback.audience, status: caseFeedback.status, createdAt: caseFeedback.createdAt }).from(caseFeedback).where(eq(caseFeedback.customCaseId, record.id)).orderBy(desc(caseFeedback.createdAt)).limit(50)
      : [];
    return privateJson({
      customCase: { ...summarize(record, email, admin, viewerGrant, licenseTier, shares.length, protection?.copyProtected === true), publicationFingerprint, protection },
      draft: protection ? { ...draft.payload, protection } : draft.payload,
      shares,
      feedback,
    });
  }

  const requestedLimit = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 25;
  const cursorParam = url.searchParams.get("cursor");
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) return privateJson({ error: "Invalid custom-case cursor." }, 400);

  const ownerWhere = eq(customCases.ownerEmail, email);
  const viewerGrantExists = exists(db.select({ id: customCaseGrants.id }).from(customCaseGrants).where(and(
    eq(customCaseGrants.customCaseId, customCases.id),
    eq(customCaseGrants.recipientEmail, email),
  )));
  const visibleWhere = admin
    ? or(ownerWhere, eq(customCases.isPrivate, false))!
    : or(ownerWhere, and(eq(customCases.isPrivate, false), viewerGrantExists))!;
  const copyProtected = sql<boolean>`coalesce((
    select case
      when json_extract(${caseDrafts.payload}, '$.protection.copyProtected') = 1
        or json_extract(${caseDrafts.payload}, '$.protection.copyPolicy') = 'lineage_locked'
      then 1 else 0 end
    from ${caseDrafts}
    where ${caseDrafts.customCaseId} = ${customCases.id}
      and ${caseDrafts.version} = ${customCases.currentVersion}
      and ${caseDrafts.fingerprint} = ${customCases.fingerprint}
    order by ${caseDrafts.updatedAt} desc
    limit 1
  ), 0)`;
  const pageWhere = cursor ? and(visibleWhere, or(
    lt(customCases.updatedAt, cursor.updatedAt),
    and(eq(customCases.updatedAt, cursor.updatedAt), lt(customCases.id, cursor.id)),
  )!) : visibleWhere;
  const page = await db.select({ ...getTableColumns(customCases), copyProtected }).from(customCases).where(pageWhere).orderBy(desc(customCases.updatedAt), desc(customCases.id)).limit(limit + 1);
  const records = page.slice(0, limit);
  const nextCursor = page.length > limit && records.length ? encodeCursor(records.at(-1)!) : null;
  if (!records.length) return privateJson({ customCases: [], nextCursor: null, licenseTier, isAdmin: admin });
  const pageIds = records.map((record) => record.id);

  const viewerGrantColumns = {
    id: customCaseGrants.id,
    customCaseId: customCaseGrants.customCaseId,
    recipientEmail: customCaseGrants.recipientEmail,
    grantedByEmail: customCaseGrants.grantedByEmail,
    canReshare: customCaseGrants.canReshare,
    createdAt: customCaseGrants.createdAt,
  };
  const shareCountScope = admin
    ? inArray(customCaseGrants.customCaseId, pageIds)
    : and(inArray(customCases.id, pageIds), eq(customCases.ownerEmail, email));
  const [viewerGrants, countedGrants, ownerProfiles] = await Promise.all([
    db.select(viewerGrantColumns).from(customCaseGrants)
      .innerJoin(customCases, eq(customCaseGrants.customCaseId, customCases.id))
      .where(and(eq(customCaseGrants.recipientEmail, email), inArray(customCases.id, pageIds))),
    db.select({ customCaseId: customCaseGrants.customCaseId, count: sql<number>`count(*)` }).from(customCaseGrants)
      .innerJoin(customCases, eq(customCaseGrants.customCaseId, customCases.id))
      .where(shareCountScope)
      .groupBy(customCaseGrants.customCaseId),
    db.selectDistinct({ email: users.email, displayName: users.displayName }).from(users)
      .innerJoin(customCases, sql<boolean>`lower(trim(${users.email})) = lower(trim(${customCases.ownerEmail}))`)
      .where(inArray(customCases.id, pageIds)),
  ]);
  const viewerGrantByCase = new Map(viewerGrants.map((grant) => [grant.customCaseId, grant]));
  const shareCount = new Map<number, number>(viewerGrants.map((grant) => [grant.customCaseId, 1]));
  for (const item of countedGrants) shareCount.set(item.customCaseId, Number(item.count));
  const ownerNames = new Map(ownerProfiles.map((item) => [normalizeEmail(item.email), item.displayName]));
  const visible = records.flatMap((record) => {
    const viewerGrant = viewerGrantByCase.get(record.id);
    if (!canViewCustomCase({ viewerEmail: email, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(viewerGrant) })) return [];
    return [{ ...summarize(record, email, admin, viewerGrant, licenseTier, shareCount.get(record.id) ?? 0, Boolean(record.copyProtected)), ownerDisplayName: ownerNames.get(normalizeEmail(record.ownerEmail)) ?? "Case author" }];
  });
  return privateJson({ customCases: visible, nextCursor, licenseTier, isAdmin: admin });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request, 48_000);
  const action = payload?.action;
  const id = Number(payload?.id);
  if (!payload || typeof action !== "string" || !Number.isInteger(id) || id <= 0) return privateJson({ error: "A valid custom-case action is required." }, 400);
  const email = normalizeEmail(identity.email);
  const admin = isPlatformAdmin(identity);
  const db = getDb();
  const [record] = await db.select().from(customCases).where(eq(customCases.id, id)).limit(1);
  if (!record) return privateJson({ error: "Custom case not found." }, 404);
  const owner = normalizeEmail(record.ownerEmail) === email;

  // Private existence is itself private. Non-owners receive the same response as
  // they would for an unknown identifier, including administrators and old grantees.
  if (record.isPrivate && !owner) return privateJson({ error: "Custom case not found." }, 404);

  if (action === "set_privacy") {
    if (!owner) return privateJson({ error: "Custom case not found." }, 404);
    if (typeof payload.caseId === "string" && payload.caseId !== record.caseId) return privateJson({ error: "Save this edited case identity before changing its workspace visibility." }, 409);
    const isPrivate = payload.isPrivate === true;
    const now = new Date().toISOString();
    await db.batch([
      db.update(customCases).set({ isPrivate, updatedAt: now }).where(and(eq(customCases.id, id), eq(customCases.ownerEmail, email))),
      ...(isPrivate ? [db.delete(customCaseGrants).where(eq(customCaseGrants.customCaseId, id))] : []),
      db.insert(auditEvents).values({ actorEmail: email, eventType: isPrivate ? "custom_case_made_private" : "custom_case_made_restricted", objectType: "custom_case", objectId: String(id), detail: { grantsRevoked: isPrivate } }),
    ]);
    return privateJson({ customCase: { id, isPrivate }, grantsRevoked: isPrivate });
  }

  const [viewerProfile] = await db.select({ licenseTier: users.licenseTier }).from(users).where(eq(users.email, email)).limit(1);
  const [viewerGrant] = await db.select().from(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, id), eq(customCaseGrants.recipientEmail, email))).limit(1);
  const mayShare = canShareCustomCase({ viewerEmail: email, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(viewerGrant), grantCanReshare: viewerGrant?.canReshare === true, licenseTier: viewerProfile?.licenseTier });

  if (action === "share") {
    if (!mayShare) return privateJson({ error: record.isPrivate ? "Turn off Private before sharing this case." : "A Professional licence and sharing permission are required." }, 403);
    const recipientEmail = typeof payload.recipientEmail === "string" ? normalizeEmail(payload.recipientEmail).slice(0, 320) : "";
    if (!isEmail(recipientEmail) || recipientEmail === normalizeEmail(record.ownerEmail)) return privateJson({ error: "Choose a registered recipient other than the owner." }, 400);
    const [recipient] = await db.select({ email: users.email }).from(users).where(eq(users.email, recipientEmail)).limit(1);
    if (!recipient) return privateJson({ error: "The recipient must register a GENESIS: JURIS profile first." }, 404);
    const [existingRecipientGrant] = await db.select().from(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, id), eq(customCaseGrants.recipientEmail, recipientEmail))).limit(1);
    if (existingRecipientGrant && !admin && !owner && normalizeEmail(existingRecipientGrant.grantedByEmail) !== email) {
      return privateJson({ error: "Only the owner or administrator may replace another grantor's access decision." }, 403);
    }
    const canReshare = payload.canReshare === true && (admin || owner);
    const now = new Date().toISOString();
    const licensedToShare = admin || normalizeLicenseTier(viewerProfile?.licenseTier) !== "community";
    const currentShareAuthority = sql<boolean>`(
      lower(trim(${customCases.ownerEmail})) = ${email}
      OR ${admin ? 1 : 0} = 1
      OR EXISTS (
        SELECT 1 FROM ${customCaseGrants} AS current_grant
        WHERE current_grant.custom_case_id = ${id}
          AND current_grant.recipient_email = ${email}
          AND current_grant.can_reshare = true
      )
    )`;
    const grantWrite = db.insert(customCaseGrants).select(db.select({
      id: sql<number | null>`NULL`.as("id"),
      customCaseId: customCases.id,
      recipientEmail: sql<string>`${recipientEmail}`.as("recipient_email"),
      grantedByEmail: sql<string>`${email}`.as("granted_by_email"),
      canReshare: sql<boolean>`${canReshare}`.as("can_reshare"),
      createdAt: sql<string>`${now}`.as("created_at"),
    }).from(customCases).where(and(
      eq(customCases.id, id),
      eq(customCases.isPrivate, false),
      sql<boolean>`${licensedToShare ? 1 : 0} = 1`,
      currentShareAuthority,
    )).limit(1)).onConflictDoUpdate({
      target: [customCaseGrants.customCaseId, customCaseGrants.recipientEmail],
      set: { grantedByEmail: email, canReshare, createdAt: now },
    });
    const confirmedCaseId = sql<string>`(
      SELECT CAST(${customCases.id} AS TEXT)
      FROM ${customCases}
      WHERE ${customCases.id} = ${id}
        AND ${customCases.isPrivate} = false
        AND EXISTS (
          SELECT 1 FROM ${customCaseGrants}
          WHERE ${customCaseGrants.customCaseId} = ${id}
            AND ${customCaseGrants.recipientEmail} = ${recipientEmail}
            AND ${customCaseGrants.grantedByEmail} = ${email}
            AND ${customCaseGrants.canReshare} = ${canReshare}
        )
      LIMIT 1
    )`;
    try {
      await db.batch([
        grantWrite,
        // objectId is NOT NULL. If privacy or sharing authority changed before
        // this batch, the guarded grant writes no row and this scalar becomes
        // NULL, rolling the complete D1 batch back rather than reviving access.
        db.insert(auditEvents).values({ actorEmail: email, eventType: "custom_case_shared", objectType: "custom_case", objectId: confirmedCaseId, detail: { recipientEmail, canReshare } }),
      ]);
    } catch {
      return privateJson({ error: "Case visibility or sharing authority changed before access could be granted." }, 409);
    }
    return privateJson({ grant: { customCaseId: id, recipientEmail, canReshare } }, 201);
  }

  if (action === "revoke") {
    if (!owner && !admin && !mayShare) return privateJson({ error: "A Professional licence and sharing permission are required." }, 403);
    const recipientEmail = typeof payload.recipientEmail === "string" ? normalizeEmail(payload.recipientEmail).slice(0, 320) : "";
    if (!isEmail(recipientEmail)) return privateJson({ error: "A valid recipient is required." }, 400);
    const [targetGrant] = await db.select().from(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, id), eq(customCaseGrants.recipientEmail, recipientEmail))).limit(1);
    if (targetGrant && !admin && !owner && normalizeEmail(targetGrant.grantedByEmail) !== email) {
      return privateJson({ error: "A forwarding user may revoke only access that they granted." }, 403);
    }
    await db.batch([
      db.delete(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, id), eq(customCaseGrants.recipientEmail, recipientEmail))),
      db.insert(auditEvents).values({ actorEmail: email, eventType: "custom_case_access_revoked", objectType: "custom_case", objectId: String(id), detail: { recipientEmail } }),
    ]);
    return privateJson({ revoked: true });
  }

  return privateJson({ error: "Unsupported custom-case action." }, 400);
}

function summarize(record: typeof customCases.$inferSelect, viewerEmail: string, admin: boolean, grant: typeof customCaseGrants.$inferSelect | undefined, licenseTier: ReturnType<typeof normalizeLicenseTier>, shareCount: number, copyProtected: boolean) {
  const owner = normalizeEmail(record.ownerEmail) === viewerEmail;
  const access = owner ? "owner" : admin ? "admin" : "shared";
  return {
    id: record.id,
    caseId: record.caseId,
    title: record.title,
    currentVersion: record.currentVersion,
    fingerprint: record.fingerprint,
    isPrivate: record.isPrivate,
    copyProtected,
    status: record.status,
    access,
    canShare: canShareCustomCase({ viewerEmail, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(grant), grantCanReshare: grant?.canReshare === true, licenseTier }),
    canManagePrivacy: owner,
    shareCount,
    updatedAt: record.updatedAt,
    promotedAt: record.promotedAt,
  };
}

function storedParentIdentity(payload: Record<string, unknown>) {
  const parent = payload.parent;
  if (typeof parent !== "object" || parent === null || Array.isArray(parent)) return null;
  const record = parent as Record<string, unknown>;
  if (typeof record.caseId !== "string" || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(record.caseId)) return null;
  if (typeof record.version !== "string" || !/^\d+\.\d+\.\d+$/u.test(record.version)) return null;
  if (typeof record.fingerprint !== "string" || !/^sha256-[a-f0-9]{64}$/u.test(record.fingerprint)) return null;
  return { caseId: record.caseId, version: record.version, fingerprint: record.fingerprint };
}

function encodeCursor(record: { updatedAt: string; id: number }) {
  return btoa(JSON.stringify([record.updatedAt, record.id])).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeCursor(value: string) {
  if (!/^[A-Za-z0-9_-]{4,256}$/u.test(value)) return null;
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded: unknown = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const [updatedAt, id] = decoded;
    if (typeof updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{3}Z)?$/u.test(updatedAt) || !Number.isSafeInteger(id) || Number(id) <= 0) return null;
    const canonicalInput = updatedAt.includes(" ") ? `${updatedAt.replace(" ", "T")}Z` : updatedAt;
    const parsedAt = new Date(canonicalInput);
    if (!Number.isFinite(parsedAt.getTime())) return null;
    const canonicalAt = updatedAt.includes(" ") ? parsedAt.toISOString().slice(0, 19).replace("T", " ") : parsedAt.toISOString();
    if (canonicalAt !== updatedAt) return null;
    return { updatedAt, id: Number(id) };
  } catch {
    return null;
  }
}

function isEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
