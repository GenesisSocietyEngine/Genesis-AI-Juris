import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, caseDrafts, caseVersions, customCaseGrants, customCases, users } from "../../../db/schema";
import { buildCaseProtection, requestedCopyProtection, verifyCaseProtection } from "../../case-protection";
import { caseFingerprint, normalizeStudioDraft, studioStructuralIssues } from "../../case-integrity";
import { getChatGPTUser } from "../../chatgpt-auth";
import { canViewCustomCase, normalizeEmail } from "../../custom-case-access";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { CaseProtectionIntegrityError, getOrCreateCaseProtectionKey, resolveExactCaseArtifact, type StoredCaseArtifact } from "../../server-case-protection";
import { isPlatformAdmin } from "../../server-authorization";
import { STUDIO_CASE_BODY_LIMIT } from "../../studio-envelope";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const rows = await getDb().select({
    id: caseDrafts.id,
    customCaseId: caseDrafts.customCaseId,
    caseId: caseDrafts.caseId,
    version: caseDrafts.version,
    fingerprint: caseDrafts.fingerprint,
    title: caseDrafts.title,
    status: caseDrafts.status,
    reviewerNote: caseDrafts.reviewerNote,
    submittedAt: caseDrafts.submittedAt,
    reviewedAt: caseDrafts.reviewedAt,
    updatedAt: caseDrafts.updatedAt,
    isPrivate: customCases.isPrivate,
    customStatus: customCases.status,
  }).from(caseDrafts).leftJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(eq(caseDrafts.userEmail, identity.email.toLowerCase())).orderBy(desc(caseDrafts.updatedAt)).limit(50);
  return privateJson({ submissions: rows });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request, STUDIO_CASE_BODY_LIMIT);
  if (!payload || (payload.action !== "save" && payload.action !== "submit")) return privateJson({ error: "A valid save or submit request is required." }, 400);
  const email = identity.email.toLowerCase();
  const admin = isPlatformAdmin(identity);
  const db = getDb();
  const [profile] = await db.select({ email: users.email }).from(users).where(eq(users.email, email)).limit(1);
  if (!profile) return privateJson({ error: "Complete your professional profile before saving a shared workspace draft." }, 409);
  let draft;
  try { draft = normalizeStudioDraft(payload.draft); } catch { return privateJson({ error: "The Studio draft failed integrity validation." }, 400); }
  const structuralIssues = studioStructuralIssues(draft);
  if (payload.action === "submit" && structuralIssues.length) return privateJson({ error: "Resolve the Studio integrity checks before submission.", issues: structuralIssues }, 422);
  const fingerprint = caseFingerprint(draft);
  const [existingCustom] = await db.select().from(customCases).where(and(eq(customCases.ownerEmail, email), eq(customCases.caseId, draft.caseId))).limit(1);
  // Once a workspace envelope exists, visibility changes only through the
  // dedicated privacy action. A stale save from another tab cannot un-private it.
  const requestedPrivate = existingCustom ? existingCustom.isPrivate : payload.isPrivate === true;
  if (payload.action === "submit" && requestedPrivate) return privateJson({ error: "Turn off Private before submitting a case for review." }, 409);
  const [existing] = await db.select({
    id: caseDrafts.id,
    customCaseId: caseDrafts.customCaseId,
    status: caseDrafts.status,
    fingerprint: caseDrafts.fingerprint,
    updatedAt: caseDrafts.updatedAt,
  }).from(caseDrafts).where(and(
    eq(caseDrafts.userEmail, email), eq(caseDrafts.caseId, draft.caseId), eq(caseDrafts.version, draft.version),
  )).limit(1);
  if (existing && ["accepted", "published"].includes(existing.status)) return privateJson({ error: "An accepted version is immutable. Create a child version." }, 409);
  if (existing?.status === "submitted") return privateJson({ error: "A submitted version is frozen until a reviewer requests changes." }, 409);

  const expectedFingerprint = requestFingerprint(payload.expectedFingerprint);
  const baseFingerprint = requestFingerprint(payload.baseFingerprint);
  if ((payload.expectedFingerprint !== undefined && !expectedFingerprint) || (payload.baseFingerprint !== undefined && !baseFingerprint)) {
    return privateJson({ error: "Draft concurrency fingerprints must use the sha256 content-fingerprint format." }, 400);
  }

  if (existingCustom) {
    const exactCurrentVersion = existingCustom.currentVersion === draft.version;
    if (exactCurrentVersion) {
      if (!existing || existing.customCaseId !== existingCustom.id || !expectedFingerprint) {
        return staleDraft(existingCustom, existing, "Reopen this case before overwriting its current version.");
      }
      if (expectedFingerprint !== existing.fingerprint || (baseFingerprint && baseFingerprint !== existingCustom.fingerprint)) {
        return staleDraft(existingCustom, existing);
      }
    } else {
      // A new version is a compare-and-swap against the workspace envelope.
      // Historical versions are never made current again by saving over them.
      if (existing || !baseFingerprint || baseFingerprint !== existingCustom.fingerprint
        || draft.parent?.caseId !== existingCustom.caseId
        || draft.parent.version !== existingCustom.currentVersion
        || draft.parent.fingerprint !== existingCustom.fingerprint) {
        return staleDraft(existingCustom, existing, "Create the child version again from the current workspace case.");
      }
    }
  } else if (existing) {
    return staleDraft(null, existing, "The workspace envelope is missing; reopen the case before saving.");
  }

  let protectionKey: Uint8Array;
  let currentArtifact: StoredCaseArtifact | null = null;
  let parentArtifact: StoredCaseArtifact | null = null;
  try {
    protectionKey = await getOrCreateCaseProtectionKey(db);
    if (existingCustom) {
      currentArtifact = await resolveExactCaseArtifact(db, {
        caseId: existingCustom.caseId,
        version: existingCustom.currentVersion,
        fingerprint: existingCustom.fingerprint,
        preferredCustomCaseId: existingCustom.id,
      }, protectionKey);
      if (!currentArtifact) return staleDraft(existingCustom, existing, "The current protected workspace artifact is unavailable.");
    }

    if (draft.parent) {
      const parentIsEnvelopeCurrent = Boolean(existingCustom
        && draft.parent.caseId === existingCustom.caseId
        && draft.parent.version === existingCustom.currentVersion
        && draft.parent.fingerprint === existingCustom.fingerprint);
      const preferredCustomCaseId = existingCustom && draft.parent.caseId === existingCustom.caseId ? existingCustom.id : null;
      parentArtifact = await resolveExactCaseArtifact(db, { ...draft.parent, preferredCustomCaseId }, protectionKey);
      if (!parentArtifact && preferredCustomCaseId && !parentIsEnvelopeCurrent) {
        parentArtifact = await resolveExactCaseArtifact(db, draft.parent, protectionKey);
      }
      if (!parentArtifact) return lineageFailure("The exact parent case fingerprint is unavailable.");
      if (!await canUseArtifact(db, parentArtifact, email, admin)) return lineageFailure("The exact parent case fingerprint is unavailable.");
    }

    if (existingCustom?.currentVersion === draft.version && currentArtifact && !sameParentLineage(currentArtifact, draft.parent)) {
      return lineageFailure("The parent lineage of an existing version cannot be replaced.");
    }

    if (!existingCustom) {
      const exactArtifact = await resolveExactCaseArtifact(db, { caseId: draft.caseId, version: draft.version, fingerprint }, protectionKey);
      if (exactArtifact && !await canUseArtifact(db, exactArtifact, email, admin)) return lineageFailure("The exact case artifact is unavailable.");
      if (exactArtifact?.copyProtected) return copyProtectionFailure();
    }

    const continuingProtectedLineage = Boolean(existingCustom && parentArtifact
      && parentArtifact.customCaseId === existingCustom.id
      && parentArtifact.caseId === draft.caseId);
    if (parentArtifact?.copyProtected && !continuingProtectedLineage) return copyProtectionFailure();

    // A valid imported seal is recognized, but never reused as authority. The
    // server still rebuilds every code and seal from the exact stored lineage.
    if (draft.protection?.currentCode && draft.protection.seal) {
      let importedSealValid = false;
      try {
        importedSealValid = await verifyCaseProtection(draft.protection, {
          caseId: draft.caseId,
          version: draft.version,
          studioFingerprint: fingerprint,
          parentCaseId: draft.parent?.caseId ?? null,
          parentVersion: draft.parent?.version ?? null,
          parentFingerprint: draft.parent?.fingerprint ?? null,
          parentCode: draft.protection.parentCode,
          copyPolicy: draft.protection.copyPolicy,
        }, protectionKey);
      } catch { /* Untrusted client codes are discarded and rebuilt below. */ }
      if (!importedSealValid && draft.protection.copyProtected && !existingCustom) {
        return lineageFailure("The imported protected-case seal does not match this exact Studio artifact.");
      }
    }
  } catch (error) {
    if (error instanceof CaseProtectionIntegrityError) return lineageFailure(error.message);
    return privateJson({ error: "Case protection could not be verified." }, 503);
  }

  const copyProtected = payload.copyProtected === true
    || requestedCopyProtection(draft.protection)
    || currentArtifact?.copyProtected === true
    || parentArtifact?.copyProtected === true;
  const protection = await buildCaseProtection({
    caseId: draft.caseId,
    version: draft.version,
    studioFingerprint: fingerprint,
    parentCaseId: draft.parent?.caseId ?? null,
    parentVersion: draft.parent?.version ?? null,
    parentFingerprint: draft.parent?.fingerprint ?? null,
    parentCode: parentArtifact?.currentCode ?? null,
    copyPolicy: copyProtected ? "lineage_locked" : "fork_allowed",
  }, protectionKey);
  const protectedDraft = { ...draft, protection };

  const now = new Date().toISOString();
  const status = payload.action === "submit" ? "submitted" : "draft";

  const draftValues = {
    userEmail: email,
    caseId: draft.caseId,
    version: draft.version,
    fingerprint,
    title: draft.title,
    payload: protectedDraft as unknown as Record<string, unknown>,
    status,
    submittedAt: payload.action === "submit" ? now : null,
    updatedAt: now,
  };
  const parentWriteGuard = artifactWriteGuard(parentArtifact, email, admin);
  const finalDraftId = sql<string>`(
    SELECT CAST(${caseDrafts.id} AS TEXT)
    FROM ${caseDrafts}
    INNER JOIN ${customCases} ON ${customCases.id} = ${caseDrafts.customCaseId}
    WHERE ${caseDrafts.userEmail} = ${email}
      AND ${caseDrafts.caseId} = ${draft.caseId}
      AND ${caseDrafts.version} = ${draft.version}
      AND ${caseDrafts.fingerprint} = ${fingerprint}
      AND ${caseDrafts.status} = ${status}
      AND json_extract(${caseDrafts.payload}, '$.protection.currentCode') = ${protection.currentCode}
      AND ${customCases.ownerEmail} = ${email}
      AND ${customCases.caseId} = ${draft.caseId}
      AND ${customCases.currentVersion} = ${draft.version}
      AND ${customCases.fingerprint} = ${fingerprint}
      AND ${parentWriteGuard}
    LIMIT 1
  )`;
  const auditWrite = db.insert(auditEvents).values({
    actorEmail: email,
    eventType: payload.action === "submit" ? "case_submitted" : "case_draft_saved",
    objectType: "case_draft",
    // A scalar subquery returns NULL if any compare-and-swap write missed.
    // object_id is NOT NULL, so D1 rolls the whole batch back atomically.
    objectId: finalDraftId,
    detail: {
      customCaseId: existingCustom?.id ?? null,
      caseId: draft.caseId,
      version: draft.version,
      fingerprint,
      baseFingerprint: existingCustom?.fingerprint ?? null,
      isPrivate: requestedPrivate,
      copyProtected,
      protectionCode: protection.currentCode,
    },
  });

  try {
    if (!existingCustom) {
      const customCaseId = sql<number>`(
        SELECT ${customCases.id} FROM ${customCases}
        WHERE ${customCases.ownerEmail} = ${email} AND ${customCases.caseId} = ${draft.caseId}
        LIMIT 1
      )`;
      await db.batch([
        db.insert(customCases).values({
          ownerEmail: email,
          caseId: draft.caseId,
          title: draft.title,
          currentVersion: draft.version,
          fingerprint,
          isPrivate: requestedPrivate,
          status: "custom",
          updatedAt: now,
        }).onConflictDoNothing(),
        db.insert(caseDrafts).values({ ...draftValues, customCaseId }).onConflictDoNothing(),
        auditWrite,
      ]);
    } else if (existing) {
      const expected = expectedFingerprint!;
      const base = baseFingerprint ?? expected;
      const protectionCompareAndSwap = currentArtifact?.protection
        ? sql`json_extract(${caseDrafts.payload}, '$.protection.currentCode') = ${currentArtifact.currentCode}`
        : sql`json_extract(${caseDrafts.payload}, '$.protection.currentCode') IS NULL`;
      const currentEnvelopeExists = sql`EXISTS (
        SELECT 1 FROM ${customCases}
        WHERE ${customCases.id} = ${existingCustom.id}
          AND ${customCases.ownerEmail} = ${email}
          AND ${customCases.caseId} = ${draft.caseId}
          AND ${customCases.currentVersion} = ${draft.version}
          AND ${customCases.fingerprint} = ${base}
      )`;
      const finalDraftExists = sql`EXISTS (
        SELECT 1 FROM ${caseDrafts}
        WHERE ${caseDrafts.id} = ${existing.id}
          AND ${caseDrafts.customCaseId} = ${existingCustom.id}
          AND ${caseDrafts.fingerprint} = ${fingerprint}
          AND ${caseDrafts.status} = ${status}
          AND json_extract(${caseDrafts.payload}, '$.protection.currentCode') = ${protection.currentCode}
      )`;
      await db.batch([
        db.update(caseDrafts).set({
          customCaseId: existingCustom.id,
          fingerprint,
          title: draft.title,
          payload: protectedDraft as unknown as Record<string, unknown>,
          status,
          ...(payload.action === "submit" ? { submittedAt: now } : {}),
          updatedAt: now,
        }).where(and(eq(caseDrafts.id, existing.id), eq(caseDrafts.fingerprint, expected), eq(caseDrafts.status, existing.status), protectionCompareAndSwap, currentEnvelopeExists)),
        db.update(customCases).set({ title: draft.title, fingerprint, updatedAt: now }).where(and(
          eq(customCases.id, existingCustom.id),
          eq(customCases.ownerEmail, email),
          eq(customCases.currentVersion, draft.version),
          eq(customCases.fingerprint, base),
          finalDraftExists,
        )),
        auditWrite,
      ]);
    } else {
      const base = baseFingerprint!;
      const finalDraftExists = sql`EXISTS (
        SELECT 1 FROM ${caseDrafts}
        WHERE ${caseDrafts.customCaseId} = ${existingCustom.id}
          AND ${caseDrafts.userEmail} = ${email}
          AND ${caseDrafts.caseId} = ${draft.caseId}
          AND ${caseDrafts.version} = ${draft.version}
          AND ${caseDrafts.fingerprint} = ${fingerprint}
          AND ${caseDrafts.status} = ${status}
          AND json_extract(${caseDrafts.payload}, '$.protection.currentCode') = ${protection.currentCode}
      )`;
      await db.batch([
        db.insert(caseDrafts).values({ ...draftValues, customCaseId: existingCustom.id }).onConflictDoNothing(),
        db.update(customCases).set({
          title: draft.title,
          currentVersion: draft.version,
          fingerprint,
          updatedAt: now,
        }).where(and(
          eq(customCases.id, existingCustom.id),
          eq(customCases.ownerEmail, email),
          eq(customCases.currentVersion, existingCustom.currentVersion),
          eq(customCases.fingerprint, base),
          finalDraftExists,
        )),
        auditWrite,
      ]);
    }
  } catch {
    const [freshCustom] = await db.select().from(customCases).where(and(eq(customCases.ownerEmail, email), eq(customCases.caseId, draft.caseId))).limit(1);
    const [freshDraft] = await db.select({ id: caseDrafts.id, customCaseId: caseDrafts.customCaseId, status: caseDrafts.status, fingerprint: caseDrafts.fingerprint, updatedAt: caseDrafts.updatedAt }).from(caseDrafts).where(and(
      eq(caseDrafts.userEmail, email), eq(caseDrafts.caseId, draft.caseId), eq(caseDrafts.version, draft.version),
    )).limit(1);
    if (payload.action === "submit" && freshCustom?.isPrivate) {
      return privateJson({ error: "Case visibility changed before review submission. Reopen the case and use its current visibility." }, 409);
    }
    return staleDraft(freshCustom ?? null, freshDraft);
  }

  const [customCase] = await db.select({
    id: customCases.id,
    currentVersion: customCases.currentVersion,
    fingerprint: customCases.fingerprint,
    isPrivate: customCases.isPrivate,
    status: customCases.status,
    updatedAt: customCases.updatedAt,
  }).from(customCases).where(and(eq(customCases.ownerEmail, email), eq(customCases.caseId, draft.caseId))).limit(1);
  const [saved] = await db.select({
    id: caseDrafts.id,
    customCaseId: caseDrafts.customCaseId,
    caseId: caseDrafts.caseId,
    version: caseDrafts.version,
    fingerprint: caseDrafts.fingerprint,
    status: caseDrafts.status,
    updatedAt: caseDrafts.updatedAt,
    protectionCode: sql<string | null>`json_extract(${caseDrafts.payload}, '$.protection.currentCode')`,
  }).from(caseDrafts).where(and(
    eq(caseDrafts.userEmail, email), eq(caseDrafts.caseId, draft.caseId), eq(caseDrafts.version, draft.version), eq(caseDrafts.fingerprint, fingerprint), eq(caseDrafts.status, status),
  )).limit(1);
  if (!customCase || !saved || saved.customCaseId !== customCase.id || saved.protectionCode !== protection.currentCode) return staleDraft(customCase ?? null, saved);
  const savedResponse = {
    id: saved.id,
    customCaseId: saved.customCaseId,
    caseId: saved.caseId,
    version: saved.version,
    fingerprint: saved.fingerprint,
    status: saved.status,
    updatedAt: saved.updatedAt,
  };
  return privateJson({
    submission: { ...savedResponse, protection },
    customCase: { ...customCase, caseId: draft.caseId, title: draft.title, copyProtected, protection },
  }, payload.action === "submit" ? 201 : 200);
}

function requestFingerprint(value: unknown) {
  return typeof value === "string" && /^sha256-[a-f0-9]{64}$/.test(value) ? value : null;
}

function sameParentLineage(artifact: StoredCaseArtifact, parent: { caseId: string; version: string; fingerprint: string } | null) {
  if (!parent) return artifact.parentCaseId === null && artifact.parentVersion === null && artifact.parentFingerprint === null;
  return artifact.parentCaseId === parent.caseId && artifact.parentVersion === parent.version && artifact.parentFingerprint === parent.fingerprint;
}

function lineageFailure(message: string) {
  return privateJson({ error: message, code: "lineage_invalid" }, 409);
}

function copyProtectionFailure() {
  return privateJson({ error: "This case is lineage-locked and cannot be saved as a fork.", code: "copy_protected" }, 403);
}

async function canUseArtifact(db: ReturnType<typeof getDb>, artifact: StoredCaseArtifact, viewerEmail: string, admin: boolean) {
  if (artifact.source === "published") return true;
  if (!artifact.customCaseId) return false;
  const [envelope] = await db.select({ ownerEmail: customCases.ownerEmail, isPrivate: customCases.isPrivate }).from(customCases).where(eq(customCases.id, artifact.customCaseId)).limit(1);
  if (!envelope) return false;
  const owner = normalizeEmail(envelope.ownerEmail) === normalizeEmail(viewerEmail);
  const [grant] = owner ? [] : await db.select({ id: customCaseGrants.id }).from(customCaseGrants).where(and(
    eq(customCaseGrants.customCaseId, artifact.customCaseId),
    eq(customCaseGrants.recipientEmail, normalizeEmail(viewerEmail)),
  )).limit(1);
  return canViewCustomCase({
    viewerEmail,
    ownerEmail: envelope.ownerEmail,
    isPrivate: envelope.isPrivate,
    isAdmin: admin,
    hasGrant: Boolean(grant),
  });
}

function artifactWriteGuard(artifact: StoredCaseArtifact | null, viewerEmail: string, admin: boolean) {
  if (!artifact) return sql<boolean>`1 = 1`;
  if (artifact.source === "published") {
    const storedCode = sql<string | null>`coalesce(
      json_extract(${caseVersions.payload}, '$.protection.currentCode'),
      json_extract(${caseVersions.payload}, '$.artifactBinding.caseProtection.currentCode'),
      json_extract(${caseVersions.payload}, '$.studioDraft.protection.currentCode')
    )`;
    const codeStillMatches = artifact.protection
      ? sql<boolean>`${storedCode} = ${artifact.currentCode}`
      : sql<boolean>`${storedCode} IS NULL`;
    return sql<boolean>`EXISTS (
      SELECT 1 FROM ${caseVersions}
      WHERE ${caseVersions.caseId} = ${artifact.caseId}
        AND ${caseVersions.version} = ${artifact.version}
        AND coalesce(${caseVersions.studioFingerprint}, ${caseVersions.fingerprint}) = ${artifact.studioFingerprint}
        AND ${caseVersions.publishedAt} IS NOT NULL
        AND ${codeStillMatches}
    )`;
  }
  if (!artifact.customCaseId) return sql<boolean>`0 = 1`;
  const storedCode = sql<string | null>`json_extract(${caseDrafts.payload}, '$.protection.currentCode')`;
  const codeStillMatches = artifact.protection
    ? sql<boolean>`${storedCode} = ${artifact.currentCode}`
    : sql<boolean>`${storedCode} IS NULL`;
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${caseDrafts}
    INNER JOIN ${customCases} ON ${customCases.id} = ${caseDrafts.customCaseId}
    WHERE ${caseDrafts.customCaseId} = ${artifact.customCaseId}
      AND ${caseDrafts.caseId} = ${artifact.caseId}
      AND ${caseDrafts.version} = ${artifact.version}
      AND ${caseDrafts.fingerprint} = ${artifact.studioFingerprint}
      AND ${codeStillMatches}
      AND (
        lower(trim(${customCases.ownerEmail})) = ${normalizeEmail(viewerEmail)}
        OR (${customCases.isPrivate} = false AND (
          ${admin ? 1 : 0} = 1
          OR EXISTS (
            SELECT 1 FROM ${customCaseGrants}
            WHERE ${customCaseGrants.customCaseId} = ${artifact.customCaseId}
              AND ${customCaseGrants.recipientEmail} = ${normalizeEmail(viewerEmail)}
          )
        ))
      )
  )`;
}

function staleDraft(customCase: Pick<typeof customCases.$inferSelect, "id" | "currentVersion" | "fingerprint" | "updatedAt"> | null | undefined, draft: { fingerprint?: string; updatedAt?: string } | null | undefined, message = "This case changed in another session. Reopen it before saving your edits.") {
  return privateJson({
    error: message,
    code: "stale_draft",
    current: customCase ? {
      customCaseId: customCase.id,
      version: customCase.currentVersion,
      fingerprint: customCase.fingerprint,
      updatedAt: customCase.updatedAt,
      draftFingerprint: draft?.fingerprint ?? null,
      draftUpdatedAt: draft?.updatedAt ?? null,
    } : null,
  }, 409);
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
