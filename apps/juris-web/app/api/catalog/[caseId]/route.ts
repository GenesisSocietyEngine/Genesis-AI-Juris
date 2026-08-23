import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cases, caseVersions } from "../../../../db/schema";
import { resolveBundledManifest } from "../bundled-manifest";
import { fingerprintEtag, ifNoneMatchMatches, manifestCacheControl } from "../catalog-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(caseId)) return Response.json({ error: "Case not found." }, { status: 404 });
  const versionParameters = new URL(request.url).searchParams.getAll("version");
  if (versionParameters.length > 1) return Response.json({ error: "Case version must be provided at most once." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const requestedVersion = versionParameters[0] ?? null;
  if (requestedVersion && !/^\d+\.\d+\.\d+$/.test(requestedVersion)) return Response.json({ error: "Case version not found." }, { status: 404 });
  const db = getDb();
  const [record] = await db.select({ latestVersion: cases.currentVersion, reviewLevel: cases.reviewLevel }).from(cases).where(and(eq(cases.id, caseId), eq(cases.status, "published"))).limit(1);
  if (!record) return Response.json({ error: "Case not found." }, { status: 404 });
  const selectedVersion = requestedVersion ?? record.latestVersion;
  const [version] = await db.select({ fingerprint: caseVersions.fingerprint, payload: caseVersions.payload, changeSummary: caseVersions.changeSummary }).from(caseVersions).where(and(eq(caseVersions.caseId, caseId), eq(caseVersions.version, selectedVersion), isNotNull(caseVersions.publishedAt))).limit(1);
  if (!version) return Response.json({ error: "Published version not found." }, { status: 404 });
  const payload = resolveBundledManifest(version.payload, caseId, selectedVersion, version.fingerprint);
  if (!payload) return Response.json({ error: "Published manifest failed integrity verification." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  const etag = fingerprintEtag(version.fingerprint);
  const headers = {
    "Cache-Control": manifestCacheControl(requestedVersion !== null),
    ETag: etag,
  };
  if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  return Response.json({ caseId, currentVersion: selectedVersion, latestVersion: record.latestVersion, reviewLevel: record.reviewLevel, ...version, payload }, { headers });
}
