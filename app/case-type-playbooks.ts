import rawRegistry from "./case-type-playbooks.v1.json";
import { CASE_TYPE_REGISTRY } from "./case-type-registry";
import type { CaseTypeId, CaseTypeReference, StudioDraft, StudioNodeType } from "./types";

export type LocalizedPlaybookText = { en: string; ru: string };
export type CaseOutputProfile = { id: string; label: LocalizedPlaybookText; description: LocalizedPlaybookText; primary: boolean };
export type CaseTypePlaybook = {
  caseType: CaseTypeReference;
  label: LocalizedPlaybookText;
  summary: LocalizedPlaybookText;
  primaryOutcome: LocalizedPlaybookText;
  aiFocus: LocalizedPlaybookText;
  intakeQuestions: Array<{ id: string; label: LocalizedPlaybookText; hint: LocalizedPlaybookText }>;
  requiredNodeGroups: Array<{ id: string; label: LocalizedPlaybookText; types: StudioNodeType[]; minimum: number }>;
  test: { mode: "review" | "compare" | "process" | "play"; label: LocalizedPlaybookText; requiresPlayableRoute: boolean };
  requirements: { legalAsOf: boolean; httpsSources: boolean; complianceGate: boolean };
  canonicalRequirements: {
    minimumFacts: number;
    minimumStages: number;
    minimumActions: number;
    minimumTerminalStages: number;
    minimumActors: number;
    requireLegalAsOfFact: boolean;
    requireHttpsSourceFact: boolean;
    requireComplianceFact: boolean;
  };
  outputs: CaseOutputProfile[];
};

type Registry = { format: string; schemaVersion: number; registry: string; playbooks: CaseTypePlaybook[] };

function validatedRegistry(value: unknown): Registry {
  if (!value || typeof value !== "object") throw new Error("Case playbook registry is missing");
  const registry = value as Registry;
  if (registry.format !== "genesis-juris-case-playbook-registry" || registry.schemaVersion !== 1 || registry.registry !== "genesis-juris-case-playbooks" || !Array.isArray(registry.playbooks)) throw new Error("Unsupported case playbook registry");
  const expected = new Set(CASE_TYPE_REGISTRY.map((definition) => `${definition.id}@${definition.version}`));
  const actual = new Set(registry.playbooks.map((playbook) => `${playbook.caseType.id}@${playbook.caseType.version}`));
  if (actual.size !== expected.size || [...expected].some((id) => !actual.has(id))) throw new Error("Case playbook registry does not match the immutable case-type registry");
  for (const playbook of registry.playbooks) {
    if (!playbook.intakeQuestions.length || !playbook.requiredNodeGroups.length || !playbook.outputs.some((output) => output.primary)) throw new Error(`Incomplete case playbook ${playbook.caseType.id}`);
    for (const group of playbook.requiredNodeGroups) if (!group.types.length || !Number.isSafeInteger(group.minimum) || group.minimum < 1) throw new Error(`Invalid requirement ${group.id}`);
  }
  return registry;
}

export const CASE_TYPE_PLAYBOOK_REGISTRY = validatedRegistry(rawRegistry);
const byId = new Map(CASE_TYPE_PLAYBOOK_REGISTRY.playbooks.map((playbook) => [playbook.caseType.id, playbook]));

export function caseTypePlaybook(reference?: CaseTypeReference | null): CaseTypePlaybook {
  return byId.get(reference?.id ?? "general_advisory") ?? byId.get("general_advisory")!;
}

export type CasePackageCheck = { id: string; level: "ok" | "warn"; text: string };

export function evaluateCaseTypeDraft(draft: StudioDraft, locale: "en" | "ru"): CasePackageCheck[] {
  const playbook = caseTypePlaybook(draft.caseType);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const checks: CasePackageCheck[] = [];
  for (const group of playbook.requiredNodeGroups) {
    const count = draft.nodes.filter((node) => group.types.includes(node.type)).length;
    const label = group.label[locale];
    checks.push(count >= group.minimum
      ? { id: `nodes:${group.id}`, level: "ok", text: t(`${label}: ${count} present`, `${label}: добавлено ${count}`) }
      : { id: `nodes:${group.id}`, level: "warn", text: t(`${label}: add ${group.minimum - count} more`, `${label}: добавьте ещё ${group.minimum - count}`) });
  }
  if (playbook.requirements.legalAsOf) checks.push(/^\d{4}-\d{2}-\d{2}$/.test(draft.classification?.legalAsOf ?? "")
    ? { id: "legal-as-of", level: "ok", text: t(`Legal sources reviewed as of ${draft.classification?.legalAsOf}`, `Источники права проверены на ${draft.classification?.legalAsOf}`) }
    : { id: "legal-as-of", level: "warn", text: t("Set the legal as-of date", "Укажите дату актуальности права") });
  if (playbook.requirements.httpsSources) {
    const sources = draft.classification?.sourceUrls ?? [];
    checks.push(sources.length > 0 && sources.every((source) => source.startsWith("https://"))
      ? { id: "https-sources", level: "ok", text: t("Authoritative HTTPS sources are attached", "Авторитетные HTTPS-источники приложены") }
      : { id: "https-sources", level: "warn", text: t("Attach at least one authoritative HTTPS source", "Добавьте хотя бы один авторитетный HTTPS-источник") });
  }
  if (playbook.requirements.complianceGate) checks.push(draft.classification?.complianceOnly
    ? { id: "compliance-gate", level: "ok", text: t("Lawful-planning and anti-abuse gate is enabled", "Контроль законности и anti-abuse включён") }
    : { id: "compliance-gate", level: "warn", text: t("Enable the lawful-planning compliance gate", "Включите контроль законности налогового планирования") });
  return checks;
}

export function primaryCaseOutput(reference?: CaseTypeReference | null) {
  const playbook = caseTypePlaybook(reference);
  return playbook.outputs.find((output) => output.primary) ?? playbook.outputs[0];
}

export function caseTypePlaybookSignature() {
  return CASE_TYPE_PLAYBOOK_REGISTRY.playbooks.map((playbook) => ({
    caseType: playbook.caseType,
    intakeQuestionIds: playbook.intakeQuestions.map((question) => question.id),
    requiredNodeGroups: playbook.requiredNodeGroups.map((group) => ({ id: group.id, types: group.types, minimum: group.minimum })),
    canonicalRequirements: playbook.canonicalRequirements,
    test: playbook.test,
    outputIds: playbook.outputs.map((output) => output.id),
  }));
}

export function isKnownCaseTypeId(value: string): value is CaseTypeId {
  return byId.has(value as CaseTypeId);
}
