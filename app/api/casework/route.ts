import { and, asc, desc, eq, gt, lt, sql, type SQL } from "drizzle-orm";
import {
  caseWorkRevisions as records,
  dossiers,
  dossierOrganizationBindings as bindings,
  dossierParticipants as people,
  organizationCasGuards as guards,
} from "../../../db/schema";
import { canonicalDossierJson } from "../../dossier-contract";
import {
  canonicalDossierTimestamp,
  dossierJson,
  dossierSha256,
  isResponse,
  resolveDossierServerContext,
  type DossierServerContext as Context,
} from "../../dossier-server";
import { firmAuthority, firmReply } from "../../firm-authority";
import { organizationDossierAccess, organizationSelectionToken } from "../../organization-store";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import {
  dossierId,
  operationKey,
  parseCommand,
  preview,
  recordId,
  terminal,
  type Command,
  type CaseChoice,
} from "../../casework/model";
import { wordDocument } from "../../casework/word";
export const dynamic = "force-dynamic";
type Row = typeof records.$inferSelect;
type Data = Pick<
  Row,
  "kind" | "caseId" | "sourceId" | "sourceRevision" | "title" | "body" | "stage" | "archived" | "statusFilter"
>;
const problem = (code: string, n: number) => dossierJson({ code }, n);
const visible = (c: Context) =>
  and(
    eq(records.organizationId, c.organization!.id),
    sql`(${records.kind}<>'view' OR ${records.actorRef}=${c.actor.actorId}) AND (${records.caseId} IS NULL OR EXISTS(SELECT 1 FROM dossier_participants p JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id WHERE b.organization_id=${records.organizationId} AND p.dossier_id=${records.caseId} AND p.actor_id=${c.actor.actorId} AND p.user_id=${c.actor.userId} AND p.status='active'))`,
  );
const last = (c: Context, id: string) =>
  c.db
    .select()
    .from(records)
    .where(and(visible(c), eq(records.id, id)))
    .orderBy(desc(records.revision))
    .limit(1)
    .then((r) => r[0]);
const byKey = (c: Context, key: string) =>
  c.db
    .select()
    .from(records)
    .where(and(visible(c), eq(records.actorRef, c.actor.actorId), eq(records.operationKey, key)))
    .limit(1)
    .then((r) => r[0]);
const publicRow = (r: Row) => ({
  id: r.id,
  revision: r.revision,
  kind: r.kind,
  caseId: r.caseId,
  sourceId: r.sourceId,
  sourceRevision: r.sourceRevision,
  title: r.title,
  body: r.body,
  stage: r.stage,
  statusFilter: r.statusFilter,
  archived: r.archived,
  savedAt: r.savedAt,
});
async function receipt(c: Context, key: string, r?: Row) {
  if (r?.caseId && !(await organizationDossierAccess(c.db, c.actor, c.organization!, r.caseId)))
    return problem("access", 403);
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    operationKey: key,
    saved: r ? { id: r.id, revision: r.revision } : null,
  });
}
const projectCase = (
  d: {
    id: string;
    title: string;
    reference: string;
    revision: number;
    status: string;
    jurisdictions: string[];
  },
  role: string,
  write: boolean,
): CaseChoice => ({
  id: d.id,
  title: d.title,
  reference: d.reference,
  revision: d.revision,
  status: d.status,
  jurisdictions: d.jurisdictions,
  canEdit: write && !terminal(d.status) && ["owner", "contributor"].includes(role),
});
export async function GET(req: Request) {
  const c = await resolveDossierServerContext(req);
  if (isResponse(c)) return c;
  const q = new URL(req.url).searchParams,
    org = c.organization!,
    scope = organizationSelectionToken(org),
    write = org.role !== "auditor";
  if (q.has("operation")) {
    const key = q.get("operation")!;
    return operationKey.test(key) ? receipt(c, key, await byKey(c, key)) : problem("fields", 400);
  }
  if (q.has("download")) {
    const id = q.get("download")!;
    if (!/^document_[a-f0-9]{32}$/.test(id)) return problem("access", 404);
    const row = await last(c, id);
    if (!row || row.kind !== "document" || !row.caseId) return problem("access", 404);
    const bytes = wordDocument(row.body),
      denied = await firmAuthority(c);
    if (denied) return denied;
    if (!(await organizationDossierAccess(c.db, c.actor, org, row.caseId))) return problem("access", 404);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          "attachment; filename=\"case-document.docx\"; filename*=UTF-8''" +
          encodeURIComponent(row.title.replace(/[\\/:*?"<>|]/g, "_") + ".docx"),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Workspace-Scope": scope,
      },
    });
  }
  if (q.has("history")) {
    const id = q.get("history")!,
      before = Number(q.get("before") ?? Number.MAX_SAFE_INTEGER);
    if (!dossierId.test(id) || !Number.isSafeInteger(before) || before < 1) return problem("fields", 400);
    if (!(await organizationDossierAccess(c.db, c.actor, org, id))) return problem("access", 404);
    const rows = await c.db
      .select()
      .from(records)
      .where(and(visible(c), eq(records.id, "progress_" + id), lt(records.revision, before)))
      .orderBy(desc(records.revision))
      .limit(21);
    if (!(await organizationDossierAccess(c.db, c.actor, org, id))) return problem("access", 404);
    return firmReply(c, {
      scope,
      history: rows.slice(0, 20).map(publicRow),
      before: rows.length > 20 ? rows[19].revision : null,
    });
  }
  const after = q.get("after") ?? "";
  if (after && !recordId.test(after)) return problem("fields", 400);
  const denied = await firmAuthority(c);
  if (denied) return denied;
  const cases = after
    ? []
    : await c.db
        .select({
          id: dossiers.id,
          title: dossiers.title,
          reference: dossiers.reference,
          revision: dossiers.revision,
          status: dossiers.status,
          jurisdictions: dossiers.jurisdictions,
          role: people.role,
        })
        .from(dossiers)
        .innerJoin(bindings, and(eq(bindings.dossierId, dossiers.id), eq(bindings.organizationId, org.id)))
        .innerJoin(
          people,
          and(
            eq(people.dossierId, dossiers.id),
            eq(people.userId, c.actor.userId),
            eq(people.actorId, c.actor.actorId),
            eq(people.status, "active"),
          ),
        )
        .orderBy(asc(dossiers.title), asc(dossiers.id));
  const rows = await c.db
    .select()
    .from(records)
    .where(
      and(
        visible(c),
        after ? gt(records.id, after) : undefined,
        sql`NOT EXISTS(SELECT 1 FROM case_work_revisions n WHERE n.organization_id=${records.organizationId} AND n.id=${records.id} AND n.revision>${records.revision})`,
      ),
    )
    .orderBy(asc(records.id))
    .limit(17);
  return firmReply(c, {
    scope,
    firm: org.name,
    canWrite: write,
    cases: cases.map((v) => projectCase(v, v.role, write)),
    records: rows.slice(0, 16).map(publicRow),
    next: rows.length > 16 ? rows[15].id : null,
  });
}
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) return problem("origin", 403);
  const c = await resolveDossierServerContext(req);
  if (isResponse(c)) return c;
  const org = c.organization!;
  const input = await readJsonObject(req, 180000),
    key = input?.operationKey;
  if (typeof key !== "string" || !operationKey.test(key)) return problem("fields", 400);
  let cmd: Command;
  try {
    cmd = parseCommand(input);
  } catch (e) {
    return problem(e instanceof Error ? e.message : "fields", 400);
  }
  const viewOnly =
    cmd.action === "view" ||
    ((cmd.action === "archive" || cmd.action === "restore") && cmd.id.startsWith("view_"));
  if (org.role === "auditor" && !viewOnly) return problem("readOnly", 403);
  const digest = await dossierSha256(canonicalDossierJson(input));
  const prior = await byKey(c, key);
  if (prior) return prior.requestDigest === digest ? receipt(c, key, prior) : problem("changed", 409);
  const old = await last(c, cmd.id);
  if ((old?.revision ?? 0) !== cmd.revision) return problem("changed", 409);
  const base = {
    caseId: null,
    sourceId: null,
    sourceRevision: null,
    title: "",
    body: "",
    stage: "",
    statusFilter: "",
    archived: false,
  };
  let row: Data;
  const conditions: SQL[] = [];
  if (cmd.action === "template") {
    if (old && (old.kind !== "template" || old.archived)) return problem("changed", 409);
    row = { ...base, kind: "template", title: cmd.title, body: cmd.body };
  } else if (cmd.action === "view") {
    if (old && (old.kind !== "view" || old.archived)) return problem("changed", 409);
    row = {
      ...base,
      kind: "view",
      title: cmd.title,
      body: cmd.filter.query,
      stage: cmd.filter.stage,
      statusFilter: cmd.filter.status,
    };
  } else if (cmd.action === "generate" || cmd.action === "progress") {
    const grant = await organizationDossierAccess(c.db, c.actor, org, cmd.caseId);
    if (!grant) return problem("access", 403);
    const matter = projectCase(grant.dossier, grant.participant.role, true);
    if (!matter.canEdit) return problem("access", 403);
    conditions.push(
      sql`EXISTS(SELECT 1 FROM dossier_participants p JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id JOIN dossiers d ON d.id=p.dossier_id WHERE b.organization_id=${org.id} AND p.dossier_id=${cmd.caseId} AND p.actor_id=${c.actor.actorId} AND p.user_id=${c.actor.userId} AND p.status='active' AND p.role IN ('owner','contributor') AND d.revision=${matter.revision} AND d.status NOT IN ('closed','archived','declined','cancelled'))`,
    );
    if (cmd.action === "progress") {
      row = { ...base, kind: "progress", caseId: cmd.caseId, stage: cmd.stage, body: cmd.body };
    } else {
      const source = await last(c, cmd.sourceId);
      if (
        !source ||
        source.kind !== "template" ||
        source.archived ||
        source.revision !== cmd.sourceRevision ||
        cmd.caseRevision !== matter.revision
      )
        return problem("previewChanged", 409);
      const updateId = "progress_" + cmd.caseId,
        update = await last(c, updateId);
      const merged = preview(source.body, org.name, matter, update, cmd.locale);
      if (merged.missing.length || merged.text !== cmd.preview) return problem("previewChanged", 409);
      conditions.push(
        sql`(SELECT MAX(revision) FROM case_work_revisions WHERE organization_id=${org.id} AND id=${source.id})=${source.revision}`,
        sql`COALESCE((SELECT MAX(revision) FROM case_work_revisions WHERE organization_id=${org.id} AND id=${updateId}),0)=${update?.revision ?? 0}`,
      );
      row = {
        ...base,
        kind: "document",
        caseId: cmd.caseId,
        title: cmd.title,
        body: merged.text,
        sourceId: source.id,
        sourceRevision: source.revision,
      };
    }
  } else {
    if (!old || !["template", "view"].includes(old.kind) || old.archived !== (cmd.action === "restore"))
      return problem("changed", 409);
    row = { ...publicRow(old), archived: cmd.action === "archive" };
  }
  const saved = {
    ...row,
    id: cmd.id,
    revision: cmd.revision + 1,
    organizationId: org.id,
    actorRef: c.actor.actorId,
    operationKey: key,
    requestDigest: digest,
    savedAt: canonicalDossierTimestamp(),
  };
  const db = c.db,
    check = (s: SQL) => db.insert(guards).values({ changed: sql`CASE WHEN ${s} THEN 1 ELSE 0 END` });
  const batch: [...Parameters<typeof db.batch>[0]] = [
    db.delete(guards),
    ...conditions.map(check),
    db.insert(records).values(saved),
    db.delete(guards),
  ];
  try {
    await db.batch(batch);
  } catch {
    const exact = await byKey(c, key);
    if (exact?.requestDigest === digest) return receipt(c, key, exact);
    return (await firmAuthority(c)) ?? problem("changed", 409);
  }
  return receipt(c, key, saved);
}
