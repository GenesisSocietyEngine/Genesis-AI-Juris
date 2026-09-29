import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cases, caseVersions } from "../../../../db/schema";
import { type ObservabilityEventInput, type ObservabilityRepository } from "../../../observability";
import { runObservedD1Operation } from "../../../observed-d1-operation";
import { observabilityRequestId, observeOperationalEvent } from "../../../server-observability";
import { resolveBundledManifest } from "../bundled-manifest";
import { fingerprintEtag, ifNoneMatchMatches, manifestCacheControl } from "../catalog-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const requestId = observabilityRequestId(request);
  const observe = (input: Omit<ObservabilityEventInput, "requestId" | "route">) => observeOperationalEvent({ requestId, route: "catalog", ...input });
  const readD1 = <T>(
    logicalRepository: Extract<ObservabilityRepository, "cases" | "case_versions">,
    read: () => Promise<T>,
  ) => runObservedD1Operation(observe, { operation: "read", logicalRepository }, read);
  const { caseId } = await context.params;
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(caseId)) {
    return Response.json({ error: "Case not found." }, { status: 404 });
  }
  const versionParameters = new URL(request.url).searchParams.getAll("version");
  if (versionParameters.length > 1) return Response.json({ error: "Case version must be provided at most once." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const requestedVersion = versionParameters[0] ?? null;
  if (requestedVersion && !/^\d+\.\d+\.\d+$/.test(requestedVersion)) {
    return Response.json({ error: "Case version not found." }, { status: 404 });
  }
  const db = getDb();
  const [record] = await readD1("cases", () => db.select({ latestVersion: cases.currentVersion, reviewLevel: cases.reviewLevel }).from(cases).where(and(eq(cases.id, caseId), eq(cases.status, "published"))).limit(1));
  if (!record) {
    if (requestedVersion !== null) observe({ eventName: "historical_bundle.lookup_miss", outcome: "expected_rejection", reason: "case_unavailable", responseClass: "4xx", operation: "read", logicalRepository: "case_versions" });
    return Response.json({ error: "Case not found." }, { status: 404 });
  }
  const selectedVersion = requestedVersion ?? record.latestVersion;
  const [version] = await readD1("case_versions", () => db.select({ fingerprint: caseVersions.fingerprint, payload: caseVersions.payload, changeSummary: caseVersions.changeSummary }).from(caseVersions).where(and(eq(caseVersions.caseId, caseId), eq(caseVersions.version, selectedVersion), isNotNull(caseVersions.publishedAt))).limit(1));
  if (!version) {
    observe({
      eventName: "historical_bundle.lookup_miss",
      outcome: requestedVersion !== null ? "expected_rejection" : "internal_failure",
      reason: requestedVersion !== null ? "version_unavailable" : "stored_version_unavailable",
      responseClass: "4xx",
      operation: "read",
      logicalRepository: "case_versions",
    });
    return Response.json({ error: "Published version not found." }, { status: 404 });
  }
  const expectedFingerprint = request.headers.get("X-GENESIS-Expected-Fingerprint")?.trim().toLowerCase();
  if (expectedFingerprint && /^sha256-[a-f0-9]{64}$/u.test(expectedFingerprint) && expectedFingerprint !== version.fingerprint) {
    observe({ eventName: "played_case.fingerprint_mismatch", outcome: "expected_rejection", reason: "requested_identity_mismatch", responseClass: "2xx", operation: "read", logicalRepository: "case_versions" });
  }
  const payload = resolveBundledManifest(version.payload, caseId, selectedVersion, version.fingerprint);
  if (!payload) {
    observe({ eventName: "historical_bundle.lookup_miss", outcome: "internal_failure", reason: "manifest_integrity", responseClass: "4xx", operation: "read", logicalRepository: "case_versions" });
    return Response.json({ error: "Published manifest failed integrity verification." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  const etag = fingerprintEtag(version.fingerprint);
  const headers = {
    "Cache-Control": manifestCacheControl(requestedVersion !== null),
    ETag: etag,
  };
  if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  return Response.json({ caseId, currentVersion: selectedVersion, latestVersion: record.latestVersion, reviewLevel: record.reviewLevel, ...version, payload }, { headers });
}
