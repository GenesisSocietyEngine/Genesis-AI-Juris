import { and, asc, eq } from "drizzle-orm";
import { savedPracticeReports as saved } from "../../../db/schema";
import {
  dossierJson,
  isResponse,
  resolveDossierServerContext,
} from "../../dossier-server";
import { organizationSelectionToken } from "../../organization-store";
import { firmReply } from "../../firm-authority";
import { readJsonObject, isSameOriginMutation } from "../../request-security";
import { validConfig } from "../../reports/config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const rows = await c.db
    .select({ id: saved.id, name: saved.name, config: saved.config })
    .from(saved)
    .where(
      and(
        eq(saved.organizationId, c.organization!.id),
        eq(saved.actorRef, c.actor.actorId),
      ),
    )
    .orderBy(asc(saved.name), asc(saved.id));
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    saved: rows.map((r) => ({ ...r, config: JSON.parse(r.config) })),
  });
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return dossierJson({ error: "Origin" }, 403);
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const body = await readJsonObject(request, 8192);
  if (
    !body ||
    typeof body.id !== "string" ||
    !/^report_[a-f0-9]{32}$/.test(body.id)
  )
    return dossierJson({ error: "Invalid report" }, 400);
  const owner = and(
    eq(saved.id, body.id),
    eq(saved.organizationId, c.organization!.id),
    eq(saved.actorRef, c.actor.actorId),
  );
  if (body.action === "remove")
    await c.db.batch([c.db.delete(saved).where(owner)]);
  else {
    if (
      body.action !== "save" ||
      !validConfig(body.config) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 100
    )
      return dossierJson({ error: "Invalid configuration" }, 400);
    const config = JSON.stringify(body.config),
      name = body.name.trim();
    await c.db.batch([
      c.db
        .insert(saved)
        .values({
          id: body.id,
          organizationId: c.organization!.id,
          actorRef: c.actor.actorId,
          name,
          config,
        })
        .onConflictDoNothing(),
    ]);
    const [current] = await c.db
      .select({ config: saved.config, name: saved.name })
      .from(saved)
      .where(owner);
    if (current?.config !== config || current.name !== name)
      return dossierJson({ error: "Report changed" }, 409);
  }
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    id: body.id,
  });
}
