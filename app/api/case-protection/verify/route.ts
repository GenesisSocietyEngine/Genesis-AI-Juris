import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { customCaseGrants, customCases } from "../../../../db/schema";
import { normalizeStoredCaseProtection, verifyCaseProtection } from "../../../case-protection";
import { caseFingerprint, isRecord, normalizeStudioDraft } from "../../../case-integrity";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { canViewCustomCase, normalizeEmail } from "../../../custom-case-access";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { getOrCreateCaseProtectionKey, resolveExactCaseArtifact } from "../../../server-case-protection";
import { isPlatformAdmin } from "../../../server-authorization";
import type { CaseProtectionV1, StudioDraft } from "../../../types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request, 512_000);
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
    const sealValid = await verifyCaseProtection(protection, {
      caseId: draft.caseId,
      version: draft.version,
      studioFingerprint: fingerprint,
      parentCaseId: draft.parent?.caseId ?? null,
      parentVersion: draft.parent?.version ?? null,
      parentFingerprint: draft.parent?.fingerprint ?? null,
      parentCode: protection.parentCode,
      copyPolicy: protection.copyPolicy,
    }, key);
    if (!sealValid) return verification(false, false, false, "none", null, fingerprint);

    const artifact = await resolveExactCaseArtifact(db, { caseId: draft.caseId, version: draft.version, fingerprint }, key);
    if (!artifact || artifact.currentCode !== protection.currentCode || artifact.protection?.seal !== protection.seal) {
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
    return verification(true, artifact.copyProtected, canDuplicate, access, ownerCustomCaseId, fingerprint);
  } catch {
    return verification(false, false, false, "none", null, fingerprint);
  }
}

function verification(valid: boolean, copyProtected: boolean, canDuplicate: boolean, access: "owner" | "shared" | "admin" | "public" | "none", customCaseId: number | null, fingerprint: string | null) {
  return privateJson({ valid, copyProtected, canDuplicate, access, customCaseId: access === "owner" ? customCaseId : null, fingerprint });
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
