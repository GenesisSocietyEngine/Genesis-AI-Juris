import { and, asc, eq, gt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../../../db";
import { cases } from "../../../db/schema";
import { encodeCatalogueCursor, parseCatalogueQuery, type CatalogueFilters } from "./catalog-query";

export const dynamic = "force-dynamic";

function catalogueFilterConditions(filters: CatalogueFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.q) {
    const query = filters.q.toLowerCase();
    conditions.push(or(
      sql<boolean>`instr(lower(${cases.title}), ${query}) > 0`,
      sql<boolean>`instr(lower(${cases.summary}), ${query}) > 0`,
      sql<boolean>`instr(lower(${cases.jurisdiction}), ${query}) > 0`,
      sql<boolean>`instr(lower(${cases.practiceArea}), ${query}) > 0`,
      sql<boolean>`instr(lower(${cases.sector}), ${query}) > 0`,
      sql<boolean>`instr(lower(${cases.tags}), ${query}) > 0`,
    )!);
  }
  if (filters.jurisdiction) conditions.push(eq(cases.jurisdiction, filters.jurisdiction));
  if (filters.practiceArea) conditions.push(eq(cases.practiceArea, filters.practiceArea));
  if (filters.difficulty) conditions.push(eq(cases.difficulty, filters.difficulty));
  for (const tag of filters.tags) {
    conditions.push(sql<boolean>`exists (
      select 1 from json_each(${cases.tags}) as catalogue_tag
      where lower(cast(catalogue_tag.value as text)) = ${tag.toLowerCase()}
    )`);
  }
  return conditions;
}

export async function GET(request: Request) {
  const parsed = parseCatalogueQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const { cursor, filters, limit } = parsed.value;
  const db = getDb();
  const filterConditions = [eq(cases.status, "published"), ...catalogueFilterConditions(filters)];
  const baseWhere = and(...filterConditions)!;
  const pageWhere = cursor ? and(baseWhere, gt(cases.id, cursor.id))! : baseWhere;
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
  }).from(cases).where(pageWhere).orderBy(asc(cases.id)).limit(limit + 1);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(cases).where(baseWhere);
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const lastItem = items.at(-1);
  const nextCursor = hasNextPage && lastItem ? encodeCatalogueCursor({ id: lastItem.id }, filters) : null;
  return Response.json({
    items,
    nextCursor,
    total: Number(total),
    cases: items,
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
