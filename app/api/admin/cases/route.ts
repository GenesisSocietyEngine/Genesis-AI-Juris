import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, caseDrafts, cases, caseVersions, customCases, updates, users } from "../../../../db/schema";
import { buildCaseProtection, requestedCopyProtection } from "../../../case-protection";
import { isTaxClassification, normalizeStudioDraft, studioStructuralIssues } from "../../../case-integrity";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { compilePublicationPlayable, normalizeTaxPublicationAttestation, type TaxPublicationAttestation } from "../../../publication-integrity";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";
import { CaseProtectionIntegrityError, getOrCreateCaseProtectionKey, resolveExactCaseArtifact } from "../../../server-case-protection";
import { toPublicStudioDraft } from "../../../studio-editing";
import type { CaseProtectionV1 } from "../../../types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const payload = await readJsonObject(request, 750_000);
  if (!payload) return Response.json({ error: "A valid publication manifest is required." }, { status: 400 });
  let draft;
  try { draft = normalizeStudioDraft(payload.draft); } catch { return Response.json({ error: "The case payload failed structural validation." }, { status: 400 }); }
  const structuralIssues = studioStructuralIssues(draft);
  if (structuralIssues.length) return Response.json({ error: "The case is not ready for publication.", issues: structuralIssues }, { status: 422 });
  const compilation = compilePublicationPlayable(draft, payload.playableScenario);
  if (!compilation.ok) return Response.json({ error: compilation.error, issues: compilation.issues }, { status: compilation.status });
  const { playable, binding: compilationBinding } = compilation;
  const { studioFingerprint, playableFingerprint: fingerprint } = compilationBinding;
  const classification = draft.classification!;
  const isTax = isTaxClassification(classification);
  if (isTax && (!classification.complianceOnly || !classification.legalAsOf || (classification.sourceUrls ?? []).length === 0)) {
    return Response.json({ error: "Tax publication requires a lawful compliance scope, a legal as-of date and verified HTTPS sources." }, { status: 422 });
  }
  const authorName = text(payload.authorName, 160);
  let reviewerName = text(payload.reviewerName, 160);
  const reviewLevel = typeof payload.reviewLevel === "string" && ["community_beta", "editorial_reviewed", "expert_reviewed"].includes(payload.reviewLevel) ? payload.reviewLevel : "community_beta";
  if (!authorName || !reviewerName) return Response.json({ error: "Author and reviewer attribution are required." }, { status: 400 });
  const db = getDb();
  const customCaseId = payload.customCaseId === undefined || payload.customCaseId === null ? null : Number(payload.customCaseId);
  if (customCaseId !== null && (!Number.isInteger(customCaseId) || customCaseId <= 0)) return Response.json({ error: "A valid custom-case source is required." }, { status: 400 });
  let customSource: typeof customCases.$inferSelect | null = null;
  if (customCaseId === null) {
    const [hiddenSource] = await db.select({ id: customCases.id }).from(caseDrafts).innerJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(and(
      eq(caseDrafts.caseId, draft.caseId),
      eq(caseDrafts.version, draft.version),
      eq(caseDrafts.fingerprint, studioFingerprint),
      eq(customCases.isPrivate, true),
    )).limit(1);
    if (hiddenSource) return Response.json({ error: "Publication source not found." }, { status: 404 });
  }
  if (customCaseId !== null) {
    const [source] = await db.select().from(customCases).where(eq(customCases.id, customCaseId)).limit(1);
    if (!source || source.isPrivate) return Response.json({ error: "Custom case not found." }, { status: 404 });
    if (source.caseId !== draft.caseId || source.currentVersion !== draft.version || source.fingerprint !== studioFingerprint) return Response.json({ error: "The custom case changed. Reload its exact current version before promotion." }, { status: 409 });
    const [sourceDraft] = await db.select({ id: caseDrafts.id }).from(caseDrafts).where(and(eq(caseDrafts.customCaseId, source.id), eq(caseDrafts.version, draft.version), eq(caseDrafts.fingerprint, studioFingerprint))).limit(1);
    if (!sourceDraft) return Response.json({ error: "The exact custom-case source version is unavailable." }, { status: 409 });
    customSource = source;
  }
  let reviewEvidence: { submissionId: number; reviewerEmail: string; reviewedAt: string } | null = null;
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
    if (!review?.reviewerEmail || !review.reviewedAt) return Response.json({ error: "An accepted, timestamped moderation record for this exact Studio fingerprint is required for an elevated review label." }, { status: 422 });
    if (reviewLevel === "expert_reviewed" && (!review.verifiedPractitioner || review.reviewerEmail === review.authorEmail || review.reviewerEmail === identity.email.toLowerCase())) {
      return Response.json({ error: "Expert-reviewed publication requires an independent verified practitioner review." }, { status: 422 });
    }
    if (reviewLevel === "expert_reviewed" && review.reviewerDisplayName) reviewerName = review.reviewerDisplayName;
    reviewEvidence = { submissionId: review.submissionId, reviewerEmail: review.reviewerEmail, reviewedAt: review.reviewedAt };
  }
  const publicationInstant = new Date();
  let taxSafetyAttestation: TaxPublicationAttestation | null = null;
  if (isTax) {
    try {
      taxSafetyAttestation = normalizeTaxPublicationAttestation(payload.taxSafetyAttestation, {
        reviewerName,
        legalAsOf: classification.legalAsOf!,
        sourceCount: classification.sourceUrls!.length,
        studioFingerprint,
        playableFingerprint: fingerprint,
        now: publicationInstant,
      });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "A valid structured tax publication attestation is required." }, { status: 422 });
    }
  }
  const [currentCase] = await db.select({ version: cases.currentVersion }).from(cases).where(eq(cases.id, draft.caseId)).limit(1);
  if (currentCase && customSource && customSource.status !== "promoted") return Response.json({ error: "This General Library case ID already belongs to another lineage. Choose a new custom case ID before promotion." }, { status: 409 });
  if (currentCase && compareSemver(draft.version, currentCase.version) <= 0) return Response.json({ error: "Published versions are immutable and must advance semantic version order." }, { status: 409 });
  if (currentCase && (!draft.parent || draft.parent.caseId !== draft.caseId || draft.parent.version !== currentCase.version)) {
    return Response.json({ error: "A new version must descend from the currently published version of the same case." }, { status: 409 });
  }
  let protection: CaseProtectionV1;
  try {
    const protectionKey = await getOrCreateCaseProtectionKey(db);
    const sourceArtifact = customSource ? await resolveExactCaseArtifact(db, {
      caseId: draft.caseId,
      version: draft.version,
      fingerprint: studioFingerprint,
      preferredCustomCaseId: customSource.id,
    }, protectionKey) : null;
    if (customSource && !sourceArtifact) return Response.json({ error: "The exact protected custom-case source is unavailable." }, { status: 409 });
    const parentArtifact = draft.parent ? await resolveExactCaseArtifact(db, draft.parent, protectionKey) : null;
    if (draft.parent && !parentArtifact) return Response.json({ error: "Parent case lineage could not be verified." }, { status: 409 });
    const continuingProtectedLineage = Boolean(draft.parent && parentArtifact
      && draft.caseId === parentArtifact.caseId
      && (currentCase?.version === parentArtifact.version || parentArtifact.customCaseId === customSource?.id));
    if (parentArtifact?.copyProtected && !continuingProtectedLineage) {
      return Response.json({ error: "A lineage-locked case cannot be published as a fork.", code: "copy_protected" }, { status: 409 });
    }
    const copyProtected = payload.copyProtected === true
      || requestedCopyProtection(draft.protection)
      || sourceArtifact?.copyProtected === true
      || parentArtifact?.copyProtected === true;
    protection = await buildCaseProtection({
      caseId: draft.caseId,
      version: draft.version,
      studioFingerprint,
      parentCaseId: draft.parent?.caseId ?? null,
      parentVersion: draft.parent?.version ?? null,
      parentFingerprint: draft.parent?.fingerprint ?? null,
      parentCode: parentArtifact?.currentCode ?? null,
      copyPolicy: copyProtected ? "lineage_locked" : "fork_allowed",
    }, protectionKey);
  } catch (error) {
    const message = error instanceof CaseProtectionIntegrityError ? error.message : "Case protection could not be verified.";
    return Response.json({ error: message, code: "lineage_invalid" }, { status: 409 });
  }
  const now = publicationInstant.toISOString();
  const protectedDraft = { ...draft, protection };
  const publicStudioDraft = toPublicStudioDraft(protectedDraft);
  const artifactBinding = { ...compilationBinding, caseProtection: protection };
  const versionInsert = db.insert(caseVersions).values({ caseId: draft.caseId, sourceCustomCaseId: customSource?.id ?? null, version: draft.version, fingerprint, studioFingerprint, parentCaseId: draft.parent?.caseId ?? null, parentVersion: draft.parent?.version ?? null, parentFingerprint: draft.parent?.fingerprint ?? null, changeSummary: text(payload.changeSummary, 2_000), payload: { kind: "playable-scenario-v1", scenario: playable, studioDraft: publicStudioDraft, protection, artifactBinding, reviewEvidence: reviewEvidence ? { submissionId: reviewEvidence.submissionId, reviewerName, reviewedAt: reviewEvidence.reviewedAt, artifactBinding } : null, taxSafetyAttestation } as unknown as Record<string, unknown>, publishedAt: now });
  const caseUpsert = db.insert(cases).values({
    id: draft.caseId, currentVersion: draft.version, fingerprint, title: draft.title, jurisdiction: draft.jurisdiction,
    practiceArea: classification.practiceArea, sector: text(payload.sector, 120) || classification.practiceArea,
    difficulty: classification.difficulty, durationMinutes: boundedNumber(payload.durationMinutes, 10, 360, 45), status: "published",
    reviewLevel, authorName, reviewerName, legalAsOf: classification.legalAsOf || null, summary: draft.premise.slice(0, 2_000),
    tags: classification.tags, centrallyManaged: true, updatedAt: now,
  }).onConflictDoUpdate({ target: cases.id, set: { currentVersion: draft.version, fingerprint, title: draft.title, jurisdiction: draft.jurisdiction, practiceArea: classification.practiceArea, sector: text(payload.sector, 120) || classification.practiceArea, difficulty: classification.difficulty, durationMinutes: boundedNumber(payload.durationMinutes, 10, 360, 45), status: "published", reviewLevel, authorName, reviewerName, legalAsOf: classification.legalAsOf || null, summary: draft.premise.slice(0, 2_000), tags: classification.tags, updatedAt: now } });
  const releaseInsert = db.insert(updates).values({ title: `${draft.title} · v${draft.version}`, body: text(payload.changeSummary, 2_000) || "A reviewed case version is now available in the central library.", kind: "case", caseId: draft.caseId, publishedAt: now });
  const auditInsert = db.insert(auditEvents).values({ actorEmail: identity.email.toLowerCase(), eventType: "case_version_published", objectType: "case", objectId: draft.caseId, detail: { version: draft.version, sourceCustomCaseId: customSource?.id ?? null, playableFingerprint: fingerprint, studioFingerprint, artifactBinding, reviewLevel, reviewSubmissionId: reviewEvidence?.submissionId ?? null, reviewerEmail: reviewEvidence?.reviewerEmail ?? null, taxSafetyAttestation } });
  try {
    if (customSource && reviewEvidence) {
      const markPublished = db.update(caseDrafts).set({ status: "published", updatedAt: now }).where(and(eq(caseDrafts.id, reviewEvidence.submissionId), eq(caseDrafts.status, "accepted")));
      const markCustomPublished = db.update(caseDrafts).set({ status: "published", updatedAt: now }).where(and(eq(caseDrafts.customCaseId, customSource.id), eq(caseDrafts.fingerprint, studioFingerprint)));
      const markPromoted = db.update(customCases).set({ status: "promoted", promotedAt: now, promotedByEmail: identity.email.toLowerCase(), updatedAt: now }).where(and(eq(customCases.id, customSource.id), eq(customCases.isPrivate, false), eq(customCases.fingerprint, studioFingerprint)));
      await db.batch([caseUpsert, versionInsert, releaseInsert, auditInsert, markPublished, markCustomPublished, markPromoted]);
    } else if (customSource) {
      const markCustomPublished = db.update(caseDrafts).set({ status: "published", updatedAt: now }).where(and(eq(caseDrafts.customCaseId, customSource.id), eq(caseDrafts.fingerprint, studioFingerprint)));
      const markPromoted = db.update(customCases).set({ status: "promoted", promotedAt: now, promotedByEmail: identity.email.toLowerCase(), updatedAt: now }).where(and(eq(customCases.id, customSource.id), eq(customCases.isPrivate, false), eq(customCases.fingerprint, studioFingerprint)));
      await db.batch([caseUpsert, versionInsert, releaseInsert, auditInsert, markCustomPublished, markPromoted]);
    } else if (reviewEvidence) {
      const markPublished = db.update(caseDrafts).set({ status: "published", updatedAt: now }).where(and(eq(caseDrafts.id, reviewEvidence.submissionId), eq(caseDrafts.status, "accepted")));
      await db.batch([caseUpsert, versionInsert, releaseInsert, auditInsert, markPublished]);
    } else {
      await db.batch([caseUpsert, versionInsert, releaseInsert, auditInsert]);
    }
  } catch {
    return Response.json({ error: "Publication failed. The case/version may already exist; no partial batch was committed." }, { status: 409 });
  }
  return Response.json({ publication: { caseId: draft.caseId, version: draft.version, fingerprint, studioFingerprint, reviewLevel, serverCompiled: true, protection } }, { status: 201 });
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function boundedNumber(value: unknown, min: number, max: number, fallback: number) { const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? Math.round(number) : fallback; }
function compareSemver(left: string, right: string) { const a = left.split(".").map(Number); const b = right.split(".").map(Number); for (let index = 0; index < 3; index += 1) { if (a[index] !== b[index]) return a[index] - b[index]; } return 0; }
