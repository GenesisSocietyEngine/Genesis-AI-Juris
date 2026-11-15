import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, caseDrafts, cases, caseVersions, updates, users } from "../../../../db/schema";
import { caseFingerprint, isTaxClassification, normalizeStudioDraft, studioStructuralIssues } from "../../../case-integrity";
import { normalizePlayableScenario, playableFingerprint } from "../../../playable-integrity";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity.email)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const payload = await readJsonObject(request, 750_000);
  if (!payload) return Response.json({ error: "A valid publication manifest is required." }, { status: 400 });
  let draft;
  try { draft = normalizeStudioDraft(payload.draft); } catch { return Response.json({ error: "The case payload failed structural validation." }, { status: 400 }); }
  const structuralIssues = studioStructuralIssues(draft);
  if (structuralIssues.length) return Response.json({ error: "The case is not ready for publication.", issues: structuralIssues }, { status: 422 });
  let playable;
  try { playable = normalizePlayableScenario(payload.playableScenario); } catch { return Response.json({ error: "A compiled playable-scenario-v1 payload is required for central publication." }, { status: 400 }); }
  if (playable.caseId !== draft.caseId || playable.version !== draft.version) return Response.json({ error: "Studio and playable case identity/version must match." }, { status: 409 });
  const classification = draft.classification!;
  const isTax = isTaxClassification(classification);
  if (isTax && (!classification.complianceOnly || !classification.legalAsOf || (classification.sourceUrls ?? []).length === 0 || payload.taxSafetyAttestation !== true)) {
    return Response.json({ error: "Tax publication requires the compliance gate, a legal as-of date, HTTPS sources and an administrator safety attestation." }, { status: 422 });
  }
  const authorName = text(payload.authorName, 160);
  let reviewerName = text(payload.reviewerName, 160);
  const reviewLevel = typeof payload.reviewLevel === "string" && ["community_beta", "editorial_reviewed", "expert_reviewed"].includes(payload.reviewLevel) ? payload.reviewLevel : "community_beta";
  if (!authorName || !reviewerName) return Response.json({ error: "Author and reviewer attribution are required." }, { status: 400 });
  const db = getDb();
  const studioFingerprint = caseFingerprint(draft);
  let reviewEvidence: { submissionId: number; reviewerEmail: string; reviewedAt: string | null } | null = null;
  if (reviewLevel !== "community_beta") {
    const [review] = await db.select({
      submissionId: caseDrafts.id,
      authorEmail: caseDrafts.userEmail,
      reviewerEmail: caseDrafts.reviewerEmail,
      reviewedAt: caseDrafts.reviewedAt,
      reviewerDisplayName: users.displayName,
      verifiedPractitioner: users.verifiedPractitioner,
    }).from(caseDrafts).leftJoin(users, eq(users.email, caseDrafts.reviewerEmail)).where(and(
      eq(caseDrafts.caseId, draft.caseId),
      eq(caseDrafts.version, draft.version),
      eq(caseDrafts.fingerprint, studioFingerprint),
      eq(caseDrafts.status, "accepted"),
    )).orderBy(desc(caseDrafts.reviewedAt)).limit(1);
    if (!review?.reviewerEmail) return Response.json({ error: "An accepted moderation record for this exact Studio fingerprint is required for an elevated review label." }, { status: 422 });
    if (reviewLevel === "expert_reviewed" && (!review.verifiedPractitioner || review.reviewerEmail === review.authorEmail || review.reviewerEmail === identity.email.toLowerCase())) {
      return Response.json({ error: "Expert-reviewed publication requires an independent verified practitioner review." }, { status: 422 });
    }
    if (reviewLevel === "expert_reviewed" && review.reviewerDisplayName) reviewerName = review.reviewerDisplayName;
    reviewEvidence = { submissionId: review.submissionId, reviewerEmail: review.reviewerEmail, reviewedAt: review.reviewedAt };
  }
  const [currentCase] = await db.select({ version: cases.currentVersion }).from(cases).where(eq(cases.id, draft.caseId)).limit(1);
  if (currentCase && compareSemver(draft.version, currentCase.version) <= 0) return Response.json({ error: "Published versions are immutable and must advance semantic version order." }, { status: 409 });
  if (currentCase && (!draft.parent || draft.parent.caseId !== draft.caseId || draft.parent.version !== currentCase.version)) {
    return Response.json({ error: "A new version must descend from the currently published version of the same case." }, { status: 409 });
  }
  if (draft.parent) {
    const [parent] = await db.select({ playableFingerprint: caseVersions.fingerprint, studioFingerprint: caseVersions.studioFingerprint }).from(caseVersions).where(and(eq(caseVersions.caseId, draft.parent.caseId), eq(caseVersions.version, draft.parent.version))).limit(1);
    if (!parent || (parent.studioFingerprint ?? parent.playableFingerprint) !== draft.parent.fingerprint) return Response.json({ error: "Parent case lineage could not be verified." }, { status: 409 });
  }
  const fingerprint = playableFingerprint(playable);
  playable = { ...playable, fingerprint };
  const now = new Date().toISOString();
  const versionInsert = db.insert(caseVersions).values({ caseId: draft.caseId, version: draft.version, fingerprint, studioFingerprint, parentCaseId: draft.parent?.caseId ?? null, parentVersion: draft.parent?.version ?? null, parentFingerprint: draft.parent?.fingerprint ?? null, changeSummary: text(payload.changeSummary, 2_000), payload: { kind: "playable-scenario-v1", scenario: playable, studioDraft: draft, reviewEvidence: reviewEvidence ? { submissionId: reviewEvidence.submissionId, reviewerName, reviewedAt: reviewEvidence.reviewedAt } : null } as unknown as Record<string, unknown>, publishedAt: now });
  const caseUpsert = db.insert(cases).values({
    id: draft.caseId, currentVersion: draft.version, fingerprint, title: draft.title, jurisdiction: draft.jurisdiction,
    practiceArea: classification.practiceArea, sector: text(payload.sector, 120) || classification.practiceArea,
    difficulty: classification.difficulty, durationMinutes: boundedNumber(payload.durationMinutes, 10, 360, 45), status: "published",
    reviewLevel, authorName, reviewerName, legalAsOf: classification.legalAsOf || null, summary: draft.premise.slice(0, 2_000),
    tags: classification.tags, centrallyManaged: true, updatedAt: now,
  }).onConflictDoUpdate({ target: cases.id, set: { currentVersion: draft.version, fingerprint, title: draft.title, jurisdiction: draft.jurisdiction, practiceArea: classification.practiceArea, sector: text(payload.sector, 120) || classification.practiceArea, difficulty: classification.difficulty, durationMinutes: boundedNumber(payload.durationMinutes, 10, 360, 45), status: "published", reviewLevel, authorName, reviewerName, legalAsOf: classification.legalAsOf || null, summary: draft.premise.slice(0, 2_000), tags: classification.tags, updatedAt: now } });
  const releaseInsert = db.insert(updates).values({ title: `${draft.title} · v${draft.version}`, body: text(payload.changeSummary, 2_000) || "A reviewed case version is now available in the central library.", kind: "case", caseId: draft.caseId, publishedAt: now });
  const auditInsert = db.insert(auditEvents).values({ actorEmail: identity.email.toLowerCase(), eventType: "case_version_published", objectType: "case", objectId: draft.caseId, detail: { version: draft.version, playableFingerprint: fingerprint, studioFingerprint, reviewLevel, reviewSubmissionId: reviewEvidence?.submissionId ?? null, reviewerEmail: reviewEvidence?.reviewerEmail ?? null, taxSafetyAttestation: isTax ? true : null } });
  try {
    if (reviewEvidence) {
      const markPublished = db.update(caseDrafts).set({ status: "published", updatedAt: now }).where(and(eq(caseDrafts.id, reviewEvidence.submissionId), eq(caseDrafts.status, "accepted")));
      await db.batch([caseUpsert, versionInsert, releaseInsert, auditInsert, markPublished]);
    } else {
      await db.batch([caseUpsert, versionInsert, releaseInsert, auditInsert]);
    }
  } catch {
    return Response.json({ error: "Publication failed. The case/version may already exist; no partial batch was committed." }, { status: 409 });
  }
  return Response.json({ publication: { caseId: draft.caseId, version: draft.version, fingerprint, reviewLevel } }, { status: 201 });
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function boundedNumber(value: unknown, min: number, max: number, fallback: number) { const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? Math.round(number) : fallback; }
function compareSemver(left: string, right: string) { const a = left.split(".").map(Number); const b = right.split(".").map(Number); for (let index = 0; index < 3; index += 1) { if (a[index] !== b[index]) return a[index] - b[index]; } return 0; }
