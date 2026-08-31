import rawProfiles from "./report-profiles.v1.json";
import { canonicalFingerprint, caseFingerprint } from "./case-integrity";
import { caseTypePlaybook, evaluateCaseTypeDraft } from "./case-type-playbooks";
import { caseTypeReference, DEFAULT_CASE_TYPE } from "./case-type-reference";
import type { CaseTypeId, StudioDraft, StudioNodeType } from "./types";

export const REPORT_MODEL_SCHEMA_VERSION = 1 as const;
export const REPORT_RENDERER_VERSION = "1.0.0" as const;

export type ReportSectionId =
  | "executive_summary" | "issues" | "facts_evidence" | "authorities" | "options" | "recommendation"
  | "sources" | "approval" | "chronology" | "custody" | "risk_scenarios" | "obligations" | "deadlines"
  | "economics" | "tax_position" | "controls" | "gaps" | "remediation" | "root_cause" | "process_design"
  | "test_plan" | "expected_results" | "actors" | "findings" | "redactions" | "scenario_map" | "routes"
  | "learning_objectives" | "facilitation" | "debrief";

export type ReportProfile = {
  id: string;
  kind: string;
  caseTypes: CaseTypeId[];
  sections: ReportSectionId[];
};

type ReportRegistry = {
  format: string;
  schemaVersion: number;
  registry: string;
  rendererVersion: string;
  profiles: ReportProfile[];
};

const allowedSections = new Set<ReportSectionId>([
  "executive_summary", "issues", "facts_evidence", "authorities", "options", "recommendation", "sources", "approval",
  "chronology", "custody", "risk_scenarios", "obligations", "deadlines", "economics", "tax_position", "controls",
  "gaps", "remediation", "root_cause", "process_design", "test_plan", "expected_results", "actors", "findings",
  "redactions", "scenario_map", "routes", "learning_objectives", "facilitation", "debrief",
]);

function validatedProfiles(value: unknown): ReportRegistry {
  const registry = value as ReportRegistry;
  if (!registry || registry.format !== "genesis-juris-report-profile-registry" || registry.schemaVersion !== 1 || registry.registry !== "genesis-juris-report-profiles" || registry.rendererVersion !== REPORT_RENDERER_VERSION || !Array.isArray(registry.profiles)) throw new Error("Unsupported report-profile registry");
  const ids = new Set<string>();
  for (const profile of registry.profiles) {
    if (!/^[a-z0-9_]+$/.test(profile.id) || ids.has(profile.id) || !profile.caseTypes.length || !profile.sections.length || profile.sections.some((section) => !allowedSections.has(section))) throw new Error(`Invalid report profile ${profile.id}`);
    ids.add(profile.id);
  }
  const bindings = new Set(registry.profiles.flatMap((profile) => profile.caseTypes.map((caseType) => `${caseType}:${profile.id}`)));
  for (const playbook of caseTypePlaybookRegistry()) for (const output of playbook.outputs) if (!bindings.has(`${playbook.caseType.id}:${output.id}`)) throw new Error(`Missing report profile for ${playbook.caseType.id}:${output.id}`);
  return registry;
}

function caseTypePlaybookRegistry() {
  const seen = new Set<CaseTypeId>();
  const result = [];
  for (const profile of (rawProfiles as ReportRegistry).profiles) for (const id of profile.caseTypes) if (!seen.has(id)) {
    seen.add(id);
    result.push(caseTypePlaybook(caseTypeReference(id)));
  }
  return result;
}

export const REPORT_PROFILE_REGISTRY = validatedProfiles(rawProfiles);

export function reportProfile(profileId: string, caseType: CaseTypeId): ReportProfile {
  const profile = REPORT_PROFILE_REGISTRY.profiles.find((candidate) => candidate.id === profileId && candidate.caseTypes.includes(caseType));
  if (!profile) throw new Error("Unsupported report profile for this case type");
  return profile;
}

export type ReportReadinessInput = {
  profileId: string;
  status: "draft" | "final";
  audience: "internal" | "client";
  preparedBy: string;
  preparedFor: string;
  reviewerName: string;
  reviewerApproved: boolean;
  currentFingerprint: string;
  workspaceFingerprint: string | null;
  redactedNodeIds?: string[];
};

export type ReportReadiness = { ready: boolean; blockers: string[]; warnings: string[] };

export function validateReportReadiness(draft: StudioDraft, input: ReportReadinessInput): ReportReadiness {
  const caseType = draft.caseType?.id ?? DEFAULT_CASE_TYPE.id;
  reportProfile(input.profileId, caseType);
  const packageWarnings = evaluateCaseTypeDraft(draft, "en").filter((check) => check.level === "warn").map((check) => check.text);
  const finalExternal = input.status === "final" || input.audience === "client";
  const blockers: string[] = [];
  if (!draft.title.trim() || !draft.nodes.length) blockers.push("The case needs a title and structured content.");
  if (finalExternal && input.currentFingerprint !== input.workspaceFingerprint) blockers.push("Save this exact case version to the workspace.");
  if (finalExternal && !input.preparedBy.trim()) blockers.push("Name the report preparer.");
  if (finalExternal && !input.preparedFor.trim()) blockers.push("Name the intended recipient.");
  if (finalExternal && !input.reviewerName.trim()) blockers.push("Name the approving reviewer.");
  if (finalExternal && !input.reviewerApproved) blockers.push("Reviewer approval is required for an external or final report.");
  if (finalExternal) blockers.push(...packageWarnings);
  const warnings = finalExternal ? [] : packageWarnings;
  return { ready: blockers.length === 0, blockers: [...new Set(blockers)], warnings };
}

const nodeGroups: Record<ReportSectionId, StudioNodeType[]> = {
  executive_summary: [], issues: ["decision"], facts_evidence: ["fact", "evidence"], authorities: ["tax_rule"], options: ["decision", "outcome"], recommendation: ["outcome"],
  sources: [], approval: [], chronology: ["trigger", "deadline", "fact", "evidence"], custody: ["evidence"], risk_scenarios: ["decision", "outcome"], obligations: ["decision", "deadline"], deadlines: ["deadline"],
  economics: ["cash_flow", "entity"], tax_position: ["tax_rule", "decision", "outcome"], controls: ["decision", "evidence"], gaps: ["fact", "evidence"], remediation: ["decision", "outcome", "deadline"],
  root_cause: ["trigger", "fact", "evidence"], process_design: ["trigger", "actor", "decision", "outcome"], test_plan: ["decision", "outcome"], expected_results: ["outcome"], actors: ["actor", "entity"], findings: ["fact", "evidence", "outcome"],
  redactions: ["evidence", "fact"], scenario_map: ["trigger", "decision", "outcome"], routes: ["decision", "outcome"], learning_objectives: ["outcome"], facilitation: ["actor", "decision"], debrief: ["decision", "outcome"],
};

export type CanonicalReportModel = {
  schemaVersion: typeof REPORT_MODEL_SCHEMA_VERSION;
  rendererVersion: typeof REPORT_RENDERER_VERSION;
  case: { id: string; version: string; type: ReturnType<typeof caseTypeReference>; fingerprint: string; title: string; jurisdiction: string; legalAsOf?: string };
  profile: { id: string; kind: string; sections: ReportSectionId[] };
  publication: { status: "draft" | "final"; audience: "internal" | "client"; preparedBy: string; preparedFor: string; reviewerName: string; reviewerApproved: boolean };
  governance: {
    version: "1.0.0";
    evidencePack: { version: "1.0.0"; documents: Array<{ id: string; version: string; title: string; detail: string; provenance: "studio" }> };
    citations: Array<{ id: string; url: string; effectiveDate?: string }>;
    custody: Array<{ id: string; action: string; at: string; actor: string }>;
    decisionTable: Array<{ id: string; from: string; to: string; controlledRule: unknown }>;
    redactions: string[];
    permissions: { confidential: boolean; external: boolean };
  };
  sections: Array<{ id: ReportSectionId; items: Array<{ id: string; title: string; detail: string }> }>;
  readiness: ReportReadiness;
  contentFingerprint: string;
};

export function buildCanonicalReportModel(draft: StudioDraft, input: ReportReadinessInput & { confidential: boolean }): CanonicalReportModel {
  const caseType = draft.caseType?.id ?? DEFAULT_CASE_TYPE.id;
  const typeReference = draft.caseType ?? caseTypeReference(caseType);
  const profile = reportProfile(input.profileId, caseType);
  const redactions = new Set(input.redactedNodeIds ?? []);
  const readiness = validateReportReadiness(draft, input);
  const base = {
    schemaVersion: REPORT_MODEL_SCHEMA_VERSION,
    rendererVersion: REPORT_RENDERER_VERSION,
    case: { id: draft.caseId, version: draft.version, type: typeReference, fingerprint: caseFingerprint(draft), title: draft.title, jurisdiction: draft.jurisdiction, legalAsOf: draft.classification?.legalAsOf },
    profile: { id: profile.id, kind: profile.kind, sections: [...profile.sections] },
    publication: { status: input.status, audience: input.audience, preparedBy: input.preparedBy.trim(), preparedFor: input.preparedFor.trim(), reviewerName: input.reviewerName.trim(), reviewerApproved: input.reviewerApproved },
    governance: {
      version: "1.0.0" as const,
      evidencePack: { version: "1.0.0" as const, documents: draft.nodes.filter((node) => node.type === "evidence" && !redactions.has(node.id)).map((node) => ({ id: node.id, version: draft.version, title: node.title, detail: node.detail, provenance: "studio" as const })) },
      citations: (draft.classification?.sourceUrls ?? []).map((url, index) => ({ id: `source-${index + 1}`, url, effectiveDate: draft.classification?.legalAsOf })),
      custody: draft.editHistory.filter((entry) => !["prompt_submitted", "prompt_applied", "graph_rebuilt"].includes(entry.action)).map((entry) => ({ id: entry.id, action: entry.action, at: entry.createdAt, actor: entry.role })),
      decisionTable: draft.links.map((link) => ({ id: link.id, from: link.from, to: link.to, controlledRule: link.rule ?? null })),
      redactions: [...redactions].sort(),
      permissions: { confidential: input.confidential, external: input.audience === "client" },
    },
    sections: profile.sections.map((id) => ({ id, items: draft.nodes.filter((node) => nodeGroups[id].includes(node.type) && !redactions.has(node.id)).map((node) => ({ id: node.id, title: node.title, detail: node.detail })) })),
    readiness,
  };
  return { ...base, contentFingerprint: canonicalFingerprint(base) };
}

export type ReportReceipt = { caseId: string; caseVersion: string; profileId: string; rendererVersion: string; caseFingerprint: string; reportFingerprint: string; generatedAt: string; status: "draft" | "final"; audience: "internal" | "client" };

export function reportReceipt(model: CanonicalReportModel, generatedAt: string): ReportReceipt {
  return { caseId: model.case.id, caseVersion: model.case.version, profileId: model.profile.id, rendererVersion: model.rendererVersion, caseFingerprint: model.case.fingerprint, reportFingerprint: model.contentFingerprint, generatedAt, status: model.publication.status, audience: model.publication.audience };
}

export function isReportReceiptStale(receipt: ReportReceipt, draft: StudioDraft, profileId: string) {
  return receipt.profileId !== profileId || receipt.caseFingerprint !== caseFingerprint(draft) || receipt.rendererVersion !== REPORT_RENDERER_VERSION;
}

export function reportReceiptStorageKey(caseId: string, profileId: string) {
  return `genesis-juris-report-receipt:v1:${caseId}:${profileId}`;
}

export function parseReportReceipt(value: string | null): ReportReceipt | null {
  if (!value) return null;
  try {
    const receipt = JSON.parse(value) as ReportReceipt;
    if (!receipt || typeof receipt.caseId !== "string" || typeof receipt.profileId !== "string" || !/^sha256-[a-f0-9]{64}$/.test(receipt.caseFingerprint) || !/^sha256-[a-f0-9]{64}$/.test(receipt.reportFingerprint) || receipt.rendererVersion !== REPORT_RENDERER_VERSION) return null;
    return receipt;
  } catch { return null; }
}
