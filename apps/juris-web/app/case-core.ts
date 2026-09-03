import { caseTypeDefinition, caseTypeReference } from "./case-type-registry";
import type { CaseCoreV2, StudioDraft } from "./types";

/**
 * Projects the current authoring draft into the domain-neutral Case Core.
 * This is data-only: no arbitrary callbacks, downloaded code or AI mutation.
 */
export function projectCaseCoreV2(draft: StudioDraft): CaseCoreV2 {
  const definition = caseTypeDefinition(draft.caseType);
  const reference = draft.caseType ?? caseTypeReference(definition.id);
  return {
    schemaVersion: 2,
    caseType: reference,
    identity: { caseId: draft.caseId, version: draft.version, parent: draft.parent },
    matter: { title: draft.title, summary: draft.premise, professionalRole: draft.role },
    jurisdiction: {
      label: draft.jurisdiction,
      ...(draft.classification?.legalAsOf ? { legalAsOf: draft.classification.legalAsOf } : {}),
    },
    participants: draft.nodes
      .filter((node) => node.type === "actor" || node.type === "entity")
      .map((node) => ({ id: node.id, type: node.type as "actor" | "entity", title: node.title, detail: node.detail })),
    facts: draft.nodes
      .filter((node) => node.type === "fact")
      .map((node) => ({ id: node.id, statement: node.detail || node.title, status: "asserted" as const })),
    evidence: draft.nodes
      .filter((node) => node.type === "evidence")
      .map((node) => ({ id: node.id, title: node.title, detail: node.detail })),
    issues: draft.nodes
      .filter((node) => node.type === "decision" || node.type === "tax_rule")
      .map((node) => ({ id: node.id, title: node.title, detail: node.detail })),
    deadlines: draft.nodes
      .filter((node) => node.type === "deadline")
      .map((node) => ({ id: node.id, title: node.title, detail: node.detail, day: node.runtime?.deadlineDay, time: node.runtime?.deadlineTime })),
    outcomes: draft.nodes
      .filter((node) => node.type === "outcome")
      .map((node) => ({ id: node.id, title: node.title, detail: node.detail, classification: node.runtime?.terminalOutcome })),
    provenance: { updatedAt: draft.updatedAt, editCount: draft.editHistory.length },
  };
}
