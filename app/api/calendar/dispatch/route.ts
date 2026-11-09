import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { readJsonObject } from "../../../request-security";
import { verifyAssertion } from "../../../calendar/dispatcher-auth";
import { dispatch } from "../../../calendar/delivery";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = await readJsonObject(request, 12500);
  const token = typeof body?.assertion === "string" ? body.assertion : "";
  const status = await verifyAssertion(token);
  if (status !== "verified")
    return new Response(null, {
      status: status === "issuer" ? 503 : 403,
      headers: { "Cache-Control": "no-store", "X-CaseVant-Check": status },
    });
  const result = await dispatch(
    getDb(),
    env as Parameters<typeof dispatch>[1],
    fetch,
    Date.now(),
    new URL(request.url).searchParams.get("check") === "1",
  );
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
