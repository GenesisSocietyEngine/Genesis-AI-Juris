import { eq, sql } from "drizzle-orm";
import { platformSecrets } from "../../db/schema";
import { safeEqual } from "../calendar/store";
import { readJsonObject } from "../request-security";
import {
  checkMutation,
  confirm,
  conflict,
  gate,
  invalid,
  json,
  liveCase,
  missing,
  now,
  permitted,
  recheck,
  staff,
  staffFence,
  type Client,
  type Staff,
  type Who,
} from "./authority";
import { validId } from "./contracts";
import { choicesSql, shareState } from "./store";
const clean = (s: unknown, max: number) =>
  typeof s === "string" &&
  s.trim().length > 0 &&
  s.trim().length <= max &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)
    ? s.trim()
    : "";
const purpose = "client-portal-invitation-v1";
async function token(w: Who, id: string, create = false) {
  if (create)
    await w.db
      .insert(platformSecrets)
      .values({ id: purpose, secret: crypto.randomUUID() + crypto.randomUUID() })
      .onConflictDoNothing();
  const [key] = await w.db.select().from(platformSecrets).where(eq(platformSecrets.id, purpose)).limit(1);
  if (!key) return "";
  const bytes = new TextEncoder(),
    h = await crypto.subtle.importKey(
      "raw",
      bytes.encode(key.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", h, bytes.encode(purpose + ":" + id))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function invitation(w: Staff, b: Record<string, unknown>, id: string) {
  if (!w.owner) return missing();
  if (b.action === "revoke") {
    await w.db.run(
      sql`UPDATE portal_grants AS g SET state='revoked',revoked_by=${w.actor},revoked_at=${now} WHERE g.id=${id} AND g.state!='revoked' AND ${gate(w, false, true)}`,
    );
    const row = await w.db.get(
      sql`SELECT 1 FROM portal_grants g WHERE id=${id} AND state='revoked' AND ${gate(w, false, true)}`,
    );
    return row ? (await confirm(w, id)) || json({ saved: true }) : missing();
  }
  if (!w.canWrite) return missing();
  if (b.action === "invite") {
    const email = clean(b.email, 254).toLowerCase(),
      label = clean(b.label, 150);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !label) return invalid();
    await w.db.run(
      sql`INSERT OR IGNORE INTO portal_grants(id,organization_id,case_id,email,label,state,issuer,created_at,expires_at) SELECT ${id},${w.org},${w.caseId},${email},${label},'invited',${w.actor},${now},strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days') WHERE ${staffFence(w, true, true)}`,
    );
    const match = await w.db.get(
      sql`SELECT 1 FROM portal_grants g WHERE g.id=${id} AND g.email=${email} AND g.label=${label} AND g.issuer=${w.actor} AND ${gate(w, true, true)}`,
    );
    if (!match) return conflict();
  }
  const secret = await token(w, id, true);
  const pending = await w.db.get(
    sql`SELECT 1 FROM portal_grants g WHERE g.id=${id} AND g.state='invited' AND g.expires_at>${now} AND ${gate(w, true, true)}`,
  );
  if (!pending) return conflict();
  return (await confirm(w, id)) || json({ id, path: "/portal#invite=" + id + "." + secret });
}
async function accept(w: Client, b: Record<string, unknown>, id: string) {
  const proof = typeof b.proof === "string" ? b.proof : "",
    key = await token(w, id);
  if (!key || !safeEqual(proof, key)) return missing();
  const accepted = await w.db.run(
    sql`UPDATE portal_grants AS g SET state='active',accepted_at=${now} WHERE id=${id} AND email=${w.email} AND state='invited' AND expires_at>${now} AND ${liveCase}`,
  );
  if (!accepted.meta.changes) return missing();
  return (await confirm(w, id)) || json({ saved: true, id });
}
export async function command(w: Who, req: Request) {
  const origin = checkMutation(req);
  if (origin) return origin;
  const b = await readJsonObject(req, 24576);
  if (!b || !validId(b.id)) return invalid();
  const id = b.id,
    act = b.action;
  const stale = await recheck(w);
  if (stale) return stale;
  if (staff(w) && ["invite", "invitation", "revoke"].includes(String(act))) return invitation(w, b, id);
  if (!staff(w) && act === "accept") return accept(w, b, id);
  const grant = b.grant;
  if (!validId(grant)) return invalid();
  const allowed = permitted(w, grant, true, true);
  if (!(await w.db.get(sql`SELECT 1 WHERE ${allowed}`))) return missing();
  const actor = staff(w) ? w.actor : w.email,
    author = staff(w) ? "team" : "client";
  let kind = "",
    target = "",
    title = "",
    detail = "",
    extra = sql`1`;
  if (act === "message") {
    kind = "message";
    title = clean(b.text, 4000);
    if (!title) return invalid();
  } else if (staff(w) && act === "share") {
    if (
      !["document", "event"].includes(String(b.kind)) ||
      typeof b.target !== "string" ||
      typeof b.revision !== "string"
    )
      return invalid();
    const picked = sql`SELECT * FROM (${choicesSql(w)}) WHERE id=${b.target} AND kind=${b.kind} AND revision=${b.revision}`;
    const row = await w.db.get<{ id: string; kind: string; title: string; detail: string }>(picked);
    if (!row) return conflict();
    ({ kind, target, title, detail } = { ...row, target: row.id });
    extra = sql`EXISTS(SELECT 1 FROM (${picked}) WHERE title=${title} AND detail=${detail}) AND NOT EXISTS(SELECT 1 FROM portal_entries e JOIN portal_grants g ON g.id=e.grant_id WHERE g.id=${grant} AND e.kind=${kind} AND e.target=${target} AND e.detail=${detail} AND e.title=${title} AND (${shareState})='shared')`;
  } else if (staff(w) && act === "withdraw") {
    kind = "withdraw";
    if (!validId(b.target)) return invalid();
    target = b.target;
    extra = sql`EXISTS(SELECT 1 FROM portal_entries e WHERE e.grant_id=${grant} AND e.id=${target} AND e.kind IN ('document','event')) AND NOT EXISTS(SELECT 1 FROM portal_entries e WHERE e.grant_id=${grant} AND e.kind='withdraw' AND e.target=${target})`;
  } else return invalid();
  await w.db.run(
    sql`INSERT OR IGNORE INTO portal_entries(id,grant_id,kind,author,actor,target,title,detail,stamp) SELECT ${id},${grant},${kind},${author},${actor},${target},${title},${detail},${now} WHERE ${allowed} AND ${extra}`,
  );
  const receipt = await w.db.get(
    sql`SELECT 1 FROM portal_entries WHERE id=${id} AND grant_id=${grant} AND kind=${kind} AND actor=${actor} AND author=${author} AND target=${target} AND title=${title} AND detail=${detail} AND ${allowed}`,
  );
  return receipt ? (await confirm(w, grant)) || json({ saved: true }) : conflict();
}
