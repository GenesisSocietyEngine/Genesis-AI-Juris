import { dossierJson, isResponse, resolveDossierServerContext, revalidateDossierIdentity } from "../../dossier-server";
import { OrganizationError, organizationSelectionToken, resolveOrganization } from "../../organization-store";
import { acceptEmailInvitation, createEmailInvitation, emailInvitationRecipient, listEmailInvitations, previewEmailInvitation, requestInvitationMailboxProof, revokeEmailInvitation } from "../../email-invitation-store";
import { normalizeEmail } from "../../auth-crypto";
import { consumeAuthRateLimit } from "../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../request-security";

export const dynamic = "force-dynamic";
const fields: Record<string, string[]> = {
  invite: ["action", "organizationId", "recipientEmail", "role"], resend: ["action", "organizationId", "invitationId"],
  revoke: ["action", "organizationId", "invitationId"], preview: ["action", "token"],
  verify: ["action", "token"], accept: ["action", "token", "proof", "organizationId"],
};
function problem(error: unknown) {
  return dossierJson({ code: error instanceof OrganizationError ? error.code : "invitation_service_unavailable",
    error: "This invitation action could not be confirmed. Check your account and refresh before retrying." }, error instanceof OrganizationError ? error.status : 503);
}
export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request, { identityOnly: true });
  if (isResponse(context)) return context;
  try {
    const selected = new URL(request.url).searchParams.get("organization");
    if (!selected) throw new OrganizationError("organization_required", 400);
    const authority = await resolveOrganization(context.db, context.actor, selected);
    if (authority.role !== "org_owner") throw new OrganizationError("organization_unavailable");
    const invitations = await listEmailInvitations(context.db, authority);
    await resolveOrganization(context.db, context.actor, organizationSelectionToken(authority));
    const identity = await revalidateDossierIdentity(context);
    if (identity) return identity;
    return dossierJson({ invitations });
  } catch (error) { return problem(error); }
}
export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return dossierJson({ code: "same_origin_required" }, 403);
  const context = await resolveDossierServerContext(request, { identityOnly: true });
  if (isResponse(context)) return context;
  const body = await readJsonObject(request, 4096);
  const action = String(body?.action ?? "");
  if (!body || !fields[action] || Object.keys(body).some(key => !fields[action].includes(key))) return dossierJson({ code: "invitation_fields_invalid" }, 400);
  try {
    const { db, actor } = context;
    const limit = await consumeAuthRateLimit(request, `invitation:${action}`, actor.email, { emailLimit: action === "preview" ? 60 : 10, networkLimit: 100, windowSeconds: 3600 });
    if (!limit.allowed) throw new OrganizationError("invitation_rate_limited", 429);
    const origin = new URL(request.url).origin;
    const identity = await revalidateDossierIdentity(context);
    if (identity) return identity;
    if (action === "preview") {
      const invitation = await previewEmailInvitation(db, actor, body.token, origin);
      return await revalidateDossierIdentity(context) ?? dossierJson({ invitation });
    }
    if (action === "verify") return dossierJson(await requestInvitationMailboxProof(db, actor, body.token, origin));
    if (action === "accept") {
      const organization = await acceptEmailInvitation(db, actor, body.token, body.proof, body.organizationId, origin);
      return dossierJson({ organization: { ...organization, selection: organizationSelectionToken(organization) } });
    }
    if (typeof body.organizationId !== "string") throw new OrganizationError("organization_required", 400);
    const authority = await resolveOrganization(db, actor, body.organizationId);
    if (authority.role !== "org_owner") throw new OrganizationError("organization_unavailable");
    if (action === "revoke") { await revokeEmailInvitation(db, actor, authority, body.invitationId); return dossierJson({ ok: true }); }
    // Owner-wide allowance above cannot be bypassed by changing the recipient.
    const recipient = action === "resend" ? await emailInvitationRecipient(db, actor, authority, body.invitationId) : normalizeEmail(body.recipientEmail);
    if (!recipient) throw new OrganizationError("invitation_email_invalid", 400);
    const recipientLimit = await consumeAuthRateLimit(request, "invitation:recipient", recipient, { emailLimit: 5, networkLimit: 100, windowSeconds: 3600 });
    if (!recipientLimit.allowed) throw new OrganizationError("invitation_rate_limited", 429);
    const invitation = await createEmailInvitation(db, actor, authority, { recipientEmail: body.recipientEmail, role: body.role,
      replacementId: action === "resend" ? body.invitationId : undefined }, origin);
    return await revalidateDossierIdentity(context) ?? dossierJson(invitation, 201);
  } catch (error) { return problem(error); }
}
