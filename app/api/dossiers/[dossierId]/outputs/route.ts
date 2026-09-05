import { env } from "cloudflare:workers";
import {
  approveDossierGovernedOutput,
  dossierGovernedErrorResponse,
  generateDossierGovernedOutput,
  listDossierGovernedOutputs,
} from "../../../../dossier-governed-output-server";
import {
  dossierEnum,
  dossierJson,
  expectedDossierRevision,
  isResponse,
  prepareDossierAuditEvents,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../dossier-server";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const OUTPUT_FIELDS = new Set([
  "action",
  "expectedRevision",
  "expected_revision",
  "snapshotId",
  "snapshot_id",
  "outputId",
  "output_id",
  "format",
]);

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext(_request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;
  try {
    return dossierJson({
      outputs: await listDossierGovernedOutputs(context, access.dossier.id),
      contract_version: "1.0.0",
    });
  } catch (error) {
    return dossierGovernedErrorResponse(error);
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site governed output mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const payload = await readJsonObject(request, 16_384);
  if (!payload) return dossierJson({ error: "A valid governed output action is required." }, 400);
  if (Object.keys(payload).some((key) => !OUTPUT_FIELDS.has(key))) {
    return dossierJson({ error: "The output action contains a protected or unknown field." }, 400);
  }
  if (
    ("expectedRevision" in payload && "expected_revision" in payload)
    || ("snapshotId" in payload && "snapshot_id" in payload)
    || ("outputId" in payload && "output_id" in payload)
  ) {
    return dossierJson({ error: "The output action contains an ambiguous field." }, 400);
  }
  let action: "generate" | "approve";
  try {
    action = dossierEnum(payload.action, ["generate", "approve"] as const, "output action");
  } catch (error) {
    return dossierJson({ error: error instanceof Error ? error.message : "The output action is invalid." }, 400);
  }
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, action === "approve" ? "approve" : "output");
  if (isResponse(access)) return access;
  let expectedRevision: number;
  try {
    expectedRevision = "expectedRevision" in payload || "expected_revision" in payload
      ? expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision)
      : access.dossier.revision;
  } catch (error) {
    return dossierJson({ error: error instanceof Error ? error.message : "The output action is invalid." }, 400);
  }
  const dependencies = {
    prepareAuditEvents: (currentDossierId: string, revision: number, inputs: Parameters<typeof prepareDossierAuditEvents>[3]) =>
      prepareDossierAuditEvents(context, currentDossierId, revision, inputs),
  };

  try {
    if (action === "approve") {
      if ("snapshotId" in payload || "snapshot_id" in payload || "format" in payload) {
        return dossierJson({ error: "Approval accepts only the exact output ID and expected revision." }, 400);
      }
      const outputId = parseDossierOpaqueId(payload.outputId ?? payload.output_id, "output ID");
      const result = await approveDossierGovernedOutput({
        context,
        dependencies,
        dossierId: access.dossier.id,
        expectedRevision,
        outputId,
        reviewerParticipantId: access.participant.id,
      });
      return dossierJson(result);
    }

    if ("outputId" in payload || "output_id" in payload) {
      return dossierJson({ error: "Generation accepts only an exact snapshot ID and format." }, 400);
    }
    const snapshotId = parseDossierOpaqueId(payload.snapshotId ?? payload.snapshot_id, "snapshot ID");
    const format = dossierEnum(payload.format, ["pdf", "json_manifest", "markdown"] as const, "output format");
    const bindings = env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket };
    if (!bindings.DOSSIER_DOCUMENTS) {
      return dossierJson({ error: "Private Matter storage is unavailable.", code: "private_storage_unavailable" }, 503);
    }
    const result = await generateDossierGovernedOutput({
      context,
      dependencies,
      bucket: bindings.DOSSIER_DOCUMENTS,
      dossierId: access.dossier.id,
      expectedRevision,
      snapshotId,
      format,
    });
    return dossierJson(result, result.unchanged ? 200 : 201);
  } catch (error) {
    return dossierGovernedErrorResponse(error);
  }
}
