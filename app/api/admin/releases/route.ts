import { getDb } from "../../../../db";
import { updates } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isPlatformAdmin(identity)) return Response.json({ error: "Platform administrator access is required." }, { status: 403 });

  const payload = await readJsonObject(request, 48_000);
  if (!payload) return Response.json({ error: "A valid JSON object is required." }, { status: 400 });
  const title = text(payload.title, 160);
  const body = text(payload.body, 4000);
  const kind = typeof payload.kind === "string" && ["product", "case", "research"].includes(payload.kind) ? payload.kind : "product";
  const caseId = kind === "case" ? text(payload.caseId, 140) || null : null;
  const targetJurisdictions = list(payload.targetJurisdictions, 20, 100);
  const targetPracticeAreas = list(payload.targetPracticeAreas, 20, 100);
  const targetRoles = list(payload.targetRoles, 10, 60);
  const expiresAt = validFutureDate(payload.expiresAt);

  if (title.length < 4 || body.length < 10 || (kind === "case" && !caseId)) {
    return Response.json({ error: "A valid title, message and case target are required." }, { status: 400 });
  }

  const [release] = await getDb().insert(updates).values({
    title,
    body,
    kind,
    caseId,
    targetJurisdictions,
    targetPracticeAreas,
    targetRoles,
    publishedAt: new Date().toISOString(),
    expiresAt,
  }).returning();
  return Response.json({ release }, { status: 201 });
}

function validFutureDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date > new Date() ? date.toISOString() : null;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function list(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}
