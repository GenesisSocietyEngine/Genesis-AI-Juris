import { eq, sql, type SQL } from "drizzle-orm";
import { calendarFeeds, platformSecrets } from "../../db/schema";
import type { DossierDb } from "../dossier-server";
import { EMPTY_PLAN, parsePracticePlan } from "../matters/practice-plan";
import { terminal } from "../casework/model";
const secretId = "calendar-feed-hmac-v1";
export function grant(org: string, scope: string, actor: string, write = false): SQL {
  const member = sql`EXISTS (SELECT 1 FROM organizations o JOIN organization_memberships m ON o.id=m.organization_id WHERE o.id=${org} AND o.status='active' AND m.actor_id=${actor} AND m.status='active' ${write ? sql`AND m.role!='auditor'` : sql.empty()})`;
  if (scope === "firm") return member;
  return sql`(${member} AND EXISTS (SELECT 1 FROM dossier_organization_bindings b JOIN dossier_participants p ON p.dossier_id=b.dossier_id JOIN dossiers d ON d.id=b.dossier_id WHERE b.dossier_id=${scope} AND b.organization_id=${org} AND p.actor_id=${actor} AND p.status='active' ${write ? sql`AND p.role IN ('owner','contributor') AND d.status NOT IN ('closed','archived','declined','cancelled')` : sql.empty()}))`;
}
export const available = (status: string | undefined) => !status || !terminal(status);
export const source = (org: string, scope: string) =>
  scope === "firm"
    ? sql`SELECT plan,revision,occurred_at FROM organization_work_revisions WHERE organization_id=${org} ORDER BY revision DESC LIMIT 1`
    : sql`SELECT plan,revision,occurred_at FROM dossier_practice_revisions WHERE dossier_id=${scope} AND EXISTS(SELECT 1 FROM dossier_organization_bindings WHERE dossier_id=${scope} AND organization_id=${org}) ORDER BY revision DESC LIMIT 1`;
export async function latest(db: DossierDb, org: string, scope: string) {
  const row = await db.get<{ plan: string; occurred_at: string }>(source(org, scope));
  return {
    plan: row ? parsePracticePlan(JSON.parse(row.plan)) : EMPTY_PLAN,
    stamp: row?.occurred_at ?? "1970-01-01T00:00:00.000Z",
  };
}
export const openItem = (org: string, scope: string, id: string, rev?: number) =>
  sql`EXISTS(SELECT 1 FROM (${source(org, scope)}) p,json_each(p.plan,'$.items') i WHERE i.value->>'$.id'=${id} AND i.value->>'$.status'='open' ${rev === undefined ? sql.empty() : sql`AND p.revision=${rev}`})`;
export async function members(db: DossierDb, org: string, scope: string) {
  return db.all<{ id: string; name: string }>(
    sql`SELECT m.actor_id AS id,u.display_name AS name FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=${org} AND m.status='active' ${scope === "firm" ? sql.empty() : sql`AND EXISTS(SELECT 1 FROM dossier_participants p WHERE p.dossier_id=${scope} AND p.actor_id=m.actor_id AND p.status='active')`} ORDER BY u.display_name,m.actor_id`,
  );
}
export type Feed = typeof calendarFeeds.$inferSelect;
export async function feedToken(db: DossierDb, feed: Feed, create = false) {
  let [key] = await db.select().from(platformSecrets).where(eq(platformSecrets.id, secretId)).limit(1);
  if (!key && create) {
    await db
      .insert(platformSecrets)
      .values({
        id: secretId,
        secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      })
      .onConflictDoNothing();
    [key] = await db.select().from(platformSecrets).where(eq(platformSecrets.id, secretId)).limit(1);
  }
  if (!key) return null;
  const encoder = new TextEncoder(),
    k = await crypto.subtle.importKey(
      "raw",
      encoder.encode(key.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  const signature = await crypto.subtle.sign(
    "HMAC",
    k,
    encoder.encode(JSON.stringify([feed.id, feed.organizationId, feed.scope, feed.owner, feed.revision])),
  );
  return (
    feed.id +
    "." +
    Array.from(new Uint8Array(signature), (v) => v.toString(16).padStart(2, "0")).join("") +
    ".ics"
  );
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
