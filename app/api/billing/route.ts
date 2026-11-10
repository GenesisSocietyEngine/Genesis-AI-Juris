import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  billingEvents as events,
  dossiers,
  dossierParticipants as people,
  dossierOrganizationBindings as bindings,
  organizationCasGuards,
  dossierDocuments,
  dossierDocumentCurrentVersions as currentFiles,
} from "../../../db/schema";
import { buildBillingEvent } from "../../billing/model";
import { canonicalDossierJson } from "../../dossier-contract";
import {
  canonicalDossierTimestamp,
  dossierJson,
  dossierSha256,
  isResponse,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../dossier-server";
import {
  organizationDossierAccess,
  organizationSelectionToken,
} from "../../organization-store";
import { firmReply } from "../../firm-authority";
import { isSameOriginMutation, readJsonObject } from "../../request-security";

export const dynamic = "force-dynamic";
const denied = () =>
  dossierJson({ error: "Billing access is unavailable." }, 403);
const conflict = () =>
  dossierJson(
    { error: "Billing records changed. Refresh and review the entry." },
    409,
  );
const staff = ["owner", "contributor"];
const allRows = (c: DossierServerContext, caseId: string) =>
  c.db
    .select({
      sequence: events.sequence,
      actorRef: events.actorRef,
      createdAt: events.createdAt,
      event: events.event,
    })
    .from(events)
    .where(
      and(
        eq(events.organizationId, c.organization!.id),
        eq(events.caseId, caseId),
      ),
    )
    .orderBy(asc(events.sequence));
async function access(c: DossierServerContext, caseId: string) {
  const grant = await organizationDossierAccess(
    c.db,
    c.actor,
    c.organization!,
    caseId,
  );
  return Boolean(grant && staff.includes(grant.participant.role));
}
export async function GET(request: Request) {
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const org = c.organization!,
    scope = organizationSelectionToken(org);
  const cases = await c.db
    .select({ id: dossiers.id, title: dossiers.title })
    .from(dossiers)
    .innerJoin(
      bindings,
      and(
        eq(bindings.dossierId, dossiers.id),
        eq(bindings.organizationId, org.id),
      ),
    )
    .innerJoin(
      people,
      and(
        eq(people.dossierId, dossiers.id),
        eq(people.userId, c.actor.userId),
        eq(people.actorId, c.actor.actorId),
        eq(people.status, "active"),
        inArray(people.role, staff),
      ),
    )
    .orderBy(asc(dossiers.title), asc(dossiers.id));
  const caseId = new URL(request.url).searchParams.get("case") || "";
  if (caseId && !cases.some((item) => item.id === caseId)) return denied();
  const rows = caseId ? await allRows(c, caseId) : [];
  const receipts = caseId
    ? await c.db
        .select({
          id: dossierDocuments.id,
          title: dossierDocuments.title,
          version: currentFiles.documentVersionId,
        })
        .from(dossierDocuments)
        .innerJoin(
          currentFiles,
          and(
            eq(currentFiles.documentId, dossierDocuments.id),
            eq(currentFiles.dossierId, dossierDocuments.dossierId),
          ),
        )
        .where(
          and(
            eq(dossierDocuments.dossierId, caseId),
            eq(dossierDocuments.isProvisional, false),
          ),
        )
        .orderBy(asc(dossierDocuments.title))
    : [];
  if (caseId && !(await access(c, caseId))) return denied();
  return firmReply(c, {
    scope,
    caseId,
    cases,
    rows,
    receipts,
    canEnter: org.role !== "auditor",
    canManage: ["org_owner", "org_admin"].includes(org.role),
  });
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return denied();
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const org = c.organization!,
    input = await readJsonObject(request, 22000);
  if (
    !input ||
    typeof input.caseId !== "string" ||
    typeof input.operationKey !== "string" ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(input.operationKey) ||
    !Number.isSafeInteger(input.revision)
  )
    return dossierJson({ error: "Invalid billing request." }, 400);
  const { caseId, operationKey } = input;
  if (org.role === "auditor" || !(await access(c, caseId))) return denied();
  const manager = ["org_owner", "org_admin"].includes(org.role);
  if (!manager && !["time", "expense"].includes(String(input.kind)))
    return denied();
  const digest = await dossierSha256(canonicalDossierJson(input));
  const replay = async () => {
    const [saved] = await c.db
      .select()
      .from(events)
      .where(
        and(
          eq(events.organizationId, org.id),
          eq(events.actorRef, c.actor.actorId),
          eq(events.operationKey, operationKey),
        ),
      )
      .limit(1);
    if (!saved) return null;
    if (saved.caseId !== caseId || saved.requestDigest !== digest)
      return conflict();
    if (!(await access(c, caseId))) return denied();
    return firmReply(c, {
      sequence: saved.sequence,
      scope: organizationSelectionToken(org),
      operationKey,
    });
  };
  const previous = await replay();
  if (previous) return previous;
  const rows = await allRows(c, caseId),
    last = rows.at(-1)?.sequence ?? 0;
  if (last !== input.revision) return conflict();
  let event;
  try {
    event = buildBillingEvent(input, rows);
  } catch (error) {
    return dossierJson(
      {
        error:
          error instanceof Error ? error.message : "Invalid billing entry.",
      },
      422,
    );
  }
  const sequence = last + 1;
  if (event.kind === "expense" && input.receiptVersion) {
    if (typeof input.receiptVersion !== "string")
      return dossierJson({ error: "Invalid receipt." }, 422);
    const [receipt] = await c.db
      .select({
        id: dossierDocuments.id,
        title: dossierDocuments.title,
        version: currentFiles.documentVersionId,
      })
      .from(dossierDocuments)
      .innerJoin(
        currentFiles,
        and(
          eq(currentFiles.documentId, dossierDocuments.id),
          eq(currentFiles.dossierId, dossierDocuments.dossierId),
        ),
      )
      .where(
        and(
          eq(dossierDocuments.dossierId, caseId),
          eq(dossierDocuments.isProvisional, false),
          eq(currentFiles.documentVersionId, input.receiptVersion),
        ),
      )
      .limit(1);
    if (!receipt) return conflict();
    event.receipt = receipt;
  }
  try {
    await c.db.batch([
      c.db.insert(organizationCasGuards).values({
        changed: sql`CASE WHEN EXISTS(SELECT 1 FROM dossier_participants p JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id WHERE p.dossier_id=${caseId} AND b.organization_id=${org.id} AND p.user_id=${c.actor.userId} AND p.actor_id=${c.actor.actorId} AND p.status='active' AND p.role IN ('owner','contributor')) THEN 1 ELSE 0 END`,
      }),
      c.db.delete(organizationCasGuards),
      c.db.insert(events).values({
        organizationId: org.id,
        caseId,
        sequence,
        actorRef: c.actor.actorId,
        operationKey,
        requestDigest: digest,
        event,
        createdAt: canonicalDossierTimestamp(),
      }),
    ]);
  } catch {
    return (await replay()) ?? conflict();
  }
  return (await replay()) ?? conflict();
}
