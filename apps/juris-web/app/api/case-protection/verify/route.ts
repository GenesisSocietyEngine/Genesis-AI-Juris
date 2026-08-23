import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { caseDrafts, caseVersions, customCaseGrants, customCases } from "../../../../db/schema";
import { normalizeStoredCaseProtection, verifyCaseProtection } from "../../../case-protection";
import { caseFingerprint, isRecord, legacyCaseFingerprintV15, normalizeStudioDraft } from "../../../case-integrity";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { canViewCustomCase, normalizeEmail } from "../../../custom-case-access";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { getOrCreateCaseProtectionKey, resolveExactCaseArtifact, type StoredCaseArtifact } from "../../../server-case-protection";
import { isPlatformAdmin } from "../../../server-authorization";
import { STUDIO_CASE_BODY_LIMIT } from "../../../studio-envelope";
import type { CaseProtectionV1, StudioDraft } from "../../../types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request, STUDIO_CASE_BODY_LIMIT);
  if (!payload || !isRecord(payload.draft)) return privateJson({ error: "An exact Studio draft is required." }, 400);

  let draft: StudioDraft;
  let protection: CaseProtectionV1 | null;
  try {
    draft = normalizeStudioDraft({ ...payload.draft, protection: payload.protection ?? payload.draft.protection });
    protection = normalizeStoredCaseProtection(draft.protection);
  } catch {
    return verification(false, false, false, "none", null, null);
  }
  const fingerprint = caseFingerprint(draft);
  if (!protection) return verification(false, false, false, "none", null, fingerprint);

  const db = getDb();
  try {
    const key = await getOrCreateCaseProtectionKey(db);
    const candidates = [fingerprint];
    const legacyFingerprint = legacyCaseFingerprintV15(draft);
    if (legacyFingerprint !== fingerprint) candidates.push(legacyFingerprint);
    let artifact: StoredCaseArtifact | null = null;
    for (const candidate of candidates) {
      const sealValid = await verifyCaseProtection(protection, {
        caseId: draft.caseId,
        version: draft.version,
        studioFingerprint: candidate,
        parentCaseId: draft.parent?.caseId ?? null,
        parentVersion: draft.parent?.version ?? null,
        parentFingerprint: draft.parent?.fingerprint ?? null,
        parentCode: protection.parentCode,
        copyPolicy: protection.copyPolicy,
      }, key);
      if (!sealValid) continue;
      const resolved = await resolveExactCaseArtifact(db, { caseId: draft.caseId, version: draft.version, fingerprint: candidate }, key);
      if (!resolved || resolved.currentCode !== protection.currentCode || resolved.protection?.seal !== protection.seal) continue;
      // A v15 seal did not bind relationship IDs. Accept it only when the
      // complete v16 runnable fingerprint matches the authoritative stored
      // payload, so changing an option identity cannot reuse the old seal.
      if (candidate === legacyFingerprint && candidate !== fingerprint
        && await authoritativeCurrentFingerprint(db, resolved) !== fingerprint) continue;
      artifact = resolved;
      break;
    }
    if (!artifact) {
      return verification(false, false, false, "none", null, fingerprint);
    }

    const email = normalizeEmail(identity.email);
    const admin = isPlatformAdmin(identity);
    let access: "owner" | "shared" | "admin" | "public" | "none" = artifact.source === "published" ? "public" : "none";
    let ownerCustomCaseId: number | null = null;
    if (artifact.customCaseId) {
      const [envelope] = await db.select().from(customCases).where(eq(customCases.id, artifact.customCaseId)).limit(1);
      const [grant] = envelope ? await db.select({ id: customCaseGrants.id }).from(customCaseGrants).where(and(
        eq(customCaseGrants.customCaseId, envelope.id),
        eq(customCaseGrants.recipientEmail, email),
      )).limit(1) : [];
      if (envelope && normalizeEmail(envelope.ownerEmail) === email) {
        access = "owner";
        ownerCustomCaseId = envelope.id;
      } else if (artifact.source !== "published" && envelope && canViewCustomCase({
        viewerEmail: email,
        ownerEmail: envelope.ownerEmail,
        isPrivate: envelope.isPrivate,
        isAdmin: admin,
        hasGrant: Boolean(grant),
      })) {
        access = admin ? "admin" : "shared";
      }
    }
    if (access === "none") return verification(false, false, false, "none", null, fingerprint);
    const canDuplicate = access === "owner" || !artifact.copyProtected;
    return verification(true, artifact.copyProtected, canDuplicate, access, ownerCustomCaseId, artifact.studioFingerprint);
  } catch {
    return verification(false, false, false, "none", null, fingerprint);
  }
}

async function authoritativeCurrentFingerprint(db: ReturnType<typeof getDb>, artifact: StoredCaseArtifact) {
  let payload: unknown;
  if (artifact.source === "custom") {
    if (!artifact.customCaseId) return null;
    const records = await db.select({ payload: caseDrafts.payload }).from(caseDrafts).where(and(
      eq(caseDrafts.customCaseId, artifact.customCaseId),
      eq(caseDrafts.caseId, artifact.caseId),
      eq(caseDrafts.version, artifact.version),
      eq(caseDrafts.fingerprint, artifact.studioFingerprint),
    )).limit(2);
    if (records.length !== 1) return null;
    payload = records[0].payload;
  } else {
    const records = await db.select({ payload: caseVersions.payload }).from(caseVersions).where(and(
      eq(caseVersions.caseId, artifact.caseId),
      eq(caseVersions.version, artifact.version),
      eq(caseVersions.studioFingerprint, artifact.studioFingerprint),
    )).limit(2);
    if (records.length !== 1) return null;
    payload = records[0].payload;
  }
  try {
    const storedDraft = isRecord(payload) && isRecord(payload.studioDraft) ? payload.studioDraft : payload;
    return caseFingerprint(normalizeStudioDraft(storedDraft));
  } catch {
    return null;
  }
}

function verification(valid: boolean, copyProtected: boolean, canDuplicate: boolean, access: "owner" | "shared" | "admin" | "public" | "none", customCaseId: number | null, fingerprint: string | null) {
  return privateJson({ valid, copyProtected, canDuplicate, access, customCaseId: access === "owner" ? customCaseId : null, fingerprint });
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
