import { getDb } from "../../../../db";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";
import { isStudioDeviceScope } from "../../../studio-device-storage";
import { parseStudioHistoryReceipt, strictHistoryObject } from "../../../studio-report-history";
import { HistoryError, historyAuthority, parseHistoryOptions, readHistory, recordHistory } from "../../../studio-report-history-server";

export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "private, no-store", "vary": "Cookie" } }); }
function positive(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
async function handle(request: Request, mutate: boolean) {
  if (mutate && !isSameOriginCredentialMutation(request)) return json({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return json({ error: "Sign in is required." }, 401);
  try {
    const db = getDb();
    if (mutate) {
      const body = await readJsonObject(request, 48_000);
      if (!strictHistoryObject(body, ["customCaseId", "expectedScope", "receipt", "options"]) || !positive(body.customCaseId) || !isStudioDeviceScope(body.expectedScope)) return json({ error: "Invalid report-history request." }, 400);
      const receipt = parseStudioHistoryReceipt(body.receipt), options = parseHistoryOptions(body.options);
      if (!receipt || !options) return json({ error: "A current report receipt and complete report settings are required." }, 400);
      const authority = await historyAuthority(db, identity, request, body.customCaseId, body.expectedScope);
      const result = await recordHistory(db, authority, receipt, options);
      return json(result, result.alreadyRecorded ? 200 : 201);
    }
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => !["customCaseId", "expectedScope", "limit", "cursor"].includes(key)) || [...params.keys()].some(key => params.getAll(key).length !== 1)) return json({ error: "Invalid report-history query." }, 400);
    const id = Number(params.get("customCaseId")), scope = params.get("expectedScope"), limit = Number(params.get("limit") ?? "20");
    const rawCursor = params.get("cursor"), cursor = rawCursor === null ? null : Number(rawCursor);
    if (!positive(id) || !isStudioDeviceScope(scope) || !positive(limit) || limit > 50 || rawCursor !== null && (!/^[1-9]\d{0,15}$/.test(rawCursor) || !positive(cursor))) return json({ error: "Invalid report-history query." }, 400);
    const authority = await historyAuthority(db, identity, request, id, scope);
    return json(await readHistory(db, authority, limit, cursor));
  } catch (error) {
    if (error instanceof HistoryError) return json({ error: error.message }, error.status);
    return json({ error: "Report history is temporarily unavailable." }, 503);
  }
}
export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }
