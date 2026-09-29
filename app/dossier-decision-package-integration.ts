import { caseFingerprint, normalizeStudioDraft } from "./case-integrity";
import { canonicalDossierJson } from "./dossier-contract";
import { compileStudioDraft } from "./studio-compiler";
import type { StudioDraft } from "./types";

const SHA256_PATTERN = /^sha256-[a-f0-9]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const MAX_DECISION_PACKAGE_SIMULATION_RECEIPTS = 20;

export type PublishedDecisionPackageRecord = {
  packageId: string;
  packageVersion: string;
  packageFingerprint: string;
  studioFingerprint: string | null;
  parentPackageId: string | null;
  parentPackageVersion: string | null;
  parentPackageFingerprint: string | null;
  payload: Record<string, unknown>;
};

export type ValidatedPublishedDecisionPackage = {
  draft: StudioDraft;
  graphDigest: string;
  validationReference: string;
};

export async function validatePublishedDecisionPackage(
  published: PublishedDecisionPackageRecord,
): Promise<
  | { ok: true; value: ValidatedPublishedDecisionPackage }
  | { ok: false; code: string; issueCodes: string[] }
> {
  if (!SHA256_PATTERN.test(published.studioFingerprint ?? "") || !validParentTuple(published)) {
    return { ok: false, code: "package_integrity_invalid", issueCodes: ["stored_identity_invalid"] };
  }
  if (!isRecord(published.payload) || !("studioDraft" in published.payload)) {
    return { ok: false, code: "package_integrity_invalid", issueCodes: ["studio_draft_missing"] };
  }
  let draft: StudioDraft;
  try {
    draft = normalizeStudioDraft(published.payload.studioDraft);
  } catch {
    return { ok: false, code: "package_integrity_invalid", issueCodes: ["studio_draft_invalid"] };
  }
  if (
    draft.caseId !== published.packageId
    || draft.version !== published.packageVersion
    || caseFingerprint(draft) !== published.studioFingerprint
    || !draftParentMatchesPublishedLineage(draft, published)
  ) {
    return { ok: false, code: "package_integrity_invalid", issueCodes: ["studio_fingerprint_or_lineage_mismatch"] };
  }
  let compilation: ReturnType<typeof compileStudioDraft>;
  try {
    compilation = compileStudioDraft(draft, published.studioFingerprint);
  } catch {
    return { ok: false, code: "package_graph_invalid", issueCodes: ["compiler_rejected"] };
  }
  if (compilation.issues.length > 0 || compilation.scenario === null) {
    return {
      ok: false,
      code: "package_graph_invalid",
      issueCodes: compilation.issues.map(({ code }) => code).slice(0, 50),
    };
  }
  if (
    compilation.scenario.caseId !== published.packageId
    || compilation.scenario.version !== published.packageVersion
    || compilation.scenario.sourceFingerprint !== published.studioFingerprint
    || compilation.scenario.fingerprint !== published.packageFingerprint
  ) {
    return { ok: false, code: "package_integrity_invalid", issueCodes: ["playable_fingerprint_mismatch"] };
  }
  const graphPayload = JSON.parse(JSON.stringify({
    kind: "genesis-juris-deterministic-graph-validation-v1",
    package_id: published.packageId,
    package_version: published.packageVersion,
    studio_fingerprint: published.studioFingerprint,
    nodes: draft.nodes,
    links: draft.links,
  })) as unknown;
  const graphDigest = await integrationSha256(canonicalDossierJson(graphPayload));
  return {
    ok: true,
    value: {
      draft,
      graphDigest,
      validationReference: `graph_validation_v1_${graphDigest.slice("sha256-".length)}`,
    },
  };
}

export type DecisionPackageGraphBinding = {
  decision_package_reference_id: string;
  package_id: string;
  package_version: string;
  package_fingerprint: string;
  graph_digest: string;
};

export type DecisionPackageGraphTarget = Omit<DecisionPackageGraphBinding, "decision_package_reference_id"> & {
  parent_package_id: string | null;
  parent_package_version: string | null;
  parent_package_fingerprint: string | null;
};

export type DecisionPackageGraphProposalDiffV1 = {
  kind: "genesis-juris-decision-package-graph-diff-v1";
  schema_version: 1;
  base: DecisionPackageGraphBinding | null;
  target: DecisionPackageGraphTarget;
  changes: {
    node_ids: { added: string[]; removed: string[]; changed: string[] };
    edge_ids: { added: string[]; removed: string[]; changed: string[] };
  };
};

export function buildDecisionPackageGraphProposalDiff(input: {
  base: { binding: DecisionPackageGraphBinding; draft: StudioDraft } | null;
  target: { binding: DecisionPackageGraphTarget; draft: StudioDraft };
}): DecisionPackageGraphProposalDiffV1 {
  const nodeChanges = changedGraphEntities(
    input.base?.draft.nodes ?? [],
    input.target.draft.nodes,
  );
  const edgeChanges = changedGraphEntities(
    input.base?.draft.links ?? [],
    input.target.draft.links,
  );
  return {
    kind: "genesis-juris-decision-package-graph-diff-v1",
    schema_version: 1,
    base: input.base?.binding ?? null,
    target: input.target.binding,
    changes: {
      node_ids: nodeChanges,
      edge_ids: edgeChanges,
    },
  };
}

export async function verifyDecisionPackageGraphProposalDiff(
  proposedValue: unknown,
  expected: DecisionPackageGraphProposalDiffV1,
) {
  try {
    const proposedCanonical = canonicalDossierJson(proposedValue);
    const expectedCanonical = canonicalDossierJson(expected);
    if (proposedCanonical !== expectedCanonical) return { ok: false as const };
    return {
      ok: true as const,
      digest: await integrationSha256(expectedCanonical),
    };
  } catch {
    return { ok: false as const };
  }
}

export function parseSimulationReceiptReferences(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_DECISION_PACKAGE_SIMULATION_RECEIPTS) {
    throw new Error("Simulation receipt references are invalid.");
  }
  const references = value.map((item) => {
    if (typeof item !== "string" || !UUID_PATTERN.test(item)) {
      throw new Error("Simulation receipt references are invalid.");
    }
    return item;
  });
  if (new Set(references).size !== references.length) {
    throw new Error("Simulation receipt references must be unique.");
  }
  return references.sort();
}

export type V61SimulationReceiptRecord = {
  sessionKey: string;
  userEmail: string;
  caseId: string;
  caseVersion: string;
  caseFingerprint: string;
  state: unknown;
  status: string;
  revision: number;
  startedAt: string;
  completedAt: string | null;
  eventCount: number;
  minimumEventSequence: number | null;
  maximumEventSequence: number | null;
  startEventCount: number;
};

export async function proveV61SimulationReceipt(
  record: V61SimulationReceiptRecord,
  expected: {
    userEmail: string;
    packageId: string;
    packageVersion: string;
    packageFingerprint: string;
  },
): Promise<
  | {
      ok: true;
      reference: string;
      runtimeStateDigest: string;
      parameterBindingDigest: string;
      receiptDigest: string;
    }
  | { ok: false }
> {
  if (
    !UUID_PATTERN.test(record.sessionKey)
    || record.userEmail !== expected.userEmail
    || record.caseId !== expected.packageId
    || record.caseVersion !== expected.packageVersion
    || record.caseFingerprint !== expected.packageFingerprint
    || record.status !== "completed"
    || !Number.isSafeInteger(record.revision)
    || record.revision < 1
    || record.revision > 1_000
    || record.eventCount !== record.revision + 1
    || record.minimumEventSequence !== 0
    || record.maximumEventSequence !== record.revision
    || record.startEventCount !== 1
    || !canonicalTimestamp(record.startedAt)
    || !canonicalTimestamp(record.completedAt)
    || Date.parse(record.completedAt) < Date.parse(record.startedAt)
    || !isRecord(record.state)
    || (record.state.outcome !== "strong" && record.state.outcome !== "mixed" && record.state.outcome !== "weak")
  ) {
    return { ok: false };
  }
  try {
    const stateCanonical = canonicalDossierJson(record.state);
    const runtimeStateDigest = await integrationSha256(stateCanonical);
    const parameterBindingDigest = await integrationSha256(canonicalDossierJson({
      kind: "genesis-juris-v61-simulation-parameter-binding-v1",
      package_id: record.caseId,
      package_version: record.caseVersion,
      package_fingerprint: record.caseFingerprint,
      session_key: record.sessionKey,
      session_revision: record.revision,
      runtime_state_digest: runtimeStateDigest,
    }));
    const receiptDigest = await integrationSha256(canonicalDossierJson({
      kind: "genesis-juris-v61-persisted-simulation-receipt-v1",
      session_key: record.sessionKey,
      session_revision: record.revision,
      started_at: record.startedAt,
      completed_at: record.completedAt,
      event_count: record.eventCount,
      runtime_state_digest: runtimeStateDigest,
      parameter_binding_digest: parameterBindingDigest,
    }));
    return {
      ok: true,
      reference: record.sessionKey,
      runtimeStateDigest,
      parameterBindingDigest,
      receiptDigest,
    };
  } catch {
    return { ok: false };
  }
}

function changedGraphEntities<T extends { id: string }>(base: T[], target: T[]) {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const targetById = new Map(target.map((item) => [item.id, item]));
  return {
    added: [...targetById.keys()].filter((id) => !baseById.has(id)).sort(),
    removed: [...baseById.keys()].filter((id) => !targetById.has(id)).sort(),
    changed: [...targetById.keys()].filter((id) => {
      const prior = baseById.get(id);
      const next = targetById.get(id);
      return prior !== undefined
        && next !== undefined
        && canonicalGraphEntity(prior) !== canonicalGraphEntity(next);
    }).sort(),
  };
}

function canonicalGraphEntity(value: unknown) {
  return canonicalDossierJson(JSON.parse(JSON.stringify(value)) as unknown);
}

function draftParentMatchesPublishedLineage(
  draft: StudioDraft,
  published: Pick<
    PublishedDecisionPackageRecord,
    "parentPackageId" | "parentPackageVersion" | "parentPackageFingerprint"
  >,
) {
  if (draft.parent === null) {
    return published.parentPackageId === null
      && published.parentPackageVersion === null
      && published.parentPackageFingerprint === null;
  }
  return draft.parent.caseId === published.parentPackageId
    && draft.parent.version === published.parentPackageVersion
    && draft.parent.fingerprint === published.parentPackageFingerprint;
}

function validParentTuple(value: Pick<
  PublishedDecisionPackageRecord,
  "parentPackageId" | "parentPackageVersion" | "parentPackageFingerprint"
>) {
  if (value.parentPackageId === null) {
    return value.parentPackageVersion === null && value.parentPackageFingerprint === null;
  }
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(value.parentPackageId)
    && typeof value.parentPackageVersion === "string"
    && /^\d+\.\d+\.\d+$/u.test(value.parentPackageVersion)
    && SHA256_PATTERN.test(value.parentPackageFingerprint ?? "");
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}

async function integrationSha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256-${[...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
