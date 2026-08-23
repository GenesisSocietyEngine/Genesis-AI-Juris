import { clearSessionCookie } from "../../../auth-crypto";
import { authJson } from "../../../auth-http";
import { authSubjectHash, revokeLocalSession, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation } from "../../../request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  try {
    const session = await revokeLocalSession(request.headers.get("cookie"));
    if (session) {
      try {
        await writeAuthAudit({
          accountId: session.accountId,
          eventType: "local_logout",
          emailSubjectHash: await authSubjectHash(`account:${session.accountId}`),
          success: true,
        });
      } catch {
        // Revocation is authoritative; an unavailable audit sink must not
        // restore the session or prevent the browser cookie from expiring.
      }
    }
  } catch {
    return authJson({ authenticated: false, error: "The server session could not be revoked. The browser credential was cleared; try again when service is restored." }, 503, clearSessionCookie());
  }
  return authJson({ authenticated: false }, 200, clearSessionCookie());
}
