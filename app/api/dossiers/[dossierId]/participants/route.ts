import {
  DOSSIER_ENROLLABLE_ROLES,
  enrollDossierParticipant,
} from "../../../../dossier-participant-enrollment";
import {
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
  expectedDossierRevision,
  isResponse,
  newDossierOpaqueId,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../dossier-server";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const MAX_REQUEST_BYTES = 4_096;
const PARTICIPANT_FIELDS = new Set([
  "actorId",
  "actor_id",
  "role",
  "expectedRevision",
  "expected_revision",
]);

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site participant enrollment rejected." }, 403);
  }
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "participants");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!payload || Object.keys(payload).some((key) => !PARTICIPANT_FIELDS.has(key))) {
    return invalidEnrollment();
  }
  if (
    ("actorId" in payload && "actor_id" in payload)
    || ("expectedRevision" in payload && "expected_revision" in payload)
  ) {
    return invalidEnrollment();
  }

  let actorId: string;
  let role: (typeof DOSSIER_ENROLLABLE_ROLES)[number];
  let expectedRevision: number;
  try {
    actorId = parseDossierOpaqueId(payload.actorId ?? payload.actor_id, "participant Actor ID");
    role = dossierEnum(payload.role, DOSSIER_ENROLLABLE_ROLES, "participant role");
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
  } catch {
    return invalidEnrollment();
  }
  if (expectedRevision !== access.dossier.revision) {
    return dossierJson({
      error: "The Matter changed before participant enrollment could be recorded.",
      code: "revision_conflict",
      currentRevision: access.dossier.revision,
    }, 409);
  }

  const result = await enrollDossierParticipant({
    context,
    dossierId: access.dossier.id,
    targetActorId: actorId,
    role,
    expectedRevision,
    dependencies: {
      now: canonicalDossierTimestamp,
      newId: newDossierOpaqueId,
      prepareRevisionAuditBatch: prepareDossierRevisionAuditBatch,
    },
  });
  if (!result.ok) {
    if (result.code === "revision_conflict") {
      return dossierJson({
        error: "The Matter changed before participant enrollment could be recorded.",
        code: "revision_conflict",
        ...(result.currentRevision === undefined ? {} : { currentRevision: result.currentRevision }),
      }, 409);
    }
    return dossierJson({
      error: "Participant enrollment could not be completed.",
      code: "participant_enrollment_unavailable",
    }, 409);
  }

  return dossierJson({
    participant: result.participant,
    dossier: { dossier_id: access.dossier.id, revision: result.dossier_revision },
    audit_event_id: result.audit_event_id,
    stale_consequences: { output_ids: result.stale_output_ids },
  }, 201);
}

function invalidEnrollment() {
  return dossierJson({
    error: "A valid participant enrollment is required.",
    code: "invalid_participant_enrollment",
  }, 400);
}
