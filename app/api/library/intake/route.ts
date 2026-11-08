import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import {
  dossiers,
  dossierOrganizationBindings as bindings,
  dossierParticipants as people,
  intakeRevisions as entries,
  organizationCasGuards as guards,
} from "../../../../db/schema";
import { canonicalDossierJson } from "../../../dossier-contract";
import {
  canonicalDossierTimestamp,
  dossierJson,
  dossierSha256,
  isResponse,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../../dossier-server";
import { firmAuthority, firmReply } from "../../../firm-authority";
import { organizationDossierAccess, organizationSelectionToken } from "../../../organization-store";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import {
  answersFit,
  intakeId,
  operationId,
  parseIntake,
  type IntakeCommand,
  type Question,
} from "../../../intake/intake-model";

export const dynamic = "force-dynamic";
type Row = typeof entries.$inferSelect;
type Snapshot = Pick<
  Row,
  "title" | "questions" | "answers" | "status" | "caseId" | "templateId" | "templateRevision"
>;
const problem = (code: string, status: number) => dossierJson({ code }, status);
const own = (c: DossierServerContext) => eq(entries.organizationId, c.organization!.id);
const permitted = (c: DossierServerContext, write = false) => sql`(${entries.caseId} IS NULL OR EXISTS (
 SELECT 1 FROM dossier_participants p JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id
 WHERE b.organization_id=${entries.organizationId} AND p.dossier_id=${entries.caseId}
 AND p.user_id=${c.actor.userId} AND p.actor_id=${c.actor.actorId} AND p.status='active'
 ${write ? sql`AND p.role IN ('owner','contributor')` : sql``}))`;
async function latest(c: DossierServerContext, id: string) {
  return (
    await c.db
      .select()
      .from(entries)
      .where(and(own(c), eq(entries.id, id), permitted(c)))
      .orderBy(desc(entries.revision))
      .limit(1)
  )[0];
}
async function previous(c: DossierServerContext, key: string) {
  return (
    await c.db
      .select()
      .from(entries)
      .where(and(own(c), eq(entries.actorRef, c.actor.actorId), eq(entries.operationKey, key), permitted(c)))
      .limit(1)
  )[0];
}
async function receipt(c: DossierServerContext, key: string, r: Row | undefined) {
  if (r?.caseId && !(await organizationDossierAccess(c.db, c.actor, c.organization!, r.caseId)))
    return problem("caseAccess", 403);
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    operationKey: key,
    saved: r ? { id: r.id, revision: r.revision } : null,
  });
}
export async function GET(request: Request) {
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const query = new URL(request.url).searchParams,
    key = query.get("operation"),
    after = query.get("after") ?? "";
  if (key !== null)
    return operationId.test(key) ? receipt(c, key, await previous(c, key)) : problem("invalid", 400);
  if (after && !intakeId.test(after)) return problem("invalid", 400);
  const denied = await firmAuthority(c);
  if (denied) return denied;
  const canWrite = c.organization!.role !== "auditor",
    pageSize = 16;
  const cases = after
    ? []
    : await c.db
        .select({ id: dossiers.id, title: dossiers.title, role: people.role })
        .from(dossiers)
        .innerJoin(
          bindings,
          and(eq(bindings.dossierId, dossiers.id), eq(bindings.organizationId, c.organization!.id)),
        )
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
    .select({
      id: entries.id,
      revision: entries.revision,
      title: entries.title,
      questions: entries.questions,
      answers: entries.answers,
      status: entries.status,
      caseId: entries.caseId,
      templateId: entries.templateId,
      templateRevision: entries.templateRevision,
      savedAt: entries.savedAt,
      editable: sql<number>`${permitted(c, true)}`,
    })
    .from(entries)
    .where(
      and(
        own(c),
        permitted(c),
        after ? gt(entries.id, after) : undefined,
        sql`NOT EXISTS (SELECT 1 FROM intake_revisions newer WHERE newer.organization_id=${entries.organizationId} AND newer.id=${entries.id} AND newer.revision>${entries.revision})`,
      ),
    )
    .orderBy(asc(entries.id))
    .limit(pageSize + 1);
  const page = rows.slice(0, pageSize);
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    canWrite,
    cases: cases.map(({ id, title, role }) => ({
      id,
      title,
      canEdit: canWrite && ["owner", "contributor"].includes(role),
    })),
    records: page.map(({ editable, questions, answers, ...r }) => ({
      ...r,
      questions: JSON.parse(questions),
      answers: JSON.parse(answers),
      canEdit: canWrite && Boolean(editable),
    })),
    next: rows.length > pageSize ? page[page.length - 1].id : null,
  });
}
function base(r: Row): Snapshot {
  const { title, questions, answers, status, caseId, templateId, templateRevision } = r;
  return { title, questions, answers, status, caseId, templateId, templateRevision };
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return problem("origin", 403);
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const org = c.organization!;
  if (org.role === "auditor") return problem("readOnly", 403);
  const input = await readJsonObject(request, 196608),
    key = input?.operationKey;
  if (typeof key !== "string" || !operationId.test(key)) return problem("invalid", 400);
  let cmd: IntakeCommand;
  try {
    cmd = parseIntake(input);
  } catch (e) {
    return problem(e instanceof Error ? e.message : "invalid", 400);
  }
  const digest = await dossierSha256(canonicalDossierJson(input));
  const prior = await previous(c, key);
  if (prior) return prior.requestDigest === digest ? receipt(c, key, prior) : problem("changed", 409);
  const old = await latest(c, cmd.id);
  if ((old?.revision ?? 0) !== cmd.revision) return problem("changed", 409);
  const caseId = old?.caseId ?? (cmd.action === "answer" ? cmd.caseId : null);
  if (caseId) {
    const grant = await organizationDossierAccess(c.db, c.actor, org, caseId);
    if (!grant || !["owner", "contributor"].includes(grant.participant.role))
      return problem("caseAccess", 403);
  }
  let row: Snapshot;
  if (cmd.action === "design") {
    if (old && old.status !== "available") return problem("changed", 409);
    row = {
      caseId: null,
      templateId: null,
      templateRevision: null,
      status: "available",
      title: cmd.title,
      questions: JSON.stringify(cmd.questions),
      answers: "[]",
    };
  } else if (cmd.action === "answer") {
    if (
      old &&
      (old.status !== "draft" ||
        old.caseId !== cmd.caseId ||
        old.templateId !== cmd.templateId ||
        old.templateRevision !== cmd.templateRevision)
    )
      return problem("changed", 409);
    const source = old ?? (await latest(c, cmd.templateId));
    if (!source || (!old && (source.status !== "available" || source.revision !== cmd.templateRevision)))
      return problem("templateChanged", 409);
    if (!answersFit(JSON.parse(source.questions) as Question[], cmd.answers, cmd.status === "complete"))
      return problem("required", 400);
    row = {
      title: source.title,
      questions: source.questions,
      answers: JSON.stringify(cmd.answers),
      caseId: cmd.caseId,
      templateId: cmd.templateId,
      templateRevision: cmd.templateRevision,
      status: cmd.status,
    };
  } else {
    if (
      !old ||
      old.status !== ({ archive: "available", restore: "archived", reopen: "complete" } as const)[cmd.action]
    )
      return problem("changed", 409);
    row = {
      ...base(old),
      status: ({ archive: "archived", restore: "available", reopen: "draft" } as const)[cmd.action],
    };
  }
  const db = c.db,
    check = (test: ReturnType<typeof sql>) =>
      db.insert(guards).values({ changed: sql`CASE WHEN ${test} THEN 1 ELSE 0 END` });
  const batch: [...Parameters<typeof db.batch>[0]] = [db.delete(guards)];
  if (caseId)
    batch.push(
      check(
        sql`EXISTS(SELECT 1 FROM dossier_participants p JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id WHERE b.organization_id=${org.id} AND p.dossier_id=${caseId} AND p.user_id=${c.actor.userId} AND p.actor_id=${c.actor.actorId} AND p.status='active' AND p.role IN ('owner','contributor'))`,
      ),
    );
  if (cmd.action === "answer" && !old)
    batch.push(
      check(
        sql`(SELECT max(revision) FROM intake_revisions WHERE organization_id=${org.id} AND id=${cmd.templateId})=${cmd.templateRevision}`,
      ),
    );
  const saved = {
    ...row,
    organizationId: org.id,
    id: cmd.id,
    revision: cmd.revision + 1,
    actorRef: c.actor.actorId,
    operationKey: key,
    requestDigest: digest,
    savedAt: canonicalDossierTimestamp(),
  };
  // The unique revision key is also the compare-and-swap: no update or overwrite path.
  batch.push(db.insert(entries).values(saved), db.delete(guards));
  try {
    await db.batch(batch);
  } catch {
    const exact = await previous(c, key);
    if (exact?.requestDigest === digest) return receipt(c, key, exact);
    return (await firmAuthority(c)) ?? problem("changed", 409);
  }
  return receipt(c, key, saved);
}
