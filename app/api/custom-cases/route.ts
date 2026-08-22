import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, caseDrafts, caseFeedback, customCaseGrants, customCases, users } from "../../../db/schema";
import { canShareCustomCase, canViewCustomCase, normalizeEmail, normalizeLicenseTier } from "../../custom-case-access";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { isPlatformAdmin } from "../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const email = normalizeEmail(identity.email);
  const admin = isPlatformAdmin(email);
  const db = getDb();
  const [profile] = await db.select({ licenseTier: users.licenseTier }).from(users).where(eq(users.email, email)).limit(1);
  const licenseTier = normalizeLicenseTier(profile?.licenseTier);
  const idParam = new URL(request.url).searchParams.get("id");

  if (idParam) {
    const id = Number(idParam);
    const [record] = Number.isInteger(id) && id > 0 ? await db.select().from(customCases).where(eq(customCases.id, id)).limit(1) : [];
    const [viewerGrant] = record ? await db.select().from(customCaseGrants).where(and(eq(customCaseGrants.customCaseId, record.id), eq(customCaseGrants.recipientEmail, email))).limit(1) : [];
    if (!record || !canViewCustomCase({ viewerEmail: email, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(viewerGrant) })) {
      return privateJson({ error: "Custom case not found." }, 404);
    }
    const [draft] = await db.select().from(caseDrafts).where(and(eq(caseDrafts.customCaseId, record.id), eq(caseDrafts.version, record.currentVersion), eq(caseDrafts.fingerprint, record.fingerprint))).orderBy(desc(caseDrafts.updatedAt)).limit(1);
    if (!draft) return privateJson({ error: "Custom case version not found." }, 404);
    const owner = normalizeEmail(record.ownerEmail) === email;
    const shares = owner || (admin && !record.isPrivate)
      ? await db.select({ recipientEmail: customCaseGrants.recipientEmail, canReshare: customCaseGrants.canReshare, grantedByEmail: customCaseGrants.grantedByEmail, createdAt: customCaseGrants.createdAt }).from(customCaseGrants).where(eq(customCaseGrants.customCaseId, record.id))
      : [];
    const feedback = owner
      ? await db.select({ id: caseFeedback.id, category: caseFeedback.category, rating: caseFeedback.rating, comment: caseFeedback.comment, severity: caseFeedback.severity, suggestedCorrection: caseFeedback.suggestedCorrection, citationUrl: caseFeedback.citationUrl, contextType: caseFeedback.contextType, contextId: caseFeedback.contextId, audience: caseFeedback.audience, status: caseFeedback.status, createdAt: caseFeedback.createdAt }).from(caseFeedback).where(eq(caseFeedback.customCaseId, record.id)).orderBy(desc(caseFeedback.createdAt)).limit(50)
      : [];
    return privateJson({
      customCase: summarize(record, email, admin, viewerGrant, licenseTier, shares.length),
      draft: draft.payload,
      shares,
      feedback,
    });
  }

  const records = await db.select().from(customCases).orderBy(desc(customCases.updatedAt));
  const viewerGrants = await db.select().from(customCaseGrants).where(eq(customCaseGrants.recipientEmail, email));
  const viewerGrantByCase = new Map(viewerGrants.map((grant) => [grant.customCaseId, grant]));
  const ownedCaseIds = records.filter((record) => normalizeEmail(record.ownerEmail) === email).map((record) => record.id);
  const ownedCaseGrants = !admin && ownedCaseIds.length ? await db.select().from(customCaseGrants).where(inArray(customCaseGrants.customCaseId, ownedCaseIds)) : [];
  const allGrants = admin ? await db.select().from(customCaseGrants) : [...viewerGrants, ...ownedCaseGrants];
  const shareCount = new Map<number, number>();
  for (const grant of allGrants) shareCount.set(grant.customCaseId, (shareCount.get(grant.customCaseId) ?? 0) + 1);
  const ownerProfiles = await db.select({ email: users.email, displayName: users.displayName }).from(users);
  const ownerNames = new Map(ownerProfiles.map((item) => [normalizeEmail(item.email), item.displayName]));
  const visible = records.flatMap((record) => {
    const viewerGrant = viewerGrantByCase.get(record.id);
    if (!canViewCustomCase({ viewerEmail: email, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(viewerGrant) })) return [];
    return [{ ...summarize(record, email, admin, viewerGrant, licenseTier, shareCount.get(record.id) ?? 0), ownerDisplayName: ownerNames.get(normalizeEmail(record.ownerEmail)) ?? "Case author" }];
  });
  return privateJson({ customCases: visible, licenseTier, isAdmin: admin });
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
  const admin = isPlatformAdmin(email);
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
    try {
      await db.batch([
        db.insert(customCaseGrants).values({ customCaseId: id, recipientEmail, grantedByEmail: email, canReshare, createdAt: now }).onConflictDoUpdate({ target: [customCaseGrants.customCaseId, customCaseGrants.recipientEmail], set: { grantedByEmail: email, canReshare, createdAt: now } }),
        db.insert(auditEvents).values({ actorEmail: email, eventType: "custom_case_shared", objectType: "custom_case", objectId: String(id), detail: { recipientEmail, canReshare } }),
      ]);
    } catch {
      return privateJson({ error: "The case became Private before access could be granted." }, 409);
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

function summarize(record: typeof customCases.$inferSelect, viewerEmail: string, admin: boolean, grant: typeof customCaseGrants.$inferSelect | undefined, licenseTier: ReturnType<typeof normalizeLicenseTier>, shareCount: number) {
  const owner = normalizeEmail(record.ownerEmail) === viewerEmail;
  const access = owner ? "owner" : admin ? "admin" : "shared";
  return {
    id: record.id,
    caseId: record.caseId,
    title: record.title,
    currentVersion: record.currentVersion,
    fingerprint: record.fingerprint,
    isPrivate: record.isPrivate,
    status: record.status,
    access,
    canShare: canShareCustomCase({ viewerEmail, ownerEmail: record.ownerEmail, isPrivate: record.isPrivate, isAdmin: admin, hasGrant: Boolean(grant), grantCanReshare: grant?.canReshare === true, licenseTier }),
    canManagePrivacy: owner,
    shareCount,
    updatedAt: record.updatedAt,
    promotedAt: record.promotedAt,
  };
}

function isEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
