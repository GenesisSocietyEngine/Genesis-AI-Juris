import { eq, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { studioAILeases } from "../db/schema";

export const STUDIO_AI_MAX_IN_FLIGHT = 8;
export const STUDIO_AI_LEASE_TTL_MS = 60_000;

export type StudioAILease = { id: string; expiresAt: string };

/**
 * Acquire one of the tenant's bounded provider-call slots.
 *
 * D1 executes the cleanup and conditional INSERT as one ordered batch. The
 * INSERT ... SELECT observes the active leases in that transaction and writes
 * nothing once the tenant limit is reached. Expired leases make crashed or
 * disconnected requests self-healing without retaining request content.
 */
export async function acquireStudioAILease(subjectHash: string, now = new Date()): Promise<StudioAILease | null> {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + STUDIO_AI_LEASE_TTL_MS).toISOString();
  const eligibleLease = db.select({
    id: sql<string>`${id}`.as("id"),
    subjectHash: sql<string>`${subjectHash}`.as("subject_hash"),
    createdAt: sql<string>`${createdAt}`.as("created_at"),
    expiresAt: sql<string>`${expiresAt}`.as("expires_at"),
  }).from(sql`(SELECT 1) AS singleton`).where(sql<boolean>`(
    SELECT count(*) FROM ${studioAILeases}
    WHERE ${studioAILeases.expiresAt} > ${createdAt}
  ) < ${STUDIO_AI_MAX_IN_FLIGHT}`);

  const [, inserted] = await db.batch([
    db.delete(studioAILeases).where(lte(studioAILeases.expiresAt, createdAt)),
    db.insert(studioAILeases).select(eligibleLease).returning({ id: studioAILeases.id }),
  ]);
  return inserted.some((row) => row.id === id) ? { id, expiresAt } : null;
}

export async function releaseStudioAILease(id: string) {
  await getDb().delete(studioAILeases).where(eq(studioAILeases.id, id));
}
