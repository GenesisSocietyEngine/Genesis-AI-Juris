import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isPlatformAdmin } from "../../../server-authorization";
import { collectDatabaseState, emitDatabaseState } from "../../../database-state-diagnostics";
import { observabilityRequestId } from "../../../server-observability";

export const dynamic = "force-dynamic";
function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "private, no-store", Pragma: "no-cache", Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function GET(request: Request) {
  // Reject before local-session fallback, which may touch last_seen_at.
  if (!(await headers()).get("oai-authenticated-user-email")) {
    return privateJson({ error: "Platform administrator access is required." }, 403);
  }
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) {
    return privateJson({ error: "Platform administrator access is required." }, 403);
  }
  if (new URL(request.url).search) return privateJson({ error: "This operation accepts no parameters." }, 400);
  const bindings = env as unknown as { DB?: D1Database };
  if (!bindings.DB) return privateJson({ state: "incomplete", error: "Database binding unavailable." }, 503);
  const requestId = observabilityRequestId(request);
  const report = await collectDatabaseState(bindings.DB);
  const logDelivery = await emitDatabaseState(report, requestId);
  return privateJson({ requestId, report, logDelivery }, report.state === "collected" ? 200 : 503);
}
