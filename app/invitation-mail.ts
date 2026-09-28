import { env } from "cloudflare:workers";
import { canonicalHttpsOrigin } from "./reset-mail";
import { invitationRoleText } from "./invitation-client";

export type InvitationDelivery = "not_configured" | "provider_accepted" | "failed" | "unknown";
export type InvitationMessage = { to: string; organization: string; role: string; token: string; proof?: string; origin: string; attemptId: string };

/** Provider acceptance is not delivery. No recipient, body, token or provider error is logged. */
export async function sendInvitationMail(message: InvitationMessage): Promise<InvitationDelivery> {
  const config = env as unknown as { RESEND_API_KEY?: string; GENESIS_INVITATION_FROM_EMAIL?: string; GENESIS_PUBLIC_ORIGIN?: string; GENESIS_INVITATION_MAIL_ENABLED?: string };
  const origin = canonicalHttpsOrigin(config.GENESIS_PUBLIC_ORIGIN);
  const from = config.GENESIS_INVITATION_FROM_EMAIL?.trim();
  if (config.GENESIS_INVITATION_MAIL_ENABLED !== "true" || !config.RESEND_API_KEY || !from || from.length > 320 || /[\r\n]/.test(from) || !origin || origin !== message.origin) return "not_configured";
  const link = `${origin}/invitations#invite=${encodeURIComponent(message.token)}${message.proof ? `&proof=${encodeURIComponent(message.proof)}` : ""}`;
  const text = message.proof
    ? `Confirm access to this mailbox for your GENESIS: JURIS invitation. Open this link within 15 minutes, sign in with this email, review the organization and role, and explicitly accept. This does not sign you in or join the organization automatically.\n\n${link}\n\nIf you did not request this confirmation, ignore it.`
    : `You are invited to ${message.organization} as ${invitationRoleText(message.role, "en")} in GENESIS: JURIS. Open this link within 24 hours, sign in or register with this email, verify your mailbox and explicitly accept. Case access is assigned separately.\n\n${link}\n\nIf this invitation was unexpected, ignore it.`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `gj-invitation-${message.attemptId}` },
      body: JSON.stringify({ from, to: [message.to], subject: message.proof ? "Verify your invitation email · GENESIS: JURIS" : "Organization invitation · GENESIS: JURIS", text }),
    });
    return response.ok ? "provider_accepted" : response.status >= 500 ? "unknown" : "failed";
  } catch { return "unknown"; }
}
