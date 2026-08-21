import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cases } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = await db.select({
    id: cases.id,
    currentVersion: cases.currentVersion,
    fingerprint: cases.fingerprint,
    title: cases.title,
    jurisdiction: cases.jurisdiction,
    practiceArea: cases.practiceArea,
    sector: cases.sector,
    difficulty: cases.difficulty,
    durationMinutes: cases.durationMinutes,
    reviewLevel: cases.reviewLevel,
    authorName: cases.authorName,
    reviewerName: cases.reviewerName,
    legalAsOf: cases.legalAsOf,
    summary: cases.summary,
    tags: cases.tags,
    updatedAt: cases.updatedAt,
  }).from(cases).where(eq(cases.status, "published")).orderBy(asc(cases.title));
  return Response.json({ cases: rows }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
