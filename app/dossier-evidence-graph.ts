import { caseFingerprint, normalizeStudioDraft } from "./case-integrity";
import { canonicalDossierJson } from "./dossier-contract";
import { compileStudioDraft } from "./studio-compiler";

export type PublishedGraphTarget = {
  referenceGraphDigest: string;
  packageId: string;
  packageVersion: string;
  packageFingerprint: string;
  studioFingerprint: string | null;
  payload: Record<string, unknown>;
};

/** Pure validation shared by the route-backed D1 resolver and executable
 * tests. No graph entity is trusted until all stored publication identities,
 * the deterministic compilation, and the governed graph digest agree. */
export async function validatedPublishedGraphTarget(
  record: PublishedGraphTarget,
  targetType: "graph_node" | "graph_edge",
  targetId: string,
): Promise<boolean> {
  if (!sha256Pattern(record.studioFingerprint) || !isRecord(record.payload)) return false;
  try {
    const draft = normalizeStudioDraft(record.payload.studioDraft);
    if (
      draft.caseId !== record.packageId
      || draft.version !== record.packageVersion
      || caseFingerprint(draft) !== record.studioFingerprint
    ) return false;

    const compilation = compileStudioDraft(draft, record.studioFingerprint);
    if (
      compilation.issues.length > 0
      || compilation.scenario === null
      || compilation.scenario.caseId !== record.packageId
      || compilation.scenario.version !== record.packageVersion
      || compilation.scenario.sourceFingerprint !== record.studioFingerprint
      || compilation.scenario.fingerprint !== record.packageFingerprint
    ) return false;

    const graphDigest = await publishedGraphDigest({
      packageId: record.packageId,
      packageVersion: record.packageVersion,
      studioFingerprint: record.studioFingerprint,
      nodes: draft.nodes,
      links: draft.links,
    });
    if (graphDigest !== record.referenceGraphDigest) return false;
    return targetType === "graph_node"
      ? draft.nodes.some(({ id }) => id === targetId)
      : draft.links.some(({ id }) => id === targetId);
  } catch {
    return false;
  }
}

export async function publishedGraphDigest(input: {
  packageId: string;
  packageVersion: string;
  studioFingerprint: string;
  nodes: unknown;
  links: unknown;
}) {
  const graphPayload = JSON.parse(JSON.stringify({
    kind: "genesis-juris-deterministic-graph-validation-v1",
    package_id: input.packageId,
    package_version: input.packageVersion,
    studio_fingerprint: input.studioFingerprint,
    nodes: input.nodes,
    links: input.links,
  })) as unknown;
  return sha256(canonicalDossierJson(graphPayload));
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256-${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function sha256Pattern(value: unknown): value is string {
  return typeof value === "string" && /^sha256-[a-f0-9]{64}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
