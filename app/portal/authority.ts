import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { getChatGPTUser } from "../chatgpt-auth";
import {
  dossierJson,
  isResponse,
  requireDossierAccess,
  resolveDossierServerContext,
  revalidateDossierReadAccess,
  type DossierAccess,
  type DossierServerContext,
} from "../dossier-server";
import { grant as caseGrant, available } from "../calendar/store";
import { isSameOriginMutation } from "../request-security";

export const json = dossierJson,
  missing = () => json({ error: "This portal is unavailable." }, 404);
export const conflict = () =>
  json({ error: "This item changed. Refresh the portal and review it again." }, 409);
export const invalid = () => json({ error: "Check the fields and try again." }, 400);
export const now = sql`strftime('%Y-%m-%dT%H:%M:%fZ','now')`;
export type Staff = {
  db: ReturnType<typeof getDb>;
  c: DossierServerContext;
  access: DossierAccess;
  org: string;
  caseId: string;
  actor: string;
  owner: boolean;
  canWrite: boolean;
};
export type Client = { db: ReturnType<typeof getDb>; email: string };
export type Who = Staff | Client;
export const staff = (w: Who): w is Staff => "c" in w;
export const liveCase = sql`EXISTS(SELECT 1 FROM dossier_organization_bindings b JOIN organizations o ON o.id=b.organization_id JOIN dossiers d ON d.id=b.dossier_id WHERE b.dossier_id=g.case_id AND b.organization_id=g.organization_id AND o.status='active' AND d.status NOT IN ('closed','archived','declined','cancelled'))`;
export async function staffSession(req: Request): Promise<Staff | Response> {
  const c = await resolveDossierServerContext(req);
  if (isResponse(c)) return c;
  const access = await requireDossierAccess(c, new URL(req.url).searchParams.get("case"), "read");
  if (isResponse(access)) return access;
  if (!["owner", "contributor"].includes(access.role) || c.organization!.role === "auditor")
    return missing();
  return {
    db: c.db,
    c,
    access,
    org: c.organization!.id,
    caseId: access.dossier.id,
    actor: c.actor.actorId,
    owner: access.role === "owner",
    canWrite: available(access.dossier.status),
  };
}
export async function clientSession(): Promise<Client | Response> {
  const u = await getChatGPTUser();
  if (!u || u.authSource !== "chatgpt")
    return json({ error: "Sign in with ChatGPT using your invited email address." }, 401);
  return { db: getDb(), email: u.email.trim().toLowerCase() };
}
export async function recheck(w: Who) {
  if (staff(w)) {
    const a = await revalidateDossierReadAccess(w.c, w.access);
    return isResponse(a) ? a : undefined;
  }
  const u = await getChatGPTUser();
  if (u?.authSource !== "chatgpt" || u.email.trim().toLowerCase() !== w.email) return missing();
}
export function staffFence(w: Staff, write = true, owner = false) {
  return sql`(${caseGrant(w.org, w.caseId, w.actor, write)} AND EXISTS(SELECT 1 FROM dossier_participants p JOIN organization_memberships m ON m.actor_id=p.actor_id AND m.organization_id=${w.org} JOIN organizations o ON o.id=m.organization_id WHERE p.dossier_id=${w.caseId} AND p.id=${w.access.participant.id} AND p.actor_id=${w.actor} AND p.status='active' AND p.role=${w.access.role} AND m.role!='auditor' AND m.revision=${w.c.organization!.membershipRevision} AND o.revision=${w.c.organization!.revision} ${owner ? sql`AND p.role='owner'` : sql.empty()}))`;
}
export const gate = (w: Who, write = false, owner = false): SQL =>
  staff(w)
    ? sql`(g.case_id=${w.caseId} AND g.organization_id=${w.org} AND ${staffFence(w, write, owner)})`
    : sql`(g.email=${w.email} AND g.state='active' AND ${liveCase})`;
export const permitted = (w: Who, id: string, write = false, editable = false) =>
  sql`EXISTS(SELECT 1 FROM portal_grants g WHERE g.id=${id} AND ${gate(w, write)} ${editable ? sql`AND (g.state='active' OR (g.state='invited' AND g.expires_at>${now}))` : sql.empty()})`;
export async function confirm(w: Who, id: string | null) {
  const err = await recheck(w);
  if (err) return err;
  if (id && !(await w.db.get(sql`SELECT 1 WHERE ${permitted(w, id)}`))) return missing();
}
export const checkMutation = (r: Request) =>
  isSameOriginMutation(r) && !!r.headers.get("origin")
    ? null
    : json({ error: "Open the portal to make this change." }, 403);
export async function protect(run: () => Promise<Response>) {
  try {
    return await run();
  } catch {
    return json({ error: "The portal is temporarily unavailable. Please try again." }, 503);
  }
}
