import { and, desc, eq } from "drizzle-orm";
import { organizationInvitations, organizationLifecycleRequests, organizationMemberships, organizationSecurityEvents, users } from "../../../db/schema";
import { dossierJson, isResponse, resolveDossierServerContext } from "../../dossier-server";
import { isSameOriginCredentialMutation, readJsonObject } from "../../request-security";
import {
  ORGANIZATION_COOKIE, OrganizationError, acceptOrganizationInvitation, approveOrganizationLifecycle,
  changeOrganizationMember, createOrganization, ensurePersonalOrganization, inviteOrganizationMember,
  listOrganizations, organizationSelection, organizationSelectionToken, requestOrganizationLifecycle, resolveOrganization,
} from "../../organization-store";

export const dynamic = "force-dynamic";
const publicOrganization = (o: Awaited<ReturnType<typeof resolveOrganization>>) => ({ ...o, selection: organizationSelectionToken(o) });
const fields: Record<string, string[]> = {
  create: ["action", "name"], select: ["action", "organizationId"], accept: ["action", "token"],
  invite: ["action", "organizationId", "recipientActorId", "role"],
  member: ["action", "organizationId", "actorId", "status", "role", "expectedRevision"],
  lifecycle_request: ["action", "organizationId", "command"],
  lifecycle_approve: ["action", "organizationId", "requestId"],
};

function problem(error: unknown) {
  return dossierJson({ error: "This organization action is unavailable. Refresh your organizations and check your access.",
    code: error instanceof OrganizationError ? error.code : "organization_service_unavailable" },
    error instanceof OrganizationError ? error.status : 503);
}

export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request, { identityOnly: true });
  if (isResponse(context)) return context;
  try {
    const { db, actor } = context;
    await ensurePersonalOrganization(db, actor);
    const available = await listOrganizations(db, actor);
    let selected = null;
    let selectionIssue: string | null = null;
    try { selected = await resolveOrganization(db, actor, organizationSelection(request.headers, request.url), true); }
    catch (error) { selectionIssue = error instanceof OrganizationError ? error.code : "organization_unavailable"; }
    let members: unknown[] = [], invitations: unknown[] = [], requests: unknown[] = [], events: unknown[] = [];
    if (selected && ["org_owner", "org_admin", "auditor"].includes(selected.role)) {
      const organizationId = selected.id;
      members = await db.select({ actorId: organizationMemberships.actorId, name: users.displayName,
        role: organizationMemberships.role, status: organizationMemberships.status, revision: organizationMemberships.revision })
        .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
        .where(eq(organizationMemberships.organizationId, organizationId)).orderBy(users.displayName).limit(100);
      requests = await db.select().from(organizationLifecycleRequests).where(and(
        eq(organizationLifecycleRequests.organizationId, organizationId), eq(organizationLifecycleRequests.status, "pending"))).limit(100);
      events = await db.select().from(organizationSecurityEvents).where(eq(organizationSecurityEvents.organizationId, organizationId))
        .orderBy(desc(organizationSecurityEvents.sequence)).limit(50);
      if (selected.role === "org_owner") invitations = await db.select({ id: organizationInvitations.id,
        recipientActorId: organizationInvitations.recipientActorId, role: organizationInvitations.role,
        status: organizationInvitations.status, expiresAt: organizationInvitations.expiresAt }).from(organizationInvitations)
        .where(eq(organizationInvitations.organizationId, organizationId)).orderBy(desc(organizationInvitations.createdAt)).limit(100);
    }
    if (selected) await resolveOrganization(db, actor, organizationSelectionToken(selected), true);
    return dossierJson({ organizations: available.map(publicOrganization), selected: selected ? publicOrganization(selected) : null,
      selectionIssue, actorId: actor.actorId, members, invitations, requests, events,
      capabilities: { mode: "synthetic_validation", confidentialUploads: false, entraOidc: false, complianceExport: false } });
  } catch (error) { return problem(error); }
}

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return dossierJson({ error: "A same-origin organization action is required." }, 403);
  const context = await resolveDossierServerContext(request, { identityOnly: true });
  if (isResponse(context)) return context;
  const payload = await readJsonObject(request, 4096);
  const action = String(payload?.action ?? "");
  if (!payload || !fields[action] || Object.keys(payload).some((key) => !fields[action].includes(key))) {
    return dossierJson({ error: "The organization action contains unsupported fields." }, 400);
  }
  try {
    const { db, actor } = context;
    if (action === "create") return dossierJson({ organization: publicOrganization(await createOrganization(db, actor, payload.name)) }, 201);
    if (action === "accept") return dossierJson({ organization: publicOrganization(await acceptOrganizationInvitation(db, actor, payload.token)) });
    if (typeof payload.organizationId !== "string") throw new OrganizationError("organization_unavailable");
    const selected = await resolveOrganization(db, actor, payload.organizationId, action.startsWith("lifecycle_"));
    if (action === "select") return dossierJson({ organization: publicOrganization(selected) }, 200, {
      "Set-Cookie": `${ORGANIZATION_COOKIE}=${organizationSelectionToken(selected)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`,
    });
    if (action === "invite") return dossierJson(await inviteOrganizationMember(db, actor, selected, payload.recipientActorId, payload.role), 201);
    if (action === "member") await changeOrganizationMember(db, actor, selected, payload.actorId, payload.status, payload.role, payload.expectedRevision);
    if (action === "lifecycle_request") return dossierJson(await requestOrganizationLifecycle(db, actor, selected, payload.command), 201);
    if (action === "lifecycle_approve") await approveOrganizationLifecycle(db, actor, selected, payload.requestId);
    return dossierJson({ ok: true });
  } catch (error) { return problem(error); }
}
