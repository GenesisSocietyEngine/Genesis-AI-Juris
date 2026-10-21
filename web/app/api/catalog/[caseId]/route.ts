import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cases, caseVersions } from "../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(caseId)) return Response.json({ error: "Case not found." }, { status: 404 });
  const requestedVersion = new URL(request.url).searchParams.get("version");
  if (requestedVersion && !/^\d+\.\d+\.\d+$/.test(requestedVersion)) return Response.json({ error: "Case version not found." }, { status: 404 });
  const db = getDb();
  const [record] = await db.select({ latestVersion: cases.currentVersion, reviewLevel: cases.reviewLevel }).from(cases).where(and(eq(cases.id, caseId), eq(cases.status, "published"))).limit(1);
  if (!record) return Response.json({ error: "Case not found." }, { status: 404 });
  const selectedVersion = requestedVersion ?? record.latestVersion;
  const [version] = await db.select({ fingerprint: caseVersions.fingerprint, payload: caseVersions.payload, changeSummary: caseVersions.changeSummary }).from(caseVersions).where(and(eq(caseVersions.caseId, caseId), eq(caseVersions.version, selectedVersion), isNotNull(caseVersions.publishedAt))).limit(1);
  if (!version) return Response.json({ error: "Published version not found." }, { status: 404 });
  return Response.json({ caseId, currentVersion: selectedVersion, latestVersion: record.latestVersion, reviewLevel: record.reviewLevel, ...version }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
