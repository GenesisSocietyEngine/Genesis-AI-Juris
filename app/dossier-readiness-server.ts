import { and, asc, eq } from "drizzle-orm";
import {
  dossierAIProposals,
  dossierAssertionSources,
  dossierDecisionPackageReferences,
  dossierDeadlineReferences,
  dossierDocumentCurrentVersions,
  dossierDocuments,
  dossierGovernedOutputs,
  dossierInformationRequests,
  dossierOutputApprovals,
  dossierOutputStateEvents,
  dossierProfessionalAssertions,
  dossierSnapshots,
  dossierSourceAnchors,
} from "../db/schema";
import type { DossierReadinessFinding } from "./dossier-readiness";
import { computeDossierReadiness } from "./dossier-readiness";
import type { DossierDb } from "./dossier-server";

export interface DossierReadinessFacts {
  keyDeadlineAt: string | null;
  documents: ReadonlyArray<{ id: string; status: string; currentVersionId: string | null }>;
  informationRequests: ReadonlyArray<{ id: string; status: string; dueAt: string | null }>;
  pendingProposals: ReadonlyArray<{ id: string }>;
  contradictions: ReadonlyArray<{ id: string }>;
  criticalDeadlines: ReadonlyArray<{ id: string; status: string; dueAt: string }>;
  acceptedAssertions: ReadonlyArray<{ id: string; sourceAnchorIds: readonly string[] }>;
  acceptedSourceAnchors: ReadonlyArray<{
    id: string;
    documentVersionId: string;
    currentDocumentVersionId: string | null;
  }>;
  decisionPackages: ReadonlyArray<{
    id: string;
    state: string;
    graphValidationStatus: string;
    simulationRunReferences: readonly string[];
  }>;
  outputs: ReadonlyArray<{
    id: string;
    snapshotRevision: number;
    state: string;
    reviewerApproved: boolean;
  }>;
}

export function dossierReadinessFindingsFromFacts(
  facts: DossierReadinessFacts,
  dossierRevision: number,
  evaluatedAt: string,
): DossierReadinessFinding[] {
  const findings: DossierReadinessFinding[] = [];
  const add = (
    code: DossierReadinessFinding["code"],
    relatedObjectType: DossierReadinessFinding["relatedObjectType"],
    relatedObjectId: string | null,
  ) => findings.push({ code, relatedObjectType, relatedObjectId });

  if (facts.documents.length === 0) {
    add("DOCUMENT_REQUIRED_MISSING", null, null);
  } else {
    for (const document of facts.documents) {
      if (!document.currentVersionId || !["accepted_source", "superseded", "rejected"].includes(document.status)) {
        add("DOCUMENT_REVIEW_REQUIRED", "document", document.id);
      }
    }
  }

  const evaluatedEpoch = Date.parse(evaluatedAt);
  for (const request of facts.informationRequests) {
    if (request.status !== "open") continue;
    add(
      request.dueAt && Date.parse(request.dueAt) < evaluatedEpoch ? "INFORMATION_REQUEST_OVERDUE" : "INFORMATION_REQUEST_OPEN",
      "information_request",
      request.id,
    );
  }
  for (const proposal of facts.pendingProposals) add("AI_PROPOSAL_PENDING", "ai_proposal", proposal.id);
  for (const contradiction of facts.contradictions) add("CONTRADICTION_UNRESOLVED", "professional_assertion", contradiction.id);

  const openCriticalDeadlines = facts.criticalDeadlines.filter(({ status }) => status === "open");
  if (openCriticalDeadlines.length === 0 && facts.keyDeadlineAt === null) {
    add("CRITICAL_DEADLINE_MISSING", null, null);
  }
  for (const deadline of openCriticalDeadlines) {
    if (Date.parse(deadline.dueAt) < evaluatedEpoch) add("CRITICAL_DEADLINE_OVERDUE", "deadline_reference", deadline.id);
  }

  for (const assertion of facts.acceptedAssertions) {
    if (assertion.sourceAnchorIds.length === 0) add("SOURCE_ANCHOR_MISSING", "professional_assertion", assertion.id);
  }
  for (const anchor of facts.acceptedSourceAnchors) {
    if (!anchor.currentDocumentVersionId || anchor.documentVersionId !== anchor.currentDocumentVersionId) {
      add("SOURCE_VERSION_STALE", "source_anchor", anchor.id);
    }
  }

  const currentPackages = facts.decisionPackages.filter(({ state }) => state === "current");
  const validPackage = currentPackages.find(({ graphValidationStatus }) => graphValidationStatus === "valid");
  if (!validPackage) {
    add("DECISION_GRAPH_INVALID", currentPackages[0] ? "decision_package_reference" : null, currentPackages[0]?.id ?? null);
  }
  const simulatedPackage = currentPackages.find(({ simulationRunReferences }) => simulationRunReferences.length > 0);
  if (!simulatedPackage) {
    add("SIMULATION_REQUIRED", currentPackages[0] ? "decision_package_reference" : null, currentPackages[0]?.id ?? null);
  }

  if (facts.outputs.length === 0) {
    add("OUTPUT_REQUIRED", null, null);
    add("REVIEWER_APPROVAL_MISSING", null, null);
  } else {
    const currentOutput = facts.outputs.find((output) => output.state === "current" && output.snapshotRevision === dossierRevision);
    if (!currentOutput) {
      add("OUTPUT_STALE", "governed_output", facts.outputs[0].id);
      add("REVIEWER_APPROVAL_MISSING", "governed_output", facts.outputs[0].id);
    } else if (!currentOutput.reviewerApproved) {
      add("REVIEWER_APPROVAL_MISSING", "governed_output", currentOutput.id);
    }
  }
  return findings;
}

export async function computeStoredDossierReadiness(input: {
  db: DossierDb;
  dossierId: string;
  dossierRevision: number;
  keyDeadlineAt: string | null;
  evaluatedAt: string;
}) {
  const [
    documents,
    requests,
    proposals,
    assertions,
    assertionSources,
    anchors,
    currentVersions,
    deadlines,
    packages,
    outputRows,
    outputStates,
    approvals,
  ] = await Promise.all([
    input.db.select({ id: dossierDocuments.id, status: dossierDocuments.status })
      .from(dossierDocuments).where(eq(dossierDocuments.dossierId, input.dossierId)),
    input.db.select({ id: dossierInformationRequests.id, status: dossierInformationRequests.status, dueAt: dossierInformationRequests.dueAt })
      .from(dossierInformationRequests).where(eq(dossierInformationRequests.dossierId, input.dossierId)),
    input.db.select({ id: dossierAIProposals.id }).from(dossierAIProposals).where(and(
      eq(dossierAIProposals.dossierId, input.dossierId),
      eq(dossierAIProposals.reviewState, "pending"),
    )),
    input.db.select({ id: dossierProfessionalAssertions.id, type: dossierProfessionalAssertions.assertionType, status: dossierProfessionalAssertions.status })
      .from(dossierProfessionalAssertions).where(eq(dossierProfessionalAssertions.dossierId, input.dossierId)),
    input.db.select({ assertionId: dossierAssertionSources.assertionId, sourceAnchorId: dossierAssertionSources.sourceAnchorId })
      .from(dossierAssertionSources).where(eq(dossierAssertionSources.dossierId, input.dossierId)),
    input.db.select({ id: dossierSourceAnchors.id, documentId: dossierSourceAnchors.documentId, documentVersionId: dossierSourceAnchors.documentVersionId, reviewState: dossierSourceAnchors.reviewState })
      .from(dossierSourceAnchors).where(eq(dossierSourceAnchors.dossierId, input.dossierId)),
    input.db.select({ documentId: dossierDocumentCurrentVersions.documentId, documentVersionId: dossierDocumentCurrentVersions.documentVersionId })
      .from(dossierDocumentCurrentVersions).where(eq(dossierDocumentCurrentVersions.dossierId, input.dossierId)),
    input.db.select({ id: dossierDeadlineReferences.id, status: dossierDeadlineReferences.status, dueAt: dossierDeadlineReferences.dueAt, critical: dossierDeadlineReferences.critical })
      .from(dossierDeadlineReferences).where(eq(dossierDeadlineReferences.dossierId, input.dossierId)),
    input.db.select({ id: dossierDecisionPackageReferences.id, state: dossierDecisionPackageReferences.state, graphValidationStatus: dossierDecisionPackageReferences.graphValidationStatus, simulationRunReferences: dossierDecisionPackageReferences.simulationRunReferences })
      .from(dossierDecisionPackageReferences).where(eq(dossierDecisionPackageReferences.dossierId, input.dossierId)),
    input.db.select({ id: dossierGovernedOutputs.id, snapshotRevision: dossierSnapshots.dossierRevision })
      .from(dossierGovernedOutputs).innerJoin(dossierSnapshots, and(
        eq(dossierSnapshots.dossierId, dossierGovernedOutputs.dossierId),
        eq(dossierSnapshots.id, dossierGovernedOutputs.snapshotId),
      )).where(eq(dossierGovernedOutputs.dossierId, input.dossierId)),
    input.db.select({ outputId: dossierOutputStateEvents.outputId, sequence: dossierOutputStateEvents.sequence, state: dossierOutputStateEvents.state })
      .from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, input.dossierId))
      .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence)),
    input.db.select({ outputId: dossierOutputApprovals.outputId }).from(dossierOutputApprovals)
      .where(eq(dossierOutputApprovals.dossierId, input.dossierId)),
  ]);

  const currentVersionByDocument = new Map(currentVersions.map((item) => [item.documentId, item.documentVersionId]));
  const sourcesByAssertion = new Map<string, string[]>();
  for (const source of assertionSources) {
    sourcesByAssertion.set(source.assertionId, [...(sourcesByAssertion.get(source.assertionId) ?? []), source.sourceAnchorId]);
  }
  const acceptedAssertionIds = new Set(assertions.filter(({ status }) => status === "accepted").map(({ id }) => id));
  const acceptedAnchorIds = new Set(assertionSources.filter(({ assertionId }) => acceptedAssertionIds.has(assertionId)).map(({ sourceAnchorId }) => sourceAnchorId));
  const latestOutputState = new Map<string, string>();
  for (const state of outputStates) latestOutputState.set(state.outputId, state.state);
  const approvedOutputs = new Set(approvals.map(({ outputId }) => outputId));

  const facts: DossierReadinessFacts = {
    keyDeadlineAt: input.keyDeadlineAt,
    documents: documents.map((document) => ({ ...document, currentVersionId: currentVersionByDocument.get(document.id) ?? null })),
    informationRequests: requests,
    pendingProposals: proposals,
    contradictions: assertions.filter(({ type, status }) => type === "contradiction" && (status === "accepted" || status === "needs_review")),
    criticalDeadlines: deadlines.filter(({ critical }) => critical).map(({ id, status, dueAt }) => ({ id, status, dueAt })),
    acceptedAssertions: assertions.filter(({ status }) => status === "accepted").map(({ id }) => ({ id, sourceAnchorIds: sourcesByAssertion.get(id) ?? [] })),
    acceptedSourceAnchors: anchors.filter(({ id, reviewState }) => acceptedAnchorIds.has(id) && reviewState === "accepted").map((anchor) => ({
      id: anchor.id,
      documentVersionId: anchor.documentVersionId,
      currentDocumentVersionId: currentVersionByDocument.get(anchor.documentId) ?? null,
    })),
    decisionPackages: packages,
    outputs: outputRows.map((output) => ({
      ...output,
      state: latestOutputState.get(output.id) ?? "stale",
      reviewerApproved: approvedOutputs.has(output.id),
    })),
  };
  return computeDossierReadiness({
    dossierId: input.dossierId,
    revision: input.dossierRevision,
    evaluatedAt: input.evaluatedAt,
    findings: dossierReadinessFindingsFromFacts(facts, input.dossierRevision, input.evaluatedAt),
  });
}
