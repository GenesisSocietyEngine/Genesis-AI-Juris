import { and, desc, eq } from "drizzle-orm";
import { organizationWorkflowRevisions as revisions } from "../../../../db/schema";
import { canonicalDossierJson } from "../../../dossier-contract";
import { boundedDossierText, canonicalDossierTimestamp, dossierJson, dossierSha256, isResponse, newDossierOpaqueId, revalidateDossierIdentity, resolveDossierServerContext } from "../../../dossier-server";
import { assertOrganizationCurrent } from "../../../organization-store";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { changeWorkflowLibrary, EMPTY_LIBRARY, readWorkflowLibrary } from "../../../work/workflow-templates";

export const dynamic = "force-dynamic";
type Context = Exclude<Awaited<ReturnType<typeof resolveDossierServerContext>>, Response>;
async function finish(context: Context, data: unknown) {
  const identity = await revalidateDossierIdentity(context); if (identity) return identity;
  try { await assertOrganizationCurrent(context.db, context.actor, context.organization!); }
  catch { return dossierJson({ error: "Organization access changed." }, 404); }
  return dossierJson(data);
}
export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request); if (isResponse(context)) return context;
  const [row] = await context.db.select().from(revisions).where(eq(revisions.organizationId, context.organization!.id)).orderBy(desc(revisions.revision)).limit(1);
  return finish(context, { library: row ? readWorkflowLibrary(JSON.parse(row.library)) : EMPTY_LIBRARY, canManage: ["org_owner", "org_admin"].includes(context.organization!.role) });
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return dossierJson({ error: "Cross-site change rejected." }, 403);
  const context = await resolveDossierServerContext(request); if (isResponse(context)) return context;
  if (!["org_owner", "org_admin"].includes(context.organization!.role)) return dossierJson({ error: "Only organization owners and administrators can manage workflow templates." }, 403);
  const command = await readJsonObject(request, 32768);
  let key: string, digest: string;
  try {
    if (!command || Object.keys(command).some(k => !["action", "id", "template", "expectedRevision", "operationKey"].includes(k)) || !Number.isSafeInteger(command.expectedRevision) || Number(command.expectedRevision) < 0) throw Error();
    key = boundedDossierText(command.operationKey, "Operation key", 8, 120);
    if (key !== command.operationKey) throw Error();
    digest = await dossierSha256(canonicalDossierJson(command));
  } catch { return dossierJson({ error: "Invalid template action." }, 400); }
  const original = async () => (await context.db.select().from(revisions).where(and(eq(revisions.organizationId, context.organization!.id), eq(revisions.actorRef, context.actor.actorId), eq(revisions.operationKey, key))).limit(1))[0];
  const receipt = (row: typeof revisions.$inferSelect) => row.requestDigest === digest ? finish(context, { library: readWorkflowLibrary(JSON.parse(row.library)), operation: row.operationKey }) : dossierJson({ error: "This operation key belongs to a different change." }, 409);
  const prior = await original(); if (prior) return receipt(prior);
  const [latest] = await context.db.select().from(revisions).where(eq(revisions.organizationId, context.organization!.id)).orderBy(desc(revisions.revision)).limit(1);
  const library = latest ? readWorkflowLibrary(JSON.parse(latest.library)) : EMPTY_LIBRARY;
  if (library.revision !== command!.expectedRevision) return dossierJson({ error: "Templates changed. Refresh and compare before saving." }, 409);
  let next;
  try { next = changeWorkflowLibrary(library, command!, () => newDossierOpaqueId("wf")); }
  catch (error) { return dossierJson({ error: error instanceof Error ? error.message : "Invalid template." }, 400); }
  const row = { organizationId: context.organization!.id, revision: next.revision, actorRef: context.actor.actorId, operationKey: key, requestDigest: digest, library: canonicalDossierJson(next), occurredAt: canonicalDossierTimestamp() };
  try { await context.db.batch([context.db.insert(revisions).values(row)]); }
  catch { const saved = await original(); if (saved) return receipt(saved); return dossierJson({ error: "Templates or your access changed. Refresh before saving." }, 409); }
  return receipt(row);
}
