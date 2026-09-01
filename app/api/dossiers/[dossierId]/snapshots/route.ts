import { env } from "cloudflare:workers";
import {
  createDossierSnapshot,
  DOSSIER_PILOT_REDACTION_PROFILE_ID,
  DOSSIER_PILOT_SNAPSHOT_AUDIENCE,
  dossierGovernedErrorResponse,
  listDossierSnapshots,
} from "../../../../dossier-governed-output-server";
import {
  dossierJson,
  expectedDossierRevision,
  isResponse,
  prepareDossierAuditEvents,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const SNAPSHOT_FIELDS = new Set([
  "expectedRevision",
  "expected_revision",
  "locale",
  "audience",
  "redactionProfileId",
  "redaction_profile_id",
]);

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;
  try {
    return dossierJson({
      snapshots: await listDossierSnapshots(context, access.dossier.id),
      contract_version: "1.0.0",
    });
  } catch (error) {
    return dossierGovernedErrorResponse(error);
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site Matter snapshot mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "snapshot");
  if (isResponse(access)) return access;
  const payload = await readJsonObject(request, 16_384);
  if (!payload) return dossierJson({ error: "A valid snapshot request is required." }, 400);
  if (Object.keys(payload).some((key) => !SNAPSHOT_FIELDS.has(key))) {
    return dossierJson({ error: "The snapshot request contains a protected or unknown field." }, 400);
  }
  if (
    ("expectedRevision" in payload && "expected_revision" in payload)
    || ("redactionProfileId" in payload && "redaction_profile_id" in payload)
  ) {
    return dossierJson({ error: "The snapshot request contains an ambiguous field." }, 400);
  }
  let expectedRevision: number;
  let locale: string;
  let audience: typeof DOSSIER_PILOT_SNAPSHOT_AUDIENCE;
  let redactionProfileId: typeof DOSSIER_PILOT_REDACTION_PROFILE_ID;
  try {
    expectedRevision = "expectedRevision" in payload || "expected_revision" in payload
      ? expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision)
      : access.dossier.revision;
    if (
      typeof payload.locale !== "string"
      || !/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(payload.locale)
    ) throw new Error("Snapshot locale is invalid.");
    locale = payload.locale;
    if (
      payload.audience !== DOSSIER_PILOT_SNAPSHOT_AUDIENCE
      || (payload.redactionProfileId ?? payload.redaction_profile_id)
        !== DOSSIER_PILOT_REDACTION_PROFILE_ID
    ) {
      return dossierJson({
        error: "The pilot supports only internal snapshots with the pilot-default profile until deterministic, versioned redaction is available.",
        code: "snapshot_redaction_unavailable",
      }, 409);
    }
    audience = DOSSIER_PILOT_SNAPSHOT_AUDIENCE;
    redactionProfileId = DOSSIER_PILOT_REDACTION_PROFILE_ID;
  } catch (error) {
    return dossierJson({ error: error instanceof Error ? error.message : "The snapshot request is invalid." }, 400);
  }
  const bindings = env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket };
  if (!bindings.DOSSIER_DOCUMENTS) {
    return dossierJson({ error: "Private Matter storage is unavailable.", code: "private_storage_unavailable" }, 503);
  }
  try {
    const result = await createDossierSnapshot({
      context,
      dependencies: {
        prepareAuditEvents: (currentDossierId, revision, inputs) =>
          prepareDossierAuditEvents(context, currentDossierId, revision, inputs),
      },
      bucket: bindings.DOSSIER_DOCUMENTS,
      dossierId: access.dossier.id,
      expectedRevision,
      locale,
      audience,
      redactionProfileId,
    });
    return dossierJson(result, 201);
  } catch (error) {
    return dossierGovernedErrorResponse(error);
  }
}
