import { getChatGPTUser } from "../../chatgpt-auth";
import { dossierJson, isResponse, resolveDossierServerContext } from "../../dossier-server";
import { ensurePersonalOrganization, listOrganizations, organizationSelection, organizationSelectionToken, resolveOrganization, OrganizationError } from "../../organization-store";

export const dynamic = "force-dynamic";

/** Minimal shell identity and membership, resolved together on the server.
 * No case roles, member directory, invitation tokens or customer bodies. */
export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return dossierJson({ authenticated: false }, 401);
  const context = await resolveDossierServerContext(request, { identityOnly: true });
  const account = { displayName: identity.fullName ?? identity.displayName, email: identity.email, authSource: identity.authSource };
  if (isResponse(context)) {
    const issue = await context.clone().json().catch(() => null) as {code?:string} | null;
    if (issue?.code === "profile_required") return dossierJson({ authenticated: true, identity: account, actorId: null, organizations: [], selected: null, profileRequired: true });
    return context;
  }
  try {
    await ensurePersonalOrganization(context.db, context.actor);
    const available = await listOrganizations(context.db, context.actor);
    const organizations = available.filter(o => o.status === "active").map(o => ({ ...o, selection: organizationSelectionToken(o) }));
    let selected = null;
    let selectionIssue: string | null = null;
    try { selected = await resolveOrganization(context.db, context.actor, organizationSelection(request.headers, request.url)); }
    catch (error) { if(!(error instanceof OrganizationError))throw error;selectionIssue=error.code; }
    return dossierJson({ authenticated: true, identity: { ...account, displayName: context.actor.displayName }, actorId: context.actor.actorId,
      organizations, selected: selected ? { ...selected, selection: organizationSelectionToken(selected) } : null, selectionIssue, profileRequired: false });
  } catch { return dossierJson({ code: "organization_service_unavailable" }, 503); }
}
