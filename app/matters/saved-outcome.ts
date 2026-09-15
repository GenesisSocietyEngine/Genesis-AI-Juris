export type SavedOutcome = {
  caseId: string; recordId: string; kind: "deadline" | "citation";
  reason: string; outcome: string; supportingSourceId: string | null;
  actorId: string | null; actorRole: string | null; occurredAt: string | null;
  auditEventId: string; revision: number;
};
export type RefreshResult = { status: "updated"; revision: number } | { status: "failed" | "superseded" };
export type SavedOutcomeState = { receipt: SavedOutcome; phase: "updating" | "updated" | "update_failed" };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
const optionalText = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;

/** A successful HTTP response is not enough: bind every disposition field to the submitted proposal. */
export function savedOutcomeReceipt(payload: unknown, expected: {
  caseId: string; recordId: string; kind: "deadline" | "citation";
  reason: string; revision: number; status: string; support: string;
}): SavedOutcome | null {
  const response = object(payload), row = object(response?.disposition), dossier = object(response?.dossier);
  if (!row || !dossier || !optionalText(response?.audit_event_id)
    || row.auditEventId !== response?.audit_event_id || row.dossierId !== expected.caseId
    || dossier.dossier_id !== expected.caseId || row.reason !== expected.reason.trim()
    || row.revisionBefore !== expected.revision || row.revisionAfter !== expected.revision + 1
    || dossier.revision !== row.revisionAfter) return null;
  const deadline = expected.kind === "deadline";
  if ((deadline ? row.deadlineReferenceId : row.sourceAnchorId) !== expected.recordId
    || (deadline && row.newStatus !== expected.status)
    || (deadline ? row.supportingSourceAnchorId : row.replacementSourceAnchorId) !== (expected.support || null)) return null;
  return {
    caseId: expected.caseId, recordId: expected.recordId, kind: expected.kind,
    reason: String(row.reason), outcome: deadline ? expected.status : "retired",
    supportingSourceId: expected.support || null, actorId: optionalText(row.actorRef),
    actorRole: optionalText(row.actorRole), occurredAt: optionalText(row.occurredAt),
    auditEventId: String(row.auditEventId), revision: Number(row.revisionAfter),
  };
}

/** Refresh never repeats the write. A retained receipt stays saved even if reading fails. */
export async function refreshSavedOutcome(receipt: SavedOutcome, read: () => Promise<RefreshResult>,
  isCurrent: () => boolean, publish: (state: SavedOutcomeState) => void) {
  if (!isCurrent()) return;
  publish({ receipt, phase: "updating" });
  let result: RefreshResult;
  try { result = await read(); } catch { result = { status: "failed" }; }
  if (!isCurrent() || result.status === "superseded") return;
  publish({ receipt, phase: result.status === "updated" && result.revision >= receipt.revision ? "updated" : "update_failed" });
}

export function savedOutcomeMessage(state: SavedOutcomeState) {
  return state.phase === "updating" ? "Outcome saved. Updating case actions…"
    : state.phase === "updated" ? "Outcome saved. Case actions updated. Review the remaining work below."
      : "Outcome saved. Case actions could not be updated. Previous queue information may be outdated; retry the update before continuing.";
}
