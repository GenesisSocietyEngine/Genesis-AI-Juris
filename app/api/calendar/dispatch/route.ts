import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { authorized } from "../../../calendar/dispatcher-auth";
import { dispatch } from "../../../calendar/delivery";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ") || !(await authorized(bearer.slice(7))))
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  const result = await dispatch(
    getDb(),
    env as Parameters<typeof dispatch>[1],
    fetch,
    Date.now(),
    new URL(request.url).searchParams.get("check") === "1",
  );
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
