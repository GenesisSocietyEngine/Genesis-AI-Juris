"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canonicalFingerprint, caseFingerprint, casePublicationFingerprint, isRecord, isTaxDraft, legacyCaseFingerprintV15, normalizeStudioDraft, slugifyCaseId } from "./case-integrity";
import { bundledCataloguePresentation, mayUseBundledCatalogueFallback } from "./catalogue-fallback";
import { actionUseKey, decisionAvailability, resolveDecisionTiming, resolveLegacyDecisionTiming } from "./game-engine";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import { isSupportedPlayedCaseSchemaRevision, PLAYED_CASE_SCHEMA_REVISION } from "./played-case-contract";
import { deriveRunLedger, type RunLedger } from "./run-ledger";
import type { CanonicalRuntimeState } from "./canonical-runtime";
import { initialMetrics, PRODUCT_RELEASE } from "./runtime-constants";
import { LatestRequestGate } from "./latest-request";
import { deviceDraftEnvelope, LEGACY_STUDIO_DRAFT_KEY, LEGACY_STUDIO_PRIVATE_KEY, mayPersistReportReceiptOnDevice, mayPersistStudioDraftOnDevice, studioDeviceDraftKey, studioDeviceScope, unwrapDeviceDraft } from "./studio-device-storage";
import { addStudioLink, appendStudioHistory, applyStudioPromptIteration, deleteStudioLink, describeStudioPromptOperation, nextStudioLinkId, nextStudioNodeId, nextStudioNodePosition, planStudioPromptIteration, relinkStudioLink, type StudioPromptPlan } from "./studio-editing";
import { applyValidatedAIStudioPlan, studioAIBaseFingerprint, toStudioAIContext } from "./studio-ai-plan";
import { compileStudioDraft } from "./studio-compiler";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { caseTypeReference } from "./case-type-reference";
import { STUDIO_NODE_MENU_PAGE_SIZE, studioNodeMenuOptions, studioNodeMenuPage } from "./studio-node-menu";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";
import type { GuidedStudioStep } from "./StudioGuidedWizard";
import { parseStudioWorkflowStep, restoredStudioWorkflowStep, serializedStudioWorkflowStep, studioWorkflowStorageKey } from "./studio-workflow";
import { applyStudioSnapshot, diffDraftToRevision, diffStudioSnapshots, emptyStudioTimeline, recordStudioRevision, snapshotStudioDraft, stepStudioTimeline, studioSnapshotsEqual, type StudioRevision, type StudioTimeline } from "./studio-revisions";
import { applyDealChangeToTaxEconomics, calculateTaxEconomics, convertRentalTaxBase, defaultTaxEconomics, prefillTaxEconomicsFromDeal, rentalTaxBaseFromDeal } from "./tax-economics";
import { inferDealEconomicsFromText } from "./deal-economics";
import type {
  DecisionOption,
  CaseCoreV2,
  CaseTypeId,
  CaseTypeReference,
  LocalText,
  MetricKey,
  Scenario,
  StudioDraft,
  StudioEditAction,
  StudioLink,
  StudioNode,
  StudioNodeType,
} from "./types";

type Locale = "en" | "ru";
type View = "library" | "play" | "studio" | "community" | "help";
type Theme = "office" | "after-hours";
type GraphOrientation = "vertical" | "horizontal";
type StudioAIEntitlement = "loading" | "anonymous" | "profile_required" | "ready" | "not_configured" | "unavailable";
type JurisAppProps = { studioOnly?: boolean };
function graphNodeVisualHeight(node: StudioNode) {
  const titleLines = Math.max(1, Math.ceil(node.title.trim().length / 18));
  const runtimeHeight = node.runtime?.budgetCostEur !== undefined || node.runtime?.durationMinutes !== undefined ? 22 : 0;
  return Math.max(96, 40 + titleLines * 17 + runtimeHeight);
}
function graphLinkGeometry(from: StudioNode, to: StudioNode, orientation: GraphOrientation) {
  if (orientation === "vertical") {
    const startX = from.x + 82.5;
    const startY = from.y + graphNodeVisualHeight(from);
    const endX = to.x + 82.5;
    const endY = to.y;
    const bend = Math.max(60, Math.abs(endY - startY) * 0.42);
    return { path: `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`, endX, endY };
  }
  const startX = from.x + 165;
  const startY = from.y + 38;
  const endX = to.x;
  const endY = to.y + 38;
  return { path: `M ${startX} ${startY} C ${startX + 40} ${startY}, ${endX - 38} ${endY}, ${endX} ${endY}`, endX, endY };
}
function graphBoundsForNodes(nodes: StudioNode[]) {
  return {
    width: Math.max(1_200, Math.ceil(nodes.reduce((value, node) => Math.max(value, node.x + 211), 0))),
    height: Math.max(570, Math.ceil(nodes.reduce((value, node) => {
      const titleLines = Math.max(1, Math.ceil(node.title.trim().length / 18));
      const runtimeHeight = node.runtime?.budgetCostEur !== undefined || node.runtime?.durationMinutes !== undefined ? 22 : 0;
      return Math.max(value, node.y + Math.max(150, 40 + titleLines * 17 + runtimeHeight) + 54);
    }, 0))),
  };
}
const HelpFaq = lazy(() => import("./HelpFaq"));
const StudioAIReview = lazy(() => import("./StudioAIReview"));
const StudioAIProgress = lazy(() => import("./StudioAIProgress"));
const DealOutcomePanel = lazy(() => import("./DealOutcomePanel"));
const CashFlowScenarioEditor = lazy(() => import("./CashFlowScenarioEditor"));
const GraphMilestones = lazy(() => import("./GraphMilestones"));
const CaseReportDialog = lazy(() => import("./CaseReportDialog"));
const CaseMarkdownDialog = lazy(() => import("./CaseMarkdownDialog"));
const CanonicalMarkdownReview = lazy(() => import("./CanonicalMarkdownReview"));
const StudioGuidedDemo = lazy(() => import("./StudioGuidedDemo"));
const StudioGuidedWizard = lazy(() => import("./StudioGuidedWizard"));
const StudioCaseTypeSelector = lazy(() => import("./StudioCaseTypeSelector"));
const StudioCaseViews = lazy(() => import("./StudioCaseViews"));
const StudioCasePlaybook = lazy(() => import("./StudioCasePlaybook"));
const StudioPackageValidationCard = lazy(() => import("./StudioPackageValidationCard"));
const StudioOutcomeParameters = lazy(() => import("./StudioOutcomeParameters"));
const StudioUserMoreActions = lazy(() => import("./StudioUserMoreActions"));
const OperationsDashboard = lazy(() => import("./OperationsDashboard"));
const CanonicalPromptAction = lazy(() => import("./StudioPromptAuxiliary").then((module) => ({default:module.CanonicalPromptAction})));
const CanonicalReadyAction = lazy(() => import("./StudioPromptAuxiliary").then((module) => ({default:module.CanonicalReadyAction})));
const StudioPromptPrivacyNote = lazy(() => import("./StudioPromptAuxiliary").then((module) => ({default:module.StudioPromptPrivacyNote})));
type OutcomeClass = "strong" | "mixed" | "weak";
type DecisionRecord = { stageId: string; stage: string; option: DecisionOption };
type FeedbackTarget = { caseId: string; version: string; title: string; source: "playable" | "studio"; fingerprint?: string; customCaseId?: number | null; contextType?: "case" | "stage" | "decision" | "node"; contextId?: string; privateCase?: boolean };

function returnedAIStudioPlan(value: unknown, instruction: string): StudioPromptPlan | null {
  if (!isRecord(value) || value.planner !== "ai" || value.instruction !== instruction || typeof value.canApply !== "boolean"
    || typeof value.contextOnly !== "boolean" || !Array.isArray(value.operations) || !Array.isArray(value.diagnostics)) return null;
  const allowed = new Set(["add_node", "update_node", "add_link", "update_link", "append_context", "set_case_field", "set_classification", "set_deal_economics"]);
  if (value.operations.length > 100 || value.operations.some((operation) => !isRecord(operation) || typeof operation.kind !== "string" || !allowed.has(operation.kind))) return null;
  if (value.assumptions !== undefined && (!Array.isArray(value.assumptions) || value.assumptions.some((item) => typeof item !== "string"))) return null;
  if (value.warnings !== undefined && (!Array.isArray(value.warnings) || value.warnings.some((item) => typeof item !== "string"))) return null;
  return value as StudioPromptPlan;
}

type InboxEntry = {
  id: string;
  status: string;
  title: string;
  source: string;
  body: string;
  materialRef?: string;
};

type PlayedCaseFile = {
  format: "genesis-juris-played-case";
  schemaVersion: 2 | typeof PLAYED_CASE_SCHEMA_REVISION;
  exportedAt: string;
  scenario: {
    id: string;
    caseId: string;
    contentVersion: string;
    fingerprint: string;
  };
  playthrough: {
    status: "in_progress" | "completed";
    currentStageId: string;
    clockMinute: number;
    decisions: Array<{
      sequence: number;
      stageId: string;
      optionId: string;
    }>;
    derivedMetrics: Record<MetricKey, number>;
    outcome: OutcomeClass | null;
    canonicalRuntime?:
      | { mode: "server-session"; sessionKey: string; expectedRevision: number }
      | { mode: "local-replay"; seed: number; commands: Array<{ sequence: number; kind: "decision"; stageId: string; optionId: string } | { sequence: number; kind: "advance_time"; minutes: number }> };
  };
};

type ServerPlaySessionState = {
  currentStageId: string;
  clockMinute: number;
  metrics: Record<MetricKey, number>;
  actionUseCounts: Record<string, number>;
  completedDeadlineIds: string[];
  missedDeadlineIds: string[];
  decisions: Array<{ sequence: number; stageId: string; optionId: string }>;
  timeAdvances?: Array<{ sequence: number; minutes: number }>;
  outcome: OutcomeClass | null;
  outcomeId?: string | null;
  availableActionIds?: string[];
  activeDeadlineIds?: string[];
  visibleInboxIds?: string[];
  resolvedInboxIds?: string[];
  availableEvidenceIds?: string[];
  deadlineDueMinutes?: Record<string, number>;
  canonicalResources?: Record<string, number>;
  canonicalNumericMetrics?: Record<string, number>;
  canonicalOutcome?: NonNullable<DecisionOption["resolvedOutcome"]>;
};
type CanonicalRuntimeModule = typeof import("./canonical-runtime");
type CanonicalPresentation = ReturnType<CanonicalRuntimeModule["canonicalPresentationState"]>;

type ServerPlaySession = {
  sessionKey: string;
  caseId: string;
  version: string;
  fingerprint: string;
  state: ServerPlaySessionState;
  status: "active" | "completed" | "abandoned";
  revision: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const taxPublicationChecklist = [
  "lawfulPurposeConfirmed",
  "complianceOnlyConfirmed",
  "legalAsOfVerified",
  "sourceAuthorityVerified",
  "antiAbuseRulesReviewed",
  "reportingObligationsReviewed",
  "noEvasionFacilitationConfirmed",
] as const;
type TaxPublicationChecklistKey = typeof taxPublicationChecklist[number];
type PromotionCandidate = { item: CommunityCustomCase; draft: StudioDraft; scenario: Scenario };

type CustomCaseFile = {
  format: "genesis-juris-custom-case";
  schemaVersion: 4;
  exportedAt: string;
  case: {
    id: string;
    version: string;
    fingerprint: string;
    parent: StudioDraft["parent"];
    protection: StudioDraft["protection"];
    coreSchemaVersion: 2;
    caseType: CaseTypeReference;
    visibility?: "restricted" | "private";
  };
  core: CaseCoreV2;
  draft: StudioDraft;
};

const ui = {
  en: {
    library: "Templates", play: "Operations", studio: "Case Studio",
    office: "Office", night: "After hours", catalogue: "Production catalogue",
    openCase: "Open case file", launch: "Launch scenario", continue: "Continue operation",
    role: "Your role", jurisdiction: "Jurisdiction", dossier: "Dossier",
    situation: "Situation", attention: "Inbox attention", decisions: "Available decisions",
    pressure: "Pressure", noPressure: "No active regulatory pressure", visibleMaterial: "Visible material",
    review: "Review decision", cancel: "Cancel", confirm: "Confirm & dispatch",
    consequence: "Operational consequence", continueCase: "Continue case", debrief: "View debrief",
    returnLibrary: "Return to library", position: "Legal position", evidence: "Evidence integrity",
    trust: "Institutional trust", exposure: "Exposure", provenance: "Source provenance",
    actionLog: "Decision record", day: "Day", cost: "Cost", duration: "Time", complete: "Case debrief",
    adaptation: "Interactive web adaptation",
    canonNote: "Web beta. Published cases are versioned; expert-review status and legal as-of dates are shown in the catalogue.",
    author: "Case authoring command deck",
    authorLead: "Describe a legal crisis in plain language, then shape its actors, evidence, deadlines, decisions and outcomes on the visual graph.",
    prompt: "Case prompt", generate: "Generate case graph", save: "Save draft", saved: "Draft saved on this device",
    export: "Export JSON", import: "Import JSON", newDraft: "New draft", graph: "Scenario graph",
    importCustom: "Import custom case", exportCustom: "Export custom case", childVersion: "Create child version",
    customCase: "Custom case", caseId: "Case ID", version: "Version", parentCase: "Parent case", fingerprint: "Content fingerprint",
    exportPlay: "Export play JSON", importPlay: "Import played case", importedPlay: "Played case restored",
    invalidPlay: "This file is not a valid or compatible GENESIS: JURIS played case.",
    inspector: "Node inspector", checks: "Integrity checks", preview: "Playable preview", addNode: "Add node",
    deleteNode: "Delete node", title: "Title", detail: "Detail", nodeType: "Node type",
    noSelection: "Select a node in the graph to edit it.", allClear: "Draft passes structural checks.",
    localNote: "Drafts can be saved locally or submitted to the moderated practitioner workspace. Use only synthetic or de-identified material.",
    community: "Community", help: "Help", feedback: "Give feedback",
    nodeTypes: { trigger: "Trigger", actor: "Actor", fact: "Fact", evidence: "Evidence", deadline: "Deadline", decision: "Decision", outcome: "Outcome", entity: "Entity / jurisdiction", tax_rule: "Tax rule", cash_flow: "Cash flow" } as Record<StudioNodeType, string>,
  },
  ru: {
    library: "Шаблоны", play: "Операции", studio: "Студия кейсов",
    office: "Офис", night: "После работы", catalogue: "Производственный каталог",
    openCase: "Открыть дело", launch: "Запустить сценарий", continue: "Продолжить операцию",
    role: "Ваша роль", jurisdiction: "Юрисдикция", dossier: "Досье",
    situation: "Ситуация", attention: "Требуют внимания", decisions: "Доступные решения",
    pressure: "Давление", noPressure: "Активного регуляторного давления нет", visibleMaterial: "Видимые материалы",
    review: "Проверка решения", cancel: "Отмена", confirm: "Подтвердить и отправить",
    consequence: "Операционное последствие", continueCase: "Продолжить дело", debrief: "Открыть разбор",
    returnLibrary: "Вернуться в библиотеку", position: "Правовая позиция", evidence: "Целостность доказательств",
    trust: "Институциональное доверие", exposure: "Экспозиция", provenance: "Происхождение источника",
    actionLog: "Реестр решений", day: "День", cost: "Стоимость", duration: "Время", complete: "Разбор дела",
    adaptation: "Интерактивная веб-адаптация",
    canonNote: "Веб-бета. Опубликованные кейсы версионируются; статус экспертной проверки и дата актуальности права указаны в каталоге.",
    author: "Командная палуба автора",
    authorLead: "Опишите юридический кризис обычным языком, затем соберите акторов, доказательства, сроки, решения и исходы на визуальном графе.",
    prompt: "Промпт кейса", generate: "Построить граф кейса", save: "Сохранить черновик", saved: "Черновик сохранён на этом устройстве",
    export: "Экспорт JSON", import: "Импорт JSON", newDraft: "Новый черновик", graph: "Граф сценария",
    importCustom: "Импорт custom-кейса", exportCustom: "Экспорт custom-кейса", childVersion: "Создать дочернюю версию",
    customCase: "Custom-кейс", caseId: "ID кейса", version: "Версия", parentCase: "Родительский кейс", fingerprint: "Отпечаток содержимого",
    exportPlay: "Экспорт прохождения", importPlay: "Импорт прохождения", importedPlay: "Прохождение восстановлено",
    invalidPlay: "Файл не является корректным или совместимым прохождением GENESIS: JURIS.",
    inspector: "Инспектор узла", checks: "Проверки целостности", preview: "Игровой предпросмотр", addNode: "Добавить узел",
    deleteNode: "Удалить узел", title: "Название", detail: "Описание", nodeType: "Тип узла",
    noSelection: "Выберите узел на графе, чтобы отредактировать его.", allClear: "Черновик прошёл структурные проверки.",
    localNote: "Черновики можно хранить локально или отправлять в модерируемое рабочее пространство. Используйте только синтетические или обезличенные материалы.",
    community: "Сообщество", help: "Помощь", feedback: "Дать отзыв",
    nodeTypes: { trigger: "Триггер", actor: "Актор", fact: "Факт", evidence: "Доказательство", deadline: "Срок", decision: "Решение", outcome: "Исход", entity: "Компания / юрисдикция", tax_rule: "Налоговое правило", cash_flow: "Денежный поток" } as Record<StudioNodeType, string>,
  },
};

type UiText = (typeof ui)["en"];

const metricLabels: Record<Locale, Record<MetricKey, string>> = {
  en: { position: "Position", evidence: "Evidence", trust: "Trust", exposure: "Exposure" },
  ru: { position: "Позиция", evidence: "Доказательства", trust: "Доверие", exposure: "Экспозиция" },
};

const typeColors: Record<StudioNodeType, string> = {
  trigger: "#f06b4f", actor: "#5bb8c4", fact: "#d2a85e", evidence: "#8fc2a9",
  deadline: "#e48a68", decision: "#f0c35b", outcome: "#a594d8", entity: "#68a8dc",
  tax_rule: "#d09a66", cash_flow: "#72c6a4",
};

function runtimeForNodeType(runtime: StudioNode["runtime"], type: StudioNodeType): StudioNode["runtime"] {
  if (!runtime) return undefined;
  const compatible: NonNullable<StudioNode["runtime"]> = {
    ...(runtime.day !== undefined ? { day: runtime.day } : {}),
    ...(runtime.time !== undefined ? { time: runtime.time } : {}),
    ...(runtime.pressure !== undefined ? { pressure: runtime.pressure } : {}),
    ...(runtime.budgetCostEur !== undefined ? { budgetCostEur: runtime.budgetCostEur } : {}),
    ...(runtime.durationMinutes !== undefined ? { durationMinutes: runtime.durationMinutes } : {}),
    ...(type === "outcome" && runtime.terminalOutcome !== undefined ? { terminalOutcome: runtime.terminalOutcome } : {}),
    ...(type === "deadline" && runtime.deadlineDay !== undefined ? { deadlineDay: runtime.deadlineDay } : {}),
    ...(type === "deadline" && runtime.deadlineTime !== undefined ? { deadlineTime: runtime.deadlineTime } : {}),
    ...(type === "deadline" && runtime.missedOutcomeNodeId !== undefined ? { missedOutcomeNodeId: runtime.missedOutcomeNodeId } : {}),
  };
  return Object.keys(compatible).length ? compatible : undefined;
}

const iconPaths: Record<string, React.ReactNode> = {
  library: <><path d="M4 5.5h16M6 3v5M18 3v5M5 10h14v10H5z"/><path d="M9 14h6M9 17h4"/></>,
  play: <><path d="M4 19V8l8-4 8 4v11"/><path d="M8 19v-6h8v6M3 19h18"/></>,
  studio: <><path d="M6 5h4v4H6zM14 15h4v4h-4zM16 4v7M8 13v6M10 7h6M8 15h6"/></>,
  video: <><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m10 9 5 3-5 3z"/></>,
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  arrow: <path d="M5 12h14M14 7l5 5-5 5"/>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  alert: <><path d="m12 3 9 17H3z"/><path d="M12 9v5M12 17.5v.1"/></>,
  person: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.3 3.3-6.5 7.5-6.5s6.7 2.2 7.5 6.5"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>, check: <path d="m4 12 5 5L20 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></>,
  save: <><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
  reset: <><path d="M5 8V4M5 4h4"/><path d="M5.5 4.5A8 8 0 1 1 4 14"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  spark: <><path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function local(value: LocalText, locale: Locale) { return value[locale]; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function numberedStudioLinks(pairs: Array<[string, string]>): StudioLink[] {
  return pairs.map(([from, to], index) => ({ id: `link-${index + 1}`, from, to }));
}
async function readJsonResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return await response.json() as T;
}
function formatCaseClock(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const day = Math.floor(safe / 1440) + 1;
  const minuteOfDay = safe % 1440;
  return { day, time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}` };
}
function bumpPatchVersion(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : "1.0.1";
}
function classifyOutcome(metrics: Record<MetricKey, number>): OutcomeClass {
  const resilience = metrics.position + metrics.evidence + metrics.trust - metrics.exposure;
  return resilience >= 150 ? "strong" : resilience >= 112 ? "mixed" : "weak";
}

function normalizeServerPlaySession(value: unknown): ServerPlaySession | null {
  if (!isRecord(value) || typeof value.sessionKey !== "string" || typeof value.caseId !== "string" || typeof value.version !== "string" || typeof value.fingerprint !== "string" || !isRecord(value.state)) return null;
  const state = value.state;
  if (typeof state.currentStageId !== "string" || typeof state.clockMinute !== "number" || !Number.isInteger(state.clockMinute) || !isRecord(state.metrics) || !isRecord(state.actionUseCounts) || !Array.isArray(state.completedDeadlineIds) || !Array.isArray(state.missedDeadlineIds) || !Array.isArray(state.decisions)) return null;
  const metricState = state.metrics;
  if (!["position", "evidence", "trust", "exposure"].every((key) => typeof metricState[key] === "number" && Number.isFinite(metricState[key]))) return null;
  if (value.status !== "active" && value.status !== "completed" && value.status !== "abandoned") return null;
  if (typeof value.revision !== "number" || !Number.isInteger(value.revision) || value.revision < 0) return null;
  const actionUseCounts = Object.fromEntries(Object.entries(state.actionUseCounts).filter(([, count]) => typeof count === "number" && Number.isInteger(count) && count >= 0)) as Record<string, number>;
  const decisions = state.decisions.flatMap((decision) => isRecord(decision) && typeof decision.sequence === "number" && typeof decision.stageId === "string" && typeof decision.optionId === "string" ? [{ sequence: decision.sequence, stageId: decision.stageId, optionId: decision.optionId }] : []);
  const timeAdvances = Array.isArray(state.timeAdvances) ? state.timeAdvances.flatMap((item) => isRecord(item) && typeof item.sequence === "number" && typeof item.minutes === "number" ? [{ sequence: item.sequence, minutes: item.minutes }] : []) : [];
  const outcome = state.outcome === "strong" || state.outcome === "mixed" || state.outcome === "weak" ? state.outcome : null;
  const canonicalOutcome = isRecord(state.canonicalOutcome)
    && typeof state.canonicalOutcome.id === "string"
    && isRecord(state.canonicalOutcome.title)
    && typeof state.canonicalOutcome.title.en === "string"
    && typeof state.canonicalOutcome.title.ru === "string"
    && isRecord(state.canonicalOutcome.summary)
    && typeof state.canonicalOutcome.summary.en === "string"
    && typeof state.canonicalOutcome.summary.ru === "string"
    && (state.canonicalOutcome.classification === "strong" || state.canonicalOutcome.classification === "mixed" || state.canonicalOutcome.classification === "weak")
    ? {
        id: state.canonicalOutcome.id,
        title: { en: state.canonicalOutcome.title.en, ru: state.canonicalOutcome.title.ru },
        summary: { en: state.canonicalOutcome.summary.en, ru: state.canonicalOutcome.summary.ru },
        classification: state.canonicalOutcome.classification as OutcomeClass,
      }
    : undefined;
  const strings = (items: unknown) => Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : undefined;
  const numbers = (record: unknown) => isRecord(record)
    ? Object.fromEntries(Object.entries(record).filter(([, item]) => typeof item === "number" && Number.isFinite(item))) as Record<string, number>
    : undefined;
  return {
    sessionKey: value.sessionKey,
    caseId: value.caseId,
    version: value.version,
    fingerprint: value.fingerprint,
    state: {
      currentStageId: state.currentStageId,
      clockMinute: state.clockMinute,
      metrics: { position: Number(metricState.position), evidence: Number(metricState.evidence), trust: Number(metricState.trust), exposure: Number(metricState.exposure) },
      actionUseCounts,
      completedDeadlineIds: state.completedDeadlineIds.filter((item): item is string => typeof item === "string"),
      missedDeadlineIds: state.missedDeadlineIds.filter((item): item is string => typeof item === "string"),
      decisions,
      timeAdvances,
      outcome,
      outcomeId: typeof state.outcomeId === "string" ? state.outcomeId : null,
      availableActionIds: strings(state.availableActionIds),
      activeDeadlineIds: strings(state.activeDeadlineIds),
      visibleInboxIds: strings(state.visibleInboxIds),
      resolvedInboxIds: strings(state.resolvedInboxIds),
      availableEvidenceIds: strings(state.availableEvidenceIds),
      deadlineDueMinutes: numbers(state.deadlineDueMinutes),
      canonicalResources: numbers(state.canonicalResources),
      canonicalNumericMetrics: numbers(state.canonicalNumericMetrics),
      canonicalOutcome,
    },
    status: value.status,
    revision: value.revision,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
  };
}

function clientCanonicalState(runtime: CanonicalRuntimeState, presentation: CanonicalPresentation, outcome: OutcomeClass | null, canonicalOutcome: ServerPlaySessionState["canonicalOutcome"], decisions: ServerPlaySessionState["decisions"] = [], timeAdvances: NonNullable<ServerPlaySessionState["timeAdvances"]> = []): ServerPlaySessionState {
  return {
    currentStageId: presentation.currentStageId,
    clockMinute: presentation.clockMinute,
    metrics: presentation.metrics,
    actionUseCounts: presentation.actionUseCounts,
    completedDeadlineIds: presentation.completedDeadlineIds,
    missedDeadlineIds: presentation.missedDeadlineIds,
    decisions,
    timeAdvances,
    outcome,
    outcomeId: presentation.outcomeId,
    availableActionIds: presentation.availableActionIds,
    activeDeadlineIds: presentation.activeDeadlineIds,
    visibleInboxIds: presentation.visibleInboxIds,
    resolvedInboxIds: presentation.resolvedInboxIds,
    availableEvidenceIds: presentation.availableEvidenceIds,
    deadlineDueMinutes: presentation.deadlineDueMinutes,
    canonicalResources: { ...runtime.resources },
    canonicalNumericMetrics: { ...runtime.numericMetrics },
    canonicalOutcome,
  };
}

const defaultPrompt = `A renewable-energy developer discovers that its community consultation map omitted two households before a permit hearing. The planning authority requests a corrected record within 36 hours. Create a case for counsel to preserve evidence, coordinate the developer and mapping contractor, decide whether to seek an adjournment, and reach either a credible corrected process or a compromised permit position.`;

const PENDING_WORKSPACE_SAVE_KEY = "genesis.juris.pending-workspace-save.v2";
const PENDING_WORKSPACE_SAVE_MAX_AGE_MS = 15 * 60 * 1000;
const PENDING_CASE_PROMPT_KEY = "genesis-juris-pending-case-prompt-v1";

type PendingWorkspaceSave = {
  schema: "genesis.juris.pending-workspace-save.v2";
  action: "save" | "submit";
  draft: StudioDraft;
  isPrivate: boolean;
  serverFingerprint: string | null;
  serverPublicationFingerprint: string | null;
  requestedAt: number;
};

function parsePendingWorkspaceSave(value: string | null): PendingWorkspaceSave | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<PendingWorkspaceSave>;
    if (candidate.schema !== PENDING_WORKSPACE_SAVE_KEY || (candidate.action !== "save" && candidate.action !== "submit")) return null;
    if (typeof candidate.isPrivate !== "boolean" || !Number.isFinite(candidate.requestedAt) || Date.now() - candidate.requestedAt! > PENDING_WORKSPACE_SAVE_MAX_AGE_MS) return null;
    if (candidate.serverFingerprint !== null && typeof candidate.serverFingerprint !== "string") return null;
    if (candidate.serverPublicationFingerprint !== null && typeof candidate.serverPublicationFingerprint !== "string") return null;
    return { ...candidate, draft: normalizeStudioDraft(candidate.draft) } as PendingWorkspaceSave;
  } catch {
    return null;
  }
}

const defaultDraft: StudioDraft = {
  caseId: "the_missing_boundary",
  version: "1.0.0",
  caseType: caseTypeReference("training_simulation"),
  parent: null,
  title: "The Missing Boundary", jurisdiction: "UK · Planning", role: "Project counsel",
  premise: "A consultation map omitted two households before a permit hearing.", premisePublication: "author-reviewed", updatedAt: new Date(0).toISOString(),
  classification: { practiceArea: "Planning & regulatory", difficulty: "Intermediate", tags: ["evidence", "regulatory", "deadline"], taxTopics: [], complianceOnly: true },
  nodes: [
    { id: "trigger-1", type: "trigger", title: "Omitted households discovered", detail: "The consultation map excluded two addresses.", x: 50, y: 220 },
    { id: "actor-1", type: "actor", title: "Planning authority", detail: "Requests a corrected record within 36 hours.", x: 270, y: 70 },
    { id: "evidence-1", type: "evidence", title: "Map revision history", detail: "GIS exports, contractor instructions and approval log.", x: 270, y: 270 },
    { id: "deadline-1", type: "deadline", title: "36-hour correction window", detail: "Before the permit hearing bundle closes.", x: 490, y: 80 },
    { id: "decision-1", type: "decision", title: "Correct or adjourn", detail: "Choose a corrected filing or seek an adjournment.", x: 510, y: 300 },
    { id: "outcome-1", type: "outcome", title: "Credible corrected process", detail: "The record is repaired and participation restored.", x: 750, y: 180 },
    { id: "outcome-2", type: "outcome", title: "Compromised permit position", detail: "The omission undermines procedural confidence.", x: 750, y: 390 },
  ],
  links: numberedStudioLinks([
    ["trigger-1", "actor-1"], ["trigger-1", "evidence-1"], ["actor-1", "deadline-1"],
    ["evidence-1", "decision-1"], ["deadline-1", "decision-1"], ["decision-1", "outcome-1"],
    ["decision-1", "outcome-2"],
  ]),
  editHistory: [
    { id: "edit-initial-author", role: "author", source: "prompt", action: "prompt_submitted", message: defaultPrompt, createdAt: "2026-08-21T00:00:00.000Z" },
    { id: "edit-initial-studio", role: "studio", source: "prompt", action: "prompt_applied", message: "Created the initial seven-node scenario graph. Future prompt iterations will preserve manual graph edits.", createdAt: "2026-08-21T00:00:00.000Z" },
  ],
};

function blankStudioDraft(updatedAt = new Date().toISOString()): StudioDraft {
  return {
    caseId: "untitled_case",
    version: "1.0.0",
    caseType: caseTypeReference("general_advisory"),
    parent: null,
    title: "",
    jurisdiction: "",
    role: "",
    premise: "",
    premisePublication: "author-reviewed",
    classification: { domain: "general", practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true },
    nodes: [],
    links: [],
    editHistory: [],
    updatedAt,
  };
}

// Keep the first server/client render deterministic and genuinely empty. The
// worked example remains available as an explicit author action.
const initialBlankDraft = blankStudioDraft(new Date(0).toISOString());

export default function JurisApp({ studioOnly = false }: JurisAppProps) {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("office");
  const [view, setView] = useState<View>(studioOnly ? "studio" : "library");
  const [featuredId, setFeaturedId] = useState(fallbackCatalogueRecords[2].id);
  const [catalogueRecords, setCatalogueRecords] = useState<PublishedCaseSummary[]>(() => bundledCatalogueRecords());
  const [catalogueNextCursor, setCatalogueNextCursor] = useState<string | null>(null);
  const [catalogueTotal, setCatalogueTotal] = useState(fallbackCatalogueRecords.length);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueScenarios, setCatalogueScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [metrics, setMetrics] = useState({ ...initialMetrics });
  const [selectedOption, setSelectedOption] = useState<DecisionOption | null>(null);
  const [resultOption, setResultOption] = useState<DecisionOption | null>(null);
  const [decisionLog, setDecisionLog] = useState<DecisionRecord[]>([]);
  const [outcome, setOutcome] = useState<"strong" | "mixed" | "weak" | null>(null);
  const [dossierRef, setDossierRef] = useState<string | null>(null);
  const [caseMinute, setCaseMinute] = useState(0);
  const [actionUseCounts, setActionUseCounts] = useState<Record<string, number>>({});
  const [completedDeadlineIds, setCompletedDeadlineIds] = useState<string[]>([]);
  const [missedDeadlineIds, setMissedDeadlineIds] = useState<string[]>([]);
  const [serverPlaySession, setServerPlaySession] = useState<ServerPlaySession | null>(null);
  const [localCanonicalState, setLocalCanonicalState] = useState<ServerPlaySessionState | null>(null);
  const [legacyTimingMode, setLegacyTimingMode] = useState(false);
  const [playSessionSync, setPlaySessionSync] = useState<"opening" | "server" | "local" | "stale" | "error">("local");
  const [playSessionBusy, setPlaySessionBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraftState] = useState<StudioDraft>(initialBlankDraft);
  const [validatedDraft, setValidatedDraft] = useState<StudioDraft>(initialBlankDraft);
  const [studioPrivate, setStudioPrivate] = useState(false);
  const [studioCustomCaseId, setStudioCustomCaseId] = useState<number | null>(null);
  const [studioCanManagePrivacy, setStudioCanManagePrivacy] = useState(true);
  const [studioServerFingerprint, setStudioServerFingerprint] = useState<string | null>(null);
  const [studioServerPublicationFingerprint, setStudioServerPublicationFingerprint] = useState<string | null>(null);
  const [studioCanDuplicate, setStudioCanDuplicate] = useState(true);
  const [studioCopyProtectionLocked, setStudioCopyProtectionLocked] = useState(false);
  const [studioStorageScope, setStudioStorageScope] = useState<string | null>(null);
  const [studioAIEntitlement, setStudioAIEntitlement] = useState<StudioAIEntitlement>("loading");
  const draftRef = useRef<StudioDraft>(initialBlankDraft);
  const [studioTimeline, setStudioTimelineState] = useState<StudioTimeline>(emptyStudioTimeline());
  const studioTimelineRef = useRef<StudioTimeline>(emptyStudioTimeline());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number; startX: number; startY: number; lastX: number; lastY: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const playedCaseImportRef = useRef<HTMLInputElement>(null);
  const dragBeforeRef = useRef<StudioDraft | null>(null);
  const playSessionStartRef = useRef(0);
  const localCanonicalRuntimeRef = useRef<CanonicalRuntimeState | null>(null);
  const catalogueLaunchRef = useRef(0);
  const catalogueRequestGateRef = useRef(new LatestRequestGate());
  const studioChangedBeforeRestoreRef = useRef(false);
  const text = ui[locale];

  useEffect(() => {
    let cancelled = false;
    // v12 used origin-wide keys that could cross account boundaries on shared
    // browsers. Never read them again; new drafts use an identity-scoped,
    // versioned envelope and workspace/private artifacts are excluded entirely.
    window.localStorage.removeItem(LEGACY_STUDIO_DRAFT_KEY);
    window.localStorage.removeItem(LEGACY_STUDIO_PRIVATE_KEY);
    const resolveIdentityBoundary = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const payload = await readJsonResponse<{ authenticated?: boolean; registered?: boolean; profile?: { email?: string }; capabilities?: { studioAI?: boolean } }>(response);
        const scope = await studioDeviceScope(response.ok && payload?.authenticated ? payload.profile?.email : null);
        if (!cancelled) {
          setStudioStorageScope(scope);
          setStudioAIEntitlement(response.ok && payload?.authenticated
            ? (payload.registered ? (payload.capabilities?.studioAI ? "ready" : "not_configured") : "profile_required")
            : "anonymous");
        }
      } catch {
        // Fail closed: without a resolved identity scope the app does not read
        // or persist a device draft.
        if (!cancelled) setStudioAIEntitlement("unavailable");
      }
    };
    void resolveIdentityBoundary();
    window.addEventListener("focus", resolveIdentityBoundary);
    return () => { cancelled = true; window.removeEventListener("focus", resolveIdentityBoundary); };
  }, []);

  useEffect(() => {
    if (studioOnly) return;
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested === "library" || requested === "play" || requested === "studio" || requested === "community" || requested === "help") {
      const update = window.setTimeout(() => setView(requested), 0);
      return () => window.clearTimeout(update);
    }
  }, [studioOnly]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("import") !== "markdown") return;
    const value = window.sessionStorage.getItem(PENDING_CASE_PROMPT_KEY);
    window.sessionStorage.removeItem(PENDING_CASE_PROMPT_KEY);
    url.searchParams.delete("import");
    window.history.replaceState(window.history.state, "", url);
    if (value && value.length <= STUDIO_PROMPT_CHARACTER_LIMIT) {
      const update = window.setTimeout(() => setPrompt(value), 0);
      return () => window.clearTimeout(update);
    }
  }, []);

  useEffect(() => {
    if (!studioStorageScope) return;
    const restore = window.setTimeout(() => {
      if (studioChangedBeforeRestoreRef.current) return;
      const stored = window.localStorage.getItem(studioDeviceDraftKey(studioStorageScope));
      if (stored) {
        try {
          const candidate = unwrapDeviceDraft(JSON.parse(stored), studioStorageScope);
          if (!candidate) throw new Error("Invalid device-draft envelope");
          const restored = normalizeStudioDraft(candidate);
          if (!mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: false, draft: restored })) throw new Error("Workspace or protected draft cannot be restored from device storage");
          const emptyTimeline = emptyStudioTimeline();
          draftRef.current = restored;
          studioTimelineRef.current = emptyTimeline;
          setDraftState(restored);
          setStudioTimelineState(emptyTimeline);
          setStudioPrivate(false);
          setStudioCustomCaseId(null);
          setStudioCanManagePrivacy(true);
          setStudioServerFingerprint(null);
          setStudioServerPublicationFingerprint(null);
          setStudioCanDuplicate(true);
          setStudioCopyProtectionLocked(restored.protection?.copyProtected === true && Boolean(restored.protection.seal));
        } catch {
          // Keep the bundled draft when local storage contains invalid data.
        }
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, [studioStorageScope]);

  useEffect(() => {
    if (!studioStorageScope) return;
    if (!mayPersistStudioDraftOnDevice({ canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate, draft })) {
      window.localStorage.removeItem(studioDeviceDraftKey(studioStorageScope));
    }
  }, [draft, studioCanDuplicate, studioCustomCaseId, studioPrivate, studioStorageScope]);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  useEffect(() => () => catalogueRequestGateRef.current.abort(), []);

  const refreshCatalogue = useCallback(async ({ filters = {}, cursor = null, append = false, force = false }: { filters?: CatalogueSearchFilters; cursor?: string | null; append?: boolean; force?: boolean } = {}) => {
    const requestTicket = catalogueRequestGateRef.current.start();
    setCatalogueLoading(true);
    setCatalogueError("");
    const params = new URLSearchParams({ limit: "24" });
    if (filters.q?.trim()) params.set("q", filters.q.trim());
    if (filters.jurisdiction && filters.jurisdiction !== "all") params.set("jurisdiction", filters.jurisdiction);
    if (filters.practiceArea && filters.practiceArea !== "all") params.set("practiceArea", filters.practiceArea);
    if (filters.difficulty && filters.difficulty !== "all") params.set("difficulty", filters.difficulty);
    if (filters.tag && filters.tag !== "all") params.set("tag", filters.tag);
    if (cursor) params.set("cursor", cursor);
    if (force) params.set("fresh", String(Date.now()));
    try {
      const response = await fetch(`/api/catalog?${params}`, { ...(force ? { cache: "no-store" as const } : {}), signal: requestTicket.signal });
      const payload = await readJsonResponse<{ items?: unknown[]; nextCursor?: string | null; total?: number }>(response);
      if (!response.ok || !Array.isArray(payload?.items)) throw new Error("Catalogue response is unavailable");
      if (!catalogueRequestGateRef.current.isCurrent(requestTicket)) return;
      const records = payload.items.flatMap((item) => {
        try { return [normalizePublishedCaseSummary(item)]; } catch { return []; }
      });
      setCatalogueRecords((current) => {
        if (!append) return records;
        const merged = new Map(current.map((item) => [item.id, item]));
        for (const item of records) merged.set(item.id, item);
        return [...merged.values()];
      });
      setCatalogueNextCursor(typeof payload.nextCursor === "string" ? payload.nextCursor : null);
      setCatalogueTotal(typeof payload.total === "number" ? payload.total : records.length);
      setFeaturedId((current) => records.some((item) => item.id === current) || append ? current : records[0]?.id ?? current);
    } catch {
      if (!catalogueRequestGateRef.current.isCurrent(requestTicket)) return;
      setCatalogueError(locale === "en" ? "The central catalogue is temporarily unavailable; bundled cases remain playable." : "Центральный каталог временно недоступен; встроенные кейсы остаются доступными.");
      if (!append) {
        const fallback = bundledCatalogueRecords().filter((record) => publishedRecordMatches(record, filters));
        setCatalogueRecords(fallback);
        setCatalogueTotal(fallback.length);
        setCatalogueNextCursor(null);
      }
    } finally {
      if (catalogueRequestGateRef.current.isCurrent(requestTicket)) setCatalogueLoading(false);
      catalogueRequestGateRef.current.finish(requestTicket);
    }
  }, [locale]);

  const featuredRecord = catalogueRecords.find((record) => record.id === featuredId) ?? catalogueRecords[0] ?? bundledCatalogueRecords()[0];
  const featured = catalogueScenarios.find((scenario) => scenario.caseId === featuredRecord.id && scenario.version === featuredRecord.currentVersion && scenario.fingerprint === featuredRecord.fingerprint) ?? null;
  const stage = activeScenario?.stages[stageIndex] ?? null;
  const canonicalPlayState = activeScenario && serverPlaySession
    && serverPlaySession.caseId === activeScenario.caseId
    && serverPlaySession.version === activeScenario.version
    && serverPlaySession.fingerprint === activeScenario.fingerprint
    ? serverPlaySession.state
    : localCanonicalState;
  const runLedger = useMemo(() => {
    if (!activeScenario) return null;
    const authoritative = canonicalPlayState
      ? { resources: canonicalPlayState.canonicalResources, numericMetrics: canonicalPlayState.canonicalNumericMetrics }
      : undefined;
    return deriveRunLedger(activeScenario, decisionLog, authoritative);
  }, [activeScenario, canonicalPlayState, decisionLog]);
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const reportReceiptDeviceEligible = mayPersistReportReceiptOnDevice({
    scope: studioStorageScope,
    canDuplicate: studioCanDuplicate,
    customCaseId: studioCustomCaseId,
    isPrivate: studioPrivate,
    draft,
  });
  useEffect(() => {
    const timer = window.setTimeout(() => setValidatedDraft(draft), 180);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const [packageValidation, setPackageValidation] = useState<{
    source: StudioDraft | null;
    checks: Array<{ level: "ok" | "warn"; text: string }>;
    requiresPlayableRoute: boolean;
  }>({ source: null, checks: [], requiresPlayableRoute: true });
  useEffect(() => {
    let cancelled = false;
    void import("./studio-validation")
      .then(({ validateStudioDraft }) => {
        const result = validateStudioDraft(validatedDraft, locale);
        if (!cancelled) setPackageValidation({ source: validatedDraft, ...result });
      })
      .catch(() => {
        if (!cancelled) setPackageValidation({
          source: validatedDraft,
          requiresPlayableRoute: true,
          checks: [{ level: "warn", text: locale === "en" ? "Package validation is unavailable" : "Проверка пакета недоступна" }],
        });
      });
    return () => { cancelled = true; };
  }, [locale, validatedDraft]);
  const packageValidationSettled = packageValidation.source === validatedDraft;
  const checks = packageValidationSettled
    ? packageValidation.checks
    : [{ level: "warn" as const, text: locale === "en" ? "Checking the selected package…" : "Проверяется выбранный пакет…" }];
  const packageRequiresPlayableRoute = packageValidationSettled ? packageValidation.requiresPlayableRoute : true;

  function syncStudioDraft(next: StudioDraft) {
    studioChangedBeforeRestoreRef.current = true;
    draftRef.current = next;
    setDraftState(next);
  }
  function syncStudioTimeline(next: StudioTimeline) {
    studioTimelineRef.current = next;
    setStudioTimelineState(next);
  }
  function replaceStudioDraft(next: StudioDraft) {
    syncStudioDraft(next);
    syncStudioTimeline(emptyStudioTimeline());
  }
  function enterNewLocalDraft(next: StudioDraft, nextSelectedNodeId: string | null) {
    const isolated = structuredClone(next);
    delete isolated.protection;
    isolated.parent = null;
    if (studioStorageScope) window.localStorage.removeItem(studioDeviceDraftKey(studioStorageScope));
    replaceStudioDraft(isolated);
    setStudioPrivate(false);
    setStudioCustomCaseId(null);
    setStudioCanManagePrivacy(true);
    setStudioServerFingerprint(null);
    setStudioServerPublicationFingerprint(null);
    setStudioCanDuplicate(true);
    setStudioCopyProtectionLocked(false);
    setSelectedNodeId(nextSelectedNodeId);
  }
  function updateStudioDraft(update: React.SetStateAction<StudioDraft>) {
    if (!studioCanDuplicate) return;
    const current = draftRef.current;
    const next = typeof update === "function" ? update(current) : update;
    if (next !== current) syncStudioDraft(next);
  }
  function commitStudioDraft(update: React.SetStateAction<StudioDraft>, label: string, source: "prompt" | "visual", createdAt = new Date().toISOString()) {
    if (!studioCanDuplicate) return false;
    const before = draftRef.current;
    const after = typeof update === "function" ? update(before) : update;
    if (studioSnapshotsEqual(snapshotStudioDraft(before), snapshotStudioDraft(after))) {
      if (after !== before) syncStudioDraft(after);
      return false;
    }
    syncStudioDraft(after);
    syncStudioTimeline(recordStudioRevision(studioTimelineRef.current, before, after, { label, source, createdAt }));
    return true;
  }
  function checkpointStudioDraft(before: StudioDraft, action: StudioEditAction, message: string) {
    if (!studioCanDuplicate) return;
    const createdAt = new Date().toISOString();
    const current = draftRef.current;
    if (studioSnapshotsEqual(snapshotStudioDraft(before), snapshotStudioDraft(current))) return;
    const after = appendStudioHistory(current, { role: "studio", source: "visual", action, message }, createdAt);
    syncStudioDraft(after);
    syncStudioTimeline(recordStudioRevision(studioTimelineRef.current, before, after, { label: message, source: "visual", createdAt }));
  }
  function travelStudioTimeline(direction: "undo" | "redo") {
    if (!studioCanDuplicate) return;
    const step = stepStudioTimeline(studioTimelineRef.current, direction);
    if (!step) return;
    const createdAt = new Date().toISOString();
    const restored = appendStudioHistory(applyStudioSnapshot(draftRef.current, step.snapshot, createdAt), {
      role: "studio", source: "visual", action: direction === "undo" ? "undo_applied" : "redo_applied",
      message: direction === "undo"
        ? (locale === "en" ? `Undo: ${step.revision.label}` : `Отмена: ${step.revision.label}`)
        : (locale === "en" ? `Redo: ${step.revision.label}` : `Повтор: ${step.revision.label}`),
    }, createdAt);
    syncStudioDraft(restored);
    syncStudioTimeline(step.timeline);
    if (!restored.nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(restored.nodes[0]?.id ?? null);
    showSessionNotice(direction === "undo" ? (locale === "en" ? "Last Studio change undone" : "Последняя правка отменена") : (locale === "en" ? "Studio change restored" : "Правка повторена"));
  }
  function restoreStudioRevision(revision: StudioRevision) {
    if (!studioCanDuplicate) return;
    const createdAt = new Date().toISOString();
    const before = draftRef.current;
    let after = applyStudioSnapshot(before, revision.after, createdAt);
    if (studioSnapshotsEqual(snapshotStudioDraft(before), snapshotStudioDraft(after))) return;
    after = appendStudioHistory(after, { role: "studio", source: "visual", action: "revision_restored", message: locale === "en" ? `Restored session revision: ${revision.label}` : `Восстановлена версия сессии: ${revision.label}` }, createdAt);
    syncStudioDraft(after);
    syncStudioTimeline(recordStudioRevision(studioTimelineRef.current, before, after, { label: locale === "en" ? `Restore: ${revision.label}` : `Откат: ${revision.label}`, source: "visual", createdAt }));
    if (!after.nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(after.nodes[0]?.id ?? null);
    showSessionNotice(locale === "en" ? "Revision restored as a new change" : "Версия восстановлена как новая правка");
  }

  function navigate(next: View) {
    setView(studioOnly && next !== "play" ? "studio" : next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function restoreFromServerSession(session: ServerPlaySession, scenario: Scenario) {
    const latestTimeAdvance = Math.max(0, ...(session.state.timeAdvances ?? []).map((item) => item.sequence));
    const restoredLog = session.state.decisions.flatMap((decision, index) => {
      const sourceStage = scenario.stages.find((item) => item.id === decision.stageId);
      const sourceOption = sourceStage?.options.find((option) => option.id === decision.optionId);
      if (!sourceStage || !sourceOption) return [];
      const nextStageId = session.state.decisions[index + 1]?.stageId ?? session.state.currentStageId;
      const exactOutcome = scenario.mobileParity && index === session.state.decisions.length - 1 && decision.sequence > latestTimeAdvance ? session.state.canonicalOutcome : undefined;
      const option = scenario.mobileParity ? {
        ...sourceOption,
        nextStageId,
        resolvedOutcome: exactOutcome,
        result: exactOutcome?.summary ?? { en: "Canonical action completed. The authoritative state was updated.", ru: "Каноническое действие выполнено. Авторитетное состояние обновлено." },
      } : { ...sourceOption, nextStageId };
      return [{ stageId: sourceStage.id, stage: local(sourceStage.headline, locale), option }];
    });
    const restoredStageIndex = scenario.stages.findIndex((item) => item.id === session.state.currentStageId);
    localCanonicalRuntimeRef.current = null;
    setLocalCanonicalState(null);
    setServerPlaySession(session);
    setMetrics(session.state.metrics);
    setCaseMinute(session.state.clockMinute);
    setActionUseCounts(session.state.actionUseCounts);
    setCompletedDeadlineIds(session.state.completedDeadlineIds);
    setMissedDeadlineIds(session.state.missedDeadlineIds);
    setDecisionLog(restoredLog);
    setStageIndex(restoredStageIndex >= 0 ? restoredStageIndex : 0);
    setOutcome(session.state.outcome);
    setDossierRef(scenario.stages[restoredStageIndex]?.materialRefs[0] ?? scenario.materials[0]?.ref ?? null);
  }
  function storeLocalCanonicalRuntime(runtime: CanonicalRuntimeState, runtimeModule: CanonicalRuntimeModule, decisions = localCanonicalState?.decisions ?? [], timeAdvances = localCanonicalState?.timeAdvances ?? []) {
    const presentation = runtimeModule.canonicalPresentationState(runtime);
    const state = clientCanonicalState(runtime, presentation, runtimeModule.canonicalOutcomeClass(presentation.outcomeId), runtimeModule.canonicalOutcomePresentation(runtime.caseId, presentation.outcomeId), decisions, timeAdvances);
    localCanonicalRuntimeRef.current = runtime;
    setLocalCanonicalState(state);
    return state;
  }
  function restoreLocalCanonicalView(state: ServerPlaySessionState, scenario: Scenario) {
    setMetrics(state.metrics);
    setCaseMinute(state.clockMinute);
    setActionUseCounts(state.actionUseCounts);
    setCompletedDeadlineIds(state.completedDeadlineIds);
    setMissedDeadlineIds(state.missedDeadlineIds);
    const nextStageIndex = scenario.stages.findIndex((item) => item.id === state.currentStageId);
    setStageIndex(nextStageIndex >= 0 ? nextStageIndex : 0);
    setOutcome(state.outcome);
    const visibleMaterial = scenario.materials.find((material) => state.availableEvidenceIds?.includes(material.ref));
    setDossierRef(visibleMaterial?.ref ?? scenario.materials[0]?.ref ?? null);
  }
  async function beginLocalCanonicalSession(scenario: Scenario, requestVersion: number) {
    if (!scenario.mobileParity) return false;
    try {
      const runtimeModule = await import("./canonical-runtime");
      if (requestVersion !== playSessionStartRef.current) return false;
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const runtime = runtimeModule.createCanonicalRuntime(scenario.caseId, seed);
      const state = storeLocalCanonicalRuntime(runtime, runtimeModule, [], []);
      setServerPlaySession(null);
      setDecisionLog([]);
      restoreLocalCanonicalView(state, scenario);
      setPlaySessionSync("local");
      return true;
    } catch {
      return false;
    }
  }
  async function beginServerPlaySession(scenario: Scenario, requestVersion: number) {
    try {
      const response = await fetch("/api/play-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", caseId: scenario.caseId, version: scenario.version, fingerprint: scenario.fingerprint }),
      });
      if (requestVersion !== playSessionStartRef.current) return;
      if (response.status === 401 || response.status === 404) {
        if (await beginLocalCanonicalSession(scenario, requestVersion)) return;
        setPlaySessionSync("local");
        return;
      }
      const payload = await response.json().catch(() => null) as { session?: unknown } | null;
      const session = normalizeServerPlaySession(payload?.session);
      if (!response.ok || !session || session.caseId !== scenario.caseId || session.version !== scenario.version || session.fingerprint !== scenario.fingerprint) {
        if (!await beginLocalCanonicalSession(scenario, requestVersion)) setPlaySessionSync("error");
        return;
      }
      restoreFromServerSession(session, scenario);
      setPlaySessionSync("server");
    } catch {
      if (requestVersion === playSessionStartRef.current && !await beginLocalCanonicalSession(scenario, requestVersion)) setPlaySessionSync("error");
    }
  }
  function startScenario(scenario: Scenario, options: { legacyTiming?: boolean } = {}) {
    const sessionRequestVersion = playSessionStartRef.current + 1;
    playSessionStartRef.current = sessionRequestVersion;
    const initialIndex = Math.max(0, scenario.stages.findIndex((item) => item.id === scenario.initialStageId));
    setActiveScenario(scenario); setStageIndex(initialIndex); setMetrics({ ...initialMetrics }); setDecisionLog([]);
    setCaseMinute(scenario.initialClockMinute); setActionUseCounts({}); setCompletedDeadlineIds([]); setMissedDeadlineIds([]);
    localCanonicalRuntimeRef.current = null; setLocalCanonicalState(null); setServerPlaySession(null); setPlaySessionSync("opening"); setPlaySessionBusy(false);
    setLegacyTimingMode(options.legacyTiming === true);
    setOutcome(null); setSelectedOption(null); setResultOption(null); setDossierRef(scenario.materials[0]?.ref ?? null); navigate("play");
    void beginServerPlaySession(scenario, sessionRequestVersion);
  }
  async function launchCatalogueCase(record: PublishedCaseSummary) {
    const launchRequestVersion = catalogueLaunchRef.current + 1;
    catalogueLaunchRef.current = launchRequestVersion;
    const cached = catalogueScenarios.find((scenario) => scenario.caseId === record.id && scenario.version === record.currentVersion && scenario.fingerprint === record.fingerprint);
    if (cached) { setCatalogueLoading(false); startScenario(cached); return; }
    setCatalogueLoading(true);
    let manifestResponseStatus: number | null = null;
    try {
      const response = await fetch(`/api/catalog/${encodeURIComponent(record.id)}?version=${encodeURIComponent(record.currentVersion)}`);
      manifestResponseStatus = response.status;
      const item = await readJsonResponse<unknown>(response);
      if (!isRecord(item) || !isRecord(item.payload) || item.payload.kind !== "playable-scenario-v1") throw new Error("Published manifest unavailable");
      const scenario = normalizePlayableScenario(item.payload.scenario);
      if (scenario.caseId !== record.id || scenario.version !== record.currentVersion || scenario.fingerprint !== record.fingerprint || playableFingerprint(scenario) !== scenario.fingerprint) throw new Error("Published manifest identity mismatch");
      if (launchRequestVersion !== catalogueLaunchRef.current) return;
      setCatalogueScenarios((current) => {
        const withoutVersion = current.filter((existing) => existing.caseId !== scenario.caseId || existing.version !== scenario.version);
        return [...withoutVersion, scenario].sort((left, right) => left.order - right.order);
      });
      startScenario(scenario);
    } catch {
      if (launchRequestVersion !== catalogueLaunchRef.current) return;
      if (mayUseBundledCatalogueFallback(manifestResponseStatus)) {
        try {
          const { scenarios: bundledScenarios } = await import("./scenarios");
          if (launchRequestVersion !== catalogueLaunchRef.current) return;
          const fallback = bundledScenarios.find((scenario) => scenario.caseId === record.id && scenario.version === record.currentVersion && scenario.fingerprint === record.fingerprint);
          if (fallback && playableFingerprint(fallback) === fallback.fingerprint) {
            setCatalogueScenarios((current) => [...current.filter((scenario) => scenario.caseId !== fallback.caseId || scenario.version !== fallback.version), fallback].sort((left, right) => left.order - right.order));
            startScenario(fallback);
            showSessionNotice(locale === "en" ? "The network manifest was unavailable; the exact bundled version was opened." : "Сетевой манифест недоступен; открыта точная встроенная версия.");
            return;
          }
        } catch {
          // Keep the case closed when neither the versioned API nor the exact
          // integrity-checked bundled compatibility copy is available.
        }
      }
      showSessionNotice(locale === "en" ? "This exact published case version could not be loaded." : "Не удалось загрузить точную опубликованную версию кейса.");
    } finally {
      if (launchRequestVersion === catalogueLaunchRef.current) setCatalogueLoading(false);
    }
  }
  async function dispatchDecision() {
    if (!selectedOption || !stage || !activeScenario) return;
    if (playSessionSync === "opening") {
      showSessionNotice(locale === "en" ? "The server run is still opening. Try again in a moment." : "Серверное прохождение ещё запускается. Повторите через мгновение.");
      setSelectedOption(null);
      return;
    }
    const selectedUseKey = actionUseKey(selectedOption);
    const canonicalAvailable = !activeScenario.mobileParity || Boolean(
      selectedOption.canonicalActionId
      && canonicalPlayState?.availableActionIds?.includes(selectedOption.canonicalActionId),
    );
    if (!canonicalAvailable || (!activeScenario.mobileParity && !decisionAvailability(selectedOption, metrics, actionUseCounts[selectedUseKey] ?? 0).available)) {
      showSessionNotice(locale === "en" ? "This action is not available under the current rules." : "Действие недоступно при текущем состоянии правил.");
      setSelectedOption(null);
      return;
    }
    const updated = { ...metrics };
    (Object.keys(selectedOption.effects) as MetricKey[]).forEach((key) => { updated[key] = clamp(updated[key] + (selectedOption.effects[key] ?? 0)); });
    const timing = legacyTimingMode
      ? resolveLegacyDecisionTiming(activeScenario, caseMinute, selectedOption, completedDeadlineIds, missedDeadlineIds)
      : resolveDecisionTiming(activeScenario, caseMinute, selectedOption, completedDeadlineIds, missedDeadlineIds);
    if (timing.newlyMissedDeadlineIds.length > 0) {
      updated.exposure = clamp(updated.exposure + timing.newlyMissedDeadlineIds.length * 8);
      updated.trust = clamp(updated.trust - timing.newlyMissedDeadlineIds.length * 4);
    }
    const selected = selectedOption;
    const sourceStage = stage;
    const applyTransition = (nextMetrics: Record<MetricKey, number>, transitionMinute: number, nextCompleted: string[], nextMissed: string[], nextUses: Record<string, number>, nextStageId: string, authoritativeOutcome?: ServerPlaySessionState["canonicalOutcome"]) => {
      const deadlineReroute = nextStageId !== selected.nextStageId;
      const dispatchedOption: DecisionOption = activeScenario.mobileParity ? {
        ...selected,
        nextStageId,
        resolvedOutcome: authoritativeOutcome,
        result: authoritativeOutcome?.summary ?? {
          en: "Canonical action completed. The authoritative stage, clock and resources were updated.",
          ru: "Каноническое действие выполнено. Авторитетные стадия, время и ресурсы обновлены.",
        },
      } : deadlineReroute ? {
        ...selected,
        nextStageId,
        result: {
          en: `${selected.result.en} A controlling deadline changed the route to ${activeScenario.stages.find((item) => item.id === nextStageId)?.headline.en ?? nextStageId}.`,
          ru: `${selected.result.ru} Контрольный срок изменил маршрут дела на стадию «${activeScenario.stages.find((item) => item.id === nextStageId)?.headline.ru ?? nextStageId}».`,
        },
      } : { ...selected, nextStageId };
      setMetrics(nextMetrics);
      setCaseMinute(transitionMinute);
      setCompletedDeadlineIds(nextCompleted);
      setMissedDeadlineIds(nextMissed);
      setActionUseCounts(nextUses);
      setDecisionLog((current) => [...current, { stageId: sourceStage.id, stage: local(sourceStage.headline, locale), option: dispatchedOption }]);
      setResultOption(dispatchedOption);
      setSelectedOption(null);
    };

    const activeServerSession = serverPlaySession && serverPlaySession.status === "active"
      && serverPlaySession.caseId === activeScenario.caseId
      && serverPlaySession.version === activeScenario.version
      && serverPlaySession.fingerprint === activeScenario.fingerprint
      ? serverPlaySession : null;
    if (activeServerSession) {
      setPlaySessionBusy(true);
      try {
        const response = await fetch("/api/play-sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "decision", sessionKey: activeServerSession.sessionKey, expectedRevision: activeServerSession.revision, eventId: crypto.randomUUID(), optionId: selected.id }),
        });
        const payload = await response.json().catch(() => null) as { session?: unknown; error?: string; code?: string } | null;
        const authoritative = normalizeServerPlaySession(payload?.session);
        if (response.ok && authoritative) {
          setServerPlaySession(authoritative);
          setPlaySessionSync("server");
          applyTransition(authoritative.state.metrics, authoritative.state.clockMinute, authoritative.state.completedDeadlineIds, authoritative.state.missedDeadlineIds, authoritative.state.actionUseCounts, authoritative.state.currentStageId, authoritative.state.canonicalOutcome);
          return;
        }
        if (response.status === 409 && payload?.code === "stale_session" && authoritative) {
          restoreFromServerSession(authoritative, activeScenario);
          setSelectedOption(null); setResultOption(null); setPlaySessionSync("stale");
          showSessionNotice(locale === "en" ? "This run changed in another tab; the server state has been restored." : "Прохождение изменилось в другой вкладке; восстановлено состояние сервера.");
          return;
        }
        setPlaySessionSync("error");
        showSessionNotice(payload?.error ?? (locale === "en" ? "The server could not record this decision. Retry without closing the review." : "Сервер не смог зафиксировать решение. Повторите, не закрывая окно."));
        return;
      } catch {
        setPlaySessionSync("error");
        showSessionNotice(locale === "en" ? "The run could not be synchronised. Retry when the connection is restored." : "Не удалось синхронизировать прохождение. Повторите после восстановления соединения.");
        return;
      } finally {
        setPlaySessionBusy(false);
      }
    }

    if (activeScenario.mobileParity && localCanonicalRuntimeRef.current && selected.canonicalActionId) {
      setPlaySessionBusy(true);
      try {
        const runtimeModule = await import("./canonical-runtime");
        const runtime = runtimeModule.dispatchCanonicalAction(localCanonicalRuntimeRef.current, selected.canonicalActionId);
        const currentDecisions = localCanonicalState?.decisions ?? [];
        const currentAdvances = localCanonicalState?.timeAdvances ?? [];
        const nextSequence = Math.max(0, ...currentDecisions.map((item) => item.sequence), ...currentAdvances.map((item) => item.sequence)) + 1;
        const nextState = storeLocalCanonicalRuntime(runtime, runtimeModule, [...currentDecisions, { sequence: nextSequence, stageId: sourceStage.id, optionId: selected.id }], currentAdvances);
        applyTransition(nextState.metrics, nextState.clockMinute, nextState.completedDeadlineIds, nextState.missedDeadlineIds, nextState.actionUseCounts, nextState.currentStageId, nextState.canonicalOutcome);
        return;
      } catch {
        showSessionNotice(locale === "en" ? "The canonical action could not be applied." : "Не удалось применить каноническое действие.");
        return;
      } finally {
        setPlaySessionBusy(false);
      }
    }
    if (activeScenario.mobileParity) {
      showSessionNotice(locale === "en" ? "The canonical runtime is still unavailable." : "Канонический расчёт пока недоступен.");
      return;
    }

    const localNextStageId = timing.nextStageId ?? selected.nextStageId;
    if (!localNextStageId) {
      showSessionNotice(locale === "en" ? "The authored action has no valid destination." : "Для действия не задан корректный следующий этап.");
      return;
    }
    applyTransition(
      updated,
      timing.transitionMinute,
      timing.completedDeadlineIds,
      Array.from(new Set([...missedDeadlineIds, ...timing.newlyMissedDeadlineIds])),
      { ...actionUseCounts, [selectedUseKey]: (actionUseCounts[selectedUseKey] ?? 0) + 1 },
      localNextStageId,
    );
  }
  async function advanceCaseTime(minutes: number) {
    if (!activeScenario?.mobileParity?.foregroundClock || playSessionBusy) return;
    if ((!serverPlaySession || serverPlaySession.status !== "active") && localCanonicalRuntimeRef.current) {
      setPlaySessionBusy(true);
      try {
        const runtimeModule = await import("./canonical-runtime");
        const runtime = runtimeModule.advanceCanonicalTime(localCanonicalRuntimeRef.current, minutes);
        const currentDecisions = localCanonicalState?.decisions ?? [];
        const currentAdvances = localCanonicalState?.timeAdvances ?? [];
        const nextSequence = Math.max(0, ...currentDecisions.map((item) => item.sequence), ...currentAdvances.map((item) => item.sequence)) + 1;
        const state = storeLocalCanonicalRuntime(runtime, runtimeModule, currentDecisions, [...currentAdvances, { sequence: nextSequence, minutes }]);
        restoreLocalCanonicalView(state, activeScenario);
        showSessionNotice(locale === "en" ? `Case clock advanced by ${minutes / 60}h.` : `Время дела продвинуто на ${minutes / 60} ч.`);
      } catch {
        showSessionNotice(locale === "en" ? "The case clock could not be advanced." : "Не удалось продвинуть время дела.");
      } finally {
        setPlaySessionBusy(false);
      }
      return;
    }
    if (!serverPlaySession || serverPlaySession.status !== "active") return;
    setPlaySessionBusy(true);
    try {
      const response = await fetch("/api/play-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "advance_time", sessionKey: serverPlaySession.sessionKey, expectedRevision: serverPlaySession.revision, eventId: crypto.randomUUID(), minutes }),
      });
      const payload = await response.json().catch(() => null) as { session?: unknown; error?: string; code?: string } | null;
      const authoritative = normalizeServerPlaySession(payload?.session);
      if (response.ok && authoritative) {
        restoreFromServerSession(authoritative, activeScenario);
        setPlaySessionSync("server");
        showSessionNotice(locale === "en" ? `Case clock advanced by ${minutes / 60}h.` : `Время дела продвинуто на ${minutes / 60} ч.`);
        return;
      }
      if (response.status === 409 && payload?.code === "stale_session" && authoritative) {
        restoreFromServerSession(authoritative, activeScenario);
        setPlaySessionSync("stale");
        showSessionNotice(locale === "en" ? "The server state changed and was restored." : "Состояние сервера изменилось и было восстановлено.");
        return;
      }
      setPlaySessionSync("error");
      showSessionNotice(payload?.error ?? (locale === "en" ? "The case clock could not be advanced." : "Не удалось продвинуть время дела."));
    } catch {
      setPlaySessionSync("error");
      showSessionNotice(locale === "en" ? "The case clock could not be synchronised." : "Не удалось синхронизировать время дела.");
    } finally {
      setPlaySessionBusy(false);
    }
  }
  function advanceStage() {
    if (!activeScenario) return; setResultOption(null);
    const nextStageId = resultOption?.nextStageId;
    if (!nextStageId) return;
    const nextIndex = activeScenario.stages.findIndex((item) => item.id === nextStageId);
    if (nextIndex < 0) return;
    setStageIndex(nextIndex);
    if (activeScenario.stages[nextIndex].terminal) setOutcome(canonicalPlayState?.outcome ?? resultOption?.resolvedOutcome?.classification ?? activeScenario.stages[nextIndex].terminalOutcome ?? classifyOutcome(metrics));
  }
  function showSessionNotice(message: string) {
    setSessionNotice(message);
    window.setTimeout(() => setSessionNotice(null), 3200);
  }
  function exportPlayedCase() {
    if (!activeScenario) return;
    const displayedDecisions = decisionLog.map((entry, index) => {
      const sourceStage = activeScenario.stages.find((item) => item.id === entry.stageId);
      const sourceOption = sourceStage?.options.find((option) => option.id === entry.option.id);
      if (!sourceStage || !sourceOption) throw new Error("The current decision log does not match the scenario catalogue.");
      return { sequence: index + 1, stageId: sourceStage.id, optionId: sourceOption.id };
    });
    const canonicalRuntime = activeScenario.mobileParity
      ? serverPlaySession?.caseId === activeScenario.caseId && serverPlaySession.version === activeScenario.version && serverPlaySession.fingerprint === activeScenario.fingerprint
        ? { mode: "server-session" as const, sessionKey: serverPlaySession.sessionKey, expectedRevision: serverPlaySession.revision }
        : localCanonicalRuntimeRef.current && localCanonicalState
          ? {
              mode: "local-replay" as const,
              seed: localCanonicalRuntimeRef.current.seed,
              commands: [
                ...(localCanonicalState.decisions ?? []).map((item) => ({ ...item, kind: "decision" as const })),
                ...(localCanonicalState.timeAdvances ?? []).map((item) => ({ ...item, kind: "advance_time" as const })),
              ].sort((left, right) => left.sequence - right.sequence),
            }
          : undefined
      : undefined;
    if (activeScenario.mobileParity && !canonicalRuntime) {
      showSessionNotice(locale === "en" ? "This canonical run is not available for exact export." : "Это каноническое прохождение недоступно для точного экспорта.");
      return;
    }
    const decisions = activeScenario.mobileParity ? canonicalPlayState?.decisions ?? [] : displayedDecisions;
    const exportedOutcome = activeScenario.mobileParity ? canonicalPlayState?.outcome ?? null : outcome;
    const payload: PlayedCaseFile = {
      format: "genesis-juris-played-case",
      schemaVersion: activeScenario.mobileParity ? PLAYED_CASE_SCHEMA_REVISION : 2,
      exportedAt: new Date().toISOString(),
      scenario: {
        id: activeScenario.id,
        caseId: activeScenario.caseId,
        contentVersion: activeScenario.version,
        fingerprint: activeScenario.fingerprint,
      },
      playthrough: {
        status: exportedOutcome ? "completed" : "in_progress",
        currentStageId: activeScenario.mobileParity ? canonicalPlayState?.currentStageId ?? activeScenario.stages[stageIndex].id : activeScenario.stages[stageIndex].id,
        clockMinute: activeScenario.mobileParity ? canonicalPlayState?.clockMinute ?? caseMinute : caseMinute,
        decisions,
        derivedMetrics: activeScenario.mobileParity ? canonicalPlayState?.metrics ?? metrics : metrics,
        outcome: exportedOutcome,
        canonicalRuntime,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeScenario.id}-played-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function importPlayedCase(file: File) {
    if (file.size > 1_000_000) { window.alert(text.invalidPlay); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isRecord(parsed) || parsed.format !== "genesis-juris-played-case" || !isSupportedPlayedCaseSchemaRevision(parsed.schemaVersion)) throw new Error("Unsupported played-case schema");
        if (!isRecord(parsed.scenario) || !isRecord(parsed.playthrough)) throw new Error("Missing played-case sections");
        const scenarioFile = parsed.scenario;
        const playthroughFile = parsed.playthrough;

        const { requirePlayedCaseServerSession, resolvePlayedCaseScenario } = await import("./played-case-loader");
        const resolvedScenario = await resolvePlayedCaseScenario({ id: scenarioFile.id, caseId: scenarioFile.caseId, contentVersion: scenarioFile.contentVersion, fingerprint: scenarioFile.fingerprint }, catalogueScenarios);
        const importedScenario = resolvedScenario.scenario;
        const legacyMode = resolvedScenario.legacyTiming;

        const importedDecisions = playthroughFile.decisions;
        const importedStatus = playthroughFile.status;
        const currentStageId = playthroughFile.currentStageId;
        if (!Array.isArray(importedDecisions) || (importedStatus !== "in_progress" && importedStatus !== "completed") || typeof currentStageId !== "string") {
          throw new Error("Invalid playthrough state");
        }
        if (parsed.schemaVersion === PLAYED_CASE_SCHEMA_REVISION && importedScenario.mobileParity) {
          const descriptor = playthroughFile.canonicalRuntime;
          if (!isRecord(descriptor)) throw new Error("Missing canonical replay descriptor");
          if (descriptor.mode === "server-session"
            && typeof descriptor.sessionKey === "string"
            && typeof descriptor.expectedRevision === "number"
            && Number.isSafeInteger(descriptor.expectedRevision)
            && descriptor.expectedRevision >= 0) {
            const response = await fetch(`/api/play-sessions?sessionKey=${encodeURIComponent(descriptor.sessionKey)}&purpose=import&expectedRevision=${descriptor.expectedRevision}`, {
              cache: "no-store",
              headers: { "X-GENESIS-Expected-Fingerprint": importedScenario.fingerprint },
            });
            const body = await response.json().catch(() => null) as { session?: unknown } | null;
            const session = normalizeServerPlaySession(body?.session);
            const exactSession = requirePlayedCaseServerSession(response.ok, session, importedScenario, descriptor.sessionKey, descriptor.expectedRevision);
            setActiveScenario(importedScenario);
            setFeaturedId(importedScenario.caseId);
            playSessionStartRef.current += 1;
            setLegacyTimingMode(false);
            setSelectedOption(null);
            setResultOption(null);
            restoreFromServerSession(exactSession, importedScenario);
            setPlaySessionSync("server");
            navigate("play");
            showSessionNotice(text.importedPlay);
            return;
          }
          if (descriptor.mode !== "local-replay" || typeof descriptor.seed !== "number" || !Number.isSafeInteger(descriptor.seed) || descriptor.seed < 0 || !Array.isArray(descriptor.commands) || descriptor.commands.length > 1_000) throw new Error("Invalid canonical replay descriptor");
          const runtimeModule = await import("./canonical-runtime");
          let runtime = runtimeModule.createCanonicalRuntime(importedScenario.caseId, descriptor.seed);
          const restoredLog: DecisionRecord[] = [];
          const canonicalDecisions: ServerPlaySessionState["decisions"] = [];
          const canonicalAdvances: NonNullable<ServerPlaySessionState["timeAdvances"]> = [];
          for (const [index, command] of descriptor.commands.entries()) {
            if (!isRecord(command) || command.sequence !== index + 1) throw new Error("Invalid canonical command sequence");
            if (command.kind === "decision" && typeof command.stageId === "string" && typeof command.optionId === "string") {
              const sourceStage = importedScenario.stages.find((item) => item.id === runtime.stageId);
              const sourceOption = sourceStage?.options.find((option) => option.id === command.optionId);
              if (!sourceStage || sourceStage.id !== command.stageId || !sourceOption?.canonicalActionId) throw new Error("Canonical decision mismatch");
              runtime = runtimeModule.dispatchCanonicalAction(runtime, sourceOption.canonicalActionId);
              const presentation = runtimeModule.canonicalPresentationState(runtime);
              const exactOutcome = runtimeModule.canonicalOutcomePresentation(runtime.caseId, presentation.outcomeId);
              restoredLog.push({
                stageId: sourceStage.id,
                stage: local(sourceStage.headline, locale),
                option: {
                  ...sourceOption,
                  nextStageId: presentation.currentStageId,
                  resolvedOutcome: exactOutcome,
                  result: exactOutcome?.summary ?? { en: "Canonical action completed. The authoritative state was updated.", ru: "Каноническое действие выполнено. Авторитетное состояние обновлено." },
                },
              });
              canonicalDecisions.push({ sequence: command.sequence, stageId: sourceStage.id, optionId: sourceOption.id });
            } else if (command.kind === "advance_time" && typeof command.minutes === "number" && Number.isInteger(command.minutes) && command.minutes > 0 && command.minutes <= 1_440) {
              runtime = runtimeModule.advanceCanonicalTime(runtime, command.minutes);
              canonicalAdvances.push({ sequence: command.sequence, minutes: command.minutes });
            } else {
              throw new Error("Invalid canonical command");
            }
          }
          const presentation = runtimeModule.canonicalPresentationState(runtime);
          const restoredOutcome = runtimeModule.canonicalOutcomeClass(presentation.outcomeId);
          const exportedOutcome = playthroughFile.outcome === "strong" || playthroughFile.outcome === "mixed" || playthroughFile.outcome === "weak" ? playthroughFile.outcome : null;
          if (presentation.currentStageId !== currentStageId || presentation.clockMinute !== playthroughFile.clockMinute || restoredOutcome !== exportedOutcome || Boolean(restoredOutcome) !== (importedStatus === "completed")) throw new Error("Canonical replay snapshot mismatch");
          setActiveScenario(importedScenario);
          setFeaturedId(importedScenario.caseId);
          playSessionStartRef.current += 1;
          setServerPlaySession(null);
          setLegacyTimingMode(false);
          const state = storeLocalCanonicalRuntime(runtime, runtimeModule, canonicalDecisions, canonicalAdvances);
          restoreLocalCanonicalView(state, importedScenario);
          setDecisionLog(restoredLog);
          setSelectedOption(null);
          setResultOption(null);
          setPlaySessionSync("local");
          navigate("play");
          showSessionNotice(text.importedPlay);
          return;
        }
        const restoredMetrics = { ...initialMetrics };
        const restoredLog: DecisionRecord[] = [];
        const restoredActionUses: Record<string, number> = {};
        const restoredCompletedDeadlines: string[] = [];
        const restoredMissedDeadlines: string[] = [];
        let restoredMinute = importedScenario.initialClockMinute;
        let restoredStageId = importedScenario.initialStageId;
        importedDecisions.forEach((decision, index) => {
          if (!isRecord(decision) || decision.sequence !== index + 1) throw new Error("Invalid decision sequence");
          const sourceStage = importedScenario.stages.find((item) => item.id === restoredStageId);
          if (!sourceStage || decision.stageId !== sourceStage.id || typeof decision.optionId !== "string") throw new Error("Decision stage mismatch");
          const sourceOption = sourceStage.options.find((option) => option.id === decision.optionId);
          if (!sourceOption) throw new Error("Decision option is not in the current catalogue");
          const useKey = actionUseKey(sourceOption);
          const priorUses = restoredActionUses[useKey] ?? 0;
          if (!decisionAvailability(sourceOption, restoredMetrics, priorUses).available) throw new Error("Decision was not available under the authored rules");
          restoredActionUses[useKey] = priorUses + 1;
          (Object.keys(sourceOption.effects) as MetricKey[]).forEach((key) => {
            restoredMetrics[key] = clamp(restoredMetrics[key] + (sourceOption.effects[key] ?? 0));
          });
          const timing = legacyMode
            ? resolveLegacyDecisionTiming(importedScenario, restoredMinute, sourceOption, restoredCompletedDeadlines, restoredMissedDeadlines)
            : resolveDecisionTiming(importedScenario, restoredMinute, sourceOption, restoredCompletedDeadlines, restoredMissedDeadlines);
          restoredMinute = timing.transitionMinute;
          restoredCompletedDeadlines.splice(0, restoredCompletedDeadlines.length, ...timing.completedDeadlineIds);
          restoredMissedDeadlines.push(...timing.newlyMissedDeadlineIds);
          if (timing.newlyMissedDeadlineIds.length > 0) {
            restoredMetrics.exposure = clamp(restoredMetrics.exposure + timing.newlyMissedDeadlineIds.length * 8);
            restoredMetrics.trust = clamp(restoredMetrics.trust - timing.newlyMissedDeadlineIds.length * 4);
          }
          const restoredOption = timing.forcedStageId ? { ...sourceOption, nextStageId: timing.nextStageId } : sourceOption;
          restoredLog.push({ stageId: sourceStage.id, stage: local(sourceStage.headline, locale), option: restoredOption });
          restoredStageId = timing.nextStageId ?? restoredStageId;
        });

        const restoredStageIndex = importedScenario.stages.findIndex((item) => item.id === restoredStageId);
        if (restoredStageIndex < 0) throw new Error("Current stage is not in the scenario");
        const completed = importedStatus === "completed";
        if (currentStageId !== restoredStageId || (completed && !importedScenario.stages[restoredStageIndex].terminal) || (!completed && importedScenario.stages[restoredStageIndex].terminal)) throw new Error("Playthrough progress is inconsistent");

        setActiveScenario(importedScenario);
        setFeaturedId(importedScenario.caseId);
        playSessionStartRef.current += 1;
        localCanonicalRuntimeRef.current = null;
        setLocalCanonicalState(null);
        setServerPlaySession(null);
        setPlaySessionSync("local");
        setPlaySessionBusy(false);
        setLegacyTimingMode(legacyMode);
        setStageIndex(restoredStageIndex);
        setMetrics(restoredMetrics);
        setDecisionLog(restoredLog);
        setCaseMinute(restoredMinute);
        setActionUseCounts(restoredActionUses);
        setCompletedDeadlineIds(restoredCompletedDeadlines);
        setMissedDeadlineIds(restoredMissedDeadlines);
        setOutcome(completed ? classifyOutcome(restoredMetrics) : null);
        setSelectedOption(null);
        setResultOption(null);
        setDossierRef(importedScenario.materials[0]?.ref ?? null);
        navigate("play");
        showSessionNotice(text.importedPlay);
      } catch {
        window.alert(text.invalidPlay);
      }
    };
    reader.readAsText(file);
  }
  function generateDraft() {
    const clean = prompt.trim();
    if (!clean) return;
    // This fallback is intentionally content-neutral. The intake remains in
    // governed prompt history, while every report-visible field starts as a
    // generic template that the author must review and replace deliberately.
    const shortTitle = "Rule-based legal scenario";
    const nodes: StudioNode[] = [
      { id: "trigger-1", type: "trigger", title: "Define the reviewed trigger", detail: "Replace with an author-reviewed event or instruction.", x: 45, y: 235 },
      { id: "actor-1", type: "actor", title: "Responsible professional", detail: "Identify the accountable author-reviewed actor.", x: 265, y: 65 },
      { id: "actor-2", type: "actor", title: "Relevant counterparty", detail: "Identify the reviewed counterparty, authority or stakeholder.", x: 265, y: 390 },
      { id: "evidence-1", type: "evidence", title: "Preserve the source record", detail: "Identify authoritative documents and physical evidence.", x: 300, y: 235 },
      { id: "deadline-1", type: "deadline", title: "Procedural response window", detail: "Replace with a verified, source-bound deadline.", x: 515, y: 70 },
      { id: "decision-1", type: "decision", title: "Choose the institutional response", detail: "Create at least two complete, consequential responses.", x: 520, y: 280 },
      { id: "outcome-1", type: "outcome", title: "Position protected", detail: "Evidence and institutional process remain credible.", x: 760, y: 150 },
      { id: "outcome-2", type: "outcome", title: "Position compromised", detail: "The decision creates an open risk.", x: 760, y: 390 },
    ];
    const links = numberedStudioLinks([
      ["trigger-1", "actor-1"], ["trigger-1", "actor-2"], ["trigger-1", "evidence-1"],
      ["actor-1", "deadline-1"], ["evidence-1", "decision-1"], ["deadline-1", "decision-1"],
      ["decision-1", "outcome-1"], ["decision-1", "outcome-2"],
    ]);
    const createdAt = new Date().toISOString();
    let rebuilt: StudioDraft = { caseId: "rule_based_legal_scenario", version: "1.0.0", caseType: caseTypeReference("general_advisory"), parent: null, title: shortTitle, jurisdiction: "Set jurisdiction", role: "Scenario counsel", premise: "", premisePublication: "prompt-derived", classification: { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }, nodes, links, editHistory: [], updatedAt: createdAt };
    rebuilt = appendStudioHistory(rebuilt, { role: "author", source: "prompt", action: "prompt_submitted", message: clean }, createdAt);
    rebuilt = appendStudioHistory(rebuilt, { role: "studio", source: "prompt", action: "graph_rebuilt", message: locale === "en" ? `Built a new ${nodes.length}-node graph from this prompt. The previous draft was replaced by explicit author request.` : `По явной команде автора построен новый граф из ${nodes.length} узлов; предыдущий черновик заменён.` }, createdAt);
    enterNewLocalDraft(rebuilt, "decision-1");
    setPrompt("");
  }
  function applyPromptIteration() {
    if (!studioCanDuplicate) return;
    const clean = prompt.trim();
    if (!clean) return;
    const createdAt = new Date().toISOString();
    const current = draftRef.current;
    const result = applyStudioPromptIteration(current, { instruction: clean, locale, nodeLabels: text.nodeTypes, selectedNodeId, createdAt });
    if (!result.changed) return;
    commitStudioDraft(result.draft, locale === "en" ? `Prompt iteration: ${clean.slice(0, 80)}` : `Итерация промпта: ${clean.slice(0, 80)}`, "prompt", createdAt);
    setPrompt("");
  }
  function applyReviewedAIPlan(plan: StudioPromptPlan, baseFingerprint: string) {
    if (!studioCanDuplicate) return false;
    const current = draftRef.current;
    if (plan.planner !== "ai" || studioAIBaseFingerprint(current) !== baseFingerprint) {
      showSessionNotice(locale === "en" ? "The graph changed after AI analysis. Review a fresh plan before applying it." : "После AI-анализа схема изменилась. Получите и проверьте новый план.");
      return false;
    }
    const createdAt = new Date().toISOString();
    let result;
    try { result = applyValidatedAIStudioPlan(current, { plan, locale, createdAt }); }
    catch {
      showSessionNotice(locale === "en" ? "The reviewed proposal failed the final graph safety check. Analyse the current graph again." : "Проверенное предложение не прошло итоговую проверку безопасности схемы. Проанализируйте текущую схему заново.");
      return false;
    }
    if (!result.changed) return false;
    commitStudioDraft(result.draft, locale === "en" ? `Reviewed AI plan: ${plan.summary?.slice(0, 80) || plan.instruction.slice(0, 80)}` : `Проверенный AI-план: ${plan.summary?.slice(0, 80) || plan.instruction.slice(0, 80)}`, "prompt", createdAt);
    setPrompt("");
    return true;
  }
  function applyCanonicalMarkdownDraft(source: StudioDraft) {
    const createdAt = new Date().toISOString();
    const restored = appendStudioHistory(source, {
      role: "studio",
      source: "prompt",
      action: "graph_rebuilt",
      message: locale === "en"
        ? `Restored the exact fingerprinted graph from a canonical Markdown case description.`
        : `Точная схема восстановлена из канонического Markdown-описания с проверенным отпечатком.`,
    }, createdAt);
    enterNewLocalDraft(restored, restored.nodes.find((node) => node.type === "decision")?.id ?? restored.nodes[0]?.id ?? null);
    setPrompt("");
  }
  function saveDraft() {
    if (!studioStorageScope) {
      showSessionNotice(locale === "en" ? "Device storage is unavailable until the account boundary is verified." : "Локальное сохранение недоступно, пока не подтверждён контур аккаунта.");
      return;
    }
    if (!mayPersistStudioDraftOnDevice({ canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate, draft: draftRef.current })) {
      showSessionNotice(locale === "en" ? "Private, protected and workspace cases stay in the signed-in workspace and are never cached in shared browser storage." : "Приватные, защищённые и workspace-кейсы хранятся только в авторизованном workspace и не кэшируются в общем хранилище браузера.");
      return;
    }
    const next = { ...draftRef.current, updatedAt: new Date().toISOString() }; syncStudioDraft(next);
    window.localStorage.setItem(studioDeviceDraftKey(studioStorageScope), JSON.stringify(deviceDraftEnvelope(studioStorageScope, next)));
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }
  async function exportDraft() {
    if (!studioCanDuplicate) {
      showSessionNotice(locale === "en" ? "This grant allows inspection only; export and copy are not enabled." : "Этот доступ разрешает только просмотр; экспорт и копирование не включены.");
      return;
    }
    if (!draft.title.trim() || draft.nodes.length === 0) {
      showSessionNotice(locale === "en" ? "Add a title and at least one node before exporting." : "Перед экспортом задайте название и добавьте хотя бы один узел.");
      return;
    }
    let normalized: StudioDraft;
    try { normalized = normalizeStudioDraft(draft); } catch {
      showSessionNotice(locale === "en" ? "Resolve the Studio validation prompts before exporting." : "Перед экспортом устраните замечания Studio.");
      return;
    }
    if (!studioServerFingerprint || !studioServerPublicationFingerprint
      || studioServerFingerprint !== caseFingerprint(normalized)
      || studioServerPublicationFingerprint !== casePublicationFingerprint(normalized)) {
      showSessionNotice(locale === "en" ? "Save this exact edited version to the workspace before exporting it." : "Перед экспортом сохраните именно эту отредактированную версию в workspace.");
      return;
    }
    if (!normalized.protection || !/^sha256-[a-f0-9]{64}$/.test(normalized.protection.currentCode) || !/^hmac-sha256-[a-f0-9]{64}$/.test(normalized.protection.seal)) {
      showSessionNotice(locale === "en" ? "Save this exact version to the workspace before exporting its server-sealed JSON." : "Сохраните эту точную версию в workspace перед экспортом JSON с серверной печатью.");
      return;
    }
    const exportedAt = new Date().toISOString();
    const exportedDraft = { ...normalized, updatedAt: exportedAt };
    const resolvedCaseType = exportedDraft.caseType ?? caseTypeReference("general_advisory");
    const { projectCaseCoreV2 } = await import("./case-core");
    const payload: CustomCaseFile = {
      format: "genesis-juris-custom-case",
      schemaVersion: 4,
      exportedAt,
      case: {
        id: normalized.caseId,
        version: normalized.version,
        fingerprint: caseFingerprint(normalized),
        parent: normalized.parent,
        protection: normalized.protection,
        coreSchemaVersion: 2,
        caseType: resolvedCaseType,
        visibility: studioPrivate ? "private" : "restricted",
      },
      core: projectCaseCoreV2(exportedDraft),
      draft: exportedDraft,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${normalized.caseId}-v${normalized.version}.juris-case.json`;
    link.click(); URL.revokeObjectURL(url);
  }
  function importDraft(file: File) {
    if (file.size > 1_000_000) { window.alert(locale === "en" ? "Case files are limited to 1 MB." : "Размер файла кейса ограничен 1 МБ."); return; }
    const reader = new FileReader(); reader.onload = async () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        let imported: StudioDraft;
        let importedPrivate = false;
        let importedCustomCaseId: number | null = null;
        let importedServerFingerprint: string | null = null;
        let importedServerPublicationFingerprint: string | null = null;
        let importedCanDuplicate = true;
        if (isRecord(parsed) && parsed.format === "genesis-juris-custom-case" && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2 || parsed.schemaVersion === 3 || parsed.schemaVersion === 4) && isRecord(parsed.case)) {
          imported = normalizeStudioDraft(parsed.draft);
          const currentFingerprint = caseFingerprint(imported);
          const legacyFingerprint = legacyCaseFingerprintV15(imported);
          if (parsed.case.id !== imported.caseId || parsed.case.version !== imported.version
            || (parsed.case.fingerprint !== currentFingerprint && parsed.case.fingerprint !== legacyFingerprint)) {
            throw new Error("Custom case identity or fingerprint mismatch");
          }
          if (parsed.schemaVersion === 4) {
            const { projectCaseCoreV2 } = await import("./case-core");
            const resolvedCaseType = imported.caseType ?? caseTypeReference("general_advisory");
            if (parsed.case.coreSchemaVersion !== 2 || canonicalFingerprint(parsed.case.caseType) !== canonicalFingerprint(resolvedCaseType)
              || canonicalFingerprint(parsed.core) !== canonicalFingerprint(projectCaseCoreV2(imported))) throw new Error("Case Core or case-type package mismatch");
          }
          if (parsed.schemaVersion === 3 || parsed.schemaVersion === 4) {
            if (!imported.protection || !isRecord(parsed.case.protection) || parsed.case.protection.currentCode !== imported.protection.currentCode || parsed.case.protection.seal !== imported.protection.seal || parsed.case.protection.parentCode !== imported.protection.parentCode || parsed.case.protection.copyPolicy !== imported.protection.copyPolicy) throw new Error("Case protection metadata mismatch");
            const verificationResponse = await fetch("/api/case-protection/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: imported }) });
            const verification = await readJsonResponse<{ valid?: boolean; canDuplicate?: boolean; customCaseId?: number | null; fingerprint?: string; publicationFingerprint?: string }>(verificationResponse);
            if (!verificationResponse.ok || verification?.valid !== true) throw new Error("Case protection seal could not be verified");
            importedCanDuplicate = verification.canDuplicate === true;
            importedCustomCaseId = typeof verification.customCaseId === "number" ? verification.customCaseId : null;
            importedServerFingerprint = typeof verification.fingerprint === "string" ? verification.fingerprint : null;
            importedServerPublicationFingerprint = typeof verification.publicationFingerprint === "string" ? verification.publicationFingerprint : null;
          } else if (imported.protection) throw new Error("Protected metadata requires a sealed v3 export envelope");
          importedPrivate = parsed.case.visibility === "private";
        } else {
          imported = normalizeStudioDraft(parsed);
          if (imported.protection) throw new Error("Protected cases require a sealed v3 export envelope");
        }
        const restored = { ...imported, updatedAt: new Date().toISOString() };
        replaceStudioDraft(restored);
        setStudioPrivate(importedPrivate);
        setStudioCustomCaseId(importedCustomCaseId);
        setStudioCanManagePrivacy(importedCustomCaseId !== null);
        setStudioServerFingerprint(importedServerFingerprint);
        setStudioServerPublicationFingerprint(importedServerPublicationFingerprint);
        setStudioCanDuplicate(importedCanDuplicate);
        setStudioCopyProtectionLocked(imported.protection?.copyProtected === true);
        setPrompt("");
        setSelectedNodeId(restored.nodes[0]?.id ?? null);
        navigate("studio");
        showSessionNotice(importedCanDuplicate ? (locale === "en" ? "Custom case loaded in the visual editor" : "Custom-кейс открыт в визуальном редакторе") : (locale === "en" ? "Protected case seal verified; opened for inspection only" : "Печать защищённого кейса проверена; открыт режим просмотра"));
      } catch { window.alert(locale === "en" ? "This file is not a valid GENESIS: JURIS case draft." : "Файл не является корректным черновиком GENESIS: JURIS."); }
    }; reader.readAsText(file);
  }
  async function openWorkspaceCustomCase(customCaseId: number) {
    const response = await fetch(`/api/custom-cases?id=${customCaseId}`);
    const payload = await readJsonResponse<{ customCase?: { id: number; isPrivate: boolean; canManagePrivacy: boolean; copyProtected: boolean; fingerprint: string; publicationFingerprint: string; access: "owner" | "admin" | "shared" }; draft?: unknown; error?: string }>(response);
    if (!response.ok || !payload?.customCase || !payload.draft) {
      showSessionNotice(locale === "en" ? "The custom case is no longer available" : "Custom-кейс больше недоступен");
      return;
    }
    try {
      const restored = { ...normalizeStudioDraft(payload.draft), updatedAt: new Date().toISOString() };
      replaceStudioDraft(restored);
      setStudioPrivate(payload.customCase.isPrivate === true);
      setStudioCustomCaseId(payload.customCase.id);
      setStudioCanManagePrivacy(payload.customCase.canManagePrivacy === true);
      setStudioServerFingerprint(payload.customCase.fingerprint);
      setStudioServerPublicationFingerprint(payload.customCase.publicationFingerprint);
      setStudioCanDuplicate(payload.customCase.access === "owner" || (payload.customCase.access === "shared" && payload.customCase.copyProtected !== true));
      setStudioCopyProtectionLocked(payload.customCase.copyProtected === true);
      setPrompt("");
      setSelectedNodeId(restored.nodes[0]?.id ?? null);
      navigate("studio");
      showSessionNotice(locale === "en" ? "Workspace case opened in Studio" : "Кейс из workspace открыт в Studio");
    } catch {
      showSessionNotice(locale === "en" ? "The stored case failed integrity validation" : "Сохранённый кейс не прошёл проверку целостности");
    }
  }
  function createChildVersion() {
    if (!studioServerFingerprint || !studioServerPublicationFingerprint) {
      showSessionNotice(locale === "en" ? "Save the exact parent version to the workspace before creating its child." : "Сохраните точную родительскую версию в workspace перед созданием дочерней.");
      return;
    }
    let exactParentFingerprint: string;
    let exactParentPublicationFingerprint: string;
    try {
      const normalizedParent = normalizeStudioDraft(draftRef.current);
      exactParentFingerprint = caseFingerprint(normalizedParent);
      exactParentPublicationFingerprint = casePublicationFingerprint(normalizedParent);
    } catch {
      showSessionNotice(locale === "en" ? "Resolve Studio validation and size issues before creating a child version." : "Устраните замечания проверки и размера Studio перед созданием дочерней версии.");
      return;
    }
    if (exactParentFingerprint !== studioServerFingerprint || exactParentPublicationFingerprint !== studioServerPublicationFingerprint) {
      showSessionNotice(locale === "en" ? "Save these exact parent edits to the workspace before creating a child version." : "Сохраните именно эти правки родительской версии в workspace перед созданием дочерней.");
      return;
    }
    const createdAt = new Date().toISOString();
    commitStudioDraft((current) => appendStudioHistory({
      ...current,
      parent: { caseId: current.caseId, version: current.version, fingerprint: studioServerFingerprint },
      ...(current.protection ? { protection: { ...current.protection, parentCode: current.protection.currentCode, currentCode: "", seal: "" } } : {}),
      version: bumpPatchVersion(current.version),
    }, { role: "studio", source: "visual", action: "case_updated", message: locale === "en" ? `Created child version from ${current.caseId} v${current.version}.` : `Создана дочерняя версия от ${current.caseId} v${current.version}.` }, createdAt), locale === "en" ? "Created child case version" : "Создана дочерняя версия кейса", "visual", createdAt);
    showSessionNotice(locale === "en" ? "Child version created with parent trace" : "Дочерняя версия создана со ссылкой на родителя");
  }
  function recordVisualEdit(action: StudioEditAction, message: string, before?: StudioDraft) {
    if (!studioCanDuplicate) return;
    if (before) { checkpointStudioDraft(before, action, message); return; }
    const createdAt = new Date().toISOString();
    syncStudioDraft(appendStudioHistory(draftRef.current, { role: "studio", source: "visual", action, message }, createdAt));
  }
  function updateNode(change: Partial<StudioNode>) {
    if (!selectedNodeId) return;
    updateStudioDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNodeId ? { ...node, ...change } : node) }));
  }
  function addNode(type: StudioNodeType, preferredPosition?: { x: number; y: number }) {
    const createdAt = new Date().toISOString();
    if (draftRef.current.nodes.length >= 200) return;
    const id = nextStudioNodeId(draftRef.current.nodes, type);
    commitStudioDraft((current) => {
      const position = nextStudioNodePosition(current.nodes, current.nodes.find((node) => node.id === selectedNodeId), preferredPosition);
      return appendStudioHistory({ ...current, nodes: [...current.nodes, { id, type, title: text.nodeTypes[type], detail: "", ...position }] }, { role: "studio", source: "visual", action: "node_added", message: locale === "en" ? `Visual edit: added ${text.nodeTypes[type]} node “${text.nodeTypes[type]}”.` : `Визуальная правка: добавлен узел «${text.nodeTypes[type]}».` }, createdAt);
    }, locale === "en" ? `Added ${text.nodeTypes[type]} node` : `Добавлен узел «${text.nodeTypes[type]}»`, "visual", createdAt);
    setSelectedNodeId(id);
  }
  function addLink(from: string, to: string) {
    const createdAt = new Date().toISOString();
    commitStudioDraft((current) => {
      const fromNode = current.nodes.find((node) => node.id === from);
      const toNode = current.nodes.find((node) => node.id === to);
      const link = { id: nextStudioLinkId(current.links), from, to };
      return addStudioLink(current, link, { role: "studio", source: "visual", action: "link_added", message: locale === "en" ? `Visual edit: created relation “${fromNode?.title ?? from}” → “${toNode?.title ?? to}”.` : `Визуальная правка: создана связь «${fromNode?.title ?? from}» → «${toNode?.title ?? to}».` }, createdAt).draft;
    }, locale === "en" ? `Connected ${from} → ${to}` : `Создана связь ${from} → ${to}`, "visual", createdAt);
  }
  function relinkLink(previous: StudioLink, next: StudioLink) {
    const createdAt = new Date().toISOString();
    commitStudioDraft((current) => {
      const label = (id: string) => current.nodes.find((node) => node.id === id)?.title ?? id;
      return relinkStudioLink(current, previous, next, { role: "studio", source: "visual", action: "link_relinked", message: locale === "en" ? `Visual edit: relinked “${label(previous.from)}” → “${label(previous.to)}” to “${label(next.from)}” → “${label(next.to)}”.` : `Визуальная правка: связь «${label(previous.from)}» → «${label(previous.to)}» перепривязана на «${label(next.from)}» → «${label(next.to)}».` }, createdAt).draft;
    }, locale === "en" ? `Relinked ${previous.id}` : `Перепривязана связь ${previous.id}`, "visual", createdAt);
  }
  function deleteLink(link: StudioLink) {
    const createdAt = new Date().toISOString();
    commitStudioDraft((current) => {
      const label = (id: string) => current.nodes.find((node) => node.id === id)?.title ?? id;
      return deleteStudioLink(current, link, { role: "studio", source: "visual", action: "link_deleted", message: locale === "en" ? `Visual edit: deleted relation “${label(link.from)}” → “${label(link.to)}”.` : `Визуальная правка: удалена связь «${label(link.from)}» → «${label(link.to)}».` }, createdAt).draft;
    }, locale === "en" ? `Deleted ${link.id}` : `Удалена связь ${link.id}`, "visual", createdAt);
  }
  function loadTaxTemplate() {
    const taxPrompt = "A Belgian-headed group is considering a cross-border IP and financing structure involving Belgium, the Netherlands and the UAE. Model the cash flows, treaty access, beneficial ownership, transfer pricing, substance, CFC, permanent establishment, withholding tax, DAC6 and Pillar Two implications. Require documented commercial purpose and compare compliant alternatives; exclude concealment, sham arrangements and tax evasion.";
    setPrompt(taxPrompt);
    const createdAt = new Date().toISOString();
    let template: StudioDraft = {
      caseId: "cross_border_ip_financing_review", version: "1.0.0", caseType: caseTypeReference("tax_compliance"), parent: null,
      title: "Cross-border IP & Financing Review", jurisdiction: "Belgium · EU · International",
      role: "International tax counsel", premise: taxPrompt, premisePublication: "prompt-derived",
      classification: { domain: "tax", practiceArea: "International tax planning", difficulty: "Advanced", tags: ["tax", "cross-border", "advisory", "anti-abuse"], taxTopics: ["Treaty access", "Beneficial ownership", "Transfer pricing", "DEMPE", "Substance", "CFC", "PE", "Withholding tax", "DAC6", "Pillar Two"], complianceOnly: true, purpose: "lawful_planning", legalAsOf: "2026-08-21", sourceUrls: ["https://www.oecd.org/en/topics/global-minimum-tax.html", "https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/directive-administrative-cooperation-dac/dac6_en"] },
      taxEconomics: defaultTaxEconomics(),
      updatedAt: createdAt,
      nodes: [
        { id: "trigger-1", type: "trigger", title: "Proposed IP and financing restructure", detail: "The group requests a defensible comparison before implementation.", x: 35, y: 220 },
        { id: "actor-1", type: "actor", title: "Group tax director", detail: "Accountable decision-maker coordinating business, legal, finance and external advisers.", x: 225, y: 220 },
        { id: "entity-1", type: "entity", title: "Belgian operating company", detail: "People, functions, risks, assets and effective management.", x: 420, y: 55 },
        { id: "entity-2", type: "entity", title: "NL / UAE entities", detail: "Test residence, substance, beneficial ownership and commercial purpose.", x: 420, y: 360 },
        { id: "cash_flow-1", type: "cash_flow", title: "Royalty and interest flows", detail: "For each payer → payee flow: instrument, amount/currency, WHT, deductibility, treaty basis and beneficial owner.", x: 615, y: 55 },
        { id: "tax_rule-1", type: "tax_rule", title: "Scope, anti-abuse & reporting gates", detail: "Apply jurisdiction/fiscal-year sources. Test PPT/GAAR, CFC, PE, TP, ATAD and DAC6 hallmarks/MBT; test Pillar Two only if the EUR 750m scope threshold is met.", x: 615, y: 360 },
        { id: "evidence-1", type: "evidence", title: "Substance and pricing file", detail: "Residence, ownership, board records, personnel, functions/risks/assets, DEMPE, contracts, forecasts, benchmarking and source confidence.", x: 805, y: 65 },
        { id: "decision-1", type: "decision", title: "Select a compliant design", detail: "Compare status quo, revised structure and no-go outcome with documented assumptions.", x: 805, y: 300 },
        { id: "outcome-1", type: "outcome", title: "Defensible planning position", detail: "Commercial purpose, governance and tax treatment align.", x: 1010, y: 150 },
        { id: "outcome-2", type: "outcome", title: "Redesign or abandon", detail: "Anti-abuse, substance or reporting risks outweigh projected benefit.", x: 1010, y: 390 },
      ],
      links: numberedStudioLinks([
        ["trigger-1", "actor-1"], ["actor-1", "entity-1"], ["actor-1", "entity-2"],
        ["entity-1", "cash_flow-1"], ["entity-2", "cash_flow-1"], ["cash_flow-1", "tax_rule-1"],
        ["tax_rule-1", "evidence-1"], ["evidence-1", "decision-1"], ["decision-1", "outcome-1"],
        ["decision-1", "outcome-2"],
      ]),
      editHistory: [],
    };
    template = appendStudioHistory(template, { role: "author", source: "prompt", action: "prompt_submitted", message: taxPrompt }, createdAt);
    template = appendStudioHistory(template, { role: "studio", source: "prompt", action: "prompt_applied", message: "Loaded the compliance-first international tax graph. Future iterations preserve its entities, flows, rules and manual edits." }, createdAt);
    enterNewLocalDraft(template, "decision-1");
    setPrompt("");
    navigate("studio");
  }
  function deleteNode() {
    if (!selectedNodeId) return;
    const createdAt = new Date().toISOString();
    commitStudioDraft((current) => {
      const node = current.nodes.find((item) => item.id === selectedNodeId);
      const relationCount = current.links.filter((link) => link.from === selectedNodeId || link.to === selectedNodeId).length;
      return appendStudioHistory({ ...current, nodes: current.nodes.filter((item) => item.id !== selectedNodeId), links: current.links.filter((link) => link.from !== selectedNodeId && link.to !== selectedNodeId) }, { role: "studio", source: "visual", action: "node_deleted", message: locale === "en" ? `Visual edit: deleted “${node?.title ?? selectedNodeId}” and ${relationCount} connected relation(s).` : `Визуальная правка: удалён узел «${node?.title ?? selectedNodeId}» и связанных связей: ${relationCount}.` }, createdAt);
    }, locale === "en" ? `Deleted node ${selectedNodeId}` : `Удалён узел ${selectedNodeId}`, "visual", createdAt);
    setSelectedNodeId(null);
  }
  function moveNode(event: React.PointerEvent<HTMLButtonElement>, node: StudioNode, graphScale = 1) {
    const canvas = event.currentTarget.closest(".graph-canvas"); if (!(canvas instanceof HTMLElement)) return; const rect = canvas.getBoundingClientRect();
    const scale = Number.isFinite(graphScale) && graphScale > 0 ? graphScale : 1;
    const pointerX = (event.clientX - rect.left) / scale;
    const pointerY = (event.clientY - rect.top) / scale;
    const canvasWidth = rect.width / scale;
    const canvasHeight = rect.height / scale;
    if (event.type === "pointerdown") { event.currentTarget.setPointerCapture(event.pointerId); dragBeforeRef.current = draftRef.current; setDragging({ id: node.id, dx: pointerX - node.x, dy: pointerY - node.y, startX: node.x, startY: node.y, lastX: node.x, lastY: node.y }); setSelectedNodeId(node.id); }
    else if (event.type === "pointermove" && dragging?.id === node.id) {
      const x = Math.max(12, Math.min(canvasWidth - 178, pointerX - dragging.dx));
      const y = Math.max(12, Math.min(canvasHeight - 92, pointerY - dragging.dy));
      updateStudioDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, x, y } : item) }));
      setDragging((current) => current?.id === node.id ? { ...current, lastX: x, lastY: y } : current);
    } else if (event.type === "pointerup" || event.type === "pointercancel") {
      const completed = dragging;
      setDragging(null);
      if (completed?.id === node.id && (Math.round(completed.startX) !== Math.round(completed.lastX) || Math.round(completed.startY) !== Math.round(completed.lastY))) recordVisualEdit("node_moved", locale === "en" ? `Visual edit: moved “${node.title}” to (${Math.round(completed.lastX)}, ${Math.round(completed.lastY)}).` : `Визуальная правка: узел «${node.title}» перемещён в (${Math.round(completed.lastX)}, ${Math.round(completed.lastY)}).`, dragBeforeRef.current ?? undefined);
      dragBeforeRef.current = null;
    }
  }

  function playStudioDraft() {
    const compiled = compileStudioDraft(draftRef.current);
    if (!compiled.scenario) {
      window.alert((locale === "en" ? "This graph cannot be played yet:\n" : "Граф пока нельзя пройти:\n") + compiled.issues.map((issue) => `• ${issue.message}${issue.nodeIds.length ? ` (${issue.nodeIds.join(", ")})` : ""}`).join("\n"));
      return;
    }
    const createdAt = new Date().toISOString();
    syncStudioDraft(appendStudioHistory(draftRef.current, { role: "studio", source: "visual", action: "compiled_for_play", message: locale === "en" ? `Compiled the current ${draftRef.current.nodes.length}-node graph and opened it in the full case player.` : `Текущий граф из ${draftRef.current.nodes.length} узлов собран и открыт в полноценном проигрывателе.` }, createdAt));
    startScenario(compiled.scenario);
  }
  function resetStudioDraft() {
    const hasWork = Boolean(draftRef.current.nodes.length || draftRef.current.links.length || draftRef.current.title || draftRef.current.editHistory.length || prompt.trim());
    if (hasWork && !window.confirm(locale === "en" ? "Start a completely blank draft? The current local graph, prompt and undo history will be cleared." : "Создать полностью пустой черновик? Текущий локальный граф, промпт и история отмены будут очищены.")) return false;
    enterNewLocalDraft(blankStudioDraft(), null);
    setPrompt("");
    return true;
  }
  function purgeLocalStudioState() {
    studioChangedBeforeRestoreRef.current = true;
    if (studioStorageScope) window.localStorage.removeItem(studioDeviceDraftKey(studioStorageScope));
    const clean = blankStudioDraft();
    const cleanTimeline = emptyStudioTimeline();
    draftRef.current = clean;
    studioTimelineRef.current = cleanTimeline;
    setDraftState(clean);
    setStudioTimelineState(cleanTimeline);
    setStudioPrivate(false);
    setStudioCustomCaseId(null);
    setStudioCanManagePrivacy(true);
    setStudioServerFingerprint(null);
    setStudioServerPublicationFingerprint(null);
    setStudioCanDuplicate(true);
    setStudioCopyProtectionLocked(false);
    setSelectedNodeId(null);
  }
  function loadExampleDraft() {
    enterNewLocalDraft(defaultDraft, "decision-1");
    setPrompt("");
  }

  return (
    <div className={`app-shell theme-${theme}${studioOnly ? " studio-only-shell studio-host-falcon" : ""}`}>
      <div className="atmosphere" aria-hidden="true"><span /><span /><span /></div>
      <header className="topbar">
        {studioOnly ? <a className="brand falcon-studio-brand" href="https://www.falcon-merlin.com/" target="_top" aria-label={locale === "en" ? "Falcon-Merlin home" : "Главная Falcon-Merlin"}>
          <span className="falcon-monogram" aria-hidden="true">FM</span>
          <span><b>FALCON-MERLIN</b><small><strong>CASE STUDIO</strong> · ADVISORY · BETA v0.1.0</small></span>
        </a> : <button className="brand" onClick={() => navigate("library")} aria-label={locale === "en" ? "GENESIS: JURIS CODEX — Templates" : "GENESIS: JURIS CODEX — Шаблоны"}>
          {/* The SVG is deliberately served directly; it is a tiny UI mark and does not need responsive image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/brand/genesis-juris-codex-mark.svg" alt="" />
          <span><b>GENESIS: JURIS</b><small><strong>CODEX</strong> · PRODUCT {PRODUCT_RELEASE}</small></span>
        </button>}
        {!studioOnly && <nav className="main-nav" aria-label={locale === "en" ? "Primary navigation" : "Основная навигация"}>
          <button className={view === "library" ? "active" : ""} aria-current={view === "library" ? "page" : undefined} onClick={() => navigate("library")}><Icon name="library" />{text.library}</button>
          <button className={view === "play" ? "active" : ""} aria-current={view === "play" ? "page" : undefined} onClick={() => activeScenario ? navigate("play") : void launchCatalogueCase(featuredRecord)}><Icon name="play" />{text.play}</button>
          <button className={view === "studio" ? "active" : ""} aria-current={view === "studio" ? "page" : undefined} onClick={() => navigate("studio")}><Icon name="studio" />{text.studio}<span className="nav-new">LAB</span></button>
          <button className={view === "community" ? "active" : ""} aria-current={view === "community" ? "page" : undefined} onClick={() => navigate("community")}><Icon name="globe" />{text.community}</button>
          <button className={view === "help" ? "active" : ""} aria-current={view === "help" ? "page" : undefined} onClick={() => navigate("help")}><Icon name="file" />{text.help}</button>
        </nav>}
        <div className="top-actions">
          <input
            ref={playedCaseImportRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importPlayedCase(file);
              event.target.value = "";
            }}
          />
          {!studioOnly && <button className="utility-button" onClick={() => playedCaseImportRef.current?.click()} aria-label={text.importPlay} title={text.importPlay}><Icon name="upload" /><span>{text.importPlay}</span></button>}
          {!studioOnly && activeScenario && <button className="utility-button" onClick={exportPlayedCase} aria-label={text.exportPlay} title={text.exportPlay}><Icon name="download" /><span>{text.exportPlay}</span></button>}
          <Link className="utility-button" href="/matters"><Icon name="file"/><span>{locale === "en" ? "My cases" : "Мои дела"}</span></Link>
          {studioOnly && <Link className="utility-button" href="/?view=library"><Icon name="library"/><span>{locale === "en" ? "Templates" : "Шаблоны"}</span></Link>}
          {studioOnly && <Link className="utility-button" href="/account"><span>Account</span></Link>}
          {studioOnly && <a className="utility-button studio-demo-link" href="/help/studio-demo" target="_blank" rel="noreferrer" aria-label={locale === "en" ? "Open the three-minute Studio demo" : "Открыть трёхминутное демо Studio"}><Icon name="video"/><span>{locale === "en" ? "Demo · 3 min" : "Демо · 3 мин"}</span></a>}
          {studioOnly && <a className="utility-button studio-site-link" href="https://www.falcon-merlin.com/" target="_top" aria-label={locale === "en" ? "Return to the Falcon-Merlin website" : "Вернуться на сайт Falcon-Merlin"}><span aria-hidden="true">←</span><span>{locale === "en" ? "Falcon-Merlin.com" : "На основной сайт"}</span></a>}
          {studioOnly && <a className="utility-button studio-fullscreen-link" href="/studio" target="_blank" rel="noreferrer"><Icon name="arrow" /><span>{locale === "en" ? "Full screen" : "На весь экран"}</span></a>}
          <button className="utility-button" onClick={() => setLocale(locale === "en" ? "ru" : "en")} aria-label={locale === "en" ? "Switch language" : "Сменить язык"}><Icon name="globe" /><span>{locale.toUpperCase()}</span></button>
          <button className="utility-button" onClick={() => setTheme(theme === "office" ? "after-hours" : "office")} aria-label={locale === "en" ? "Switch atmosphere" : "Сменить тему оформления"}><Icon name={theme === "office" ? "sun" : "moon"} /><span>{theme === "office" ? text.office : text.night}</span></button>
        </div>
      </header>

      {!studioOnly && view === "library" && <LibraryView locale={locale} text={text} records={catalogueRecords} loadedScenarios={catalogueScenarios} featuredRecord={featuredRecord} featuredScenario={featured} setFeaturedId={setFeaturedId} launchCase={(record) => void launchCatalogueCase(record)} requestFeedback={setFeedbackTarget} openTaxTemplate={loadTaxTemplate} searchCatalogue={refreshCatalogue} nextCursor={catalogueNextCursor} total={catalogueTotal} loading={catalogueLoading} error={catalogueError} />}
      {view === "play" && activeScenario && stage && runLedger && <PlayView
        locale={locale} text={text} scenario={activeScenario} stage={stage} stageIndex={stageIndex} metrics={metrics} ledger={runLedger}
        decisionLog={decisionLog} caseMinute={caseMinute} actionUseCounts={actionUseCounts} completedDeadlineIds={completedDeadlineIds}
        missedDeadlineIds={missedDeadlineIds} canonicalState={canonicalPlayState ?? undefined} dossierRef={dossierRef} setDossierRef={setDossierRef}
        setSelectedOption={setSelectedOption} advanceTime={(minutes) => void advanceCaseTime(minutes)} timeBusy={playSessionBusy} outcome={outcome}
        sessionSync={playSessionSync} exportSession={exportPlayedCase} replayCase={() => startScenario(activeScenario, { legacyTiming: legacyTimingMode })}
        returnLibrary={() => navigate(studioOnly ? "studio" : "library")} returnToStudio={studioOnly} requestFeedback={(contextType, contextId) => setFeedbackTarget({ caseId: activeScenario.caseId, version: activeScenario.version, title: activeScenario.title[locale], source: "playable", fingerprint: activeScenario.fingerprint, contextType, contextId })}
      />}
      {view === "studio" && <StudioView standalone={studioOnly} locale={locale} text={text} prompt={prompt} setPrompt={setPrompt} draft={draft} setDraft={updateStudioDraft} selectedNode={selectedNode} selectedNodeId={selectedNodeId} selectNode={setSelectedNodeId} checks={checks} packageRequiresPlayableRoute={packageRequiresPlayableRoute} generateDraft={generateDraft} applyPromptIteration={applyPromptIteration} applyReviewedAIPlan={applyReviewedAIPlan} applyCanonicalMarkdownDraft={applyCanonicalMarkdownDraft} saveDraft={saveDraft} savedFlash={savedFlash} exportDraft={exportDraft} importRef={importRef} importDraft={importDraft} createChildVersion={createChildVersion} updateNode={updateNode} recordVisualEdit={recordVisualEdit} addNode={addNode} addLink={addLink} relinkLink={relinkLink} deleteLink={deleteLink} deleteNode={deleteNode} moveNode={moveNode} resetDraft={resetStudioDraft} loadExample={loadExampleDraft} loadTaxTemplate={loadTaxTemplate} requestFeedback={() => setFeedbackTarget({ caseId: draft.caseId, version: draft.version, title: draft.title, source: "studio", fingerprint: caseFingerprint(draft), customCaseId: studioCustomCaseId, contextType: selectedNode ? "node" : "case", contextId: selectedNode?.id, privateCase: studioPrivate })} timeline={studioTimeline} undoDraft={() => travelStudioTimeline("undo")} redoDraft={() => travelStudioTimeline("redo")} restoreRevision={restoreStudioRevision} playDraft={playStudioDraft} isPrivate={studioPrivate} setPrivate={setStudioPrivate} customCaseId={studioCustomCaseId} setCustomCaseId={setStudioCustomCaseId} canManagePrivacy={studioCanManagePrivacy} setCanManagePrivacy={setStudioCanManagePrivacy} serverFingerprint={studioServerFingerprint} setServerFingerprint={setStudioServerFingerprint} serverPublicationFingerprint={studioServerPublicationFingerprint} setServerPublicationFingerprint={setStudioServerPublicationFingerprint} copyProtectionLocked={studioCopyProtectionLocked} setCopyProtectionLocked={setStudioCopyProtectionLocked} canDuplicate={studioCanDuplicate} reportReceiptStorageScope={studioStorageScope} persistReportReceiptOnDevice={reportReceiptDeviceEligible} aiEntitlement={studioAIEntitlement} />}
      {!studioOnly && view === "community" && <CommunityView locale={locale} cases={catalogueRecords} openCustomCase={openWorkspaceCustomCase} refreshCatalogue={() => refreshCatalogue({ force: true })} clearDeviceDraft={purgeLocalStudioState} />}
      {!studioOnly && view === "help" && <HelpView locale={locale} openCommunity={() => navigate("community")} openStudio={() => navigate("studio")} />}
      {(selectedOption || resultOption) && activeScenario && stage && <DecisionModal locale={locale} text={text} scenario={activeScenario} stageHeadline={local(stage.headline, locale)} option={selectedOption ?? resultOption!} isResult={Boolean(resultOption)} busy={playSessionBusy} close={() => { if (!playSessionBusy) { setSelectedOption(null); setResultOption(null); } }} dispatch={dispatchDecision} advance={advanceStage} finalStage={Boolean(activeScenario.stages.find((item) => item.id === (selectedOption ?? resultOption)?.nextStageId)?.terminal)} />}
      {sessionNotice && <div className="session-toast" role="status"><Icon name="check" />{sessionNotice}</div>}
      {feedbackTarget && <FeedbackDialog locale={locale} target={feedbackTarget} close={() => setFeedbackTarget(null)} submitted={(audience) => { const privateProductFeedback = feedbackTarget.privateCase && audience !== "owner_private"; setFeedbackTarget(null); showSessionNotice(audience === "owner_private" ? (locale === "en" ? "Private note saved for you only." : "Приватная заметка сохранена только для вас.") : privateProductFeedback ? (locale === "en" ? "Redacted product feedback sent to Maxim." : "Обезличенный отзыв о продукте отправлен Максиму.") : (locale === "en" ? "Feedback submitted for expert review." : "Отзыв отправлен на экспертную проверку.")); }} />}
    </div>
  );
}

type CatalogueSearchFilters = { q?: string; jurisdiction?: string; practiceArea?: string; difficulty?: string; tag?: string };
type PublishedCaseSummary = {
  id: string; currentVersion: string; fingerprint: string; title: string; jurisdiction: string; practiceArea: string;
  sector: string; difficulty: string; durationMinutes: number; reviewLevel: string; authorName: string; reviewerName: string;
  legalAsOf: string | null; summary: string; tags: string[]; updatedAt: string;
};
type CaseMeta = { practice: string; difficulty: string; duration: number; tags: string[]; version?: string; fingerprint?: string; reviewLevel?: string; updatedAt?: string; authorName?: string; reviewerName?: string; legalAsOf?: string };
const fallbackCaseTaxonomy: Record<string, CaseMeta> = {
  be_commercial_failed_erp_001: { practice: "Commercial disputes", difficulty: "Advanced", duration: 45, tags: ["ERP", "evidence", "litigation"], reviewLevel: "bundled_beta", authorName: "GENESIS: JURIS", reviewerName: "Expert review pending" },
  be_commercial_logistics_001: { practice: "Commercial recovery", difficulty: "Intermediate", duration: 35, tags: ["logistics", "CMR", "insolvency"], reviewLevel: "bundled_beta", authorName: "GENESIS", reviewerName: "Expert review pending" },
  greenfire_first_72_hours: { practice: "Environmental & crisis", difficulty: "Intermediate", duration: 35, tags: ["incident", "regulatory", "72h"], reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending" },
  nl_food_safety_goldenshell_001: { practice: "Food safety & product recall", difficulty: "Advanced", duration: 40, tags: ["recall", "traceability", "claims"], reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending" },
  us_environmental_desert_water_001: { practice: "Environmental mass claims", difficulty: "Expert", duration: 50, tags: ["groundwater", "causation", "mass claims"], reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending" },
};

const fallbackCatalogueRecords: PublishedCaseSummary[] = [
  { id: "be_commercial_failed_erp_001", currentVersion: "1.2.0", fingerprint: "sha256-016544740b270af3b6e3392f190fbc8de2516435494b64ad6924ee42ca75f581", title: "Failed ERP Implementation", jurisdiction: "BE · Commercial", practiceArea: "Commercial disputes", sector: "Technology / implementation", difficulty: "Advanced", durationMinutes: 45, reviewLevel: "bundled_beta", authorName: "GENESIS: JURIS", reviewerName: "Expert review pending", legalAsOf: null, summary: "Asteron Systems pursues its ERP supplier after a failed implementation, while scope changes, acceptance language, causation, evidence, deadlines, and layered remedies shape the result.", tags: ["ERP", "evidence", "litigation"], updatedAt: "" },
  { id: "be_commercial_logistics_001", currentVersion: "1.2.0", fingerprint: "sha256-ea8c505ee15bc582900b4093fdf82340668998510a4dc0653a623871ab2a5163", title: "Unpaid Logistics Invoices", jurisdiction: "BE · Commercial", practiceArea: "Commercial recovery", sector: "Logistics", difficulty: "Intermediate", durationMinutes: 35, reviewLevel: "bundled_beta", authorName: "GENESIS", reviewerName: "Expert review pending", legalAsOf: null, summary: "Velmont Logistics seeks recovery of unpaid freight and warehousing invoices while Orbis Retail disputes service levels, detention charges, and contractual surcharges.", tags: ["logistics", "CMR", "insolvency"], updatedAt: "" },
  { id: "greenfire_first_72_hours", currentVersion: "0.4.0", fingerprint: "sha256-d0a07ed183269eb0c9c76a9226bcde27a878179d8a3afca4b10b794ca00f1d51", title: "GreenFire — The First 72 Hours", jurisdiction: "NL · Corporate / Regulatory", practiceArea: "Environmental & crisis", sector: "Industrial / crisis", difficulty: "Intermediate", durationMinutes: 35, reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending", legalAsOf: null, summary: "An industrial fire places a chemical-storage company under simultaneous criminal, regulatory, environmental, insurance, and insolvency pressure.", tags: ["incident", "regulatory", "72h"], updatedAt: "" },
  { id: "nl_food_safety_goldenshell_001", currentVersion: "0.3.0", fingerprint: "sha256-fcd51c1425f61d28c027c3600da1702f995c8b1b9bdfffe14e4e5c1fee1564dd", title: "GoldenShell — Recall at Dawn", jurisdiction: "NL · Food safety", practiceArea: "Food safety & product recall", sector: "Food safety", difficulty: "Advanced", durationMinutes: 40, reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending", legalAsOf: null, summary: "A food-safety authority blocks twelve poultry farms after traces of an unauthorised pesticide are detected in eggs.", tags: ["recall", "traceability", "claims"], updatedAt: "" },
  { id: "us_environmental_desert_water_001", currentVersion: "0.3.0", fingerprint: "sha256-20d0037ab29211858bce13618e86b17be54af5dd4e9f9c1796ddb62edd9608b2", title: "Desert Water", jurisdiction: "US · Environmental", practiceArea: "Environmental mass claims", sector: "Environmental / mass claims", difficulty: "Expert", durationMinutes: 50, reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending", legalAsOf: null, summary: "Residents of Sundial Mesa suspect that hexavalent chromium from Caldera's cooling and compressor facility reached their wells.", tags: ["groundwater", "causation", "mass claims"], updatedAt: "" },
];

function bundledCatalogueRecords(): PublishedCaseSummary[] {
  return fallbackCatalogueRecords.map((record) => ({ ...record, tags: [...record.tags] }));
}

function normalizePublishedCaseSummary(value: unknown): PublishedCaseSummary {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.currentVersion !== "string" || typeof value.fingerprint !== "string" || typeof value.title !== "string") throw new Error("Invalid catalogue summary");
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value.id) || !/^\d+\.\d+\.\d+$/.test(value.currentVersion) || !/^sha256-[a-f0-9]{64}$/.test(value.fingerprint)) throw new Error("Invalid catalogue identity");
  return {
    id: value.id,
    currentVersion: value.currentVersion,
    fingerprint: value.fingerprint,
    title: value.title.trim().slice(0, 200),
    jurisdiction: typeof value.jurisdiction === "string" ? value.jurisdiction.trim().slice(0, 160) : "",
    practiceArea: typeof value.practiceArea === "string" ? value.practiceArea.trim().slice(0, 100) : "General legal",
    sector: typeof value.sector === "string" ? value.sector.trim().slice(0, 160) : "General legal",
    difficulty: typeof value.difficulty === "string" ? value.difficulty.trim().slice(0, 40) : "Intermediate",
    durationMinutes: typeof value.durationMinutes === "number" && Number.isInteger(value.durationMinutes) ? Math.max(1, Math.min(10_000, value.durationMinutes)) : 30,
    reviewLevel: typeof value.reviewLevel === "string" ? value.reviewLevel.trim().slice(0, 60) : "community_beta",
    authorName: typeof value.authorName === "string" ? value.authorName.trim().slice(0, 160) : "GENESIS: JURIS",
    reviewerName: typeof value.reviewerName === "string" ? value.reviewerName.trim().slice(0, 160) : "Editorial review pending",
    legalAsOf: typeof value.legalAsOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.legalAsOf) ? value.legalAsOf : null,
    summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 8_000) : "",
    tags: Array.isArray(value.tags) ? value.tags.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 100)).filter(Boolean).slice(0, 30) : [],
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

function publishedRecordMatches(record: PublishedCaseSummary, filters: CatalogueSearchFilters) {
  const haystack = [record.title, record.summary, record.jurisdiction, record.practiceArea, record.sector, ...record.tags].join(" ").toLowerCase();
  return (!filters.q?.trim() || haystack.includes(filters.q.trim().toLowerCase()))
    && (!filters.jurisdiction || filters.jurisdiction === "all" || record.jurisdiction === filters.jurisdiction)
    && (!filters.practiceArea || filters.practiceArea === "all" || record.practiceArea === filters.practiceArea)
    && (!filters.difficulty || filters.difficulty === "all" || record.difficulty === filters.difficulty)
    && (!filters.tag || filters.tag === "all" || record.tags.some((tag) => tag.toLowerCase() === filters.tag!.toLowerCase()));
}

function summaryScenario(record: PublishedCaseSummary, index: number): Scenario {
  const presentation = bundledCataloguePresentation[record.id];
  return {
    id: `catalogue.${record.id}.${record.currentVersion.replaceAll(".", "-")}`,
    caseId: record.id,
    order: (index + 1) * 10,
    title: { en: record.title, ru: presentation?.titleRu ?? record.title },
    subtitle: { en: presentation?.subtitleEn ?? (record.summary || record.practiceArea), ru: presentation?.subtitleRu ?? (record.summary || record.practiceArea) },
    jurisdiction: record.jurisdiction,
    role: { en: "Scenario counsel", ru: "Юрист по сценарию" },
    version: record.currentVersion,
    sector: { en: record.sector, ru: presentation?.sectorRu ?? record.sector },
    urgency: presentation?.urgency ?? "standard",
    fingerprint: record.fingerprint,
    accent: "#d2a85e",
    actors: [], materials: [], stages: [],
    opening: { en: record.summary || "Open the exact version to load its working record.", ru: presentation?.summaryRu ?? (record.summary || "Откройте точную версию, чтобы загрузить материалы дела.") },
    initialStageId: "", initialClockMinute: 0, deadlines: [], workflowInbox: [],
    outcomes: { strong: { en: "Strong", ru: "Сильный" }, mixed: { en: "Mixed", ru: "Смешанный" }, weak: { en: "Weak", ru: "Слабый" } },
  };
}

function editorialReviewLabel(level: string | undefined, locale: Locale) {
  if (level === "practitioner_reviewed") return locale === "en" ? "Practitioner reviewed" : "Проверено практиком";
  if (level === "editorial_reviewed") return locale === "en" ? "Editorially reviewed" : "Редакционная проверка";
  if (level === "community_beta") return locale === "en" ? "Community preview" : "Предпросмотр сообщества";
  return locale === "en" ? "Editorial preview" : "Редакционный предпросмотр";
}

function LibraryView({ locale, text, records, loadedScenarios, featuredRecord, featuredScenario, setFeaturedId, launchCase, requestFeedback, openTaxTemplate, searchCatalogue, nextCursor, total, loading, error }: { locale: Locale; text: UiText; records: PublishedCaseSummary[]; loadedScenarios: Scenario[]; featuredRecord: PublishedCaseSummary; featuredScenario: Scenario | null; setFeaturedId: (id: string) => void; launchCase: (record: PublishedCaseSummary) => void; requestFeedback: (target: FeedbackTarget) => void; openTaxTemplate: () => void; searchCatalogue: (options?: { filters?: CatalogueSearchFilters; cursor?: string | null; append?: boolean; force?: boolean }) => Promise<void>; nextCursor: string | null; total: number; loading: boolean; error: string }) {
  const [query, setQuery] = useState("");
  const [practiceFilter, setPracticeFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const cases = useMemo(() => records.map((record, index) => loadedScenarios.find((scenario) => scenario.caseId === record.id && scenario.version === record.currentVersion && scenario.fingerprint === record.fingerprint) ?? summaryScenario(record, index)), [loadedScenarios, records]);
  const featured = featuredScenario ?? summaryScenario(featuredRecord, Math.max(0, records.findIndex((record) => record.id === featuredRecord.id)));
  const catalogueMeta = useMemo<Record<string, CaseMeta>>(() => Object.fromEntries(records.map((record) => [record.id, {
    practice: record.practiceArea, difficulty: record.difficulty, duration: record.durationMinutes, tags: record.tags,
    version: record.currentVersion, fingerprint: record.fingerprint, reviewLevel: record.reviewLevel, updatedAt: record.updatedAt,
    authorName: record.authorName, reviewerName: record.reviewerName, legalAsOf: record.legalAsOf ?? undefined,
  }])), [records]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void searchCatalogue({ filters: { q: query, practiceArea: practiceFilter, jurisdiction: jurisdictionFilter, difficulty: difficultyFilter, tag: tagFilter } }); }, 260);
    return () => window.clearTimeout(timer);
  }, [difficultyFilter, jurisdictionFilter, practiceFilter, query, searchCatalogue, tagFilter]);
  const metadataFor = (scenario: Scenario) => {
    const candidate = catalogueMeta[scenario.caseId];
    if (candidate?.version === scenario.version && candidate.fingerprint === scenario.fingerprint) return candidate;
    return fallbackCaseTaxonomy[scenario.caseId] ?? { practice: "General legal", difficulty: "Intermediate", duration: 30, tags: [], reviewLevel: "community_beta" };
  };
  const facetRecords = [...bundledCatalogueRecords(), ...records];
  const practices = Array.from(new Set(facetRecords.map((item) => item.practiceArea))).sort();
  const jurisdictions = Array.from(new Set(facetRecords.map((item) => item.jurisdiction))).sort();
  const difficulties = Array.from(new Set(facetRecords.map((item) => item.difficulty))).sort();
  const tags = Array.from(new Set(facetRecords.flatMap((item) => item.tags))).sort();
  const filteredCases = cases.filter((scenario) => {
    const meta = metadataFor(scenario);
    const haystack = [scenario.title[locale], scenario.subtitle[locale], scenario.jurisdiction, meta?.practice, ...(meta?.tags ?? [])].join(" ").toLowerCase();
    return (!query.trim() || haystack.includes(query.toLowerCase()))
      && (practiceFilter === "all" || meta?.practice === practiceFilter)
      && (jurisdictionFilter === "all" || scenario.jurisdiction === jurisdictionFilter)
      && (difficultyFilter === "all" || meta?.difficulty === difficultyFilter)
      && (durationFilter === "all" || (durationFilter === "short" ? (meta?.duration ?? 0) <= 35 : durationFilter === "medium" ? (meta?.duration ?? 0) > 35 && (meta?.duration ?? 0) <= 45 : (meta?.duration ?? 0) > 45))
      && (tagFilter === "all" || meta?.tags.includes(tagFilter));
  });
  const featuredMeta = metadataFor(featured);
  const resetFilters = () => { setQuery(""); setPracticeFilter("all"); setJurisdictionFilter("all"); setDifficultyFilter("all"); setDurationFilter("all"); setTagFilter("all"); };

  return <main className="library-view">
    <section className="library-hero page-width">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot" />{text.catalogue} · {total.toString().padStart(2, "0")} CASES</div><h1>{text.library}</h1><p className="hero-deck">{locale === "en" ? "Enter a living legal crisis. Read the record, weigh the evidence and make the decision that changes the institutional position." : "Войдите в живой юридический кризис. Изучите материалы, оцените доказательства и примите решение, меняющее институциональную позицию."}</p><div className="hero-facts"><span>GENESIS: JURIS {PRODUCT_RELEASE}</span><span>{total.toString().padStart(2, "0")} {locale === "en" ? "guided cases" : "учебных кейсов"}</span><span>EN / RU</span></div></div>
      <div className="hero-index" aria-label="Catalogue index"><span>CASE INDEX</span><b>{String(Math.max(1, records.findIndex((record) => record.id === featuredRecord.id) + 1)).padStart(2, "0")}</b><small>/ {total.toString().padStart(2, "0")}</small></div>
    </section>
    <section className="positioning-band page-width"><div><span>PROFESSIONAL JUDGMENT · SIMULATED</span><h2>{locale === "en" ? "Train the decisions that legal work rarely lets you repeat." : "Тренируйте решения, которые реальная юридическая работа редко позволяет повторить."}</h2></div><p>{locale === "en" ? "GENESIS: JURIS is a platform for building, reviewing and playing branching legal simulations. It develops judgment under uncertainty, evidence discipline and risk-aware action — with versioned cases and practitioner feedback." : "GENESIS: JURIS — платформа для создания, рецензирования и прохождения разветвлённых юридических симуляций. Она развивает профессиональное суждение в условиях неопределённости, дисциплину доказательств и управление рисками."}</p></section>
    <section className="featured-case" style={{ "--case-accent": featured.accent } as React.CSSProperties}>
      <div className="case-visual" aria-hidden="true"><div className="case-grid" /><div className="case-orbit orbit-one"/><div className="case-orbit orbit-two"/><div className="case-signal"><span/>{featured.id === "greenfire_first_72_hours" ? "72H" : `0${featured.order / 10}`}</div><div className="file-stamp">CASE FILE<br/><b>GUIDED</b></div></div>
      <div className="featured-content"><div className="case-kicker"><span>{featured.jurisdiction}</span><span>{featured.sector[locale]}</span></div><h2>{featured.title[locale]}</h2><p className="case-subtitle">{featured.subtitle[locale]}</p><p className="case-brief">{featured.opening[locale]}</p><div className="case-depth">{featured.stages.length ? <><span>{featured.stages.length} {locale === "en" ? "stages" : "этапов"}</span><span>{featured.stages.reduce((sum, item) => sum + item.options.length, 0)} {locale === "en" ? "choices" : "решений"}</span><span>{featured.deadlines.length} {locale === "en" ? "deadlines" : "сроков"}</span></> : <span>{locale === "en" ? "Case details load when you open it" : "Материалы загрузятся при открытии кейса"}</span>}</div><dl className="case-meta"><div><dt>{text.role}</dt><dd>{featured.role[locale]}</dd></div><div><dt>{text.jurisdiction}</dt><dd>{featured.jurisdiction}</dd></div><div><dt>{locale === "en" ? "Practice" : "Практика"}</dt><dd>{featuredMeta.practice}</dd></div></dl><details className="case-trust-details"><summary>{locale === "en" ? "Editorial details" : "Редакционные сведения"}</summary><div className="case-trust"><span>{editorialReviewLabel(featuredMeta.reviewLevel, locale)}</span><span>{locale === "en" ? "Case version" : "Версия кейса"}: v{featured.version}</span><span>{locale === "en" ? "Author" : "Автор"}: {featuredMeta.authorName ?? "GENESIS: JURIS"}</span><span>{featuredMeta.legalAsOf ? `${locale === "en" ? "Law as of" : "Право на"} ${featuredMeta.legalAsOf}` : (locale === "en" ? "Legal review pending" : "Проверка актуальности ожидается")}</span></div></details><div className="featured-actions"><button className="primary-cta" disabled={loading} onClick={() => launchCase(featuredRecord)}>{loading ? (locale === "en" ? "Loading…" : "Загрузка…") : text.launch}<Icon name="arrow"/></button><button className="secondary-cta" onClick={() => requestFeedback({ caseId: featuredRecord.id, version: featuredRecord.currentVersion, title: featured.title[locale], source: "playable", fingerprint: featuredRecord.fingerprint })}>{text.feedback}</button></div></div>
    </section>
    <section className="catalogue-filters page-width"><label className="filter-search"><span>{locale === "en" ? "Search the library" : "Поиск по библиотеке"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "Title, topic or jurisdiction…" : "Название, тема или юрисдикция…"}/></label><details className="catalogue-filter-more"><summary>{locale === "en" ? "More filters" : "Другие фильтры"}</summary><div><label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value)}><option value="all">{locale === "en" ? "All practices" : "Все практики"}</option>{practices.map((practice) => <option key={practice}>{practice}</option>)}</select></label><label><span>{locale === "en" ? "Jurisdiction" : "Юрисдикция"}</span><select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="all">{locale === "en" ? "All jurisdictions" : "Все юрисдикции"}</option>{jurisdictions.map((jurisdiction) => <option key={jurisdiction}>{jurisdiction}</option>)}</select></label><label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">{locale === "en" ? "All levels" : "Все уровни"}</option>{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label><span>{locale === "en" ? "Duration" : "Длительность"}</span><select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}><option value="all">{locale === "en" ? "Any duration" : "Любая"}</option><option value="short">≤ 35 min</option><option value="medium">36–45 min</option><option value="long">45+ min</option></select></label><label><span>{locale === "en" ? "Tag" : "Тег"}</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">{locale === "en" ? "All tags" : "Все теги"}</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label></div></details><div className="filter-result"><b>{filteredCases.length.toString().padStart(2, "0")} / {total.toString().padStart(2, "0")}</b><button onClick={resetFilters}>{locale === "en" ? "Reset" : "Сбросить"}</button></div></section>
    {error && <p className="catalogue-status page-width" role="status">{error}</p>}
    <section className="case-strip page-width"><div className="section-heading"><div><span>01 — {String(total).padStart(2,"0")}</span><h2>{locale === "en" ? "Choose the matter" : "Выберите дело"}</h2></div><p>{locale === "en" ? "Choose a case to explore its facts, evidence and decisions." : "Выберите кейс, чтобы изучить факты, доказательства и решения."}</p></div><div className="case-list">{filteredCases.map((scenario, index) => {
      const meta = metadataFor(scenario);
      const record = records.find((item) => item.id === scenario.caseId)!;
      return <div key={scenario.caseId} className="case-row-wrap"><button className={`case-row ${scenario.caseId === featuredRecord.id ? "selected" : ""}`} onClick={() => { setFeaturedId(scenario.caseId); launchCase(record); }} aria-label={`${text.launch}: ${scenario.title[locale]}`}><span className="row-number">{String(index + 1).padStart(2, "0")}</span><span className="row-main"><b>{scenario.title[locale]}</b><small>{scenario.subtitle[locale]}</small><em>{meta.tags.map((tag) => <i key={tag}>{tag}</i>)}</em></span><span className="row-meta"><i>{scenario.jurisdiction}</i><i>{meta.practice}</i></span><span className={`urgency ${scenario.urgency}`}>{scenario.urgency}</span><Icon name="arrow"/></button><button className="case-row-feedback" onClick={() => requestFeedback({ caseId: scenario.caseId, version: scenario.version, title: scenario.title[locale], source: "playable", fingerprint: scenario.fingerprint })}>{text.feedback}</button></div>;
    })}{filteredCases.length === 0 && !loading && <div className="catalogue-empty"><b>{locale === "en" ? "No cases match these filters." : "Кейсы по этим фильтрам не найдены."}</b><button className="secondary-cta" onClick={resetFilters}>{locale === "en" ? "Reset filters" : "Сбросить фильтры"}</button></div>}</div>{nextCursor && <button className="catalogue-load-more secondary-cta" disabled={loading} onClick={() => void searchCatalogue({ filters: { q: query, practiceArea: practiceFilter, jurisdiction: jurisdictionFilter, difficulty: difficultyFilter, tag: tagFilter }, cursor: nextCursor, append: true })}>{loading ? (locale === "en" ? "Loading…" : "Загрузка…") : (locale === "en" ? "Load next 24 cases" : "Загрузить следующие 24 кейса")}</button>}</section>
    <section className="tax-capability page-width"><div><span>CROSS-BORDER TAX STRUCTURING · OFFSHORE COMPLIANCE</span><h2>{locale === "en" ? "Model lawful cross-border tax planning as a living system." : "Моделируйте законное трансграничное налоговое планирование как живую систему."}</h2><p>{locale === "en" ? "Map entities, jurisdictions, cash flows, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 and Pillar Two — with explicit anti-abuse and documentation gates." : "Связывайте компании, юрисдикции, денежные потоки, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 и Pillar Two — с обязательными anti-abuse и документальными проверками."}</p></div><button className="primary-cta" onClick={openTaxTemplate}>{locale === "en" ? "Open tax-planning template" : "Открыть налоговый шаблон"}<Icon name="arrow"/></button></section>
    <section className="authority-note page-width"><span className="authority-seal">J</span><div><b>{text.adaptation}</b><p>{text.canonNote}</p></div><code>GENESIS: JURIS · {PRODUCT_RELEASE}</code></section>
  </main>;
}
function PlayView({ locale, text, scenario, stage, stageIndex, metrics, ledger, decisionLog, caseMinute, actionUseCounts, completedDeadlineIds, missedDeadlineIds, canonicalState, dossierRef, setDossierRef, setSelectedOption, advanceTime, timeBusy, outcome, sessionSync, exportSession, replayCase, returnLibrary, returnToStudio = false, requestFeedback }: {
  locale: Locale; text: UiText; scenario: Scenario; stage: Scenario["stages"][number]; stageIndex: number; metrics: Record<MetricKey, number>;
  ledger: RunLedger; decisionLog: DecisionRecord[]; caseMinute: number; actionUseCounts: Record<string, number>; completedDeadlineIds: string[];
  missedDeadlineIds: string[]; canonicalState?: ServerPlaySessionState; dossierRef: string | null; setDossierRef: (ref: string) => void;
  setSelectedOption: (option: DecisionOption) => void; advanceTime: (minutes: number) => void; timeBusy: boolean; outcome: OutcomeClass | null;
  sessionSync: "opening" | "server" | "local" | "stale" | "error"; exportSession: () => void; replayCase: () => void;
  returnLibrary: () => void; returnToStudio?: boolean; requestFeedback: (contextType: "case" | "stage", contextId?: string) => void;
}) {
  const visibleMaterials = canonicalState?.availableEvidenceIds
    ? scenario.materials.filter((material) => canonicalState.availableEvidenceIds?.includes(material.ref))
    : scenario.materials;
  const activeMaterial = visibleMaterials.find((material) => material.ref === dossierRef) ?? visibleMaterials[0] ?? scenario.materials[0];
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedInboxIndex, setSelectedInboxIndex] = useState(0);
  const decisionRef = useRef<HTMLElement>(null);
  const clock = formatCaseClock(caseMinute);
  const activeActionIds = new Set(stage.options.map((option) => option.id));
  const visitedStageIds = new Set(decisionLog.map((entry) => entry.stageId));
  const workflowInbox = canonicalState?.visibleInboxIds
    ? scenario.workflowInbox.filter((item) => canonicalState.visibleInboxIds?.includes(item.id))
    : scenario.workflowInbox.filter((item) => item.initiallyVisible || item.resolutionActions.some((action) => activeActionIds.has(action)));
  const resolvedOptionIds = new Set(decisionLog.map((entry) => entry.option.id));
  const unresolvedWorkflowInbox = canonicalState?.resolvedInboxIds
    ? workflowInbox.filter((item) => !canonicalState.resolvedInboxIds?.includes(item.id))
    : workflowInbox.filter((item) => !item.resolutionActions.some((action) => resolvedOptionIds.has(action)));
  const inboxEntries: InboxEntry[] = [
    {
      id: `${stage.id}-situation`,
      status: locale === "en" ? "ACTION REQUIRED" : "ТРЕБУЕТСЯ ДЕЙСТВИЕ",
      title: stage.headline[locale],
      source: stage.source[locale],
      body: stage.brief[locale],
    },
    ...unresolvedWorkflowInbox.map((item) => ({
      id: item.id,
      status: item.actionRequired ? (locale === "en" ? "ACTION REQUIRED" : "ТРЕБУЕТСЯ ДЕЙСТВИЕ") : (locale === "en" ? "CASE UPDATE" : "ОБНОВЛЕНИЕ ДЕЛА"),
      title: item.subject[locale],
      source: locale === "en" ? "Versioned case inbox" : "Версионный Inbox дела",
      body: item.body[locale],
    })),
  ];
  const deadlineRows = scenario.deadlines.filter((deadline) => !canonicalState?.activeDeadlineIds || canonicalState.activeDeadlineIds.includes(deadline.id)).map((deadline) => {
    const completed = completedDeadlineIds.includes(deadline.id);
    const missed = missedDeadlineIds.includes(deadline.id);
    const dueAtMinute = canonicalState?.deadlineDueMinutes?.[deadline.id] ?? deadline.dueAtMinute;
    const remaining = dueAtMinute - caseMinute;
    return { deadline, dueAtMinute, completed, missed, remaining };
  }).sort((left, right) => left.dueAtMinute - right.dueAtMinute);
  const nextDeadline = deadlineRows.find((row) => !row.completed && !row.missed);
  const availableCount = sessionSync === "opening" ? 0 : stage.options.filter((option) => {
    if (scenario.mobileParity) return Boolean(option.canonicalActionId && canonicalState?.availableActionIds?.includes(option.canonicalActionId));
    const uses = actionUseCounts[actionUseKey(option)] ?? 0;
    return decisionAvailability(option, metrics, uses).available;
  }).length;

  function remainingLabel(minutes: number) {
    const absolute = Math.abs(minutes);
    const days = Math.floor(absolute / 1440);
    const hours = Math.floor((absolute % 1440) / 60);
    const mins = absolute % 60;
    const value = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${mins}m`].filter(Boolean).join(" ");
    return minutes < 0 ? (locale === "en" ? `${value} overdue` : `просрочено на ${value}`) : (locale === "en" ? `${value} remaining` : `осталось ${value}`);
  }

  function revealDecisions() {
    decisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      decisionRef.current?.querySelector<HTMLButtonElement>(".decision-options button")?.focus();
    }, 380);
  }
  if (outcome) return <DebriefView locale={locale} text={text} scenario={scenario} metrics={metrics} ledger={ledger} decisionLog={decisionLog} outcome={outcome} canonicalOutcome={canonicalState?.canonicalOutcome} exportSession={exportSession} replayCase={replayCase} returnLibrary={returnLibrary} returnToStudio={returnToStudio} requestFeedback={() => requestFeedback("case")}/>;
  return <main className="operations-view"><aside className="case-rail"><button className="rail-back" onClick={returnLibrary}><span>←</span>{returnToStudio ? text.studio : text.library}</button><div className="rail-case"><small>ACTIVE MATTER</small><b>{scenario.title[locale]}</b><span>{scenario.jurisdiction}</span></div><div className="workflow-depth"><span>{scenario.stages.length} STAGES</span><span>{scenario.mobileParity?.actionCount ?? scenario.stages.reduce((sum, item) => sum + item.options.length, 0)} ACTIONS</span></div><div className={`run-authority ${sessionSync}`}><span>{sessionSync === "server" ? (locale === "en" ? "SERVER-AUTHORITATIVE RUN" : "РАСЧЁТ НА СЕРВЕРЕ") : sessionSync === "opening" ? (locale === "en" ? "OPENING RUN…" : "ЗАПУСК…") : sessionSync === "stale" ? (locale === "en" ? "SERVER STATE RESTORED" : "СОСТОЯНИЕ ВОССТАНОВЛЕНО") : sessionSync === "error" ? (locale === "en" ? "SYNC NEEDS RETRY" : "НУЖНА СИНХРОНИЗАЦИЯ") : (locale === "en" ? "LOCAL PREVIEW RUN" : "ЛОКАЛЬНЫЙ ПРЕДПРОСМОТР")}</span></div><ol className="stage-list">{scenario.stages.map((item, index) => <li key={item.id} className={index === stageIndex ? "active" : visitedStageIds.has(item.id) ? "done" : ""}><span>{visitedStageIds.has(item.id) && index !== stageIndex ? "✓" : index + 1}</span><div><b>{item.phase[locale]}</b><small>{item.terminal ? "TERMINAL" : item.id.replaceAll("_", " ")}</small></div></li>)}</ol><div className="rail-version">CONTENT v{scenario.version}<br/><code>{scenario.fingerprint}</code></div></aside>
    <section className="command-center">
      <div className="command-header">
        <div>
          <div className="eyebrow"><span className="live-dot"/>LIVE OPERATION · {text.day.toUpperCase()} {clock.day}</div>
          <h1>{scenario.title[locale]}</h1>
          <p>{stage.phase[locale]} <span>·</span> {clock.time}</p>
        </div>
        <div className="clock-controls">
          <div className="command-clock"><span>{clock.time}</span><small>{text.day} {clock.day} · {scenario.mobileParity?.foregroundClock ? "FOREGROUND" : "CASE CLOCK"}</small></div>
          {scenario.mobileParity?.foregroundClock && <div className="time-advance-controls" aria-label={locale === "en" ? "Advance case time" : "Продвинуть время дела"}>
            <button disabled={timeBusy || sessionSync === "opening" || !canonicalState?.availableActionIds} onClick={() => advanceTime(60)}>+1h</button>
            <button disabled={timeBusy || sessionSync === "opening" || !canonicalState?.availableActionIds} onClick={() => advanceTime(360)}>+6h</button>
          </div>}
        </div>
      </div>
      <RunLedgerPanel locale={locale} ledger={ledger} day={clock.day} />
      <MetricPanel locale={locale} metrics={metrics} compact/>
      <article className="engagement-brief">
        <div><span>{locale === "en" ? "INITIAL SITUATION / MANDATE" : "НАЧАЛЬНАЯ СИТУАЦИЯ / ПОРУЧЕНИЕ"}</span><code>{scenario.caseId}</code></div>
        <p>{scenario.opening[locale]}</p>
      </article>
      <div className="ops-ledger">
        <button
          className="ledger-control ledger-inbox"
          onClick={() => { setSelectedInboxIndex(0); setInboxOpen(true); }}
          aria-haspopup="dialog"
          aria-label={`${text.attention}: ${inboxEntries.length}`}
        >
          <span>{text.attention}</span>
          <b>{inboxEntries.length}</b>
          <small>ACTION REQUIRED</small>
          <Icon name="arrow"/>
        </button>
        <button
          className="ledger-control ledger-decisions"
          onClick={revealDecisions}
          aria-label={`${text.decisions}: ${availableCount}`}
        >
          <span>{text.decisions}</span>
          <b>{availableCount}</b>
          <small>RESPONSE WINDOW OPEN</small>
          <Icon name="arrow"/>
        </button>
      </div>
      <section className="deadline-ledger" aria-label={locale === "en" ? "Case deadlines" : "Дедлайны дела"}>
        <div className="deadline-heading"><div><span>{locale === "en" ? "DEADLINE CONTROL" : "КОНТРОЛЬ СРОКОВ"}</span><h2>{locale === "en" ? "Time changes the case" : "Время изменяет дело"}</h2></div><code>{deadlineRows.length.toString().padStart(2,"0")} DEADLINES</code></div>
        {deadlineRows.length === 0 ? <p className="no-deadlines">{locale === "en" ? "No authored deadline is active in this introductory matter." : "В этом вводном деле нет настроенных дедлайнов."}</p> : <div className="deadline-list">{deadlineRows.map(({deadline,dueAtMinute,completed,missed,remaining}) => <div key={deadline.id} className={`deadline-row ${completed ? "complete" : missed ? "missed" : remaining <= 180 ? "urgent" : ""}`}><span className="deadline-state">{completed ? "✓" : missed ? "!" : "◷"}</span><div><b>{deadline.title[locale]}</b><small>{completed ? (locale === "en" ? "Completed" : "Выполнено") : missed ? remainingLabel(remaining) : remainingLabel(remaining)}</small></div><time>D{Math.floor(dueAtMinute/1440)+1} · {formatCaseClock(dueAtMinute).time}</time></div>)}</div>}
      </section>
      <article className="situation-panel">
        <div className="situation-top"><span>{text.situation}</span><code>{stage.source[locale]}</code></div>
        <h2>{stage.headline[locale]}</h2>
        <p>{stage.brief[locale]}</p>
        <div className={`pressure-band ${nextDeadline && nextDeadline.remaining <= 180 ? "active" : ""}`}>
          <Icon name={nextDeadline && nextDeadline.remaining <= 180 ? "alert" : "check"}/>
          <div><small>{text.pressure}</small><b>{nextDeadline ? `${nextDeadline.deadline.title[locale]} · ${remainingLabel(nextDeadline.remaining)}` : text.noPressure}</b></div>
        </div>
      </article>
      <section className="decision-entry" ref={decisionRef} tabIndex={-1}>
        <div>
          <span>STAGE {String(stageIndex+1).padStart(2,"0")} / {String(scenario.stages.length).padStart(2,"0")}</span>
          <h2>{locale === "en" ? "Analysis, engagement and available work" : "Анализ, принятие поручения и доступная работа"}</h2>
          <p>{locale === "en" ? "Every action adapted for the current web-beta stage is shown. Time advances and the quoted cost is recorded only after confirmation." : "Показаны все действия, адаптированные для текущей стадии веб-беты. После подтверждения продвигается время и фиксируется заявленная стоимость."}</p>
        </div>
        <div className="decision-options">
          {stage.options.map((option) => {
            const uses = actionUseCounts[actionUseKey(option)] ?? 0;
            const authoredAvailability = decisionAvailability(option, metrics, uses);
            const available = scenario.mobileParity
              ? Boolean(option.canonicalActionId && canonicalState?.availableActionIds?.includes(option.canonicalActionId))
              : authoredAvailability.available;
            const exhausted = scenario.mobileParity ? uses > 0 && option.repeatability === "once" : authoredAvailability.exhausted;
            const authoredCost = scenario.mobileParity ? option.costAuthored === true : true;
            const economics = `${authoredCost ? `€ ${option.cost.toLocaleString()}` : (locale === "en" ? "COST NOT AUTHORED" : "ЗАТРАТЫ НЕ ЗАДАНЫ")} · ${option.minutes} MIN`;
            const nextDay = option.completionDayOffset !== undefined && option.completionDayOffset > 0 ? (locale === "en" ? " · NEXT WORKDAY" : " · СЛЕДУЮЩИЙ РАБОЧИЙ ДЕНЬ") : "";
            const stateLabel = sessionSync === "opening"
              ? (locale === "en" ? "OPENING SERVER RUN" : "ЗАПУСК СЕРВЕРНОГО РАСЧЁТА")
              : exhausted
                ? (locale === "en" ? "COMPLETED" : "ВЫПОЛНЕНО")
                : !available
                  ? scenario.mobileParity
                    ? (locale === "en" ? "LOCKED BY CANONICAL RULE" : "ЗАБЛОКИРОВАНО КАНОНИЧЕСКИМ ПРАВИЛОМ")
                    : (locale === "en" ? "LOCKED BY RULE" : "ЗАБЛОКИРОВАНО ПРАВИЛОМ")
                  : `${economics}${nextDay}${option.repeatability === "limited" ? ` · ${uses}/${option.maxUses}` : ""}`;
            const title = !scenario.mobileParity && !available && !exhausted
              ? authoredAvailability.blockedGuards.map((guard) => `${guard.metric} ${guard.comparison} ${guard.value}`).join(", ")
              : undefined;
            return <button key={option.id} disabled={sessionSync === "opening" || !available} onClick={() => setSelectedOption(option)} title={title}><span>{option.label[locale]}</span><small>{stateLabel}</small><Icon name={sessionSync === "opening" || !available ? exhausted ? "check" : "alert" : "arrow"}/></button>;
          })}
        </div>
      </section>
      <button className="case-feedback-cta secondary-cta" onClick={() => requestFeedback("stage", stage.id)}><Icon name="file"/>{locale === "en" ? "Give feedback on this stage" : "Дать отзыв об этой стадии"}</button>
      {inboxOpen && (
        <InboxPanel
          locale={locale}
          entries={inboxEntries}
          selectedIndex={selectedInboxIndex}
          selectEntry={setSelectedInboxIndex}
          close={() => setInboxOpen(false)}
          openMaterial={(ref) => {
            setDossierRef(ref);
            setInboxOpen(false);
            window.setTimeout(() => document.querySelector(".dossier-pane")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          }}
        />
      )}
    </section>
    <aside className="dossier-pane"><div className="pane-heading"><span>{text.dossier}</span><b>{visibleMaterials.length}</b></div><p className="pane-intro">{text.visibleMaterial} · {text.provenance}</p><div className="material-tabs">{visibleMaterials.map((material) => <button key={material.ref} className={material.ref === activeMaterial?.ref ? "active" : ""} onClick={() => setDossierRef(material.ref)}><code>{material.ref}</code><span>{material.title[locale]}</span></button>)}</div>{activeMaterial ? <article className="material-sheet"><div className="sheet-punch"/><div className="sheet-reg">{activeMaterial.ref}</div><span className="document-type">{activeMaterial.type[locale]}</span><h3>{activeMaterial.title[locale]}</h3><dl><div><dt>SOURCE</dt><dd>{activeMaterial.source[locale]}</dd></div><div><dt>DATE / TIME</dt><dd>{activeMaterial.date}</dd></div><div><dt>CASE</dt><dd>{scenario.caseId}</dd></div></dl><p>{locale === "en" ? "Visible case material. Source identity remains attached; opening this record does not recommend a decision." : "Видимый материал дела. Идентичность источника сохранена; открытие записи не рекомендует решение."}</p><div className="sheet-status"><Icon name="check"/> PROVENANCE ATTACHED</div></article> : <p className="pane-intro">{locale === "en" ? "No evidence is available at this stage." : "На этой стадии материалы ещё недоступны."}</p>}{decisionLog.length > 0 && <section className="mini-log"><h3>{text.actionLog}</h3>{decisionLog.map((entry,index) => <div key={`${entry.option.id}-${index}`}><span>{String(index+1).padStart(2,"0")}</span><p>{entry.option.label[locale]}</p></div>)}</section>}</aside></main>;
}

function DebriefView({ locale, text, scenario, metrics, ledger, decisionLog, outcome, canonicalOutcome, exportSession, replayCase, returnLibrary, returnToStudio = false, requestFeedback }: { locale: Locale; text: UiText; scenario: Scenario; metrics: Record<MetricKey, number>; ledger: RunLedger; decisionLog: DecisionRecord[]; outcome: OutcomeClass; canonicalOutcome?: NonNullable<DecisionOption["resolvedOutcome"]>; exportSession: () => void; replayCase: () => void; returnLibrary: () => void; returnToStudio?: boolean; requestFeedback: () => void }) {
  const exactOutcome = canonicalOutcome ?? [...decisionLog].reverse().find((entry) => entry.option.resolvedOutcome)?.option.resolvedOutcome;
  const presentation = {
    strong: {
      classLabel: locale === "en" ? "FAVORABLE OUTCOME" : "БЛАГОПРИЯТНЫЙ ИСХОД",
      posture: locale === "en" ? "Position protected" : "Позиция защищена",
      explanation: locale === "en"
        ? "Evidence integrity, institutional trust and the legal position outweighed the remaining exposure."
        : "Целостность доказательств, институциональное доверие и правовая позиция перевесили оставшуюся экспозицию.",
      icon: "check",
    },
    mixed: {
      classLabel: locale === "en" ? "MIXED OUTCOME" : "СМЕШАННЫЙ ИСХОД",
      posture: locale === "en" ? "Position remains contested" : "Позиция остаётся спорной",
      explanation: locale === "en"
        ? "Material strengths were offset by unresolved exposure. The matter remains defensible, but not fully controlled."
        : "Сильные стороны были уравновешены нерешённой экспозицией. Дело остаётся защищаемым, но не полностью контролируемым.",
      icon: "file",
    },
    weak: {
      classLabel: locale === "en" ? "ADVERSE OUTCOME" : "НЕБЛАГОПРИЯТНЫЙ ИСХОД",
      posture: locale === "en" ? "Position compromised" : "Позиция ослаблена",
      explanation: locale === "en"
        ? "Accumulated exposure and institutional weaknesses outweighed the position preserved by individual decisions."
        : "Накопленная экспозиция и институциональные слабости перевесили позицию, сохранённую отдельными решениями.",
      icon: "alert",
    },
  }[outcome];

  return (
    <main className="debrief-view page-width">
      <div className="debrief-mark"><span>CASE CLOSED</span><b>{scenario.id.includes(".studio.") ? "STUDIO" : String(scenario.order / 10).padStart(2, "0")}</b></div>
      <div className="eyebrow"><span className="live-dot"/>{text.complete}</div>
      <h1>{scenario.title[locale]}</h1>

      <section className={`outcome-verdict outcome-${outcome}`}>
        <div className="verdict-classification">
          <span className="verdict-icon"><Icon name={presentation.icon} size={27}/></span>
          <small>{presentation.classLabel}</small>
          <b>{presentation.posture}</b>
        </div>
        <div className="verdict-narrative">
          <span>{locale === "en" ? "FINAL CASE OUTCOME" : "ИТОГОВЫЙ РЕЗУЛЬТАТ ДЕЛА"}</span>
          <h2>{exactOutcome?.title[locale] ?? scenario.outcomes[outcome][locale]}</h2>
          <p>{exactOutcome?.summary[locale] ?? presentation.explanation}</p>
        </div>
      </section>

      <section className="financial-result">
        <div className="financial-heading">
          <div><span>{locale === "en" ? "FINANCIAL RESULT" : "ФИНАНСОВЫЙ РЕЗУЛЬТАТ"}</span><h2>{locale === "en" ? "Matter economics" : "Экономика дела"}</h2></div>
          <small>{ledger.financialOutcomeAuthored ? (locale === "en" ? "Outcome quantified by the source case" : "Исход количественно задан в исходном кейсе") : (locale === "en" ? "Outcome amount is not authored in this source case" : "Сумма исхода не задана в исходном кейсе")}</small>
        </div>
        <dl className="financial-grid">
          <div><dt>{locale === "en" ? (ledger.costCoverage === "complete" || ledger.spendAuthoritative ? "Legal spend" : "Known legal spend") : (ledger.costCoverage === "complete" || ledger.spendAuthoritative ? "Юридические расходы" : "Известные юридические расходы")}</dt><dd>€ {ledger.spendEur.toLocaleString()}</dd></div>
          <div><dt>{locale === "en" ? (ledger.billableCoverage === "complete" ? "Billable time" : "Known billable time") : (ledger.billableCoverage === "complete" ? "Учтённое время" : "Известное учтённое время")}</dt><dd>{ledger.billableCoverage === "not-authored" ? "—" : `${(ledger.billableMinutes / 60).toFixed(1)} h`}</dd></div>
          <div><dt>{locale === "en" ? "Award / settlement" : "Присуждение / урегулирование"}</dt><dd>{ledger.financialOutcomeAuthored ? `€ ${ledger.awardEur.toLocaleString()}` : "—"}</dd></div>
          <div><dt>{locale === "en" ? "Outcome costs" : "Расходы по исходу"}</dt><dd>{ledger.financialOutcomeAuthored ? `€ ${ledger.outcomeCostsEur.toLocaleString()}` : "—"}</dd></div>
          <div className="financial-net"><dt>{locale === "en" ? "Net financial result" : "Чистый финансовый результат"}</dt><dd>{ledger.financialOutcomeAuthored && (ledger.costCoverage === "complete" || ledger.spendAuthoritative) ? `€ ${(ledger.awardEur - ledger.outcomeCostsEur - ledger.spendEur).toLocaleString()}` : ledger.financialOutcomeAuthored ? (locale === "en" ? "Partially quantified" : "Рассчитан частично") : (locale === "en" ? "Not quantified" : "Не рассчитан")}</dd></div>
          {ledger.authorizedBudgetEur > 0 && <div className={ledger.spendEur > ledger.authorizedBudgetEur ? "budget-exceeded" : ""}><dt>{ledger.spendEur > ledger.authorizedBudgetEur ? (locale === "en" ? "Budget exceeded" : "Превышение бюджета") : (locale === "en" ? "Budget remaining" : "Остаток бюджета")}</dt><dd>€ {Math.abs(ledger.authorizedBudgetEur - ledger.spendEur).toLocaleString()}</dd></div>}
        </dl>
        {ledger.costCoverage !== "complete" && <p className="financial-caveat">{ledger.spendAuthoritative ? (locale === "en" ? "The total spend is authoritative in the canonical runtime; some individual actions do not carry a separate cost annotation." : "Итоговые расходы авторитетно рассчитаны каноническим runtime; для отдельных действий стоимость отдельно не размечена.") : (locale === "en" ? "Only action costs explicitly authored in the canonical mobile scenario are included; no missing values were invented." : "Учтены только затраты, явно заданные в каноническом мобильном сценарии; отсутствующие значения не выдумывались.")}</p>}
      </section>

      <section className="final-posture">
        <div className="final-posture-heading">
          <span>{locale === "en" ? "Final institutional posture" : "Итоговая институциональная позиция"}</span>
          <small>{locale === "en" ? `Values after ${decisionLog.length} confirmed decision${decisionLog.length === 1 ? "" : "s"}` : `Значения после подтверждённых решений: ${decisionLog.length}`}</small>
        </div>
        <MetricPanel locale={locale} metrics={metrics} compact/>
      </section>

      <div className="debrief-grid">
        <section>
          <h2>{text.actionLog}</h2>
          {decisionLog.map((entry, index) => (
            <article key={`${entry.option.id}-${index}`} className="log-entry">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{entry.stage}</small>
                <b>{entry.option.label[locale]}</b>
                <p>{entry.option.result[locale]}</p>
                <div className="log-effects">
                  {(Object.entries(entry.option.effects) as Array<[MetricKey, number]>).map(([key, value]) => (
                    <i key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</i>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
        <aside className="outcome-reasons">
          <h2>{locale === "en" ? "Why this outcome" : "Почему получен этот исход"}</h2>
          <p>{locale === "en" ? "Each confirmed response changed the final posture. These were the decisive consequences:" : "Каждый подтверждённый ответ изменял итоговую позицию. Определяющими стали следующие последствия:"}</p>
          <ol>
            {decisionLog.map((entry, index) => <li key={entry.option.id}><span>{String(index + 1).padStart(2, "0")}</span><p>{entry.option.result[locale]}</p></li>)}
          </ol>
          <div className="canonical-note"><Icon name="file"/><p>{text.canonNote}</p></div>
        </aside>
      </div>

      <div className="debrief-actions">
        <button className="secondary-cta" onClick={returnLibrary}>{returnToStudio ? (locale === "en" ? "Return to Studio" : "Вернуться в Studio") : text.returnLibrary}</button>
        <button className="secondary-cta" onClick={requestFeedback}><Icon name="file"/>{text.feedback}</button>
        <button className="secondary-cta" onClick={exportSession}><Icon name="download"/>{text.exportPlay}</button>
        <button className="primary-cta" onClick={replayCase}><Icon name="reset"/>{locale === "en" ? "Replay this case" : "Пройти кейс заново"}</button>
      </div>
    </main>
  );
}

function InboxPanel({ locale, entries, selectedIndex, selectEntry, close, openMaterial }: { locale: Locale; entries: InboxEntry[]; selectedIndex: number; selectEntry: (index: number) => void; close: () => void; openMaterial: (ref: string) => void }) {
  const entry = entries[selectedIndex] ?? entries[0];
  return (
    <div className="inbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="inbox-panel" role="dialog" aria-modal="true" aria-labelledby="inbox-panel-title">
        <header>
          <div>
            <span>OPERATIONAL INBOX</span>
            <h2 id="inbox-panel-title">{locale === "en" ? "Attention required" : "Требуют внимания"}</h2>
          </div>
          <b>{entries.length.toString().padStart(2, "0")}</b>
          <button onClick={close} aria-label={locale === "en" ? "Close inbox" : "Закрыть входящие"}><Icon name="close"/></button>
        </header>
        <div className="inbox-panel-body">
          <nav aria-label={locale === "en" ? "Attention messages" : "Сообщения, требующие внимания"}>
            {entries.map((item, index) => (
              <button key={item.id} className={index === selectedIndex ? "active" : ""} onClick={() => selectEntry(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{item.status}</small><b>{item.title}</b><code>{item.source}</code></div>
                <Icon name="arrow"/>
              </button>
            ))}
          </nav>
          <article className="inbox-message">
            <div className="message-register"><span>{entry.status}</span><code>{entry.id}</code></div>
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
            <dl>
              <div><dt>SOURCE / TIME</dt><dd>{entry.source}</dd></div>
              <div><dt>STATUS</dt><dd>{locale === "en" ? "Unread · visible record" : "Не прочитано · видимая запись"}</dd></div>
            </dl>
            <div className="message-actions">
              <button className="secondary-cta" onClick={close}>{locale === "en" ? "Return to operation" : "Вернуться к операции"}</button>
              {entry.materialRef && <button className="primary-cta" onClick={() => openMaterial(entry.materialRef!)}>{locale === "en" ? "Open linked material" : "Открыть связанный материал"}<Icon name="arrow"/></button>}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function MetricPanel({ locale, metrics, compact = false }: { locale: Locale; metrics: Record<MetricKey, number>; compact?: boolean }) {
  return <div className={`metric-panel ${compact ? "compact" : ""}`}>{(Object.keys(metrics) as MetricKey[]).map((key) => <div key={key} className={`metric metric-${key}`}><div><span>{metricLabels[locale][key]}</span><b>{metrics[key]}</b></div><i><em style={{ width: `${metrics[key]}%` }}/></i></div>)}</div>;
}

function RunLedgerPanel({ locale, ledger, day }: { locale: Locale; ledger: RunLedger; day: number }) {
  const remaining = ledger.authorizedBudgetEur > 0 ? ledger.authorizedBudgetEur - ledger.spendEur : null;
  return <section className="run-ledger" aria-label={locale === "en" ? "Current case resources" : "Текущие ресурсы дела"}>
    <div className={remaining !== null && remaining < 0 ? "resource-alert" : ""}><span>{locale === "en" ? (ledger.costCoverage === "complete" || ledger.spendAuthoritative ? "TOTAL SPEND" : "KNOWN SPEND") : (ledger.costCoverage === "complete" || ledger.spendAuthoritative ? "ВСЕГО ЗАТРАТ" : "ИЗВЕСТНЫЕ ЗАТРАТЫ")}</span><b>€ {ledger.spendEur.toLocaleString()}</b><small>{remaining === null ? (locale === "en" ? "No budget authored" : "Бюджет не задан") : remaining < 0 ? `${locale === "en" ? "Exceeded" : "Превышение"}: € ${Math.abs(remaining).toLocaleString()}` : `${locale === "en" ? "Remaining" : "Остаток"}: € ${remaining.toLocaleString()}`}</small></div>
    <div className={ledger.staminaModelled && ledger.stamina < 35 ? "resource-alert" : ""}><span>STAMINA</span><b>{ledger.staminaModelled ? `${ledger.stamina}/100` : "—"}</b><small>{ledger.staminaModelled ? `${locale === "en" ? "Fatigue" : "Усталость"} ${ledger.fatigue} · ${locale === "en" ? "strain" : "нагрузка"} ${ledger.cumulativeStrain}` : (locale === "en" ? "Not authored for this case" : "Не задана для этого кейса")}</small></div>
    <div><span>{locale === "en" ? "WORKING DAY" : "РАБОЧИЙ ДЕНЬ"}</span><b>{String(day).padStart(2, "0")}</b><small>{locale === "en" ? "Deadlines keep running" : "Сроки продолжают идти"}</small></div>
    <div><span>{locale === "en" ? "BILLABLE TIME" : "УЧТЁННОЕ ВРЕМЯ"}</span><b>{ledger.billableCoverage === "not-authored" ? "—" : `${(ledger.billableMinutes / 60).toFixed(1)} h`}</b><small>{ledger.billableCoverage === "not-authored" ? (locale === "en" ? "Not authored for this case" : "Не задано для этого кейса") : `${ledger.billableMinutes.toLocaleString()} min`}</small></div>
  </section>;
}

function DecisionModal({ locale, text, scenario, stageHeadline, option, isResult, busy, close, dispatch, advance, finalStage }: { locale: Locale; text: UiText; scenario: Scenario; stageHeadline: string; option: DecisionOption; isResult: boolean; busy: boolean; close: () => void; dispatch: () => void | Promise<void>; advance: () => void; finalStage: boolean }) {
  const completionTime = option.completionMinuteOfDay === undefined
    ? null
    : `${String(Math.floor(option.completionMinuteOfDay / 60)).padStart(2, "0")}:${String(option.completionMinuteOfDay % 60).padStart(2, "0")}`;
  const nextWorkday = option.completionDayOffset !== undefined && option.completionDayOffset > 0;
  const authoredCost = scenario.mobileParity ? option.costAuthored === true : true;
  const workloadAuthored = option.fatigueDelta !== undefined || option.strainDelta !== undefined || option.resetsFatigue;
  const fatigueLabel = option.resetsFatigue
    ? (locale === "en" ? "fatigue reset" : "сброс усталости")
    : `${locale === "en" ? "fatigue" : "усталость"} ${(option.fatigueDelta ?? 0) >= 0 ? "+" : ""}${option.fatigueDelta ?? 0}`;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isResult && !busy) close(); }}>
      <section className={`decision-modal ${isResult ? "result" : ""}`} role="dialog" aria-modal="true" aria-labelledby="decision-title" aria-busy={busy}>
        {!isResult && <button className="modal-close" onClick={close} disabled={busy} aria-label={text.cancel}><Icon name="close"/></button>}
        <div className="modal-register">{isResult ? "DISPATCH RECORD" : "RESPONSE REVIEW"}<span>{scenario.caseId}</span></div>
        <div className="modal-icon"><Icon name={isResult ? "check" : "file"} size={30}/></div>
        <span className="modal-kicker">{isResult ? text.consequence : text.review}</span>
        <h2 id="decision-title">{option.label[locale]}</h2>
        <p className="modal-context">{isResult ? option.result[locale] : option.detail[locale]}</p>
        {!isResult && <div className="modal-source"><small>CURRENT SITUATION</small><p>{stageHeadline}</p></div>}
        <dl className="decision-cost">
          <div><dt>{text.cost}</dt><dd>{authoredCost ? `EUR ${option.cost.toLocaleString()}` : (locale === "en" ? "Not authored" : "Не задана")}</dd></div>
          <div><dt>{text.duration}</dt><dd>{option.minutes} min</dd></div>
          <div><dt>{locale === "en" ? "Billable time" : "Учтённое время"}</dt><dd>{option.billableMinutes === undefined ? (locale === "en" ? "Not authored" : "Не задано") : `${option.billableMinutes} min`}</dd></div>
          <div><dt>{locale === "en" ? "Workload" : "Нагрузка"}</dt><dd>{workloadAuthored ? `${fatigueLabel} · ${locale === "en" ? "strain" : "напряжение"} ${(option.strainDelta ?? 0) >= 0 ? "+" : ""}${option.strainDelta ?? 0}` : (locale === "en" ? "Not modelled" : "Не моделируется")}</dd></div>
          {nextWorkday && <div className="decision-calendar"><dt>{locale === "en" ? "Calendar transition" : "Переход календаря"}</dt><dd>{locale === "en" ? "Next workday" : "Следующий рабочий день"}{completionTime ? ` · ${completionTime}` : ""}</dd></div>}
        </dl>
        <div className="effect-preview">{(Object.entries(option.effects) as Array<[MetricKey, number]>).map(([key,value]) => <span key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</span>)}</div>
        <div className="modal-actions">
          {!isResult && <button className="secondary-cta" onClick={close} disabled={busy}>{text.cancel}</button>}
          <button className="primary-cta" disabled={busy} onClick={isResult ? advance : dispatch}>{busy ? (locale === "en" ? "Recording…" : "Фиксация…") : isResult ? (finalStage ? text.debrief : text.continueCase) : text.confirm}<Icon name="arrow"/></button>
        </div>
      </section>
    </div>
  );
}

type StudioViewProps = {
  standalone?: boolean;
  locale: Locale; text: UiText; prompt: string; setPrompt: React.Dispatch<React.SetStateAction<string>>; draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>; selectedNode: StudioNode | null; selectedNodeId: string | null;
  selectNode: (id: string | null) => void; checks: Array<{ level: "ok" | "warn"; text: string }>; packageRequiresPlayableRoute: boolean;
  generateDraft: () => void; applyPromptIteration: () => void; applyReviewedAIPlan: (plan: StudioPromptPlan, baseFingerprint: string) => boolean; applyCanonicalMarkdownDraft: (draft: StudioDraft) => void; saveDraft: () => void; savedFlash: boolean;
  exportDraft: () => void; importRef: React.RefObject<HTMLInputElement | null>; importDraft: (file: File) => void;
  createChildVersion: () => void; updateNode: (change: Partial<StudioNode>) => void;
  recordVisualEdit: (action: StudioEditAction, message: string, before?: StudioDraft) => void; addNode: (type: StudioNodeType, preferredPosition?: { x: number; y: number }) => void;
  addLink: (from: string, to: string) => void; relinkLink: (previous: StudioLink, next: StudioLink) => void;
  deleteLink: (link: StudioLink) => void; deleteNode: () => void;
  moveNode: (event: React.PointerEvent<HTMLButtonElement>, node: StudioNode, graphScale?: number) => void; resetDraft: () => boolean | void;
  loadExample: () => void; loadTaxTemplate: () => void; requestFeedback: () => void;
  timeline: StudioTimeline; undoDraft: () => void; redoDraft: () => void;
  restoreRevision: (revision: StudioRevision) => void; playDraft: () => void;
  isPrivate: boolean; setPrivate: (value: boolean) => void; customCaseId: number | null; setCustomCaseId: (value: number | null) => void;
  canManagePrivacy: boolean; setCanManagePrivacy: (value: boolean) => void;
  serverFingerprint: string | null; setServerFingerprint: (value: string | null) => void;
  serverPublicationFingerprint: string | null; setServerPublicationFingerprint: (value: string | null) => void;
  copyProtectionLocked: boolean; setCopyProtectionLocked: (value: boolean) => void; canDuplicate: boolean; aiEntitlement: StudioAIEntitlement;
  reportReceiptStorageScope: string | null; persistReportReceiptOnDevice: boolean;
};

type StudioDerivations = {
  source: StudioDraft | null;
  bytes: number;
  aiBaseFingerprint: string;
  caseFingerprint: string;
  compilation: ReturnType<typeof compileStudioDraft>;
};

function computeStudioDerivations(source: StudioDraft): StudioDerivations {
  const exactCaseFingerprint = caseFingerprint(source);
  return {
    source,
    bytes: studioJsonBytes(source),
    aiBaseFingerprint: studioAIBaseFingerprint(source),
    caseFingerprint: exactCaseFingerprint,
    compilation: compileStudioDraft(source, exactCaseFingerprint),
  };
}

function StudioView({ standalone = false, locale, text, prompt, setPrompt, draft, setDraft, selectedNode, selectedNodeId, selectNode, checks, packageRequiresPlayableRoute, generateDraft, applyPromptIteration, applyReviewedAIPlan, applyCanonicalMarkdownDraft, saveDraft, savedFlash, exportDraft, importRef, importDraft, createChildVersion, updateNode, recordVisualEdit, addNode, addLink, relinkLink, deleteLink, deleteNode, moveNode, resetDraft, loadExample, loadTaxTemplate, requestFeedback, timeline, undoDraft, redoDraft, restoreRevision, playDraft, isPrivate, setPrivate, customCaseId, setCustomCaseId, canManagePrivacy, setCanManagePrivacy, serverFingerprint, setServerFingerprint, serverPublicationFingerprint, setServerPublicationFingerprint, copyProtectionLocked, setCopyProtectionLocked, canDuplicate, reportReceiptStorageScope, persistReportReceiptOnDevice, aiEntitlement }: StudioViewProps) {
  const [workspaceState, setWorkspaceState] = useState<"idle" | "saving" | "saved" | "submitted" | "conflict" | "auth_required" | "error">("idle");
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [relationStatus, setRelationStatus] = useState("");
  const fieldBefore = useRef("");
  const fieldBeforeDraft = useRef<StudioDraft | null>(null);
  const economicPromptSyncRef = useRef(0);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [selectedRuleLinkId, setSelectedRuleLinkId] = useState<string | null>(null);
  const [aiState, setAIState] = useState<"idle" | "analysing" | "ready" | "error">("idle");
  const [aiError, setAIError] = useState("");
  const [promptLimitNotice, setPromptLimitNotice] = useState(false);
  const [aiResult, setAIResult] = useState<{ key: string; baseFingerprint: string; plan: StudioPromptPlan; model: string | null; requestId: string | null } | null>(null);
  const [displayMode, setDisplayMode] = useState<"user" | "developer">("user");
  const [guidedStep, setGuidedStep] = useState<GuidedStudioStep>(1);
  const [workspaceSavedFingerprint, setWorkspaceSavedFingerprint] = useState<string | null>(null);
  const [studioDerivations, setStudioDerivations] = useState<StudioDerivations>({
    source: null,
    bytes: 0,
    aiBaseFingerprint: "",
    caseFingerprint: "",
    compilation: { scenario: null, issues: [], warnings: [] },
  });
  const [derivationAttempt, setDerivationAttempt] = useState(0);
  const [derivationError, setDerivationError] = useState(false);
  const [derivedPrompt, setDerivedPrompt] = useState(prompt);
  const [relationPage, setRelationPage] = useState(0);
  const [relationNodeQuery, setRelationNodeQuery] = useState("");
  const [relationNodePage, setRelationNodePage] = useState(0);
  const [destinationNodeQuery, setDestinationNodeQuery] = useState("");
  const [destinationNodePage, setDestinationNodePage] = useState(0);
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphOrientation, setGraphOrientation] = useState<GraphOrientation>("vertical");
  const graphDraftIdentity = `${draft.caseId}\u0000${draft.version}`;
  const guidedWorkflowKey = studioWorkflowStorageKey(draft.caseId);
  const guidedDraftIsEmpty = !draft.title.trim() && draft.nodes.length === 0 && draft.links.length === 0;
  const graphDraftIdentityRef = useRef(graphDraftIdentity);
  const guidedWorkflowRestoredRef = useRef(false);
  const defaultGraphLayoutRef = useRef("");
  const [caseReportOpen, setCaseReportOpen] = useState(false);
  const [caseReportFingerprint, setCaseReportFingerprint] = useState("");
  const [caseReportStatus, setCaseReportStatus] = useState("");
  const [caseMarkdownOpen, setCaseMarkdownOpen] = useState(false);
  const [canonicalCandidate, setCanonicalCandidate] = useState<{ draft: StudioDraft; fingerprint: string; status: "amended"|"final"; language: "en"|"ru" } | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const graphDeckRef = useRef<HTMLElement | null>(null);
  const graphViewportRef = useRef<HTMLDivElement | null>(null);
  const moreActionsRef = useRef<HTMLDetailsElement | null>(null);
  const pendingAuthActionRef = useRef<"save" | "submit">("save");
  const shareDraftRef = useRef<(action: "save" | "submit", pending?: PendingWorkspaceSave) => Promise<void>>(async () => undefined);
  const derivationsSettled = studioDerivations.source === draft;
  const promptDerivationsSettled = derivationsSettled && derivedPrompt === prompt;
  const canonicalPrompt = prompt.includes("GENESIS-JURIS-CANONICAL-V1");
  const promptPlan = useMemo<StudioPromptPlan>(() => canonicalPrompt
    ? { instruction: "", operations: [], diagnostics: [], canApply: false, contextOnly: false, planner: "deterministic" }
    : derivationsSettled
    ? planStudioPromptIteration(draft, { instruction: derivedPrompt, locale, nodeLabels: text.nodeTypes, selectedNodeId })
    : { instruction: "", operations: [], diagnostics: [], canApply: false, contextOnly: false, planner: "deterministic" }, [canonicalPrompt, derivationsSettled, derivedPrompt, draft, locale, selectedNodeId, text.nodeTypes]);
  const draftBytes = studioDerivations.bytes;
  const draftWithinEnvelope = draftBytes <= STUDIO_DRAFT_SERIALIZED_LIMIT;
  const aiBaseFingerprint = studioDerivations.aiBaseFingerprint;
  const workspaceFingerprint = `${aiBaseFingerprint}\u0000${isPrivate ? "private" : "restricted"}`;
  const visibleWorkspaceState = !derivationsSettled || ((workspaceState === "saved" || workspaceState === "submitted") && workspaceSavedFingerprint !== workspaceFingerprint) ? "idle" : workspaceState;
  const aiInputKey = `${aiBaseFingerprint}\u0000${locale}\u0000${selectedNodeId ?? ""}\u0000${prompt.trim()}`;
  const aiInputKeyRef = useRef(aiInputKey);
  const activeAIResult = derivationsSettled && aiResult?.key === aiInputKey ? aiResult : null;
  useEffect(() => { shareDraftRef.current = shareDraft; });
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("auth_retry") === "1";
    if (!requested) return;
    const pending = parsePendingWorkspaceSave(window.sessionStorage.getItem(PENDING_WORKSPACE_SAVE_KEY));
    window.sessionStorage.removeItem(PENDING_WORKSPACE_SAVE_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_retry");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    const retry = window.setTimeout(() => {
      if (!pending) { setWorkspaceState("error"); return; }
      setDraft(pending.draft);
      setPrivate(pending.isPrivate);
      setServerFingerprint(pending.serverFingerprint);
      setServerPublicationFingerprint(pending.serverPublicationFingerprint);
      window.setTimeout(() => void shareDraftRef.current(pending.action, pending), 100);
    }, 0);
    return () => window.clearTimeout(retry);
    // This intentionally runs once on the dispatch-owned SIWC return URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function openWorkspaceAuthorization(action: "save" | "submit") {
    const pending: PendingWorkspaceSave = {
      schema: PENDING_WORKSPACE_SAVE_KEY,
      action,
      draft,
      isPrivate,
      serverFingerprint,
      serverPublicationFingerprint,
      requestedAt: Date.now(),
    };
    window.sessionStorage.setItem(PENDING_WORKSPACE_SAVE_KEY, JSON.stringify(pending));
    // SIWC must start as a top-level navigation; a client router or fetch is not valid here.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/signin-with-chatgpt?return_to=${encodeURIComponent("/?view=studio&auth_retry=1")}`);
  }
  const aiNodeTitles = useMemo(() => {
    const titles = new Map(draft.nodes.map((node) => [node.id, node.title]));
    for (const operation of activeAIResult?.plan.operations ?? []) {
      if (operation.kind === "add_node") titles.set(operation.node.id, operation.node.title);
    }
    return titles;
  }, [activeAIResult, draft.nodes]);
  const simplePlanNodeTitles = useMemo(() => {
    const titles = new Map(draft.nodes.map((node) => [node.id, node.title]));
    for (const operation of promptPlan.operations) {
      if (operation.kind === "add_node") titles.set(operation.node.id, operation.node.title);
    }
    return titles;
  }, [draft.nodes, promptPlan.operations]);
  const reviewLinkEndpoints = useMemo(() => new Map(draft.links.map((link) => [link.id, { from: link.from, to: link.to }])), [draft.links]);
  const compiledDraft = derivationsSettled ? studioDerivations.compilation : { scenario: null, issues: [], warnings: [] };
  const validationReady = Boolean(derivationsSettled
    && checks.every((check) => check.level === "ok")
    && (!packageRequiresPlayableRoute || compiledDraft.scenario));
  const nodeById = useMemo(() => new Map(draft.nodes.map((node) => [node.id, node])), [draft.nodes]);
  const nodeNumberById = useMemo(() => new Map(draft.nodes.map((node, index) => [node.id, index + 1])), [draft.nodes]);
  const graphBounds = useMemo(() => graphBoundsForNodes(draft.nodes), [draft.nodes]);
  const graphBoundsRef = useRef(graphBounds);
  useEffect(() => {
    graphBoundsRef.current = graphBounds;
  }, [graphBounds]);
  useEffect(() => {
    function closeMoreActionsOnOutsidePointer(event: PointerEvent) {
      const menu = moreActionsRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    }
    function closeMoreActionsOnEscape(event: KeyboardEvent) {
      const menu = moreActionsRef.current;
      if (event.key !== "Escape" || !menu?.open) return;
      const focusWasInside = document.activeElement instanceof Node && menu.contains(document.activeElement);
      menu.open = false;
      if (focusWasInside) menu.querySelector<HTMLElement>("summary")?.focus();
    }
    document.addEventListener("pointerdown", closeMoreActionsOnOutsidePointer, true);
    document.addEventListener("keydown", closeMoreActionsOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMoreActionsOnOutsidePointer, true);
      document.removeEventListener("keydown", closeMoreActionsOnEscape);
    };
  }, []);
  const fitGraph = useCallback(() => {
    const viewport = graphViewportRef.current;
    const width = viewport?.clientWidth ?? graphDeckRef.current?.clientWidth ?? 1_200;
    const height = viewport?.clientHeight ?? 570;
    const bounds = graphBoundsRef.current;
    const scale = Math.max(0.55, Math.min(1, (width - 28) / bounds.width, (height - 28) / bounds.height));
    setGraphZoom(scale);
    // Wait for CSS zoom and the new canvas bounds to settle, then return to a
    // deterministic origin. Smooth scrolling could be interrupted and leave
    // the newly arranged first row clipped above the viewport.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => viewport?.scrollTo({ left: 0, top: 0, behavior: "auto" })));
  }, []);
  const relationPageSize = 20;
  const relationPageCount = Math.max(1, Math.ceil(draft.links.length / relationPageSize));
  const safeRelationPage = Math.min(relationPage, relationPageCount - 1);
  const visibleRelations = useMemo(() => draft.links.slice(safeRelationPage * relationPageSize, (safeRelationPage + 1) * relationPageSize), [draft.links, safeRelationPage]);
  const relationNodeMenu = useMemo(() => studioNodeMenuPage(draft.nodes, relationNodeQuery, relationNodePage), [draft.nodes, relationNodePage, relationNodeQuery]);
  const destinationNodes = useMemo(() => draft.nodes.filter((node) => node.id !== selectedNodeId), [draft.nodes, selectedNodeId]);
  const destinationNodeMenu = useMemo(() => studioNodeMenuPage(destinationNodes, destinationNodeQuery, destinationNodePage), [destinationNodePage, destinationNodeQuery, destinationNodes]);
  const selectedRuleLink = draft.links.find((link) => link.id === selectedRuleLinkId) ?? null;
  const taxDraft = isTaxDraft(draft);
  const paletteNodeTypes = (Object.keys(typeColors) as StudioNodeType[]).filter((type) => displayMode === "developer" || taxDraft || type !== "tax_rule");
  const inferredDealModel = useMemo(() => inferDealEconomicsFromText([
    draft.premise,
    ...draft.nodes.flatMap((node) => [node.title, node.detail]),
    ...draft.editHistory.filter((entry) => entry.action === "prompt_submitted").map((entry) => entry.message),
  ].join("\n")), [draft.editHistory, draft.nodes, draft.premise]);
  const editableDealModel = draft.dealEconomics ?? inferredDealModel;
  const taxModel = useMemo(() => editableDealModel
    ? prefillTaxEconomicsFromDeal(draft.taxEconomics, editableDealModel)
    : draft.taxEconomics ?? defaultTaxEconomics(), [draft.taxEconomics, editableDealModel]);
  const taxResult = useMemo(() => taxDraft ? calculateTaxEconomics(taxModel) : null, [taxDraft, taxModel]);
  const taxBaseBreakdown = useMemo(() => {
    if (!editableDealModel) return null;
    const source = rentalTaxBaseFromDeal(editableDealModel);
    if (!source) return null;
    if (source.currency === taxModel.currency) return source;
    const rate = taxModel.fx?.sourceCurrency === source.currency && taxModel.fx.targetCurrency === taxModel.currency ? taxModel.fx.rate : null;
    return rate ? convertRentalTaxBase(source, taxModel.currency, rate) : null;
  }, [editableDealModel, taxModel.currency, taxModel.fx]);
  const syncEconomicPrompt = useCallback((nextDraft: StudioDraft) => {
    const request = ++economicPromptSyncRef.current;
    void import("./studio-economic-prompt").then(({ synchronizedEconomicPrompt }) => {
      if (request === economicPromptSyncRef.current) setPrompt((current) => synchronizedEconomicPrompt(current, nextDraft));
    });
  }, [setPrompt]);
  const selectedRevision = timeline.revisions.find((revision) => revision.id === selectedRevisionId) ?? timeline.revisions.at(-1) ?? null;
  const selectedDiff = selectedRevision ? diffStudioSnapshots(selectedRevision.before, selectedRevision.after) : null;
  const restoreDiff = selectedRevision ? diffDraftToRevision(draft, selectedRevision) : null;
  const userLocalFallback = !canonicalPrompt && ((aiEntitlement !== "ready" && aiEntitlement !== "loading") || aiState === "error");

  useEffect(() => () => aiAbortRef.current?.abort(), []);

  useEffect(() => {
    if (graphDraftIdentityRef.current === graphDraftIdentity) return;
    graphDraftIdentityRef.current = graphDraftIdentity;
    setGraphOrientation("vertical");
  }, [graphDraftIdentity]);

  useEffect(() => {
    guidedWorkflowRestoredRef.current = false;
    const timer = window.setTimeout(() => {
      const queryStep = parseStudioWorkflowStep(new URL(window.location.href).searchParams.get("studio_step"));
      let storedStep: GuidedStudioStep | null = null;
      try { storedStep = parseStudioWorkflowStep(window.localStorage.getItem(guidedWorkflowKey)); } catch { /* URL state remains authoritative when device storage is unavailable. */ }
      const restoredStep = restoredStudioWorkflowStep(guidedDraftIsEmpty, queryStep, storedStep);
      guidedWorkflowRestoredRef.current = true;
      if (guidedDraftIsEmpty) {
        const stage = serializedStudioWorkflowStep(1);
        try { window.localStorage.setItem(guidedWorkflowKey, stage); } catch { /* Guided navigation remains available without device persistence. */ }
        const url = new URL(window.location.href);
        if (url.searchParams.get("studio_step") !== stage) {
          url.searchParams.set("studio_step", stage);
          window.history.replaceState(window.history.state, "", url);
        }
      }
      setGuidedStep(restoredStep);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [guidedDraftIsEmpty, guidedWorkflowKey]);

  useEffect(() => {
    if (!guidedWorkflowRestoredRef.current) return;
    const stage = serializedStudioWorkflowStep(guidedStep);
    try { window.localStorage.setItem(guidedWorkflowKey, stage); } catch { /* Guided navigation still works without device persistence. */ }
    const url = new URL(window.location.href);
    if (url.searchParams.get("studio_step") === stage) return;
    url.searchParams.set("studio_step", stage);
    window.history.replaceState(window.history.state, "", url);
  }, [guidedStep, guidedWorkflowKey]);

  useEffect(() => {
    function restoreGuidedStepFromHistory() {
      const step = parseStudioWorkflowStep(new URL(window.location.href).searchParams.get("studio_step"));
      if (step) setGuidedStep(guidedDraftIsEmpty ? 1 : step);
    }
    window.addEventListener("popstate", restoreGuidedStepFromHistory);
    return () => window.removeEventListener("popstate", restoreGuidedStepFromHistory);
  }, [guidedDraftIsEmpty]);

  useEffect(() => {
    const layoutKey = `${graphDraftIdentity}\u0000${draft.nodes.map((node) => node.id).join("\u0001")}`;
    if (!canDuplicate || draft.nodes.length < 2 || defaultGraphLayoutRef.current === layoutKey) return;
    defaultGraphLayoutRef.current = layoutKey;
    setGraphOrientation("vertical");
    let cancelled = false;
    void import("./studio-layout").then(({ layoutStudioNodes }) => {
      if (cancelled) return;
      setDraft((current) => {
        const currentKey = `${current.caseId}\u0000${current.version}\u0000${current.nodes.map((node) => node.id).join("\u0001")}`;
        if (currentKey !== layoutKey) return current;
        const nodes = layoutStudioNodes(current.nodes, current.links, "vertical");
        return nodes.some((node, index) => node.x !== current.nodes[index]?.x || node.y !== current.nodes[index]?.y) ? { ...current, nodes } : current;
      });
      window.requestAnimationFrame(() => window.requestAnimationFrame(fitGraph));
    });
    return () => { cancelled = true; };
  }, [canDuplicate, draft.nodes, fitGraph, graphDraftIdentity, setDraft]);

  useEffect(() => {
    let idleHandle: number | null = null;
    let watchdogHandle: number | null = null;
    let cancelled = false;
    let finished = false;
    const derive = () => {
      if (cancelled || finished) return;
      finished = true;
      try {
        const next = computeStudioDerivations(draft);
        if (!cancelled) {
          setStudioDerivations(next);
          setDerivationError(false);
        }
      } catch {
        if (!cancelled) setDerivationError(true);
      }
    };
    const debounceHandle = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(derive, { timeout: 700 });
        watchdogHandle = window.setTimeout(derive, 1_000);
      } else watchdogHandle = globalThis.setTimeout(derive, 0) as unknown as number;
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(debounceHandle);
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
      if (watchdogHandle !== null) window.clearTimeout(watchdogHandle);
    };
  }, [derivationAttempt, draft]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDerivedPrompt(prompt), 180);
    return () => window.clearTimeout(timer);
  }, [prompt]);

  useEffect(() => {
    if (!taxDraft || JSON.stringify(draft.taxEconomics) === JSON.stringify(taxModel)) return;
    const nextDraft = { ...draft, taxEconomics: taxModel };
    setDraft((current) => current === draft ? nextDraft : current);
    syncEconomicPrompt(nextDraft);
  }, [draft, setDraft, syncEconomicPrompt, taxDraft, taxModel]);

  useEffect(() => { aiInputKeyRef.current = aiInputKey; }, [aiInputKey]);

  useEffect(() => {
    function cancelRelation(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setLinkSourceId(null);
      setRelationStatus("");
    }
    document.addEventListener("keydown", cancelRelation);
    return () => document.removeEventListener("keydown", cancelRelation);
  }, []);

  useEffect(() => {
    function timelineShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      if (event.shiftKey) redoDraft(); else undoDraft();
    }
    document.addEventListener("keydown", timelineShortcut);
    return () => document.removeEventListener("keydown", timelineShortcut);
  }, [redoDraft, undoDraft]);

  async function analysePromptWithAI() {
    const instruction = prompt.trim();
    if (!instruction || !canDuplicate || !derivationsSettled) return;
    if (!draftWithinEnvelope) {
      setAIState("error");
      setAIError(locale === "en" ? "This draft is larger than the 900 KB Studio envelope. Shorten node or relation details before AI analysis." : "Черновик превышает лимит Studio 900 КБ. Сократите описания узлов или связей перед AI-анализом.");
      return;
    }
    if (canonicalPrompt) {
      setAIState("analysing");
      setAIError("");
      setCanonicalCandidate(null);
      try {
        const { parseCaseMarkdown } = await import("./case-markdown");
        const candidate = await parseCaseMarkdown(instruction);
        if (!candidate) throw new Error();
        setCanonicalCandidate(candidate);
        setAIState("idle");
      } catch {
        setAIState("error");
        setAIError(locale === "en" ? "The canonical Markdown is incomplete or its fingerprint does not match." : "Канонический Markdown неполон либо его отпечаток не совпадает.");
      }
      return;
    }
    if (aiEntitlement !== "ready") return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const requestKey = aiInputKey;
    const baseFingerprint = aiBaseFingerprint;
    setAIState("analysing");
    setAIError("");
    try {
      const response = await fetch("/api/studio/ai-plan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction, locale, selectedNodeId, baseFingerprint, draft: toStudioAIContext(draft) }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401 || (response.status === 403 && isRecord(payload) && payload.code === "profile_required")) throw new Error(locale === "en" ? "AI access requires a signed-in, registered professional profile. Use the access action above without closing this tab." : "Для AI нужен вход и зарегистрированный профессиональный профиль. Используйте кнопку доступа выше, не закрывая эту вкладку.");
      if (!isRecord(payload)) throw new Error(locale === "en" ? "AI planning returned an unreadable response." : "AI-планировщик вернул нечитаемый ответ.");
      if (!response.ok) {
        const { localizedStudioAIError } = await import("./studio-ai-client-error");
        throw new Error(localizedStudioAIError(locale, payload.code, payload.error));
      }
      const plan = returnedAIStudioPlan(payload.plan, instruction);
      if (!plan || payload.baseFingerprint !== baseFingerprint || requestKey !== aiInputKeyRef.current) throw new Error(locale === "en" ? "The AI plan no longer matches this graph." : "AI-план больше не соответствует этой схеме.");
      setAIResult({ key: requestKey, baseFingerprint, plan, model: typeof payload.model === "string" ? payload.model : null, requestId: typeof payload.requestId === "string" ? payload.requestId : null });
      setAIState("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      setAIState("error");
      setAIError(error instanceof Error ? error.message : (locale === "en" ? "AI planning failed safely." : "AI-планирование безопасно остановлено."));
    } finally {
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
    }
  }

  function applyActiveAIPlan() {
    if (!activeAIResult?.plan.canApply) return;
    const reviewedPlan: StudioPromptPlan = { ...activeAIResult.plan, aiProvenance: {
      model: activeAIResult.model,
      requestId: activeAIResult.requestId,
      baseFingerprint: activeAIResult.baseFingerprint,
      planFingerprint: canonicalFingerprint({ kind: "studio-ai-plan-v1", plan: activeAIResult.plan }),
    } };
    if (applyReviewedAIPlan(reviewedPlan, activeAIResult.baseFingerprint)) {
      setAIResult(null);
      setAIState("idle");
      setAIError("");
      if (displayMode === "user") setGuidedStep(3);
      if (reviewedPlan.operations.some((operation) => operation.kind === "add_node")) window.setTimeout(() => void autoLayoutGraph(), 0);
      else window.requestAnimationFrame(fitGraph);
    }
  }

  function changeDisplayMode(mode: "user" | "developer") {
    setDisplayMode(mode);
  }

  async function openCaseReport() {
    if (!canDuplicate) {
      setCaseReportStatus(locale === "en" ? "Report export is unavailable in inspection-only mode." : "Экспорт отчёта недоступен в режиме просмотра.");
      return;
    }
    if (!draft.title.trim() || !draft.nodes.length) {
      setCaseReportStatus(locale === "en" ? "Add a case title and at least one node before creating the report." : "Перед созданием отчёта добавьте название кейса и хотя бы одну ноду.");
      return;
    }
    try {
      await import("./CaseReportDialog");
      setCaseReportStatus("");
      setCaseReportFingerprint(derivationsSettled ? studioDerivations.caseFingerprint : caseFingerprint(draft));
      setCaseReportOpen(true);
    } catch {
      setCaseReportStatus(locale === "en" ? "PDF unavailable. Refresh and retry." : "PDF недоступен. Обновите страницу.");
    }
  }

  function centerGraph() {
    const viewport = graphViewportRef.current;
    if (viewport) viewport.scrollTo({ left: Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2), top: Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2), behavior: "smooth" });
  }

  function visibleGraphCenter() {
    const viewport = graphViewportRef.current;
    if (!viewport) return { x: 430, y: 210 };
    const scale = Math.max(0.1, graphZoom);
    return {
      x: Math.max(20, Math.round((viewport.scrollLeft + viewport.clientWidth / 2) / scale - 82.5)),
      y: Math.max(20, Math.round((viewport.scrollTop + viewport.clientHeight / 2) / scale - 48)),
    };
  }

  async function autoLayoutGraph(orientation: GraphOrientation = graphOrientation) {
    if (!canDuplicate || draft.nodes.length < 2) { fitGraph(); return; }
    const { layoutStudioNodes } = await import("./studio-layout");
    const before = draft;
    const nodes = layoutStudioNodes(before.nodes, before.links, orientation);
    const changed = nodes.some((node, index) => node.x !== before.nodes[index]?.x || node.y !== before.nodes[index]?.y);
    if (changed) {
      setDraft({ ...before, nodes });
      recordVisualEdit("node_moved", locale === "en" ? `Visual edit: applied ${orientation} auto-layout.` : `Визуальная правка: авто-раскладка ${orientation === "vertical" ? "сверху вниз" : "слева направо"}.`, before);
    }
    const viewportWidth = graphViewportRef.current?.clientWidth ?? graphDeckRef.current?.clientWidth ?? 900;
    setGraphZoom(Math.max(0.72, Math.min(1, viewportWidth / 900)));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => graphViewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "auto" })));
    if (changed) setRelationStatus(locale === "en" ? `${orientation === "vertical" ? "Vertical" : "Horizontal"} layout applied.` : `Применена ${orientation === "vertical" ? "вертикальная" : "горизонтальная"} раскладка.`);
  }

  function clearTransientEditorSelection() {
    aiAbortRef.current?.abort();
    setAIState("idle");
    setAIResult(null);
    setAIError("");
    setPromptLimitNotice(false);
    setLinkSourceId(null);
    setSelectedRuleLinkId(null);
    setRelationStatus("");
    setSelectedRevisionId("");
    setWorkspaceSavedFingerprint(null);
    setWorkspaceState("idle");
  }

  const focusRelationStatus = useCallback(() => {
    window.requestAnimationFrame(() => document.getElementById("graph-connect-status")?.focus());
  }, []);

  function startBlankDraft() {
    const reset = resetDraft();
    if (reset !== false) { clearTransientEditorSelection(); setGraphOrientation("vertical"); setGuidedStep(1); }
  }

  function startExampleDraft() {
    const hasWork = Boolean(draft.nodes.length || draft.links.length || draft.title || draft.editHistory.length || prompt.trim());
    if (hasWork && !window.confirm(locale === "en" ? "Replace the current draft with the worked example? The current unsaved graph will be removed." : "Заменить текущий черновик учебным примером? Текущая несохранённая схема будет удалена.")) return;
    clearTransientEditorSelection();
    setGraphOrientation("vertical");
    setGuidedStep(3);
    loadExample();
  }

  function startTaxTemplate() {
    const hasWork = Boolean(draft.nodes.length || draft.links.length || draft.title || draft.editHistory.length || prompt.trim());
    if (hasWork && !window.confirm(locale === "en" ? "Replace the current draft with the tax template? The current unsaved graph will be removed." : "Заменить текущий черновик налоговым шаблоном? Текущая несохранённая схема будет удалена.")) return;
    clearTransientEditorSelection();
    setGraphOrientation("vertical");
    setGuidedStep(3);
    loadTaxTemplate();
  }

  useEffect(() => {
    function deleteSelectedGraphItem(event: KeyboardEvent) {
      if ((event.key !== "Delete" && event.key !== "Backspace") || event.metaKey || event.ctrlKey || event.altKey || !canDuplicate) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (selectedRuleLinkId) {
        const link = draft.links.find((item) => item.id === selectedRuleLinkId);
        if (!link) return;
        event.preventDefault();
        deleteLink(link);
        setSelectedRuleLinkId(null);
        setRelationStatus(locale === "en" ? "Relation deleted. Undo is available." : "Связь удалена. Доступна отмена действия.");
        focusRelationStatus();
        return;
      }
      if (!selectedNodeId || !draft.nodes.some((node) => node.id === selectedNodeId)) return;
      const relationCount = draft.links.filter((link) => link.from === selectedNodeId || link.to === selectedNodeId).length;
      if (relationCount && !window.confirm(locale === "en" ? `Delete the selected node and ${relationCount} connected relation(s)?` : `Удалить выбранный узел и связанные связи (${relationCount})?`)) return;
      event.preventDefault();
      deleteNode();
      setRelationStatus(locale === "en" ? "Node and its connected relations deleted. Undo is available." : "Узел и связанные с ним связи удалены. Доступна отмена действия.");
      focusRelationStatus();
    }
    document.addEventListener("keydown", deleteSelectedGraphItem);
    return () => document.removeEventListener("keydown", deleteSelectedGraphItem);
  }, [canDuplicate, deleteLink, deleteNode, draft.links, draft.nodes, focusRelationStatus, locale, selectedNodeId, selectedRuleLinkId]);

  async function shareDraft(action: "save" | "submit", pending?: PendingWorkspaceSave) {
    const targetDraft = pending?.draft ?? draft;
    const targetPrivate = pending?.isPrivate ?? isPrivate;
    const targetServerFingerprint = pending?.serverFingerprint ?? serverFingerprint;
    const targetServerPublicationFingerprint = pending?.serverPublicationFingerprint ?? serverPublicationFingerprint;
    if (!canDuplicate || studioJsonBytes(targetDraft) > STUDIO_DRAFT_SERIALIZED_LIMIT || (!pending && !derivationsSettled)) { setWorkspaceState("error"); return; }
    if ((targetServerFingerprint === null) !== (targetServerPublicationFingerprint === null)) { setWorkspaceState("conflict"); return; }
    setWorkspaceState("saving");
    try {
      const childFromCurrent = Boolean(targetServerFingerprint && targetServerPublicationFingerprint && targetDraft.parent?.fingerprint === targetServerFingerprint && targetDraft.parent.version !== targetDraft.version);
      const concurrency = targetServerFingerprint && targetServerPublicationFingerprint
        ? childFromCurrent
          ? { baseFingerprint: targetServerFingerprint, basePublicationFingerprint: targetServerPublicationFingerprint }
          : { expectedFingerprint: targetServerFingerprint, expectedPublicationFingerprint: targetServerPublicationFingerprint }
        : {};
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, draft: targetDraft, isPrivate: targetPrivate, ...concurrency }) });
      if (response.status === 401) {
        setWorkspaceState("auth_required");
        pendingAuthActionRef.current = action;
        openWorkspaceAuthorization(action);
        return;
      }
      if (!response.ok) {
        const failed = await response.json().catch(() => null) as { code?: string } | null;
        setWorkspaceState(response.status === 409 && failed?.code === "stale_draft" ? "conflict" : "error");
        return;
      }
      const saved = await readJsonResponse<{ customCase?: { id: number; isPrivate: boolean; fingerprint: string; publicationFingerprint: string; protection?: StudioDraft["protection"] } }>(response);
      if (saved?.customCase) {
        setCustomCaseId(saved.customCase.id); setPrivate(saved.customCase.isPrivate === true); setCanManagePrivacy(true); setServerFingerprint(saved.customCase.fingerprint);
        setServerPublicationFingerprint(saved.customCase.publicationFingerprint);
        if (saved.customCase.protection) {
          setDraft((current) => ({ ...current, protection: saved.customCase!.protection }));
          setCopyProtectionLocked(saved.customCase.protection.copyProtected === true);
        }
      }
      const savedPrivate = saved?.customCase?.isPrivate ?? targetPrivate;
      setWorkspaceSavedFingerprint(`${studioAIBaseFingerprint(targetDraft)}\u0000${savedPrivate ? "private" : "restricted"}`);
      setWorkspaceState(action === "submit" ? "submitted" : "saved");
    } catch {
      setWorkspaceState("error");
    }
  }

  async function changePrivacy(next: boolean) {
    if (!canManagePrivacy) return;
    if (next && !window.confirm(locale === "en" ? "Make this case owner-only? Saving this setting revokes every existing share and hides the case from the platform administrator." : "Сделать кейс доступным только владельцу? Сохранение настройки отзовёт все приглашения и скроет кейс от администратора платформы.")) return;
    if (customCaseId) {
      const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_privacy", id: customCaseId, isPrivate: next, caseId: draft.caseId }) });
      if (!response.ok) { setWorkspaceState("error"); return; }
    }
    setPrivate(next);
    setWorkspaceSavedFingerprint(`${aiBaseFingerprint}\u0000${next ? "private" : "restricted"}`);
    setWorkspaceState(customCaseId ? "saved" : "idle");
  }

  function changeCopyProtection(next: boolean) {
    if (!canManagePrivacy || (copyProtectionLocked && !next)) return;
    const before = draft;
    setDraft((current) => ({
      ...current,
      protection: {
        kind: "case-protection-v1",
        copyProtected: next,
        copyPolicy: next ? "lineage_locked" : "fork_allowed",
        parentCode: current.protection?.parentCode ?? null,
        currentCode: "",
        seal: "",
      },
    }));
    recordVisualEdit("case_updated", next ? (locale === "en" ? "Enabled inherited copy protection for this lineage." : "Включена наследуемая защита от копирования для линии кейса.") : (locale === "en" ? "Set this unsaved root lineage to allow forks." : "Для этой несохранённой корневой линии разрешены форки."), before);
  }

  function beginFieldEdit(value: string) { fieldBefore.current = value; fieldBeforeDraft.current = draft; }
  function commitNodeField(label: string, value: string) {
    if (!selectedNode || fieldBefore.current === value) return;
    recordVisualEdit("node_updated", locale === "en" ? `Visual edit: changed ${label} on “${selectedNode.title}”.` : `Визуальная правка: изменено поле «${label}» узла «${selectedNode.title}».`, fieldBeforeDraft.current ?? undefined);
    fieldBeforeDraft.current = null;
  }
  function applyNodeRuntimeChange(change: NonNullable<StudioNode["runtime"]>, label: string) {
    if (!selectedNode) return;
    const before = draft;
    updateNode({ runtime: { ...(selectedNode.runtime ?? {}), ...change } });
    recordVisualEdit("node_updated", locale === "en" ? `Visual edit: changed runtime ${label} on “${selectedNode.title}”.` : `Визуальная правка: изменено runtime-поле «${label}» узла «${selectedNode.title}».`, before);
  }
  function setNodeRuntimeChange(change: NonNullable<StudioNode["runtime"]>) {
    if (!selectedNode) return;
    updateNode({ runtime: { ...(selectedNode.runtime ?? {}), ...change } });
  }
  function optionalRuntimeInteger(value: string, maximum: number) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, Math.round(parsed))) : undefined;
  }
  function commitCaseField(label: string, value: string) {
    if (fieldBefore.current === value) return;
    recordVisualEdit("case_updated", locale === "en" ? `Visual edit: changed case ${label}.` : `Визуальная правка: изменено поле кейса «${label}».`, fieldBeforeDraft.current ?? undefined);
    fieldBeforeDraft.current = null;
  }
  function applyCaseChange(label: string, update: React.SetStateAction<StudioDraft>) {
    const before = draft;
    setDraft(update);
    recordVisualEdit("case_updated", locale === "en" ? `Visual edit: changed case ${label}.` : `Визуальная правка: изменено поле кейса «${label}».`, before);
  }
  function applyTaxEconomicsChange(change: Partial<NonNullable<StudioDraft["taxEconomics"]>>, label: string) {
    const before = draft;
    const nextDraft = { ...draft, taxEconomics: { ...taxModel, ...change } };
    setDraft(nextDraft);
    syncEconomicPrompt(nextDraft);
    recordVisualEdit("case_updated", locale === "en" ? `Visual edit: changed tax economics ${label}.` : `Визуальная правка: изменено поле налоговой экономики «${label}».`, before);
  }
  function setDealEconomicsChange(change: Partial<NonNullable<StudioDraft["dealEconomics"]>>) {
    if (!editableDealModel) return;
    const nextDeal = { ...editableDealModel, ...(draft.dealEconomics ?? {}), ...change };
    const nextTax = taxDraft ? applyDealChangeToTaxEconomics(taxModel, nextDeal, change) : draft.taxEconomics;
    const nextDraft = { ...draft, dealEconomics: nextDeal, ...(nextTax ? { taxEconomics: nextTax } : {}) };
    setDraft(nextDraft);
    syncEconomicPrompt(nextDraft);
  }
  async function changeTaxEconomicsCurrency(targetCurrency: string) {
    const sourceCurrency = taxModel.currency;
    if (targetCurrency === sourceCurrency) return { ok: true, message: "" };
    try {
      const { convertTaxEconomicsCurrency } = await import("./studio-tax-currency");
      const converted = await convertTaxEconomicsCurrency(taxModel, editableDealModel, targetCurrency);
      const before = draft;
      const nextDraft = { ...draft, taxEconomics: converted.tax };
      setDraft(nextDraft);
      syncEconomicPrompt(nextDraft);
      recordVisualEdit("case_updated", locale === "en" ? `Visual edit: converted tax economics from ${sourceCurrency} to ${targetCurrency} at the ECB reference rate dated ${converted.asOf}.` : `Визуальная правка: налоговая экономика пересчитана из ${sourceCurrency} в ${targetCurrency} по справочному курсу ECB от ${converted.asOf}.`, before);
      return { ok: true, message: locale === "en" ? `Converted at the ECB reference rate dated ${converted.asOf}.` : `Пересчитано по справочному курсу ECB от ${converted.asOf}.` };
    } catch {
      return { ok: false, message: locale === "en" ? "The current ECB reference rate is unavailable for this currency. Values were not changed." : "Текущий справочный курс ECB для этой валюты недоступен. Значения не изменены." };
    }
  }
  function commitDealEconomicsField(label: string, value: string) {
    if (fieldBefore.current === value) return;
    recordVisualEdit("case_updated", locale === "en" ? `Visual edit: changed cash-flow scenario ${label}.` : `Визуальная правка: изменён параметр cash-flow сценария «${label}».`, fieldBeforeDraft.current ?? undefined);
    fieldBeforeDraft.current = null;
  }
  function selectGraphNode(nodeId: string) {
    setSelectedRuleLinkId(null);
    setRelationStatus("");
    selectNode(nodeId);
  }
  function focusGraphNode(nodeId: string) {
    const node = nodeById.get(nodeId);
    if (!node) return;
    selectGraphNode(nodeId);
    setRelationStatus(locale === "en" ? `Focused node N${String(nodeNumberById.get(nodeId) ?? 0).padStart(2,"0")}.` : `В центре схемы нода N${String(nodeNumberById.get(nodeId) ?? 0).padStart(2,"0")}.`);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const viewport = graphViewportRef.current;
      const nodeButton = document.getElementById(`studio-node-${nodeId}`);
      if (viewport) {
        const scale = Math.max(0.1, graphZoom);
        const nodeHeight = graphNodeVisualHeight(node);
        viewport.scrollIntoView({ behavior: "smooth", block: "center" });
        viewport.scrollTo({
          left: Math.max(0, (node.x + 82.5) * scale - viewport.clientWidth / 2),
          top: Math.max(0, (node.y + nodeHeight / 2) * scale - viewport.clientHeight / 2),
          behavior: "smooth",
        });
      }
      nodeButton?.focus({ preventScroll: true });
    }));
  }
  function selectGraphLink(link: StudioLink) {
    selectNode(null);
    setSelectedRuleLinkId(link.id);
    const relationIndex = draft.links.findIndex((item) => item.id === link.id);
    if (relationIndex >= 0) setRelationPage(Math.floor(relationIndex / relationPageSize));
    const from = nodeById.get(link.from)?.title ?? link.from;
    const to = nodeById.get(link.to)?.title ?? link.to;
    setRelationStatus(locale === "en" ? `Selected relation: ${from} → ${to}. Press Delete to remove it.` : `Выбрана связь: ${from} → ${to}. Нажмите Delete для удаления.`);
  }
  function compilerIssueText(issue: (typeof compiledDraft.issues)[number]) {
    const names = issue.nodeIds.map((id) => nodeById.get(id)?.title).filter((title): title is string => Boolean(title));
    const suffix = names.length ? `: ${names.join(", ")}` : "";
    if (locale === "en") {
      if (issue.code === "missing_start") return "Add a Trigger node to define where the case starts.";
      if (issue.code === "missing_outcome") return "Add at least one Outcome node.";
      if (issue.code === "dead_end") return `Connect every open branch to an Outcome node${suffix}.`;
      if (issue.code === "cycle") return `Remove the loop between these nodes before testing${suffix}.`;
      if (issue.code === "unreachable") return `Connect these nodes to the main case path${suffix}.`;
      return "Complete the case title, jurisdiction, role and graph settings.";
    }
    if (issue.code === "missing_start") return "Добавьте узел «Триггер», с которого начинается кейс.";
    if (issue.code === "missing_outcome") return "Добавьте хотя бы один узел «Исход».";
    if (issue.code === "dead_end") return `Соедините каждую незавершённую ветвь с узлом «Исход»${suffix}.`;
    if (issue.code === "cycle") return `Уберите замкнутый цикл перед тестированием${suffix}.`;
    if (issue.code === "unreachable") return `Подключите эти узлы к основному маршруту кейса${suffix}.`;
    return "Заполните название, юрисдикцию, роль и обязательные настройки графа.";
  }
  function canUseRelation(from: string, to: string, ignoredLinkId = "") {
    if (!ignoredLinkId && draft.links.length >= 500) return locale === "en" ? "The 500-relation draft limit has been reached." : "Достигнут лимит черновика: 500 связей.";
    if (from === to) return locale === "en" ? "A node cannot link to itself." : "Узел нельзя связать с самим собой.";
    if (!draft.nodes.some((node) => node.id === from) || !draft.nodes.some((node) => node.id === to)) return locale === "en" ? "One endpoint is no longer available." : "Один из узлов больше недоступен.";
    if (draft.links.some((link) => link.id !== ignoredLinkId && link.from === from && link.to === to)) return locale === "en" ? "That directed relation already exists." : "Такая направленная связь уже существует.";
    return "";
  }
  function armLinkSource(nodeId: string) {
    setLinkSourceId(nodeId);
    const node = draft.nodes.find((item) => item.id === nodeId);
    setRelationStatus(locale === "en" ? `Source selected: ${node?.title ?? nodeId}. Choose an input port.` : `Выбран источник: ${node?.title ?? nodeId}. Выберите входной порт.`);
  }
  function completeLink(targetId: string) {
    if (!linkSourceId) {
      setRelationStatus(locale === "en" ? "Choose an output port first." : "Сначала выберите выходной порт.");
      return;
    }
    const issue = canUseRelation(linkSourceId, targetId);
    if (issue) { setRelationStatus(issue); return; }
    addLink(linkSourceId, targetId);
    const target = draft.nodes.find((node) => node.id === targetId);
    setRelationStatus(locale === "en" ? `Relation created to ${target?.title ?? targetId}.` : `Связь создана с узлом ${target?.title ?? targetId}.`);
    setLinkSourceId(null);
  }
  function changeRelation(link: StudioLink, endpoint: "from" | "to", value: string) {
    const next = { ...link, [endpoint]: value };
    const issue = canUseRelation(next.from, next.to, link.id);
    if (issue) { setRelationStatus(issue); return; }
    relinkLink(link, next);
    setRelationStatus(locale === "en" ? "Relation endpoint updated." : "Конец связи перепривязан.");
  }

  function setRelationRule(linkId: string, change: NonNullable<StudioLink["rule"]>) {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link) => link.id === linkId ? { ...link, rule: { ...(link.rule ?? {}), ...change } } : link),
    }));
  }
  function applyRelationRuleChange(linkId: string, change: NonNullable<StudioLink["rule"]>, label: string) {
    const before = draft;
    setRelationRule(linkId, change);
    recordVisualEdit("link_relinked", locale === "en" ? `Visual edit: changed ${label} for ${linkId}.` : `Визуальная правка: изменено поле «${label}» связи ${linkId}.`, before);
  }
  function commitRelationRule(linkId: string, label: string, value: string) {
    if (fieldBefore.current === value) return;
    recordVisualEdit("link_relinked", locale === "en" ? `Visual edit: changed ${label} for ${linkId}.` : `Визуальная правка: изменено поле «${label}» связи ${linkId}.`, fieldBeforeDraft.current ?? undefined);
    fieldBeforeDraft.current = null;
  }

  function nudgeNode(event: React.KeyboardEvent<HTMLButtonElement>, node: StudioNode) {
    if (!canDuplicate) return;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    selectGraphNode(node.id);
    const before = draft;
    setDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, x: Math.max(0, Math.min(5_000, item.x + direction[0] * step)), y: Math.max(0, Math.min(5_000, item.y + direction[1] * step)) } : item) }));
    recordVisualEdit("node_moved", locale === "en" ? `Visual edit: nudged “${node.title}” ${event.key.replace("Arrow", "").toLowerCase()} by ${step}px.` : `Визуальная правка: узел «${node.title}» сдвинут на ${step}px.`, before);
  }

  const firstSubmissionWarning = checks.find((check) => check.level === "warn")?.text ?? "";
  const submitBlocker = !canDuplicate
    ? (locale === "en" ? "This protected case is available for inspection only." : "Этот защищённый кейс доступен только для просмотра.")
    : !derivationsSettled
      ? derivationError
        ? (locale === "en" ? "Studio could not check the latest edit." : "Студии не удалось проверить последнюю правку.")
        : (locale === "en" ? "Wait while Studio finishes checking the latest edit." : "Подождите, пока Студия завершит проверку последней правки.")
      : !draftWithinEnvelope
        ? (locale === "en" ? "Shorten the case to the 900 KB Studio limit." : "Сократите кейс до лимита Studio 900 КБ.")
        : isPrivate
          ? (locale === "en" ? "Turn off Private before submitting for expert review." : "Отключите «Приватно» перед отправкой на экспертную рецензию.")
          : firstSubmissionWarning;
  const guidedReadiness = [
    Boolean(activeAIResult || canonicalCandidate || draft.nodes.length),
    Boolean(draft.nodes.length),
    Boolean(draft.title.trim() && draft.jurisdiction.trim() && draft.role.trim()),
    Boolean(draft.nodes.length > 1 && draft.links.length),
    validationReady,
    visibleWorkspaceState === "saved" || visibleWorkspaceState === "submitted",
  ] as const;
  function selectGuidedStep(step: GuidedStudioStep) {
    const url = new URL(window.location.href);
    url.searchParams.set("studio_step", serializedStudioWorkflowStep(step));
    window.history.pushState(window.history.state, "", url);
    setGuidedStep(step);
  }
  async function changeCaseType(id: CaseTypeId) {
    if (id !== "tax_compliance" && id !== "tax_planning" && draft.nodes.some((node) => node.type === "entity" || node.type === "tax_rule" || node.type === "cash_flow")) {
      setRelationStatus(locale === "en" ? "Tax-specific nodes keep this matter in the Tax & compliance package. Remove or convert those nodes before switching case type." : "Налоговые узлы сохраняют пакет «Налоги и compliance». Удалите или преобразуйте их перед сменой типа кейса.");
      return;
    }
    const { applyCaseType } = await import("./case-type-registry");
    applyCaseChange(locale === "en" ? "case type" : "тип кейса", (current) => applyCaseType(current, id));
  }
  const portableStudioActions = <Suspense fallback={null}><StudioUserMoreActions grouped={displayMode === "user"} locale={locale} canDuplicate={canDuplicate} exportReady={derivationsSettled && Boolean(draft.title.trim()) && Boolean(draft.nodes.length)} feedbackLabel={text.feedback} importLabel={text.importCustom} exportLabel={text.exportCustom} startExample={startExampleDraft} startTax={startTaxTemplate} requestFeedback={requestFeedback} importJson={()=>importRef.current?.click()} exportJson={exportDraft} saveDevice={saveDraft} markdownLoaded={(value)=>{setCanonicalCandidate(null);setAIResult(null);setAIState("idle");setPrompt(value);}} markdownOpened={()=>{setCaseReportStatus("");setCaseMarkdownOpen(true);}} markdownFailed={setCaseReportStatus}/></Suspense>;
    return <main className={`studio-view studio-${displayMode}-view studio-guided-step-${guidedStep} ${canDuplicate ? "" : "studio-inspection-view"}`} data-readonly={!canDuplicate || undefined}>
      <section className="studio-hero page-width">
        <div>
          <div className="eyebrow"><span className="live-dot"/>{standalone ? (locale === "en" ? "FALCON-MERLIN · PROFESSIONAL CASE STUDIO" : "FALCON-MERLIN · ПРОФЕССИОНАЛЬНАЯ СТУДИЯ КЕЙСОВ") : displayMode === "user" ? (locale === "en" ? "CASE STUDIO · GUIDED AUTHORING" : "СТУДИЯ КЕЙСОВ · ПОШАГОВОЕ СОЗДАНИЕ") : "AUTHORING LAB · VISUAL + PROMPT"}</div>
          <h1>{standalone ? (locale === "en" ? "Model the advice before the client acts" : "Смоделируйте консультацию до решения клиента") : displayMode === "user" ? (locale === "en" ? "Build your case" : "Создайте свой кейс") : text.author}</h1>
          <p>{standalone ? (locale === "en" ? "Turn a tax or legal matter into a reviewable case, recalculate alternative scenarios as assumptions change, and preserve the methodology in one canonical file." : "Превратите налоговую или юридическую задачу в проверяемый кейс, пересчитывайте альтернативные сценарии при изменении параметров и сохраняйте методологию в одном каноническом файле.") : displayMode === "user" ? (locale === "en" ? "Describe the situation, review the proposed scheme, adjust it visually and test the result." : "Опишите ситуацию, проверьте предложенную схему, скорректируйте её визуально и протестируйте результат.") : text.authorLead}</p>
          <div className="studio-display-mode" role="group" aria-label={locale === "en" ? "Studio interface mode" : "Режим интерфейса Студии"}>
            <button type="button" className={displayMode === "user" ? "active" : ""} aria-pressed={displayMode === "user"} onClick={() => changeDisplayMode("user")}><Icon name="person"/>{locale === "en" ? "Guided · User view" : "Пошагово · Вид пользователя"}</button>
            <button type="button" className={displayMode === "developer" ? "active" : ""} aria-pressed={displayMode === "developer"} onClick={() => changeDisplayMode("developer")}><Icon name="studio"/>{locale === "en" ? "Expert · Developer view" : "Экспертно · Вид разработчика"}</button>
          </div>
        </div>
        <div className="studio-actions">
          <button className="secondary-cta" onClick={startBlankDraft}><Icon name="reset"/>{text.newDraft}</button>
          <button className="secondary-cta" onClick={() => shareDraft("save")} disabled={!canDuplicate || !draftWithinEnvelope || !derivationsSettled || workspaceState === "saving"}><Icon name="save"/>{workspaceState === "saving" ? (locale === "en" ? "Saving…" : "Сохранение…") : (locale === "en" ? "Save to workspace" : "Сохранить в workspace")}</button>
          {displayMode === "developer" && <button className="secondary-cta report-cta" disabled={!canDuplicate} onClick={() => void openCaseReport()} title={locale === "en" ? "Open PDF options" : "Параметры PDF"}><Icon name="download"/>{locale === "en" ? "PDF report" : "PDF-отчёт"}</button>}
          {displayMode === "developer" && <button className="primary-cta" onClick={() => shareDraft("submit")} disabled={Boolean(submitBlocker) || workspaceState === "saving"} title={submitBlocker || undefined} aria-describedby={submitBlocker ? "studio-submit-blocker" : undefined}><Icon name="check"/>{locale === "en" ? "Submit for review" : "Отправить на рецензию"}</button>}
          {displayMode === "developer" ? portableStudioActions : <details ref={moreActionsRef} className="studio-more-actions"><summary><Icon name="plus"/>{locale === "en" ? "More actions" : "Другие действия"}</summary>{portableStudioActions}</details>}
          <input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file){ clearTransientEditorSelection(); importDraft(file); } event.target.value=""; }}/>
        </div>
        {submitBlocker && displayMode === "developer" && <p id="studio-submit-blocker" className="studio-submit-blocker"><Icon name="alert"/><span>{submitBlocker}</span>{derivationError && <button type="button" onClick={() => { setDerivationError(false); setDerivationAttempt((attempt) => attempt + 1); }}>{locale === "en" ? "Retry check" : "Повторить проверку"}</button>}{isPrivate && submitBlocker !== firstSubmissionWarning && <button type="button" onClick={() => document.getElementById("studio-case-settings")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{locale === "en" ? "Change visibility" : "Изменить видимость"}</button>}{firstSubmissionWarning && submitBlocker === firstSubmissionWarning && <button type="button" onClick={() => document.getElementById("studio-checks")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{locale === "en" ? "Review issue" : "Перейти к замечанию"}</button>}</p>}
        {savedFlash && <div className="save-toast"><Icon name="check"/>{text.saved}</div>}
        {caseReportStatus && <div className="save-toast report-toast" role="status"><Icon name="check"/>{caseReportStatus}</div>}
        {visibleWorkspaceState !== "idle" && <div className={`workspace-toast ${visibleWorkspaceState}`} role="status">{visibleWorkspaceState === "saving" ? (locale === "en" ? "Saving the current draft and visibility…" : "Сохраняются текущий черновик и режим видимости…") : visibleWorkspaceState === "auth_required" ? (locale === "en" ? "Continue sign-in; Studio will return here and retry this exact save automatically." : "Продолжите вход: Studio вернётся сюда и автоматически повторит сохранение этой версии.") : visibleWorkspaceState === "saved" ? (locale === "en" ? "Workspace draft and visibility saved." : "Черновик и режим видимости сохранены в workspace.") : visibleWorkspaceState === "submitted" ? (locale === "en" ? "Submitted to the expert review queue." : "Отправлено в очередь экспертной рецензии.") : visibleWorkspaceState === "conflict" ? (locale === "en" ? "A newer workspace version exists. Reopen the case before saving." : "В workspace уже есть более новая версия. Переоткройте кейс перед сохранением.") : !canDuplicate ? (locale === "en" ? "Inspection-only access: save, export and copy are disabled." : "Доступ только для просмотра: сохранение, экспорт и копирование отключены.") : !draftWithinEnvelope ? (locale === "en" ? "The draft exceeds the 900 KB Studio envelope. Shorten node or relation details." : "Черновик превышает лимит Studio 900 КБ. Сократите описания узлов или связей.") : (locale === "en" ? "The workspace change could not be saved. Check access, identity and case status." : "Не удалось сохранить изменение workspace. Проверьте доступ, идентификатор и статус кейса.")}{visibleWorkspaceState === "auth_required" && <button type="button" onClick={() => openWorkspaceAuthorization(pendingAuthActionRef.current)}>{locale === "en" ? "Continue sign-in" : "Продолжить вход"}</button>}</div>}
      </section>
    {!canDuplicate && <aside className="studio-readonly-notice page-width" role="status"><Icon name="file"/><div><b>{locale === "en" ? "Inspection-only case" : "Кейс только для просмотра"}</b><p>{locale === "en" ? "You can inspect the graph and rules, but this protected case cannot be edited, copied, exported or saved. Start a blank draft or open the worked example to author a separate case." : "Вы можете изучать схему и правила, но этот защищённый кейс нельзя редактировать, копировать, экспортировать или сохранять. Создайте новый черновик или откройте учебный пример для отдельной работы."}</p></div></aside>}
    <aside className="confidentiality-notice page-width"><Icon name="alert"/><p>{locale === "en" ? "Confidentiality: do not enter client-identifiable, privileged, personal or secret information. Use synthetic or de-identified facts and public legal sources." : "Конфиденциальность: не вводите сведения, идентифицирующие клиента, адвокатскую тайну, персональные данные или секреты. Используйте синтетические или обезличенные факты и публичные источники права."}</p></aside>
    {(displayMode === "developer" || !draftWithinEnvelope) && <div className={`draft-envelope page-width ${draftWithinEnvelope ? "" : "limit"}`} role={draftWithinEnvelope ? undefined : "alert"}><span>{locale === "en" ? "Studio case envelope" : "Объём кейса Studio"}</span><progress max={STUDIO_DRAFT_SERIALIZED_LIMIT} value={Math.min(draftBytes, STUDIO_DRAFT_SERIALIZED_LIMIT)}/><b>{Math.ceil(draftBytes / 1_000).toLocaleString()} / 900 KB</b>{!draftWithinEnvelope && <em>{locale === "en" ? "Shorten node or relation details before AI, workspace save or submission." : "Сократите описания узлов или связей перед AI-анализом, сохранением или отправкой."}</em>}</div>}
    {displayMode === "user" && <Suspense fallback={null}><StudioGuidedWizard locale={locale} activeStep={guidedStep} readiness={guidedReadiness} caseName={draft.title} saveState={visibleWorkspaceState} validationReady={validationReady} onStepChange={selectGuidedStep} onFocusBrief={() => document.getElementById("studio-case-brief")?.focus()} onStartExample={startExampleDraft} onImport={() => importRef.current?.click()}/></Suspense>}
    {(displayMode === "developer" || guidedStep === 1) && <Suspense fallback={null}><StudioCaseTypeSelector locale={locale} value={draft.caseType} disabled={!canDuplicate} onChange={changeCaseType}/><StudioCasePlaybook locale={locale} draft={draft} phase="intake"/></Suspense>}
    {displayMode === "user" && <section className="studio-user-undo page-width" aria-label={locale === "en" ? "Recent changes" : "Последние изменения"} inert={!canDuplicate}><div><Icon name="file"/><span>{locale === "en" ? `${timeline.cursor} saved change${timeline.cursor === 1 ? "" : "s"} in this session` : `Изменений в этой сессии: ${timeline.cursor}`}</span></div><div><button onClick={undoDraft} disabled={timeline.cursor === 0 || !canDuplicate}><Icon name="arrow"/>{locale === "en" ? "Undo" : "Отменить"}</button><button onClick={redoDraft} disabled={timeline.cursor >= timeline.revisions.length || !canDuplicate}>{locale === "en" ? "Redo" : "Повторить"}<Icon name="arrow"/></button></div></section>}
    {displayMode === "developer" && <section className="studio-history page-width" aria-labelledby="studio-history-title" inert={!canDuplicate}>
      <header>
        <div><span>{locale === "en" ? "Prompt & edit history" : "История промпта и правок"}</span><h2 id="studio-history-title">{locale === "en" ? "One case, one continuous authoring record" : "Один кейс — единая история редактирования"}</h2></div>
        <div className="history-toolbar"><button onClick={undoDraft} disabled={timeline.cursor === 0} aria-label={locale === "en" ? "Undo last Studio change" : "Отменить последнюю правку"}><Icon name="arrow"/>{locale === "en" ? "Undo" : "Отменить"}</button><button onClick={redoDraft} disabled={timeline.cursor >= timeline.revisions.length} aria-label={locale === "en" ? "Redo Studio change" : "Повторить правку"}>{locale === "en" ? "Redo" : "Повторить"}<Icon name="arrow"/></button><b>{draft.editHistory.length.toString().padStart(2,"0")}</b></div>
      </header>
      {timeline.revisions.length > 0 && <div className="revision-console">
        <label><span>{locale === "en" ? "Session revision" : "Версия сессии"}</span><select value={selectedRevision?.id ?? ""} onChange={(event) => setSelectedRevisionId(event.target.value)}>{timeline.revisions.map((revision, index) => <option key={revision.id} value={revision.id}>{String(index + 1).padStart(2,"0")} · {revision.label}</option>)}</select></label>
        {selectedDiff && <div className="revision-diff" aria-live="polite"><span>{selectedDiff.fields.length} {locale === "en" ? "fields" : "полей"}</span><span>+{selectedDiff.nodesAdded.length}/−{selectedDiff.nodesRemoved.length} {locale === "en" ? "nodes" : "узлов"}</span><span>Δ{selectedDiff.nodesChanged.length} {locale === "en" ? "changed" : "изменено"}</span><span>+{selectedDiff.linksAdded.length}/−{selectedDiff.linksRemoved.length} {locale === "en" ? "links" : "связей"}</span></div>}
        <button className="secondary-cta" disabled={!selectedRevision || !restoreDiff || [...restoreDiff.fields, ...restoreDiff.nodesAdded, ...restoreDiff.nodesRemoved, ...restoreDiff.nodesChanged, ...restoreDiff.linksAdded, ...restoreDiff.linksRemoved].length === 0} onClick={() => { if (selectedRevision && window.confirm(locale === "en" ? "Restore the state after this revision as a new reversible change?" : "Восстановить состояние после этой версии как новую обратимую правку?")) restoreRevision(selectedRevision); }}><Icon name="reset"/>{locale === "en" ? "Restore revision" : "Восстановить"}</button>
      </div>}
      {draft.editHistory.length ? <ol>{draft.editHistory.map((entry) => <li key={entry.id} className={`history-entry ${entry.role} source-${entry.source}`}><div><span>{entry.source === "prompt" ? "PROMPT" : locale === "en" ? "VISUAL EDIT" : "ВИЗУАЛЬНАЯ ПРАВКА"}</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><p>{entry.message}</p></li>)}</ol> : <p className="history-empty">{locale === "en" ? "Legacy draft: no authoring history was stored. Your next instruction or visual edit starts the record." : "Legacy-черновик: история редактирования отсутствует. Следующая инструкция или визуальная правка начнёт журнал."}</p>}
    </section>}
    {(displayMode === "developer" || guidedStep === 1) && <section className="prompt-deck page-width" inert={!canDuplicate}>
      <div className="prompt-label"><span>{locale === "en" ? "Describe the case or the change you need" : "Опишите кейс или нужное изменение"}</span>{displayMode === "developer" && <code>AI PLAN · REVIEW · APPLY</code>}</div>
      <textarea id="studio-case-brief" value={prompt} maxLength={STUDIO_PROMPT_CHARACTER_LIMIT} placeholder={locale === "en" ? "Describe, paste, or load a canonical .md case." : "Опишите, вставьте или загрузите канонический .md кейс."} onPaste={(event) => { const input=event.currentTarget; const finalLength=input.value.length-(input.selectionEnd-input.selectionStart)+event.clipboardData.getData("text").length; if(finalLength>STUDIO_PROMPT_CHARACTER_LIMIT)setPromptLimitNotice(true); }} onChange={(event) => { aiAbortRef.current?.abort(); setAIState("idle"); setAIResult(null); setCanonicalCandidate(null); setAIError(""); if(event.target.value.length<STUDIO_PROMPT_CHARACTER_LIMIT)setPromptLimitNotice(false); setPrompt(event.target.value); }} aria-label={text.prompt}/>
      {(displayMode === "developer" || promptLimitNotice) && <div className={`prompt-counter ${promptLimitNotice ? "limit" : ""}`} role={promptLimitNotice ? "alert" : undefined}><span>{prompt.length.toLocaleString()} / 64,000 {locale === "en" ? "characters" : "символов"}</span>{promptLimitNotice && <b>{locale === "en" ? "The text exceeds 64,000 characters." : "Текст превышает 64 000 символов."}</b>}</div>}
      <div className="prompt-actions">
        {canonicalCandidate
          ? <Suspense fallback={null}><CanonicalReadyAction locale={locale} review={() => document.getElementById("canonical-case-review")?.scrollIntoView({behavior:"smooth",block:"start"})}/></Suspense>
          : activeAIResult
            ? <button className="generate-button" onClick={() => document.getElementById("ai-plan-review")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon name="file" size={24}/><span>{locale === "en" ? "Review the AI proposal below" : "Проверьте AI-предложение ниже"}<small>{locale === "en" ? "Applying is available only after the complete operation list" : "Кнопка применения находится после полного списка операций"}</small></span><Icon name="arrow"/></button>
          : canonicalPrompt
            ? <Suspense fallback={null}><CanonicalPromptAction locale={locale} analysing={aiState === "analysing"} disabled={!prompt.trim() || aiState === "analysing" || !canDuplicate || !draftWithinEnvelope || !derivationsSettled} verify={() => { if (displayMode === "user") setGuidedStep(2); void analysePromptWithAI(); }}/></Suspense>
          : aiEntitlement === "ready"
            ? <button className="generate-button" disabled={!prompt.trim() || aiState === "analysing" || !canDuplicate || !draftWithinEnvelope || !derivationsSettled} onClick={() => { if (displayMode === "user") setGuidedStep(2); void analysePromptWithAI(); }}><Icon name="spark" size={24}/><span>{aiState === "analysing" ? (locale === "en" ? "AI is mapping the case…" : "AI строит смысловую схему…") : !derivationsSettled ? (locale === "en" ? "Finishing the latest edit…" : "Завершается последняя правка…") : (locale === "en" ? "Understand with AI" : "Понять и структурировать с AI")}<small>{locale === "en" ? "First create a reviewable proposal; nothing is changed yet" : "Сначала создаётся план для проверки; схема пока не меняется"}</small></span><Icon name="arrow"/></button>
            : aiEntitlement === "anonymous"
              ? <a className="generate-button" href={standalone ? "/signin-with-chatgpt?return_to=%2Fstudio" : "/signin-with-chatgpt?return_to=%2F%3Fview%3Dstudio"} target="_blank" rel="noreferrer"><Icon name="person" size={24}/><span>{locale === "en" ? "Sign in to use AI" : "Войдите для работы с AI"}<small>{locale === "en" ? "Opens a separate tab so this unsaved prompt and graph remain here" : "Вход откроется отдельно: несохранённые промпт и схема останутся в этой вкладке"}</small></span><Icon name="arrow"/></a>
              : aiEntitlement === "profile_required"
                ? <a className="generate-button" href={standalone ? "/account" : "/?view=community"} target="_blank" rel="noreferrer"><Icon name="person" size={24}/><span>{locale === "en" ? "Complete your profile to use AI" : "Заполните профиль для работы с AI"}<small>{locale === "en" ? "Registration opens separately; return here when the profile is saved" : "Регистрация откроется отдельно; после сохранения профиля вернитесь сюда"}</small></span><Icon name="arrow"/></a>
                : aiEntitlement === "not_configured"
                  ? <button className="generate-button" disabled><Icon name="spark" size={24}/><span>{locale === "en" ? "AI assistant is awaiting activation" : "AI-ассистент ожидает активации"}<small>{locale === "en" ? "The safe rule-based builder remains available; no data is sent" : "Безопасный локальный конструктор доступен; данные никуда не отправляются"}</small></span><Icon name="arrow"/></button>
                  : <button className="generate-button" disabled><Icon name="spark" size={24}/><span>{aiEntitlement === "loading" ? (locale === "en" ? "Checking AI access…" : "Проверка доступа к AI…") : (locale === "en" ? "AI access status is unavailable" : "Статус AI временно недоступен")}<small>{locale === "en" ? "The local case builder remains available" : "Локальный конструктор кейса остаётся доступен"}</small></span><Icon name="arrow"/></button>}
        {activeAIResult && <button className="rebuild-button" onClick={analysePromptWithAI} disabled={aiState === "analysing"}><Icon name="spark"/>{locale === "en" ? "Analyse again" : "Проанализировать снова"}</button>}
        {!canonicalPrompt && (displayMode === "developer" || userLocalFallback) && <button className="rebuild-button" disabled={!promptDerivationsSettled || !promptPlan.canApply || !canDuplicate} onClick={() => { applyPromptIteration(); if (displayMode === "user") setGuidedStep(3); }}><Icon name="file"/>{displayMode === "developer" ? (locale === "en" ? "Use exact commands" : "Применить точные команды") : promptPlan.contextOnly ? (locale === "en" ? "Add this text to case context" : "Добавить текст в контекст кейса") : (locale === "en" ? "Apply locally interpreted changes" : "Применить локально распознанные изменения")}</button>}
        {!canonicalPrompt && draft.nodes.length === 0 && (displayMode === "developer" || userLocalFallback) && <button className="rebuild-button" disabled={!prompt.trim() || !canDuplicate} onClick={() => { if (window.confirm(locale === "en" ? "Use the rule-based eight-node fallback instead of AI?" : "Использовать шаблон из восьми узлов вместо AI?")){ clearTransientEditorSelection(); generateDraft(); if (displayMode === "user") setGuidedStep(3); } }}><Icon name="reset"/>{locale === "en" ? "Quick rule-based template" : "Быстрый шаблон по правилам"}</button>}
      </div>
      <Suspense fallback={null}><StudioPromptPrivacyNote locale={locale} canonical={canonicalPrompt}/></Suspense>
    </section>}
    {(displayMode === "developer" || guidedStep === 2) && canonicalCandidate && <Suspense fallback={null}><CanonicalMarkdownReview locale={locale} draft={canonicalCandidate.draft} fingerprint={canonicalCandidate.fingerprint} status={canonicalCandidate.status} apply={() => { applyCanonicalMarkdownDraft(canonicalCandidate.draft); setCanonicalCandidate(null); setAIState("idle"); setAIError(""); if (displayMode === "user") setGuidedStep(3); }}/></Suspense>}
    {displayMode === "user" && guidedStep === 2 && userLocalFallback && !activeAIResult && prompt.trim() && promptDerivationsSettled && <section className={`simple-plan-preview page-width ${promptPlan.canApply ? "ready" : "blocked"}`}><header><div><span>{locale === "en" ? "Local fallback · review before applying" : "Локальный резервный режим · проверьте перед применением"}</span><b>{promptPlan.contextOnly ? (locale === "en" ? "This will only add text to the case context; it will not create nodes" : "Будет дополнен только контекст кейса; новые узлы не появятся") : (locale === "en" ? `${promptPlan.operations.length} proposed change${promptPlan.operations.length === 1 ? "" : "s"}` : `Предложено изменений: ${promptPlan.operations.length}`)}</b></div><small>{locale === "en" ? "No information is sent outside the application" : "Информация не отправляется за пределы приложения"}</small></header>{promptPlan.operations.length > 0 && <ol>{promptPlan.operations.map((operation,index)=><li key={`${operation.kind}-${index}`}><span aria-hidden="true">{index+1}</span><p>{describeStudioPromptOperation(operation,locale,simplePlanNodeTitles,{showIds:false,linkEndpoints:reviewLinkEndpoints})}</p></li>)}</ol>}{promptPlan.diagnostics.length > 0 && <ul>{promptPlan.diagnostics.map((diagnostic,index)=><li key={`${diagnostic.level}-${index}`} className={diagnostic.level}>{diagnostic.message}</li>)}</ul>}</section>}
    {(displayMode === "developer" || guidedStep === 2) && prompt.trim() && aiState === "analysing" && <Suspense fallback={<section className="prompt-ai-status prompt-ai-progress page-width analysing" role="status"><Icon name="spark"/><div className="ai-progress-body"><b>{locale === "en" ? "Reading and structuring the case…" : "Кейс анализируется и структурируется…"}</b><progress className="ai-progress-fallback" max={100} value={8}/></div></section>}><StudioAIProgress locale={locale}/></Suspense>}
    {(displayMode === "developer" || guidedStep === 2) && prompt.trim() && aiState === "error" && <section className="prompt-ai-status page-width error" role="alert"><Icon name="alert"/><div><b>{locale === "en" ? "No changes were made" : "Изменения не внесены"}</b><p>{aiError}</p><small>{displayMode === "developer" ? (locale === "en" ? "Retry AI analysis or inspect the exact-command preview below." : "Повторите AI-анализ или проверьте точный командный план ниже.") : (locale === "en" ? "Go back to the brief to retry AI analysis or apply the safe local interpretation." : "Вернитесь к описанию, чтобы повторить AI-анализ или применить безопасную локальную интерпретацию.")}</small></div></section>}
    {(displayMode === "developer" || guidedStep === 2) && activeAIResult && <Suspense fallback={<section className="prompt-ai-status page-width" role="status"><Icon name="spark"/><div><b>{locale === "en" ? "Preparing the proposed scheme…" : "Подготавливается предлагаемая схема…"}</b></div></section>}><StudioAIReview locale={locale} draft={draft} plan={activeAIResult.plan} nodeTitles={aiNodeTitles} linkEndpoints={reviewLinkEndpoints} nodeLabels={text.nodeTypes} applyEnabled={canDuplicate && aiState !== "analysing"} showTechnicalIds={displayMode === "developer"} onApply={applyActiveAIPlan}/></Suspense>}
    {displayMode === "developer" && !canonicalPrompt && prompt.trim() && <details className="prompt-fallback-preview page-width"><summary>{locale === "en" ? "Exact-command fallback preview" : "План точных команд — резервный режим"}</summary>{promptDerivationsSettled && <section className={`prompt-plan ${promptPlan.canApply ? "ready" : "blocked"}`}><header><div><span>{locale === "en" ? "Rule-based interpretation" : "Интерпретация по правилам"}</span><h2>{promptPlan.contextOnly ? (locale === "en" ? "Context-only turn" : "Только контекст") : (locale === "en" ? `${promptPlan.operations.length} exact operation${promptPlan.operations.length === 1 ? "" : "s"}` : `Точных операций: ${promptPlan.operations.length}`)}</h2></div><b>{promptPlan.canApply ? "READY" : "REVIEW"}</b></header>{promptPlan.operations.length > 0 && <ol>{promptPlan.operations.map((operation, index) => <li key={`${operation.kind}-${index}`}><code>{String(index + 1).padStart(2,"0")}</code><span>{describeStudioPromptOperation(operation, locale)}</span></li>)}</ol>}{promptPlan.diagnostics.length > 0 && <ul>{promptPlan.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.level}-${index}`} className={diagnostic.level}><Icon name={diagnostic.level === "error" ? "alert" : "check"}/>{diagnostic.message}</li>)}</ul>}</section>}</details>}
    {(displayMode === "developer" || guidedStep === 3) && <><div id="studio-case-settings" className="studio-settings-stack open">
    <section className="studio-meta page-width" inert={!canDuplicate}>
      <label><span>{text.title}</span><input value={draft.title} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,title:event.target.value}))} onBlur={(event)=>commitCaseField(text.title,event.currentTarget.value)}/></label>
      <label><span>{text.jurisdiction}</span><input value={draft.jurisdiction} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,jurisdiction:event.target.value}))} onBlur={(event)=>commitCaseField(text.jurisdiction,event.currentTarget.value)}/></label>
      <label><span>{text.role}</span><input value={draft.role} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,role:event.target.value}))} onBlur={(event)=>commitCaseField(text.role,event.currentTarget.value)}/></label>
      <label className="studio-context-field"><span>{locale === "en" ? "Publishable case context" : "Публикуемый контекст кейса"}</span><textarea maxLength={8000} value={draft.premise} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,premise:event.target.value,premisePublication:"author-reviewed"}))} onBlur={(event)=>commitCaseField(locale === "en" ? "case context" : "контекст кейса",event.currentTarget.value)}/><small>{locale === "en" ? "This text appears in the playable case and may become catalogue copy. Verify it before submission; the raw AI prompt is kept out of published artifacts." : "Этот текст используется в игровом кейсе и может войти в описание каталога. Проверьте его перед отправкой; исходный AI-промпт не публикуется."}</small></label>
    </section>
    <section className="studio-classification page-width" inert={!canDuplicate}>
      <label><span>{locale === "en" ? "Case domain" : "Домен кейса"}</span><select value={taxDraft ? "tax" : "general"} onChange={(event) => {
        const tax = event.target.value === "tax";
        if (!tax && draft.nodes.some((node) => node.type === "entity" || node.type === "tax_rule" || node.type === "cash_flow")) {
          setRelationStatus(locale === "en" ? "Tax-specific nodes keep this case in the Tax domain. Remove or convert those nodes first." : "Налоговые типы узлов сохраняют домен Tax. Сначала удалите или измените тип этих узлов.");
          return;
        }
        applyCaseChange(locale === "en" ? "domain" : "домен", (current) => ({
          ...current,
          classification: tax
            ? { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), domain: "tax", complianceOnly: true }
            : { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), domain: "general", practiceArea: "General legal", taxTopics: [], purpose: "compliance_review" },
          ...(tax ? { taxEconomics: current.taxEconomics ?? defaultTaxEconomics(current.dealEconomics?.currency ?? inferredDealModel?.currency ?? "EUR") } : { taxEconomics: undefined }),
        }));
      }}><option value="general">{locale === "en" ? "General legal" : "Общеправовой"}</option><option value="tax">{locale === "en" ? "Tax / cross-border structuring" : "Налоги / трансграничное структурирование"}</option></select></label>
      <label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={draft.classification?.practiceArea ?? "General legal"} onChange={(event) => applyCaseChange(locale === "en" ? "practice area" : "область практики", (current) => ({ ...current, classification: { ...(current.classification ?? { difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), practiceArea: event.target.value } }))}><option value="General legal">{locale === "en" ? "General legal" : "Общая юридическая практика"}</option><option value="International tax planning">{locale === "en" ? "International tax planning" : "Международное налоговое планирование"}</option><option value="Corporate tax">{locale === "en" ? "Corporate tax" : "Корпоративные налоги"}</option><option value="Transfer pricing">{locale === "en" ? "Transfer pricing" : "Трансфертное ценообразование"}</option><option value="Commercial disputes">{locale === "en" ? "Commercial disputes" : "Коммерческие споры"}</option><option value="AI regulation">{locale === "en" ? "AI regulation" : "Регулирование ИИ"}</option><option value="Privacy & cybersecurity">{locale === "en" ? "Privacy & cybersecurity" : "Приватность и кибербезопасность"}</option></select></label>
      <label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={draft.classification?.difficulty ?? "Intermediate"} onChange={(event) => applyCaseChange(locale === "en" ? "difficulty" : "сложность", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", tags: [], taxTopics: [], complianceOnly: true }), difficulty: event.target.value } }))}><option value="Foundation">{locale === "en" ? "Foundation" : "Базовый"}</option><option value="Intermediate">{locale === "en" ? "Intermediate" : "Средний"}</option><option value="Advanced">{locale === "en" ? "Advanced" : "Продвинутый"}</option><option value="Expert">{locale === "en" ? "Expert" : "Экспертный"}</option></select></label>
      {taxDraft && <><label><span>{locale === "en" ? "Tax-case purpose" : "Цель налогового кейса"}</span><select value={draft.classification?.purpose ?? "compliance_review"} onChange={(event) => applyCaseChange(locale === "en" ? "tax-case purpose" : "цель налогового кейса", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), purpose: event.target.value as NonNullable<StudioDraft["classification"]>["purpose"] } }))}><option value="lawful_planning">{locale === "en" ? "Lawful planning" : "Законное планирование"}</option><option value="compliance_review">{locale === "en" ? "Compliance review" : "Проверка соответствия"}</option><option value="audit_defence">{locale === "en" ? "Audit defence" : "Защита при проверке"}</option><option value="evasion_detection">{locale === "en" ? "Evasion detection" : "Выявление уклонения"}</option></select></label>
      <label><span>{locale === "en" ? "Law / guidance as of" : "Право / guidance на дату"}</span><input type="date" value={draft.classification?.legalAsOf ?? ""} onChange={(event) => applyCaseChange(locale === "en" ? "legal as-of date" : "дату актуальности права", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), legalAsOf: event.target.value } }))}/></label></>}
      <label className="wide-field"><span>{locale === "en" ? "Tags · comma separated" : "Теги · через запятую"}</span><input value={(draft.classification?.tags ?? []).join(", ")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", taxTopics: [], complianceOnly: true }), tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "tags" : "теги", event.currentTarget.value)}/></label>
      {taxDraft && <><label className="wide-field"><span>{locale === "en" ? "Tax topics · treaty, CFC, PE, WHT, DAC6…" : "Налоговые темы · treaty, CFC, PE, WHT, DAC6…"}</span><input value={(draft.classification?.taxTopics ?? []).join(", ")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], complianceOnly: true }), taxTopics: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "tax topics" : "налоговые темы", event.currentTarget.value)}/></label>
      <label className="source-field"><span>{locale === "en" ? "HTTPS legal sources · one per line" : "HTTPS-источники права · по одному в строке"}</span><textarea rows={3} value={(draft.classification?.sourceUrls ?? []).join("\n")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), sourceUrls: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "legal sources" : "источники права", event.currentTarget.value)}/></label>
      <div className="compliance-gate"><Icon name="check"/><div><b>{locale === "en" ? "International tax safety & publication gate" : "Контроль безопасности и публикации налогового кейса"}</b><p>{locale === "en" ? "Lawful-planning, compliance, audit-defence and evasion-detection scenarios may model risky facts. Publication requires named reviewer confirmation that the case does not enable concealment, sham substance, false reporting or evasion; HTTPS sources and a legal as-of date are mandatory." : "Кейсы о законном планировании, compliance, налоговом споре и выявлении уклонения могут моделировать рискованные факты. Для публикации именная рецензия должна подтвердить, что кейс не помогает сокрытию, фиктивной substance, ложной отчётности или уклонению; HTTPS-источники и дата актуальности права обязательны."}</p></div></div></>}
    </section>
    <section className={`studio-access page-width ${isPrivate ? "private" : "restricted"}`} aria-labelledby="studio-access-title" inert={!canDuplicate}>
      <div><span>{locale === "en" ? "Access & visibility" : "Доступ и видимость"}</span><h2 id="studio-access-title">{isPrivate ? (locale === "en" ? "Private · owner only" : "Приватно · только владелец") : (locale === "en" ? "Restricted custom case" : "Ограниченный custom-кейс")}</h2><p id="studio-private-description">{isPrivate ? (locale === "en" ? "Only you can open this workspace case. The platform administrator, reviewers and previous recipients cannot see its content or metadata." : "Только вы можете открыть этот кейс в workspace. Администратор платформы, рецензенты и ранее приглашённые пользователи не видят его содержание и метаданные.") : (locale === "en" ? "Visible to you and the platform administrator. Other registered users need an explicit share; it is not part of the General Library." : "Виден вам и администратору платформы. Другим зарегистрированным пользователям требуется явное приглашение; в Общую библиотеку кейс не входит.")}</p></div>
      <label className={`privacy-toggle ${canManagePrivacy ? "" : "locked"}`}><input type="checkbox" checked={isPrivate} disabled={!canManagePrivacy} onChange={(event) => changePrivacy(event.target.checked)} aria-describedby="studio-private-description"/><span>{canManagePrivacy ? (locale === "en" ? "Private" : "Приватно") : (locale === "en" ? "Owner controls privacy" : "Приватность задаёт владелец")}</span><i aria-hidden="true"/></label>
      <div className="copy-protection-control"><div><span>{displayMode === "developer" ? (locale === "en" ? "JSON lineage protection" : "Защита JSON-линии") : (locale === "en" ? "Copy protection" : "Защита от копирования")}</span><b>{draft.protection?.copyProtected ? (copyProtectionLocked ? (locale === "en" ? "Copy-protected · inherited" : "Копирование защищено · наследуется") : (locale === "en" ? "Protection pending save" : "Защита ожидает сохранения")) : (locale === "en" ? "Forks allowed" : "Форки разрешены")}</b><p>{displayMode === "developer" ? (locale === "en" ? "A server HMAC seal binds the current and parent codes. Once a saved lineage is locked, child versions cannot remove the policy." : "Серверная HMAC-печать связывает коды текущей и родительской версий. После фиксации защиты дочерние версии не могут её снять.") : (locale === "en" ? "When enabled, this protection is inherited by every later version and cannot be removed from that lineage." : "После включения защита наследуется всеми последующими версиями и не может быть снята в этой линии кейса.")}</p></div><label className={`privacy-toggle compact ${canManagePrivacy ? "" : "locked"}`}><input type="checkbox" checked={draft.protection?.copyProtected === true} disabled={!canManagePrivacy || (copyProtectionLocked && draft.protection?.copyProtected === true)} onChange={(event) => changeCopyProtection(event.target.checked)}/><span>{draft.protection?.copyProtected ? (locale === "en" ? "Protected" : "Защищено") : (locale === "en" ? "Protect" : "Защитить")}</span><i aria-hidden="true"/></label></div>
      {displayMode === "developer" && draft.protection && <dl className="protection-register"><div><dt>{locale === "en" ? "Parent code" : "Код родителя"}</dt><dd><code>{draft.protection.parentCode ?? (locale === "en" ? "Root · no parent" : "Корень · без родителя")}</code></dd></div><div><dt>{locale === "en" ? "Current version code" : "Код текущей версии"}</dt><dd><code>{draft.protection.currentCode || (locale === "en" ? "Pending workspace seal" : "Ожидает печати workspace")}</code></dd></div><div><dt>HMAC SEAL</dt><dd><code>{draft.protection.seal || (locale === "en" ? "Save to workspace to seal" : "Сохраните в workspace для печати")}</code></dd></div></dl>}
    </section>
    {displayMode === "developer" ? <section className="studio-version page-width" inert={!canDuplicate}>
      <div className="version-heading"><span>{text.customCase}</span><button className="secondary-cta" disabled={!canDuplicate} onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></div>
      <label><span>{text.caseId}</span><input value={draft.caseId} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,caseId:slugifyCaseId(event.target.value)}))} onBlur={(event)=>commitCaseField(text.caseId,event.currentTarget.value)}/></label>
      <label><span>{text.version}</span><input value={draft.version} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,version:event.target.value}))} onBlur={(event)=>commitCaseField(text.version,event.currentTarget.value)} aria-invalid={!/^\d+\.\d+\.\d+$/.test(draft.version)}/></label>
      <div className="version-value"><span>{text.fingerprint}</span><code>{derivationsSettled ? studioDerivations.caseFingerprint : (locale === "en" ? "checking latest edit…" : "проверяется последняя правка…")}</code></div>
      <div className="parent-trace"><span>{text.parentCase}</span>{draft.parent ? <><b>{draft.parent.caseId}</b><code>v{draft.parent.version} · {draft.parent.fingerprint}</code></> : <em>{locale === "en" ? "Root case · no parent" : "Корневой кейс · родителя нет"}</em>}</div>
    </section> : <section className="studio-version-simple page-width" inert={!canDuplicate}><div><span>{locale === "en" ? "Current version" : "Текущая версия"}</span><b>v{draft.version}</b><small>{draft.parent ? (locale === "en" ? `Child version of v${draft.parent.version}` : `Дочерняя версия от v${draft.parent.version}`) : (locale === "en" ? "Original case" : "Исходный кейс")}</small></div><button className="secondary-cta" disabled={!canDuplicate} onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></section>}
    </div>
    {(editableDealModel || (taxDraft && taxResult)) && <Suspense fallback={null}><StudioOutcomeParameters locale={locale} dealModel={editableDealModel} taxModel={taxModel} taxResult={taxDraft ? taxResult : null} taxBaseBreakdown={taxBaseBreakdown} ratePrompt={derivedPrompt} rateDraft={draft} disabled={!canDuplicate} beginFieldEdit={beginFieldEdit} commitDealField={commitDealEconomicsField} setDealModel={setDealEconomicsChange} changeRepaymentBasis={(repaymentBasis) => { const before=draft; setDealEconomicsChange({repaymentBasis}); recordVisualEdit("case_updated", locale === "en" ? "Visual edit: changed cash-flow repayment basis." : "Визуальная правка: изменён вид погашения cash-flow.", before); }} applyTaxChange={applyTaxEconomicsChange} changeTaxCurrency={changeTaxEconomicsCurrency}/></Suspense>}
    {(draft.dealEconomics || draft.nodes.some((node) => node.type === "cash_flow")) && <Suspense fallback={<section className="deal-outcome deal-outcome-empty page-width" role="status"><p>{locale === "en" ? "Calculating case cash flow…" : "Расчёт денежного потока…"}</p></section>}><DealOutcomePanel locale={locale} draft={draft}/></Suspense>}
    </>}
    {(displayMode === "developer" || guidedStep === 4) && <Suspense fallback={null}><StudioCaseViews locale={locale} draft={draft} onFocusNode={(nodeId) => { focusGraphNode(nodeId); document.querySelector(".studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}/></Suspense>}
    {(displayMode === "developer" || guidedStep === 4) && <section className="studio-workspace">
      <aside className="node-palette" inert={!canDuplicate}><div className="pane-heading"><span>{text.addNode}</span><b>{String(paletteNodeTypes.length).padStart(2,"0")}</b></div>{paletteNodeTypes.map((type) => <button key={type} disabled={!canDuplicate || draft.nodes.length >= 200} onClick={() => { addNode(type, visibleGraphCenter()); setRelationStatus(locale === "en" ? "Node added in view centre." : "Нода добавлена по центру."); }}><i style={{background:typeColors[type]}}/><span>{text.nodeTypes[type]}</span><Icon name="plus"/></button>)}<p>{locale === "en" ? "New nodes open in the visible centre. Connect OUT to IN; edits remain undoable." : "Ноды появляются по центру. Соединяйте ВЫХОД со ВХОДОМ; правки можно отменить."}</p></aside>
      <section className="graph-deck" ref={graphDeckRef}>
        <div className="graph-heading"><div><span>{text.graph}</span><b>{draft.title}</b></div><div className="graph-heading-actions"><div>{displayMode === "developer" ? <><code>{draft.nodes.length} NODES</code><code>{draft.links.length} LINKS</code></> : <span className="graph-counts">{draft.nodes.length} {locale === "en" ? "nodes" : "узлов"} · {draft.links.length} {locale === "en" ? "connections" : "связей"}</span>}</div><div className="graph-zoom-controls" aria-label={locale === "en" ? "Graph view controls" : "Управление видом схемы"}><label className="graph-orientation-control"><span>{locale === "en" ? "Flow" : "Поток"}</span><select value={graphOrientation} onChange={(event) => { const orientation = event.target.value as GraphOrientation; setGraphOrientation(orientation); void autoLayoutGraph(orientation); }} aria-label={locale === "en" ? "Graph orientation" : "Ориентация схемы"}><option value="vertical">{locale === "en" ? "Vertical" : "Вертикально"}</option><option value="horizontal">{locale === "en" ? "Horizontal" : "Горизонтально"}</option></select></label><button type="button" disabled={!canDuplicate || draft.nodes.length < 2} onClick={() => void autoLayoutGraph()}>{locale === "en" ? "Auto-layout" : "Авто-раскладка"}</button><button type="button" onClick={fitGraph}>{locale === "en" ? "Fit" : "Вместить"}</button><button type="button" onClick={() => setGraphZoom(1)}>100%</button><button type="button" onClick={centerGraph}>{locale === "en" ? "Center" : "По центру"}</button></div></div></div>
        <div id="graph-connect-status" className="graph-connect-status" role="status" aria-live="polite" tabIndex={-1}><span className={linkSourceId || selectedRuleLinkId || selectedNodeId ? "armed" : ""}/>{relationStatus || (locale === "en" ? "Connect: select OUT then IN. Select a node or relation and press Delete to remove it." : "Связь: выберите ВЫХОД, затем ВХОД. Выделите узел или связь и нажмите Delete для удаления.")}{linkSourceId && <button onClick={() => { setLinkSourceId(null); setRelationStatus(""); }}>{locale === "en" ? "Cancel" : "Отмена"}</button>}</div>
        <Suspense fallback={null}><GraphMilestones locale={locale} nodes={draft.nodes} select={focusGraphNode}/></Suspense>
        <div className="graph-viewport" ref={graphViewportRef} aria-label={locale === "en" ? "Resizable graph viewport" : "Изменяемое окно схемы"}>
        <div className={`graph-canvas graph-orientation-${graphOrientation}`} style={{ zoom: graphZoom, width: graphBounds.width, height: graphBounds.height }}>
          <svg className="graph-links" aria-label={locale === "en" ? "Case relationships" : "Связи кейса"}>{draft.links.map((link) => { const from=nodeById.get(link.from); const to=nodeById.get(link.to); if(!from||!to)return null; const geometry=graphLinkGeometry(from,to,graphOrientation); const selected=selectedRuleLinkId===link.id; return <g key={link.id} className={`graph-link ${selected?"selected":""}`} role="button" tabIndex={0} aria-pressed={selected} aria-label={locale === "en" ? `Relation from ${from.title} to ${to.title}. Press Delete to remove.` : `Связь от «${from.title}» к «${to.title}». Нажмите Delete для удаления.`} onClick={() => selectGraphLink(link)} onKeyDown={(event) => { if(event.key==="Enter"||event.key===" "){event.preventDefault();selectGraphLink(link);} }}><title>{from.title} → {to.title}</title><path className="graph-link-hit" d={geometry.path}/><path className="graph-link-visible" d={geometry.path}/><circle cx={geometry.endX} cy={geometry.endY} r="3"/></g>; })}</svg>
          {draft.nodes.length === 0 && <div className="graph-empty-state"><Icon name="spark"/><h3>{locale === "en" ? "Start with a description or one node" : "Начните с описания или первого узла"}</h3><p>{locale === "en" ? "Describe the matter above and choose “Understand with AI”, or add a Trigger from the left palette." : "Опишите ситуацию выше и нажмите «Понять и структурировать с AI» либо добавьте «Триггер» в палитре слева."}</p></div>}
          {draft.nodes.map((node) => <div key={node.id} className={`graph-node-shell ${node.id===selectedNodeId?"selected":""} ${node.id===linkSourceId?"link-source":""}`} style={{left:node.x,top:node.y,"--node-color":typeColors[node.type]} as React.CSSProperties}>
            <button className="node-port node-port-in" style={graphOrientation === "vertical" ? {top:-17,left:"50%",right:"auto",bottom:"auto",transform:"translateX(-50%)"} : {top:24,left:-17,right:"auto",bottom:"auto",transform:"none"}} disabled={!canDuplicate} onClick={() => completeLink(node.id)} aria-label={locale === "en" ? `Use ${node.title} as relation destination` : `Использовать ${node.title} как назначение связи`}><span/></button>
            <button className="graph-node-number" type="button" onClick={(event)=>{event.stopPropagation();focusGraphNode(node.id);}} aria-label={`${locale === "en" ? "Focus node" : "Показать ноду"} ${nodeNumberById.get(node.id) ?? ""}`}>N{String(nodeNumberById.get(node.id) ?? 0).padStart(2,"0")}</button>
            <button id={`studio-node-${node.id}`} className="graph-node" onFocus={() => selectGraphNode(node.id)} onKeyDown={(event) => { if (canDuplicate) nudgeNode(event, node); }} onPointerDown={(event)=>{setSelectedRuleLinkId(null);if(canDuplicate)moveNode(event,node,graphZoom);else selectGraphNode(node.id);}} onPointerMove={(event)=>{if(canDuplicate)moveNode(event,node,graphZoom);}} onPointerUp={(event)=>{if(canDuplicate)moveNode(event,node,graphZoom);}} onPointerCancel={(event)=>{if(canDuplicate)moveNode(event,node,graphZoom);}} aria-label={`N${String(nodeNumberById.get(node.id) ?? 0).padStart(2,"0")} · ${text.nodeTypes[node.type]}: ${node.title}. ${canDuplicate ? (locale === "en" ? "Use arrow keys to reposition; press Delete to remove." : "Используйте стрелки для перемещения; нажмите Delete для удаления.") : (locale === "en" ? "Inspection only." : "Только просмотр.")}`}><span><i/>{text.nodeTypes[node.type]}</span><b>{node.title}</b>{(node.runtime?.budgetCostEur !== undefined || node.runtime?.durationMinutes !== undefined) && <small className="node-runtime-summary">{node.runtime?.budgetCostEur !== undefined ? `€${node.runtime.budgetCostEur.toLocaleString()}` : (displayMode === "developer" ? "€ auto" : locale === "en" ? "cost automatic" : "стоимость автоматически")} · {node.runtime?.durationMinutes !== undefined ? `${node.runtime.durationMinutes} min` : (displayMode === "developer" ? "time auto" : locale === "en" ? "time automatic" : "время автоматически")}</small>}</button>
            <button className="node-port node-port-out" style={graphOrientation === "vertical" ? {top:"auto",left:"50%",right:"auto",bottom:-17,transform:"translateX(-50%)"} : {top:24,left:"auto",right:-17,bottom:"auto",transform:"none"}} disabled={!canDuplicate} aria-pressed={node.id===linkSourceId} onClick={() => armLinkSource(node.id)} aria-label={locale === "en" ? `Start relation from ${node.title}` : `Начать связь от ${node.title}`}><span/></button>
          </div>)}
        </div></div>
        <div className="graph-resize-hint"><span aria-hidden="true">↕</span>{locale === "en" ? "Drag the lower edge to resize the graph window" : "Потяните нижний край, чтобы изменить высоту окна схемы"}</div>
        <div className="graph-legend">{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><span key={type}><i style={{background:typeColors[type]}}/>{text.nodeTypes[type]}</span>)}</div>
        <details className="graph-relations" open>
          <summary>{displayMode === "developer" ? (locale === "en" ? "Relationship & Rules DSL editor" : "Редактор связей и Rules DSL") : (locale === "en" ? "Connections and player choices" : "Связи и выборы игрока")} · {draft.links.length}</summary>
          {draft.links.length ? <>
            {relationPageCount > 1 && <nav className="relation-pagination" aria-label={locale === "en" ? "Relationship pages" : "Страницы связей"}><button type="button" disabled={safeRelationPage === 0} onClick={() => setRelationPage((page) => Math.max(0, page - 1))}><Icon name="arrow"/>{locale === "en" ? "Previous" : "Назад"}</button><span>{safeRelationPage * relationPageSize + 1}–{Math.min(draft.links.length, (safeRelationPage + 1) * relationPageSize)} / {draft.links.length}</span><button type="button" disabled={safeRelationPage >= relationPageCount - 1} onClick={() => setRelationPage((page) => Math.min(relationPageCount - 1, page + 1))}>{locale === "en" ? "Next" : "Далее"}<Icon name="arrow"/></button></nav>}
            {draft.nodes.length > STUDIO_NODE_MENU_PAGE_SIZE && <div className="relation-node-menu"><label><span>{locale === "en" ? "Find a node for endpoint menus" : "Найти узел для меню связей"}</span><input type="search" value={relationNodeQuery} disabled={!canDuplicate} placeholder={locale === "en" ? "Title, type or ID" : "Название, тип или ID"} onChange={(event) => { setRelationNodeQuery(event.target.value); setRelationNodePage(0); }}/></label><span>{relationNodeMenu.start}–{relationNodeMenu.end} / {relationNodeMenu.total}</span><button type="button" disabled={!canDuplicate || relationNodeMenu.page === 0} onClick={() => setRelationNodePage(relationNodeMenu.page - 1)} aria-label={locale === "en" ? "Previous node-menu page" : "Предыдущая страница меню узлов"}><Icon name="arrow"/></button><button type="button" disabled={!canDuplicate || relationNodeMenu.page >= relationNodeMenu.pageCount - 1} onClick={() => setRelationNodePage(relationNodeMenu.page + 1)} aria-label={locale === "en" ? "Next node-menu page" : "Следующая страница меню узлов"}><Icon name="arrow"/></button></div>}
            <ol>{visibleRelations.map((link, pageIndex) => { const index = safeRelationPage * relationPageSize + pageIndex; return <li key={link.id} className={selectedRuleLinkId === link.id ? "rules-selected" : ""}>
              {displayMode === "developer" ? <code>{String(index + 1).padStart(2,"0")}</code> : <span className="relation-number">{index + 1}</span>}
              <div className="relation-endpoint"><div className="relation-endpoint-title"><span>{locale === "en" ? "Source" : "Источник"}</span><button id={`relation-source-${link.id}`} className={`relation-node-tag ${link.from===selectedNodeId?"active":""}`} type="button" aria-pressed={link.from===selectedNodeId} onClick={() => focusGraphNode(link.from)} aria-label={`${locale === "en" ? "Focus source node" : "Показать ноду-источник"} ${nodeNumberById.get(link.from) ?? ""}`}>N{String(nodeNumberById.get(link.from) ?? 0).padStart(2,"0")}</button></div><select disabled={!canDuplicate} aria-label={locale === "en" ? `Source for relation ${index + 1}` : `Источник связи ${index + 1}`} value={link.from} onChange={(event) => changeRelation(link, "from", event.target.value)}>{studioNodeMenuOptions(relationNodeMenu.nodes,nodeById,link.from).map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}{displayMode === "developer" ? ` · ${node.id}` : ""}</option>)}</select></div>
              <span className="relation-arrow">→</span>
              <div className="relation-endpoint"><div className="relation-endpoint-title"><span>{locale === "en" ? "Destination" : "Назначение"}</span><button className={`relation-node-tag destination ${link.to===selectedNodeId?"active":""}`} type="button" aria-pressed={link.to===selectedNodeId} onClick={() => focusGraphNode(link.to)} aria-label={`${locale === "en" ? "Focus destination node" : "Показать ноду-назначение"} ${nodeNumberById.get(link.to) ?? ""}`}>N{String(nodeNumberById.get(link.to) ?? 0).padStart(2,"0")}</button></div><select disabled={!canDuplicate} aria-label={locale === "en" ? `Destination for relation ${index + 1}` : `Назначение связи ${index + 1}`} value={link.to} onChange={(event) => changeRelation(link, "to", event.target.value)}>{studioNodeMenuOptions(relationNodeMenu.nodes,nodeById,link.to).map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}{displayMode === "developer" ? ` · ${node.id}` : ""}</option>)}</select></div>
              <button className="relation-rules" onClick={() => selectedRuleLinkId === link.id ? setSelectedRuleLinkId(null) : selectGraphLink(link)} aria-expanded={selectedRuleLinkId === link.id}>{displayMode === "developer" ? (locale === "en" ? "Rules" : "Правила") : (locale === "en" ? "Choice" : "Выбор")}</button>
              <button className="relation-delete" disabled={!canDuplicate} onClick={() => { deleteLink(link); if (selectedRuleLinkId === link.id) setSelectedRuleLinkId(null); setRelationStatus(locale === "en" ? "Relation deleted. Undo is available." : "Связь удалена. Доступна отмена действия."); focusRelationStatus(); }} aria-label={locale === "en" ? `Delete relation ${index + 1}` : `Удалить связь ${index + 1}`}><Icon name="trash" size={15}/></button>
            </li>; })}</ol>
            {selectedRuleLink && <RelationRuleEditor locale={locale} link={selectedRuleLink} developerMode={displayMode === "developer"} disabled={!canDuplicate} beginFieldEdit={beginFieldEdit} setRule={(change) => setRelationRule(selectedRuleLink.id, change)} applyRule={(change, label) => applyRelationRuleChange(selectedRuleLink.id, change, label)} commitField={(label, value) => commitRelationRule(selectedRuleLink.id, label, value)}/>}
          </> : <p>{locale === "en" ? "No relations yet. Use node ports or the inspector to create one." : "Связей пока нет. Используйте порты узлов или инспектор."}</p>}
        </details>
      </section>
      <aside className="node-inspector"><div className="pane-heading"><span>{text.inspector}</span><b>{selectedNode?"01":"00"}</b></div>{selectedNode?<div className="inspector-form" inert={!canDuplicate}>
        <div className="selected-type"><i style={{background:typeColors[selectedNode.type]}}/><span>{text.nodeTypes[selectedNode.type]}</span>{displayMode === "developer" && <code>{selectedNode.id}</code>}</div>
        <label><span>{text.nodeType}</span><select value={selectedNode.type} onChange={(event)=>{ const type=event.target.value as StudioNodeType; if(type!==selectedNode.type){ const before=draft; updateNode({type,runtime:runtimeForNodeType(selectedNode.runtime,type)}); recordVisualEdit("node_updated", locale === "en" ? `Visual edit: changed “${selectedNode.title}” from ${text.nodeTypes[selectedNode.type]} to ${text.nodeTypes[type]}.` : `Визуальная правка: тип узла «${selectedNode.title}» изменён на «${text.nodeTypes[type]}».`, before); } }}>{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><option key={type} value={type}>{text.nodeTypes[type]}</option>)}</select></label>
        <label><span>{text.title}</span><input value={selectedNode.title} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>updateNode({title:event.target.value})} onBlur={(event)=>commitNodeField(text.title,event.currentTarget.value)}/></label>
        <label><span>{text.detail}</span><textarea value={selectedNode.detail} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>updateNode({detail:event.target.value})} onBlur={(event)=>commitNodeField(text.detail,event.currentTarget.value)}/></label>
        {selectedNode.type === "cash_flow" && editableDealModel && <Suspense fallback={null}><CashFlowScenarioEditor locale={locale} model={editableDealModel} beginFieldEdit={beginFieldEdit} commitField={commitDealEconomicsField} setModel={setDealEconomicsChange} changeRepaymentBasis={(repaymentBasis) => { const before=draft; setDealEconomicsChange({repaymentBasis}); recordVisualEdit("case_updated", locale === "en" ? "Visual edit: changed cash-flow repayment basis." : "Визуальная правка: изменён вид погашения cash-flow.", before); }}/></Suspense>}
        {(displayMode === "developer" || selectedNode.type !== "cash_flow") && <fieldset className="node-runtime-fields"><legend>{locale === "en" ? "TIME & BUDGET" : "ВРЕМЯ И БЮДЖЕТ"}</legend>
          <p>{locale === "en" ? "These defaults are charged when the player enters this node. A relation rule may override them." : "Эти значения применяются при входе игрока в узел. Правило конкретной связи может их переопределить."}</p>
          <label><span>{locale === "en" ? "Budgeted node cost · EUR" : "Бюджетная стоимость нода · EUR"}</span><input type="number" min="0" max="1000000000" step="1" value={selectedNode.runtime?.budgetCostEur ?? ""} placeholder="auto" onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>setNodeRuntimeChange({budgetCostEur:optionalRuntimeInteger(event.target.value,1_000_000_000)})} onBlur={(event)=>commitNodeField(locale === "en" ? "budgeted cost" : "бюджетная стоимость",event.currentTarget.value)}/></label>
          <label><span>{locale === "en" ? "Node duration · minutes" : "Продолжительность нода · минуты"}</span><input type="number" min="0" max="100000000" step="1" value={selectedNode.runtime?.durationMinutes ?? ""} placeholder="auto" onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>setNodeRuntimeChange({durationMinutes:optionalRuntimeInteger(event.target.value,100_000_000)})} onBlur={(event)=>commitNodeField(locale === "en" ? "duration" : "продолжительность",event.currentTarget.value)}/></label>
          <label><span>{locale === "en" ? "Scenario day" : "День сценария"}</span><input type="number" min="1" max="10000" value={selectedNode.runtime?.day ?? ""} placeholder="auto" onChange={(event)=>applyNodeRuntimeChange({day:event.target.value ? Number(event.target.value) : undefined},locale === "en" ? "day" : "день")}/></label>
          <label><span>{locale === "en" ? "Scenario time" : "Время сценария"}</span><input type="time" value={selectedNode.runtime?.time ?? ""} onChange={(event)=>applyNodeRuntimeChange({time:event.target.value || undefined},locale === "en" ? "time" : "время")}/></label>
          {selectedNode.type === "outcome" && <label><span>{locale === "en" ? "Outcome class" : "Класс исхода"}</span><select value={selectedNode.runtime?.terminalOutcome ?? "auto"} onChange={(event)=>applyNodeRuntimeChange({terminalOutcome:event.target.value === "auto" ? undefined : event.target.value as "strong"|"mixed"|"weak"},locale === "en" ? "outcome class" : "класс исхода")}><option value="auto">{locale === "en" ? "Automatic" : "Автоматически"}</option><option value="strong">{locale === "en" ? "Strong" : "Сильный"}</option><option value="mixed">{locale === "en" ? "Mixed" : "Смешанный"}</option><option value="weak">{locale === "en" ? "Weak" : "Слабый"}</option></select></label>}
          {selectedNode.type === "deadline" && <><label><span>{locale === "en" ? "Deadline day" : "День дедлайна"}</span><input type="number" min="1" max="10000" value={selectedNode.runtime?.deadlineDay ?? ""} placeholder="auto" onChange={(event)=>applyNodeRuntimeChange({deadlineDay:event.target.value ? Number(event.target.value) : undefined},locale === "en" ? "deadline day" : "день дедлайна")}/></label><label><span>{locale === "en" ? "Deadline time" : "Время дедлайна"}</span><input type="time" value={selectedNode.runtime?.deadlineTime ?? ""} onChange={(event)=>applyNodeRuntimeChange({deadlineTime:event.target.value || undefined},locale === "en" ? "deadline time" : "время дедлайна")}/></label><label><span>{locale === "en" ? "Missed route" : "Переход при пропуске"}</span><select value={selectedNode.runtime?.missedOutcomeNodeId ?? ""} onChange={(event)=>applyNodeRuntimeChange({missedOutcomeNodeId:event.target.value || undefined},locale === "en" ? "missed-deadline route" : "переход при пропуске")}><option value="">{locale === "en" ? "Automatic · weakest outcome" : "Автоматически · самый слабый исход"}</option>{draft.nodes.filter((node)=>node.type==="outcome").map((node)=><option key={node.id} value={node.id}>{node.title}</option>)}</select></label></>}
        </fieldset>}
        <div className="inspector-destination-picker">{destinationNodes.length > STUDIO_NODE_MENU_PAGE_SIZE && <label className="node-menu-search"><span>{locale === "en" ? "Find destination" : "Найти назначение"}</span><input type="search" value={destinationNodeQuery} placeholder={locale === "en" ? "Title, type or ID" : "Название, тип или ID"} onChange={(event) => { setDestinationNodeQuery(event.target.value); setDestinationNodePage(0); }}/></label>}<label><span>{locale === "en" ? "Connect selected node to" : "Связать выбранный узел с"}</span><select value="" onChange={(event) => { const target=event.target.value; if(!target)return; const issue=canUseRelation(selectedNode.id,target); if(issue){setRelationStatus(issue);return;} addLink(selectedNode.id,target); setRelationStatus(locale === "en" ? "Relation created." : "Связь создана."); }}><option value="">{locale === "en" ? "Choose destination…" : "Выберите узел…"}</option>{destinationNodeMenu.nodes.map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}{displayMode === "developer" ? ` · ${node.id}` : ""}</option>)}</select></label>{destinationNodeMenu.pageCount > 1 && <div className="node-menu-pagination"><span>{destinationNodeMenu.start}–{destinationNodeMenu.end} / {destinationNodeMenu.total}</span><button type="button" disabled={destinationNodeMenu.page === 0} onClick={() => setDestinationNodePage(destinationNodeMenu.page - 1)} aria-label={locale === "en" ? "Previous destinations" : "Предыдущие назначения"}><Icon name="arrow"/></button><button type="button" disabled={destinationNodeMenu.page >= destinationNodeMenu.pageCount - 1} onClick={() => setDestinationNodePage(destinationNodeMenu.page + 1)} aria-label={locale === "en" ? "Next destinations" : "Следующие назначения"}><Icon name="arrow"/></button></div>}</div>
        <button className="danger-button" onClick={() => { const relations=draft.links.filter((link)=>link.from===selectedNode.id||link.to===selectedNode.id).length; if(!relations || window.confirm(locale === "en" ? `Delete this node and ${relations} connected relation(s)?` : `Удалить узел и связанные связи (${relations})?`)) deleteNode(); }}><Icon name="trash"/>{text.deleteNode}</button>
      </div>:<p className="empty-inspector">{text.noSelection}</p>}</aside>
    </section>}
    {(displayMode === "developer" || guidedStep === 5) && <section className="studio-bottom page-width"><div id="studio-checks" className="checks-panel"><div className="panel-title"><span>{text.checks}</span><b>{checks.filter((check)=>check.level==="warn").length.toString().padStart(2,"0")}</b></div>{checks.map((check,index)=><div key={index} className={`check-row ${check.level}`}><Icon name={check.level==="ok"?"check":"alert"}/><span>{check.text}</span></div>)}<p>{text.localNote}</p></div><div className="preview-panel"><div className="panel-title"><span>{locale === "en" ? "Test readiness" : "Готовность к тесту"}</span><b>{draft.nodes.length === 0 ? (locale === "en" ? "START" : "СТАРТ") : !derivationsSettled ? (locale === "en" ? "CHECKING" : "ПРОВЕРКА") : compiledDraft.scenario ? (locale === "en" ? "READY" : "ГОТОВО") : `${compiledDraft.issues.length} ${locale === "en" ? "TO FIX" : "ИСПРАВИТЬ"}`}</b></div><div className="preview-card compiler-card"><div className="preview-index">{locale === "en" ? "PLAYABLE CASE PREVIEW" : "ПРЕДПРОСМОТР ИГРАБЕЛЬНОГО КЕЙСА"}</div><h2>{locale === "en" ? "Test the case you built" : "Проверьте собранный кейс"}</h2>{draft.nodes.length === 0 ? <div className="compiler-empty"><p>{locale === "en" ? "Your new draft is empty. Return to the brief or decision map; validation will start after the first node appears." : "Новый черновик пуст. Вернитесь к описанию или карте решений — проверка начнётся после появления первого узла."}</p></div> : !derivationsSettled ? <div className="compiler-empty" role="status"><p>{locale === "en" ? "Checking the latest edit in the background. Test and save will unlock when this exact graph is ready." : "Последняя правка проверяется в фоне. Тест и сохранение станут доступны для этой точной версии схемы."}</p></div> : <><p>{locale === "en" ? `Case: ${draft.title || "Untitled case"}. Before testing, every route must start clearly and finish at an Outcome.` : `Кейс: ${draft.title || "Без названия"}. Перед тестом каждый маршрут должен иметь понятное начало и завершаться узлом «Исход».`}</p>{compiledDraft.scenario ? <><dl><div><dt>{locale === "en" ? "Playable stages" : "Игровых стадий"}</dt><dd>{compiledDraft.scenario.stages.length}</dd></div><div><dt>{locale === "en" ? "Player choices" : "Вариантов действий"}</dt><dd>{compiledDraft.scenario.stages.reduce((sum, stage) => sum + stage.options.length, 0)}</dd></div></dl>{compiledDraft.warnings.map((warning) => <p className="compiler-warning" key={warning}>{warning}</p>)}<button className="primary-cta" onClick={playDraft}><Icon name="play"/>{locale === "en" ? "Test this case" : "Протестировать кейс"}</button></> : <div className="compiler-issues">{compiledDraft.issues.map((issue) => <div key={issue.code}><Icon name="alert"/><span>{compilerIssueText(issue)}</span>{issue.nodeIds[0] && <button type="button" onClick={() => { const nodeId=issue.nodeIds[0]; selectGraphNode(nodeId); selectGuidedStep(4); }}>{locale === "en" ? "Fix on decision map" : "Исправить на карте"}</button>}</div>)}</div>}</>}</div></div></section>}
    {(displayMode === "developer" || guidedStep === 5) && !packageRequiresPlayableRoute && <Suspense fallback={null}><StudioPackageValidationCard locale={locale} draft={draft} warningCount={checks.filter((check) => check.level === "warn").length}/></Suspense>}
    {displayMode === "user" && guidedStep === 6 && <Suspense fallback={null}><StudioCasePlaybook locale={locale} draft={draft} phase="outputs"/></Suspense>}
    {displayMode === "user" && guidedStep === 6 && <section className="studio-finish page-width" aria-labelledby="studio-finish-title">
      <header><div><span>{locale === "en" ? "FINAL STEP · YOUR CASE STAYS EDITABLE" : "ФИНАЛЬНЫЙ ЭТАП · КЕЙС ОСТАЁТСЯ РЕДАКТИРУЕМЫМ"}</span><h2 id="studio-finish-title">{locale === "en" ? "Choose what happens next" : "Выберите следующее действие"}</h2></div><b className={validationReady ? "ready" : "blocked"}>{validationReady ? (locale === "en" ? "READY" : "ГОТОВО") : (locale === "en" ? "REVIEW NEEDED" : "НУЖНА ПРОВЕРКА")}</b></header>
      <div className="studio-finish-options">
        <article><Icon name="save"/><span>01</span><h3>{locale === "en" ? "Keep working later" : "Продолжить позже"}</h3><p>{locale === "en" ? "Save the exact draft and visibility settings to your workspace." : "Сохраните точный черновик и настройки видимости в workspace."}</p><button className="secondary-cta" onClick={() => shareDraft("save")} disabled={!canDuplicate || !draftWithinEnvelope || !derivationsSettled || workspaceState === "saving"}>{locale === "en" ? "Save to workspace" : "Сохранить в workspace"}</button></article>
        <article><Icon name="download"/><span>02</span><h3>{locale === "en" ? "Create a client report" : "Создать отчёт для клиента"}</h3><p>{locale === "en" ? "Choose the sections and download a PDF from this reviewed state." : "Выберите разделы и скачайте PDF из текущего проверенного состояния."}</p><button className="secondary-cta report-cta" onClick={() => void openCaseReport()} disabled={!canDuplicate || !draft.title.trim() || !draft.nodes.length}>{locale === "en" ? "Open PDF options" : "Открыть параметры PDF"}</button></article>
        <article><Icon name="check"/><span>03</span><h3>{locale === "en" ? "Request expert review" : "Запросить экспертную рецензию"}</h3><p>{locale === "en" ? "Submit only when validation is green and the visibility setting is correct." : "Отправляйте только после зелёной проверки и подтверждения режима видимости."}</p><button className="primary-cta" onClick={() => shareDraft("submit")} disabled={Boolean(submitBlocker) || workspaceState === "saving"} title={submitBlocker || undefined}>{locale === "en" ? "Submit for review" : "Отправить на рецензию"}</button></article>
      </div>
      {submitBlocker && <p className="studio-finish-note"><Icon name="alert"/>{submitBlocker}</p>}
    </section>}
    {caseReportOpen && <Suspense fallback={null}><CaseReportDialog
      locale={locale}
      draft={draft}
      currentFingerprint={caseReportFingerprint || studioDerivations.caseFingerprint || caseFingerprint(draft)}
      workspaceFingerprint={serverFingerprint}
      currentPublicationFingerprint={casePublicationFingerprint(draft)}
      workspacePublicationFingerprint={serverPublicationFingerprint}
      privateCase={isPrivate}
      canGenerateReport={canDuplicate}
      reportReceiptStorageScope={reportReceiptStorageScope}
      persistReportReceiptOnDevice={persistReportReceiptOnDevice}
      close={() => setCaseReportOpen(false)}
      completed={() => {
        setCaseReportStatus(locale === "en" ? "PDF downloaded." : "PDF скачан.");
      }}
    /></Suspense>}
    {caseMarkdownOpen && <Suspense fallback={null}><CaseMarkdownDialog locale={locale} draft={draft} close={() => setCaseMarkdownOpen(false)} completed={() => setCaseReportStatus(locale === "en" ? "Markdown downloaded." : "Markdown скачан.")}/></Suspense>}
  </main>;
}

function RelationRuleEditor({ locale, link, developerMode, disabled, beginFieldEdit, setRule, applyRule, commitField }: {
  locale: Locale;
  link: StudioLink;
  developerMode: boolean;
  disabled: boolean;
  beginFieldEdit: (value: string) => void;
  setRule: (change: NonNullable<StudioLink["rule"]>) => void;
  applyRule: (change: NonNullable<StudioLink["rule"]>, label: string) => void;
  commitField: (label: string, value: string) => void;
}) {
  const rule = link.rule ?? {};
  const guard = rule.guards?.[0];
  const numberValue = (value: string) => value === "" ? undefined : Number(value);
  return <section className="relation-rule-editor" aria-label={developerMode ? (locale === "en" ? `Runtime rules for ${link.id}` : `Runtime-правила для ${link.id}`) : (locale === "en" ? "Player choice settings" : "Настройки выбора игрока")}>
    <header><div><span>{developerMode ? `RULES DSL · ${link.id}` : (locale === "en" ? "PLAYER CHOICE" : "ВЫБОР ИГРОКА")}</span><h3>{developerMode ? (locale === "en" ? "Author the action, not just the arrow" : "Настройте действие, а не только стрелку") : (locale === "en" ? "What can the player choose here?" : "Что игрок может выбрать здесь?")}</h3></div>{developerMode && <code>{link.from} → {link.to}</code>}</header>
    <fieldset className="relation-rule-grid" disabled={disabled}>
      <label className="wide-field"><span>{locale === "en" ? "Action label" : "Название действия"}</span><input value={rule.label ?? ""} placeholder={locale === "en" ? "Defaults to destination title" : "По умолчанию — название целевого узла"} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ label: event.target.value })} onBlur={(event) => commitField(locale === "en" ? "action label" : "название действия", event.currentTarget.value)}/></label>
      <label><span>{locale === "en" ? "Cost · EUR" : "Стоимость · EUR"}</span><input type="number" min="0" max="1000000000" value={rule.cost ?? ""} placeholder="0" onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ cost: numberValue(event.target.value) })} onBlur={(event)=>commitField(locale === "en" ? "cost" : "стоимость",event.currentTarget.value)}/></label>
      <label><span>{locale === "en" ? "Duration · minutes" : "Длительность · минуты"}</span><input type="number" min="0" max="100000000" value={rule.minutes ?? ""} placeholder="20" onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ minutes: numberValue(event.target.value) })} onBlur={(event)=>commitField(locale === "en" ? "duration" : "длительность",event.currentTarget.value)}/></label>
      {developerMode && <>
        {(Object.keys(metricLabels.en) as MetricKey[]).map((metric) => <label key={metric}><span>{metricLabels[locale][metric]} · Δ</span><input type="number" min="-100" max="100" value={rule.effects?.[metric] ?? ""} placeholder="auto" onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ effects: { ...(rule.effects ?? {}), [metric]: numberValue(event.target.value) } })} onBlur={(event)=>commitField(`${metric} effect`,event.currentTarget.value)}/></label>)}
        <label><span>{locale === "en" ? "Repeatability" : "Повторяемость"}</span><select value={rule.repeatability ?? "once"} onChange={(event) => { const repeatability = event.target.value as NonNullable<StudioLink["rule"]>["repeatability"]; applyRule({ repeatability, maxUses: repeatability === "limited" ? rule.maxUses ?? 2 : undefined }, locale === "en" ? "repeatability" : "повторяемость"); }}><option value="once">{locale === "en" ? "Once" : "Один раз"}</option><option value="repeatable">{locale === "en" ? "Repeatable" : "Повторяемо"}</option><option value="limited">{locale === "en" ? "Limited" : "Ограниченно"}</option></select></label>
        {rule.repeatability === "limited" && <label><span>{locale === "en" ? "Maximum uses" : "Максимум использований"}</span><input type="number" min="1" max="10000" value={rule.maxUses ?? 2} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ maxUses: Math.max(1, Number(event.target.value) || 1) })} onBlur={(event)=>commitField(locale === "en" ? "maximum uses" : "лимит использований",event.currentTarget.value)}/></label>}
        <label><span>{locale === "en" ? "Guard metric" : "Метрика условия"}</span><select value={guard?.metric ?? "none"} onChange={(event) => applyRule({ guards: event.target.value === "none" ? undefined : [{ metric: event.target.value as MetricKey, comparison: guard?.comparison ?? "gte", value: guard?.value ?? 50 }] }, locale === "en" ? "availability guard" : "условие доступности")}><option value="none">{locale === "en" ? "Always available" : "Всегда доступно"}</option>{(Object.keys(metricLabels.en) as MetricKey[]).map((metric) => <option key={metric} value={metric}>{metricLabels[locale][metric]}</option>)}</select></label>
        {guard && <><label><span>{locale === "en" ? "Comparison" : "Сравнение"}</span><select value={guard.comparison} onChange={(event) => applyRule({ guards: [{ ...guard, comparison: event.target.value as "gte" | "lte" | "eq" }] }, locale === "en" ? "guard comparison" : "сравнение условия")}><option value="gte">≥</option><option value="lte">≤</option><option value="eq">=</option></select></label><label><span>{locale === "en" ? "Threshold" : "Порог"}</span><input type="number" min="0" max="100" value={guard.value} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ guards: [{ ...guard, value: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }] })} onBlur={(event)=>commitField(locale === "en" ? "guard threshold" : "порог условия",event.currentTarget.value)}/></label></>}
      </>}
      <label className="wide-field"><span>{locale === "en" ? "Consequence text" : "Текст последствия"}</span><textarea value={rule.result ?? ""} placeholder={locale === "en" ? "Defaults to destination detail" : "По умолчанию — описание целевого узла"} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ result: event.target.value })} onBlur={(event) => commitField(locale === "en" ? "consequence text" : "текст последствия", event.currentTarget.value)}/></label>
    </fieldset>
    <p>{developerMode ? (locale === "en" ? "Typed rules are validated and interpreted deterministically; no uploaded JavaScript or eval is executed." : "Типизированные правила валидируются и исполняются детерминированно; загружаемый JavaScript и eval не используются.") : (locale === "en" ? "These fields define what the player sees and the time, cost and consequence of this choice." : "Эти поля задают, что увидит игрок, а также время, стоимость и последствие выбора.")}</p>
  </section>;
}

type CommunityProfile = {
  displayName: string; professionalRole: string; organisation: string; jurisdiction: string;
  practiceAreas: string[]; experienceLevel: string; locale: Locale;
  productUpdates: boolean; caseUpdates: boolean; researchInvites: boolean; verifiedPractitioner: boolean; licenseTier: "community" | "professional" | "enterprise";
};
type CommunityUpdate = { id: number; title: string; body: string; kind: string; caseId: string | null; publishedAt: string | null; read: boolean };
type CommunitySubmission = { id: number; customCaseId?: number | null; caseId: string; version: string; title: string; status: string; reviewerNote: string; updatedAt: string; isPrivate?: boolean | null };
type CommunityCustomCase = { id: number; caseId: string; title: string; currentVersion: string; fingerprint: string; isPrivate: boolean; copyProtected: boolean; status: string; access: "owner" | "admin" | "shared"; canShare: boolean; canManagePrivacy: boolean; shareCount: number; updatedAt: string; promotedAt?: string | null; ownerDisplayName?: string };
type CommunityCustomCaseShare = { recipientEmail: string; canReshare: boolean; grantedByEmail: string; createdAt: string };
type CommunityCustomCaseFeedback = { id: number; category: string; rating: number; comment: string; severity: string; suggestedCorrection: string; citationUrl: string | null; contextType: string; contextId: string | null; audience: string; status: string; createdAt: string };
type AdminCommunityUser = { id: number; email: string; displayName: string; organisation: string; licenseTier: "community" | "professional" | "enterprise"; verifiedPractitioner: boolean; hasLocalAccount: boolean; localAccountStatus: string | null };

function CommunityView({ locale, cases, openCustomCase, refreshCatalogue, clearDeviceDraft }: { locale: Locale; cases: PublishedCaseSummary[]; openCustomCase: (id: number) => void; refreshCatalogue: () => Promise<void>; clearDeviceDraft: () => void }) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [updates, setUpdates] = useState<CommunityUpdate[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [customCases, setCustomCases] = useState<CommunityCustomCase[]>([]);
  const [customCasesNextCursor, setCustomCasesNextCursor] = useState<string | null>(null);
  const [customCasesLoadingMore, setCustomCasesLoadingMore] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [formError, setFormError] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [shareEmails, setShareEmails] = useState<Record<number, string>>({});
  const [shareReshare, setShareReshare] = useState<Record<number, boolean>>({});
  const [caseShares, setCaseShares] = useState<Record<number, CommunityCustomCaseShare[]>>({});
  const [caseFeedback, setCaseFeedback] = useState<Record<number, CommunityCustomCaseFeedback[]>>({});
  const [busyCaseId, setBusyCaseId] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "anonymous" | "ready" | "saving">("loading");
  useEffect(() => {
    fetch("/api/me").then((response) => readJsonResponse<{ profile?: CommunityProfile; isAdmin?: boolean; registered?: boolean }>(response)).then(async (me) => {
      if (!me?.profile) { setStatus("anonymous"); return; }
      setProfile(me.profile); setIsAdmin(me.isAdmin === true); setRegistered(me.registered === true);
      const [feed, workspace, custom] = await Promise.all([
        fetch("/api/updates").then((response) => readJsonResponse<{ updates?: CommunityUpdate[]; subscriptions?: string[] }>(response)),
        fetch("/api/submissions").then((response) => readJsonResponse<{ submissions?: CommunitySubmission[] }>(response)),
        fetch("/api/custom-cases?limit=25").then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[]; nextCursor?: string | null }>(response)),
      ]);
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? []); setSubmissions(workspace?.submissions ?? []); setCustomCases(custom?.customCases ?? []); setCustomCasesNextCursor(custom?.nextCursor ?? null); setStatus("ready");
    }).catch(() => setStatus("anonymous"));
  }, []);
  async function reloadCustomCases() {
    const payload = await fetch("/api/custom-cases?limit=25").then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[]; nextCursor?: string | null }>(response));
    setCustomCases(payload?.customCases ?? []);
    setCustomCasesNextCursor(payload?.nextCursor ?? null);
  }
  async function loadMoreCustomCases() {
    if (!customCasesNextCursor || customCasesLoadingMore) return;
    setCustomCasesLoadingMore(true);
    try {
      const payload = await fetch(`/api/custom-cases?limit=25&cursor=${encodeURIComponent(customCasesNextCursor)}`).then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[]; nextCursor?: string | null }>(response));
      const incoming = payload?.customCases ?? [];
      setCustomCases((current) => [...current, ...incoming.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setCustomCasesNextCursor(payload?.nextCursor ?? null);
    } finally {
      setCustomCasesLoadingMore(false);
    }
  }
  async function setCustomPrivacy(item: CommunityCustomCase, isPrivate: boolean) {
    if (isPrivate && !window.confirm(locale === "en" ? "Make this case owner-only? Existing shares will be revoked and Maxim will no longer see the case or its metadata." : "Сделать кейс доступным только владельцу? Все приглашения будут отозваны, а Максим больше не увидит кейс и его метаданные.")) return;
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_privacy", id: item.id, caseId: item.caseId, isPrivate }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setCaseShares((current) => ({ ...current, [item.id]: [] }));
      await reloadCustomCases();
      setCustomMessage(isPrivate ? (locale === "en" ? "Private mode enabled; every share was revoked." : "Приватный режим включён; все приглашения отозваны.") : (locale === "en" ? "The case is restricted again: visible to you and Maxim." : "Кейс снова ограниченный: он виден вам и Максиму."));
    } else setCustomMessage(result?.error ?? (locale === "en" ? "Visibility could not be changed." : "Не удалось изменить видимость."));
    setBusyCaseId(null);
  }
  async function loadCaseShares(item: CommunityCustomCase) {
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch(`/api/custom-cases?id=${item.id}`);
    const result = await response.json().catch(() => null) as { shares?: CommunityCustomCaseShare[]; feedback?: CommunityCustomCaseFeedback[]; error?: string } | null;
    if (response.ok) {
      setCaseShares((current) => ({ ...current, [item.id]: result?.shares ?? [] }));
      if (item.access === "owner") setCaseFeedback((current) => ({ ...current, [item.id]: result?.feedback ?? [] }));
    }
    else setCustomMessage(result?.error ?? (locale === "en" ? "Access list could not be loaded." : "Не удалось загрузить список доступа."));
    setBusyCaseId(null);
  }
  async function shareCustomCase(item: CommunityCustomCase) {
    const recipientEmail = (shareEmails[item.id] ?? "").trim();
    if (!recipientEmail) return;
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "share", id: item.id, recipientEmail, canReshare: shareReshare[item.id] === true }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setShareEmails((current) => ({ ...current, [item.id]: "" }));
      await Promise.all([reloadCustomCases(), loadCaseShares(item)]);
      setCustomMessage(locale === "en" ? "Case access granted." : "Доступ к кейсу предоставлен.");
    } else {
      setCustomMessage(result?.error ?? (locale === "en" ? "Case access could not be granted." : "Не удалось предоставить доступ."));
      setBusyCaseId(null);
    }
  }
  async function revokeCustomShare(item: CommunityCustomCase, recipientEmail: string) {
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", id: item.id, recipientEmail }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      await Promise.all([reloadCustomCases(), loadCaseShares(item)]);
      setCustomMessage(locale === "en" ? "Case access revoked." : "Доступ к кейсу отозван.");
    } else {
      setCustomMessage(result?.error ?? (locale === "en" ? "Access could not be revoked." : "Не удалось отозвать доступ."));
      setBusyCaseId(null);
    }
  }
  async function saveProfile() {
    if (!profile) return; setStatus("saving"); setFormError("");
    const response = await fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, locale }) });
    if (response.ok) {
      const saved = await readJsonResponse<{ profile: CommunityProfile }>(response);
      if (saved) setProfile(saved.profile); setRegistered(true);
      const feed = await fetch("/api/updates").then((result) => readJsonResponse<{ updates?: CommunityUpdate[]; subscriptions?: string[] }>(result));
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? subscriptions);
    } else setFormError(locale === "en" ? "Profile could not be saved." : "Не удалось сохранить профиль.");
    setStatus("ready");
  }
  async function toggleSubscription(caseId: string) {
    const subscribed = subscriptions.includes(caseId);
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: subscribed ? "unsubscribe" : "subscribe", caseId }) });
    if (response.ok) {
      setSubscriptions((current) => subscribed ? current.filter((id) => id !== caseId) : [...current, caseId]);
      const feed = await fetch("/api/updates").then((result) => readJsonResponse<{ updates?: CommunityUpdate[] }>(result));
      setUpdates(feed?.updates ?? []);
    }
  }
  async function markRead(updateId: number) {
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read", updateId }) });
    if (response.ok) setUpdates((current) => current.map((item) => item.id === updateId ? { ...item, read: true } : item));
  }
  async function deleteProfile() {
    if (!window.confirm(locale === "en" ? "Delete your profile, subscriptions, workspace drafts and private feedback? This cannot be undone. Immutable versions already published to the General Library and their editorial attribution may remain as part of the public record." : "Удалить профиль, подписки, workspace-черновики и приватные отзывы? Это действие необратимо. Уже опубликованные в Общей библиотеке неизменяемые версии и их редакционная атрибуция могут сохраниться как часть публичного реестра.")) return;
    const response = await fetch("/api/me", { method: "DELETE" });
    if (response.ok) { clearDeviceDraft(); setRegistered(false); setUpdates([]); setSubscriptions([]); setSubmissions([]); setCustomCases([]); setCustomCasesNextCursor(null); setCaseShares({}); setCaseFeedback({}); setFormError(locale === "en" ? "Stored community and device-draft data deleted." : "Данные сообщества и локальный черновик удалены."); }
  }
  if (status === "loading") return <main className="community-view page-width"><div className="community-loading">Loading professional workspace…</div></main>;
  if (status === "anonymous") return <main className="community-view page-width"><section className="community-hero"><div><span>PRACTITIONER COMMUNITY</span><h1>{locale === "en" ? "Register your professional profile" : "Зарегистрируйте профессиональный профиль"}</h1><p>{locale === "en" ? "Sign in to submit attributed case feedback, follow selected cases and receive updates matched to your jurisdiction, practice area and role." : "Войдите, чтобы отправлять авторизованные отзывы, подписываться на кейсы и получать обновления с учётом юрисдикции, практики и роли."}</p><div className="featured-actions"><a className="primary-cta" href="/signin-with-chatgpt?return_to=%2F">{locale === "en" ? "Sign in with ChatGPT" : "Войти через ChatGPT"}<Icon name="arrow"/></a><a className="secondary-cta" href="/account">{locale === "en" ? "Email & password" : "Email и пароль"}</a></div></div></section></main>;
  if (!profile) return null;
  return <main className="community-view page-width">
    <section className="community-hero"><div><span>PRACTITIONER COMMUNITY</span><h1>{locale === "en" ? "Professional profile & update centre" : "Профессиональный профиль и центр обновлений"}</h1><p>{locale === "en" ? "Your profile controls attribution, relevant invitations and addressed case releases." : "Профиль определяет авторство, релевантные приглашения и адресные обновления кейсов."}</p></div>{profile.verifiedPractitioner && <b className="verified-badge"><Icon name="check"/>VERIFIED PRACTITIONER</b>}</section>
    <section className="community-grid"><form className="profile-panel" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}><div className="panel-title"><span>{locale === "en" ? "Registration profile" : "Регистрационный профиль"}</span><b>01</b></div>
      <label><span>{locale === "en" ? "Display name" : "Имя"}</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}/></label>
      <label><span>{locale === "en" ? "Professional role" : "Профессиональная роль"}</span><select value={profile.professionalRole} onChange={(event) => setProfile({ ...profile, professionalRole: event.target.value })}><option value="practitioner">Practising lawyer / tax adviser</option><option value="in_house">In-house counsel</option><option value="academic">Academic / educator</option><option value="student">Student / trainee</option><option value="product">LegalTech professional</option></select></label>
      <label><span>{locale === "en" ? "Organisation" : "Организация"}</span><input value={profile.organisation} onChange={(event) => setProfile({ ...profile, organisation: event.target.value })}/></label>
      <label><span>{locale === "en" ? "Primary jurisdiction" : "Основная юрисдикция"}</span><input value={profile.jurisdiction} onChange={(event) => setProfile({ ...profile, jurisdiction: event.target.value })} placeholder="Belgium / EU"/></label>
      <label><span>{locale === "en" ? "Practice areas · comma separated" : "Области практики · через запятую"}</span><input value={profile.practiceAreas.join(", ")} onChange={(event) => setProfile({ ...profile, practiceAreas: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="International tax, Commercial, AI regulation"/></label>
      <label><span>{locale === "en" ? "Experience" : "Опыт"}</span><select value={profile.experienceLevel} onChange={(event) => setProfile({ ...profile, experienceLevel: event.target.value })}><option value="early">0–3 years</option><option value="mid">4–9 years</option><option value="senior">10+ years</option></select></label>
      <fieldset><legend>{locale === "en" ? "Addressed communications" : "Адресные сообщения"}</legend><label><input type="checkbox" checked={profile.productUpdates} onChange={(event) => setProfile({ ...profile, productUpdates: event.target.checked })}/><span>{locale === "en" ? "Product releases" : "Обновления продукта"}</span></label><label><input type="checkbox" checked={profile.caseUpdates} onChange={(event) => setProfile({ ...profile, caseUpdates: event.target.checked })}/><span>{locale === "en" ? "Followed case updates" : "Обновления отслеживаемых кейсов"}</span></label><label><input type="checkbox" checked={profile.researchInvites} onChange={(event) => setProfile({ ...profile, researchInvites: event.target.checked })}/><span>{locale === "en" ? "Research and pilot invitations" : "Приглашения к исследованиям и пилотам"}</span></label></fieldset>
      <p className="privacy-note">{locale === "en" ? "All communications are opt-in and appear in this in-product inbox. Your authenticated email is used for attribution and routing but is not shown publicly. Privacy notice v2026-08-21." : "Все сообщения включаются только по согласию и появляются во внутреннем центре обновлений. Email используется для авторства и маршрутизации, но не показывается публично. Privacy notice v2026-08-21."}</p>
      {formError && <p className="form-error" role="status">{formError}</p>}
      <button className="primary-cta" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : locale === "en" ? "Save profile" : "Сохранить профиль"}<Icon name="check"/></button>
      <div className="profile-data-actions"><a className="secondary-cta" href="/account">{locale === "en" ? "Account & sign-out" : "Аккаунт и выход"}</a>{registered && <button type="button" className="danger-button" onClick={deleteProfile}>{locale === "en" ? "Delete private account data" : "Удалить приватные данные аккаунта"}</button>}</div>
      {registered && <p className="privacy-note">{locale === "en" ? "Deletion removes your account profile, subscriptions, workspace drafts, access grants and private feedback. Immutable General Library versions already published after review—and the attribution embedded in that public editorial record—are not silently rewritten; contact the operator to request correction or pseudonymisation." : "Удаление убирает профиль аккаунта, подписки, workspace-черновики, права доступа и приватные отзывы. Уже опубликованные после рецензии неизменяемые версии Общей библиотеки и атрибуция в этом публичном редакционном реестре не переписываются автоматически; для исправления или псевдонимизации обратитесь к оператору."}</p>}
    </form>
    <section className="update-panel"><div className="panel-title"><span>{locale === "en" ? "Addressed update inbox" : "Адресный центр обновлений"}</span><b>{updates.filter((item) => !item.read).length.toString().padStart(2, "0")}</b></div>{updates.length ? updates.map((item) => <article key={item.id} className={item.read ? "" : "unread"}><span>{item.kind}</span><h3>{item.title}</h3><p>{item.body}</p><footer><small>{item.publishedAt?.slice(0, 10)}</small>{!item.read && <button onClick={() => markRead(item.id)}>{locale === "en" ? "Mark read" : "Прочитано"}</button>}</footer></article>) : <div className="empty-updates"><Icon name="check"/><b>{locale === "en" ? "You are up to date" : "У вас всё актуально"}</b><p>{locale === "en" ? "New releases matching your profile and explicit preferences will appear here." : "Здесь появятся релизы, соответствующие профилю и явным настройкам согласия."}</p></div>}</section>
    </section>
    <section className="subscription-panel"><div className="panel-title"><span>{locale === "en" ? "Follow individual cases" : "Подписки на отдельные кейсы"}</span><b>{subscriptions.length.toString().padStart(2, "0")}</b></div><div>{cases.map((item) => <button key={item.id} className={subscriptions.includes(item.id) ? "subscribed" : ""} onClick={() => toggleSubscription(item.id)}><span><b>{item.title}</b><small>{item.jurisdiction} · v{item.currentVersion}</small></span><em>{subscriptions.includes(item.id) ? (locale === "en" ? "Following" : "Подписка") : (locale === "en" ? "Follow" : "Подписаться")}</em></button>)}</div></section>
    <section className="workspace-panel"><div className="panel-title"><span>{locale === "en" ? "My Studio review workspace" : "Мои кейсы на рецензии"}</span><b>{submissions.length.toString().padStart(2, "0")}</b></div>{submissions.length ? <div className="workspace-list">{submissions.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.caseId} · v{item.version}</small></div><span>{item.status.replaceAll("_", " ")}</span>{item.reviewerNote && <p>{item.reviewerNote}</p>}</article>)}</div> : <p>{locale === "en" ? "Save or submit a Studio draft to start the moderated practitioner workflow." : "Сохраните или отправьте черновик Studio, чтобы начать модерируемый рабочий процесс."}</p>}</section>
    <section className="custom-access-panel" aria-labelledby="custom-access-title">
      <div className="panel-title"><span id="custom-access-title">{isAdmin ? (locale === "en" ? "Visible custom-case register" : "Реестр видимых custom-кейсов") : (locale === "en" ? "My & shared custom cases" : "Мои и доступные custom-кейсы")}</span><b>{customCases.length.toString().padStart(2, "0")}</b></div>
      <p className="custom-access-explainer">{locale === "en" ? "Workspace cases are never public by default. Restricted cases are visible to the owner, Maxim and invited registered users; Private cases are owner-only. Device-only saves do not appear here." : "Workspace-кейсы по умолчанию не публичны. Ограниченные кейсы видны владельцу, Максиму и приглашённым зарегистрированным пользователям; приватные — только владельцу. Локальные сохранения с устройства здесь не отображаются."}</p>
      {customMessage && <p className="custom-access-message" role="status">{customMessage}</p>}
      {customCases.length ? <><div className="custom-case-grid">{customCases.map((item) => {
        const shares = caseShares[item.id];
        const feedback = caseFeedback[item.id];
        const mayDelegateReshare = item.access === "owner" || item.access === "admin";
        return <article className={`custom-case-card ${item.isPrivate ? "private" : "restricted"}`} key={item.id}>
          <header><div className="custom-case-badges"><span>{item.isPrivate ? "PRIVATE · OWNER ONLY" : item.access === "shared" ? "SHARED CUSTOM" : "RESTRICTED CUSTOM"}</span>{item.copyProtected && <span className="copy-lock-badge">LINEAGE LOCKED</span>}{item.status === "promoted" && <span className="library-badge">GENERAL LIBRARY SNAPSHOT</span>}</div><small>{item.access === "owner" ? (locale === "en" ? "You own this case" : "Вы владелец") : item.access === "admin" ? (locale === "en" ? `Admin view · ${item.ownerDisplayName ?? "Case author"}` : `Вид администратора · ${item.ownerDisplayName ?? "Автор кейса"}`) : (locale === "en" ? `Shared by ${item.ownerDisplayName ?? "case author"}` : `Предоставил доступ: ${item.ownerDisplayName ?? "автор кейса"}`)}</small></header>
          <h3>{item.title}</h3><code>{item.caseId} · v{item.currentVersion}</code>
          <p>{item.isPrivate ? (locale === "en" ? "No administrator, reviewer or previous recipient can discover this case." : "Администратор, рецензент и прежние получатели не могут обнаружить этот кейс.") : item.access === "shared" ? (locale === "en" ? "Shared with you · other recipients are not disclosed" : "Доступ предоставлен вам · другие получатели не раскрываются") : (locale === "en" ? `${item.shareCount} explicit share(s) · not in the public catalogue` : `Явных приглашений: ${item.shareCount} · не в публичном каталоге`)}</p>
          {item.status === "promoted" && <p className="promotion-note">{locale === "en" ? "An immutable copy is public. Changing this workspace source does not rewrite that published version." : "Неизменяемая копия опубликована. Изменения этого workspace-источника не переписывают опубликованную версию."}</p>}
          <div className="custom-case-actions"><button type="button" className="secondary-cta" onClick={() => openCustomCase(item.id)}><Icon name="studio"/>{locale === "en" ? "Open in Studio" : "Открыть в Studio"}</button>{item.canManagePrivacy && <label className="privacy-toggle compact"><input type="checkbox" checked={item.isPrivate} disabled={busyCaseId === item.id} onChange={(event) => setCustomPrivacy(item, event.target.checked)}/><span>{locale === "en" ? "Private" : "Приватно"}</span><i aria-hidden="true"/></label>}</div>
          {!item.isPrivate && item.canShare && <form className="custom-share-form" onSubmit={(event) => { event.preventDefault(); shareCustomCase(item); }}><label><span>{locale === "en" ? "Registered recipient email" : "Email зарегистрированного получателя"}</span><input type="email" value={shareEmails[item.id] ?? ""} onChange={(event) => setShareEmails((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="colleague@example.com"/></label>{mayDelegateReshare && <label className="reshare-check"><input type="checkbox" checked={shareReshare[item.id] === true} onChange={(event) => setShareReshare((current) => ({ ...current, [item.id]: event.target.checked }))}/><span>{locale === "en" ? "Allow forwarding (recipient still needs Professional or Enterprise)" : "Разрешить пересылку (получателю всё равно нужна лицензия Professional или Enterprise)"}</span></label>}<button className="primary-cta" disabled={busyCaseId === item.id || !(shareEmails[item.id] ?? "").trim()}>{locale === "en" ? "Grant access" : "Предоставить доступ"}<Icon name="arrow"/></button></form>}
          {!item.isPrivate && !item.canShare && <p className="license-hint">{item.access === "owner" ? (locale === "en" ? `Sharing requires Professional or Enterprise; current tier: ${profile.licenseTier}.` : `Для предоставления доступа нужна лицензия Professional или Enterprise; текущая: ${profile.licenseTier}.`) : (locale === "en" ? "Forwarding requires Professional or Enterprise plus an explicit reshare grant." : "Для пересылки нужна лицензия Professional или Enterprise и отдельное право на дальнейший доступ.")}</p>}
          {!item.isPrivate && (item.access === "owner" || item.access === "admin") && <div className="custom-share-register"><button type="button" onClick={() => loadCaseShares(item)} disabled={busyCaseId === item.id}>{shares ? (locale === "en" ? "Refresh access list" : "Обновить список доступа") : (locale === "en" ? `Manage access (${item.shareCount})` : `Управлять доступом (${item.shareCount})`)}</button>{shares?.map((share) => <div key={share.recipientEmail}><span><b>{share.recipientEmail}</b><small>{share.canReshare ? (locale === "en" ? "may forward with licence" : "может пересылать при наличии лицензии") : (locale === "en" ? "view only" : "только просмотр")}</small></span><button type="button" onClick={() => revokeCustomShare(item, share.recipientEmail)} disabled={busyCaseId === item.id}>{locale === "en" ? "Revoke" : "Отозвать"}</button></div>)}</div>}
          {item.access === "owner" && <div className="custom-feedback-register"><button type="button" onClick={() => loadCaseShares(item)} disabled={busyCaseId === item.id}>{feedback ? (locale === "en" ? "Refresh my case notes" : "Обновить мои заметки") : (locale === "en" ? "View my case notes" : "Мои заметки по кейсу")}</button>{feedback && (feedback.length ? feedback.map((entry) => <article key={entry.id}><span><b>{entry.audience === "owner_private" ? (locale === "en" ? "PRIVATE · OWNER ONLY" : "ПРИВАТНО · ТОЛЬКО ВЛАДЕЛЕЦ") : entry.category.replaceAll("_", " ")}</b><small>{entry.createdAt.slice(0, 10)} · {entry.rating}/5 · {entry.severity}</small></span><p>{entry.comment}</p>{entry.suggestedCorrection && <p><b>{locale === "en" ? "Suggested correction:" : "Предлагаемое исправление:"}</b> {entry.suggestedCorrection}</p>}{entry.citationUrl && <a href={entry.citationUrl} target="_blank" rel="noreferrer">{locale === "en" ? "Supporting source" : "Подтверждающий источник"}</a>}</article>) : <p>{locale === "en" ? "No notes for this case yet." : "Заметок по этому кейсу пока нет."}</p>)}</div>}
        </article>;
      })}</div>{customCasesNextCursor && <button type="button" className="secondary-cta custom-cases-more" onClick={loadMoreCustomCases} disabled={customCasesLoadingMore}>{customCasesLoadingMore ? (locale === "en" ? "Loading…" : "Загрузка…") : (locale === "en" ? "Load more cases" : "Показать ещё кейсы")}</button>}</> : <p>{locale === "en" ? "No workspace custom cases are visible to this account yet. Save a Studio case to the workspace first." : "Для аккаунта пока нет видимых workspace custom-кейсов. Сначала сохраните кейс из Studio в workspace."}</p>}
    </section>
    {isAdmin && <AdminDesk locale={locale} cases={cases} customCases={customCases} reloadCustomCases={reloadCustomCases} openCustomCase={openCustomCase} refreshCatalogue={refreshCatalogue}/>}
  </main>;
}

function AdminDesk({ locale, cases, customCases, reloadCustomCases, openCustomCase, refreshCatalogue }: { locale: Locale; cases: PublishedCaseSummary[]; customCases: CommunityCustomCase[]; reloadCustomCases: () => Promise<void>; openCustomCase: (id: number) => void; refreshCatalogue: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("product");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [jurisdictions, setJurisdictions] = useState("");
  const [practices, setPractices] = useState("");
  const [roles, setRoles] = useState("");
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [feedbackQueue, setFeedbackQueue] = useState<Array<Record<string, unknown>>>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Record<string, unknown> | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [message, setMessage] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminCommunityUser[]>([]);
  const [emailResetAvailable, setEmailResetAvailable] = useState(false);
  const [adminBusy, setAdminBusy] = useState("");
  const [pendingPromotion, setPendingPromotion] = useState<PromotionCandidate | null>(null);
  const [taxReviewNote, setTaxReviewNote] = useState("");
  const [taxReviewChecks, setTaxReviewChecks] = useState<Record<TaxPublicationChecklistKey, boolean>>(() => Object.fromEntries(taxPublicationChecklist.map((key) => [key, false])) as Record<TaxPublicationChecklistKey, boolean>);
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/submissions").then((response) => readJsonResponse<{ submissions?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/feedback").then((response) => readJsonResponse<{ feedback?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/users").then((response) => readJsonResponse<{ users?: AdminCommunityUser[]; emailResetAvailable?: boolean }>(response)),
    ]).then(([submissionsPayload, feedbackPayload, usersPayload]) => {
      setQueue(submissionsPayload?.submissions ?? []);
      setFeedbackQueue(feedbackPayload?.feedback ?? []);
      setAdminUsers(usersPayload?.users ?? []);
      setEmailResetAvailable(usersPayload?.emailResetAvailable === true);
    });
  }, []);
  async function publishRelease(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/releases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, kind, caseId: kind === "case" ? caseId : null, targetJurisdictions: commaList(jurisdictions), targetPracticeAreas: commaList(practices), targetRoles: commaList(roles) }) });
    if (response.ok) { setTitle(""); setBody(""); setMessage(locale === "en" ? "Addressed release published." : "Адресный релиз опубликован."); }
    else setMessage(locale === "en" ? "Release validation failed." : "Релиз не прошёл проверку.");
  }
  async function inspectSubmission(id: number) {
    const detail = await fetch(`/api/admin/submissions?id=${id}`).then((response) => readJsonResponse<{ submission?: Record<string, unknown> }>(response));
    if (detail?.submission) { setSelectedSubmission(detail.submission); setReviewerNote(String(detail.submission.reviewerNote ?? "")); }
  }
  async function reviewSubmission(id: number, status: "accepted" | "changes_requested") {
    const response = await fetch("/api/admin/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, reviewerNote }) });
    if (response.ok) {
      setQueue((current) => current.map((item) => Number(item.id) === id ? { ...item, status } : item));
      setSelectedSubmission(null); setReviewerNote("");
    }
  }
  async function resolveFeedback(id: number) {
    const response = await fetch("/api/admin/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: "resolved", moderatorNote: "Reviewed by the editorial queue." }) });
    if (response.ok) setFeedbackQueue((current) => current.map((item) => Number(item.id) === id ? { ...item, status: "resolved" } : item));
  }
  async function changeLicense(email: string, licenseTier: AdminCommunityUser["licenseTier"]) {
    setAdminBusy(`license:${email}`); setMessage("");
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, licenseTier }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setAdminUsers((current) => current.map((user) => user.email === email ? { ...user, licenseTier } : user));
      setMessage(locale === "en" ? "Licence entitlement updated." : "Уровень лицензии обновлён.");
    } else setMessage(result?.error ?? (locale === "en" ? "Licence could not be updated." : "Не удалось обновить лицензию."));
    setAdminBusy("");
  }
  async function sendPasswordReset(user: AdminCommunityUser) {
    if (!user.hasLocalAccount || !emailResetAvailable) return;
    if (!window.confirm(locale === "en" ? `Send a single-use password-reset link to the stored address ${user.email}? You will not see the link or password.` : `Отправить одноразовую ссылку для сброса на сохранённый адрес ${user.email}? Ссылка и пароль вам показаны не будут.`)) return;
    setAdminBusy(`reset:${user.id}`); setMessage("");
    const response = await fetch("/api/admin/users/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const result = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    setMessage(response.ok ? (result?.message ?? (locale === "en" ? "Password-reset email sent." : "Письмо для сброса пароля отправлено.")) : (result?.error ?? (locale === "en" ? "The reset email could not be sent." : "Не удалось отправить письмо для сброса.")));
    setAdminBusy("");
  }
  async function promoteCustomCase(item: CommunityCustomCase) {
    setAdminBusy(`promote:${item.id}`); setMessage("");
    const detailResponse = await fetch(`/api/custom-cases?id=${item.id}`);
    const detail = await detailResponse.json().catch(() => null) as { draft?: unknown; error?: string } | null;
    if (!detailResponse.ok || detail?.draft === undefined) {
      setMessage(detail?.error ?? (locale === "en" ? "The exact custom-case version could not be loaded." : "Не удалось загрузить точную версию custom-кейса.")); setAdminBusy(""); return;
    }
    let sourceDraft: StudioDraft;
    try { sourceDraft = normalizeStudioDraft(detail.draft); }
    catch { setMessage(locale === "en" ? "The custom-case draft is structurally invalid." : "Структура черновика custom-кейса некорректна."); setAdminBusy(""); return; }
    const compiled = compileStudioDraft(sourceDraft);
    if (!compiled.scenario) {
      setMessage((locale === "en" ? "Promotion blocked: " : "Публикация заблокирована: ") + compiled.issues.map((issue) => issue.message).join(" ")); setAdminBusy(""); return;
    }
    const candidate = { item, draft: sourceDraft, scenario: compiled.scenario };
    if (isTaxDraft(sourceDraft)) {
      setPendingPromotion(candidate);
      setTaxReviewNote("");
      setTaxReviewChecks(Object.fromEntries(taxPublicationChecklist.map((key) => [key, false])) as Record<TaxPublicationChecklistKey, boolean>);
      setAdminBusy("");
      return;
    }
    if (!window.confirm(locale === "en" ? "Publish an immutable copy of this exact custom-case version to the General Library? The restricted source remains in its workspace." : "Опубликовать неизменяемую копию этой точной версии custom-кейса в Общей библиотеке? Ограниченный источник останется в workspace.")) { setAdminBusy(""); return; }
    await publishPromotion(candidate);
  }
  async function publishPromotion(candidate: PromotionCandidate, taxSafetyAttestation?: Record<string, unknown>) {
    setAdminBusy(`promote:${candidate.item.id}`); setMessage("");
    const response = await fetch("/api/admin/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customCaseId: candidate.item.id, draft: candidate.draft, authorName: candidate.item.ownerDisplayName ?? "Custom case author", reviewerName: "Maxim Hayan · platform administrator", reviewLevel: "community_beta", changeSummary: "Promoted from a restricted custom workspace to the General Library as an immutable snapshot.", durationMinutes: 45, sector: candidate.draft.classification?.practiceArea ?? "General legal", ...(taxSafetyAttestation ? { taxSafetyAttestation } : {}) }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      await Promise.all([reloadCustomCases(), refreshCatalogue()]);
      setPendingPromotion(null); setTaxReviewNote("");
      setMessage(locale === "en" ? "Immutable case version published to the General Library." : "Неизменяемая версия опубликована в Общей библиотеке.");
    } else setMessage(result?.error ?? (locale === "en" ? "Promotion failed validation." : "Кейс не прошёл проверки публикации."));
    setAdminBusy("");
  }
  async function confirmTaxPromotion() {
    if (!pendingPromotion || !pendingPromotion.draft.classification || !isTaxDraft(pendingPromotion.draft)) return;
    const classification = pendingPromotion.draft.classification;
    const allConfirmed = taxPublicationChecklist.every((key) => taxReviewChecks[key]);
    if (!allConfirmed || taxReviewNote.trim().length < 20 || !classification.legalAsOf || !(classification.sourceUrls?.length)) return;
    await publishPromotion(pendingPromotion, {
      kind: "tax-publication-attestation-v1",
      reviewerName: "Maxim Hayan · platform administrator",
      reviewedAt: new Date().toISOString(),
      legalAsOf: classification.legalAsOf,
      sourceCount: classification.sourceUrls.length,
      note: taxReviewNote.trim(),
      studioFingerprint: caseFingerprint(pendingPromotion.draft),
      playableFingerprint: pendingPromotion.scenario.fingerprint,
      checklist: Object.fromEntries(taxPublicationChecklist.map((key) => [key, true])),
    });
  }
  const selectedDraft = isRecord(selectedSubmission?.payload) ? selectedSubmission.payload : null;
  const selectedClassification = isRecord(selectedDraft?.classification) ? selectedDraft.classification : null;
  const selectedNodes = Array.isArray(selectedDraft?.nodes) ? selectedDraft.nodes : [];
  const selectedLinks = Array.isArray(selectedDraft?.links) ? selectedDraft.links : [];
  const pendingTaxClassification = pendingPromotion && isTaxDraft(pendingPromotion.draft) ? pendingPromotion.draft.classification : null;
  const taxReviewLabels: Record<TaxPublicationChecklistKey, { en: string; ru: string }> = {
    lawfulPurposeConfirmed: { en: "The scenario has a documented lawful commercial purpose.", ru: "У сценария зафиксирована законная деловая цель." },
    complianceOnlyConfirmed: { en: "The case is limited to compliant planning and risk control.", ru: "Кейс ограничен законным планированием и контролем рисков." },
    legalAsOfVerified: { en: "The legal as-of date has been checked against the sources.", ru: "Дата актуальности права сверена с источниками." },
    sourceAuthorityVerified: { en: "Each cited source is authoritative, current and HTTPS-accessible.", ru: "Каждый источник авторитетен, актуален и доступен по HTTPS." },
    antiAbuseRulesReviewed: { en: "Applicable anti-abuse, substance and beneficial-ownership rules were reviewed.", ru: "Проверены применимые anti-abuse, substance и beneficial-ownership правила." },
    reportingObligationsReviewed: { en: "Disclosure, reporting and exchange-of-information obligations were reviewed.", ru: "Проверены обязанности по раскрытию, отчётности и обмену информацией." },
    noEvasionFacilitationConfirmed: { en: "The playable paths do not facilitate concealment, evasion or false reporting.", ru: "Игровые ветви не способствуют сокрытию, уклонению или ложной отчётности." },
  };
  const taxReviewReady = Boolean(pendingTaxClassification?.legalAsOf && pendingTaxClassification.sourceUrls?.length && taxReviewNote.trim().length >= 20 && taxPublicationChecklist.every((key) => taxReviewChecks[key]));
  return <section className="admin-desk">
    <div className="panel-title"><span>PLATFORM ADMIN · MODERATION & RELEASES</span><b>ADMIN</b></div>
    <Suspense fallback={<section className="operations-dashboard operations-dashboard-loading"><p>{locale === "en" ? "Loading aggregated telemetry…" : "Загрузка агрегированной телеметрии…"}</p></section>}><OperationsDashboard locale={locale}/></Suspense>
    <div className="admin-grid">
      <form onSubmit={publishRelease}><h2>{locale === "en" ? "Addressed release" : "Адресный релиз"}</h2><label><span>Kind</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="product">Product</option><option value="case">Case</option><option value="research">Research</option></select></label>{kind === "case" && <label><span>Case</span><select value={caseId} onChange={(event) => setCaseId(event.target.value)}>{cases.map((item) => <option value={item.id} key={item.id}>{item.title} · v{item.currentVersion}</option>)}</select></label>}<label><span>Title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)}/></label><label><span>Message</span><textarea value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)}/></label><label><span>Target jurisdictions · comma separated</span><input value={jurisdictions} onChange={(event) => setJurisdictions(event.target.value)}/></label><label><span>Target practices · comma separated</span><input value={practices} onChange={(event) => setPractices(event.target.value)}/></label><label><span>Target roles · comma separated</span><input value={roles} onChange={(event) => setRoles(event.target.value)}/></label><button className="primary-cta" disabled={title.trim().length < 4 || body.trim().length < 10}>Publish release<Icon name="arrow"/></button>{message && <p role="status">{message}</p>}</form>
      <div className="moderation-queues">
        <section><h2>{locale === "en" ? "Case submissions" : "Кейсы на рецензии"}</h2>{queue.filter((item) => item.status === "submitted").slice(0, 8).map((item) => <article key={String(item.id)}><b>{String(item.title)}</b><small>{String(item.caseId)} · v{String(item.version)}</small><button onClick={() => inspectSubmission(Number(item.id))}>{locale === "en" ? "Inspect draft" : "Открыть черновик"}</button></article>)}</section>
        <section><h2>{locale === "en" ? "Feedback queue" : "Очередь отзывов"}</h2>{feedbackQueue.filter((item) => item.status !== "resolved" && item.status !== "declined").slice(0, 8).map((item) => <article key={String(item.id)}><b>{String(item.caseId)} · {String(item.category)}</b><small>{String(item.severity)} · {String(item.contextType)} {String(item.contextId ?? "")}</small><p>{String(item.comment)}</p><button onClick={() => resolveFeedback(Number(item.id))}>Resolve</button></article>)}</section>
      </div>
    </div>
    <section className="admin-custom-register"><div className="admin-section-heading"><div><span>CUSTOM → GENERAL LIBRARY</span><h2>{locale === "en" ? "Custom case inventory" : "Реестр custom-кейсов"}</h2></div><b>{customCases.filter((item) => !item.isPrivate).length.toString().padStart(2, "0")}</b></div><p>{locale === "en" ? "Private cases are omitted at the API boundary: Maxim receives neither their content nor their metadata. Promotion creates a new immutable public snapshot and keeps the custom source." : "Приватные кейсы исключаются на границе API: Максим не получает ни содержание, ни метаданные. Продвижение создаёт новую неизменяемую публичную копию и сохраняет custom-источник."}</p><div>{customCases.filter((item) => !item.isPrivate).map((item) => <article key={item.id}><div><span>{item.status === "promoted" ? "LIBRARY SNAPSHOT CREATED" : "RESTRICTED CUSTOM"}</span><h3>{item.title}</h3><small>{item.ownerDisplayName ?? "Case author"} · {item.caseId} · v{item.currentVersion} · {item.shareCount} share(s)</small></div><div><button type="button" className="secondary-cta" onClick={() => openCustomCase(item.id)}>{locale === "en" ? "Open source" : "Открыть источник"}</button><button type="button" className="primary-cta" disabled={adminBusy === `promote:${item.id}`} onClick={() => promoteCustomCase(item)}>{item.status === "promoted" ? (locale === "en" ? "Publish next version" : "Опубликовать новую версию") : (locale === "en" ? "Promote to library" : "Перевести в библиотеку")}<Icon name="arrow"/></button></div></article>)}</div></section>
    {pendingPromotion && pendingTaxClassification && <section className="tax-publication-review" aria-labelledby="tax-publication-review-title">
      <header><div><span>TAX / OFFSHORE PUBLICATION GATE</span><h2 id="tax-publication-review-title">{locale === "en" ? "Exact-artifact compliance attestation" : "Compliance-аттестация точного артефакта"}</h2></div><button type="button" onClick={() => setPendingPromotion(null)} disabled={adminBusy === `promote:${pendingPromotion.item.id}`} aria-label={locale === "en" ? "Close tax review" : "Закрыть налоговую проверку"}><Icon name="close"/></button></header>
      <p>{locale === "en" ? "Publication remains blocked until the administrator reviews the legal basis, sources and every playable path. Each confirmation is recorded against the exact Studio and compiled-playable fingerprints." : "Публикация заблокирована, пока администратор не проверит правовую основу, источники и каждую игровую ветвь. Подтверждения привязываются к точным fingerprints Studio и собранного playable-артефакта."}</p>
      <dl><div><dt>CASE / VERSION</dt><dd>{pendingPromotion.draft.caseId} · v{pendingPromotion.draft.version}</dd></div><div><dt>LEGAL AS OF</dt><dd>{pendingTaxClassification.legalAsOf ?? "MISSING"}</dd></div><div><dt>VERIFIED SOURCES</dt><dd>{pendingTaxClassification.sourceUrls?.length ?? 0}</dd></div><div><dt>REVIEWER</dt><dd>Maxim Hayan · platform administrator</dd></div><div><dt>STUDIO FINGERPRINT</dt><dd><code>{caseFingerprint(pendingPromotion.draft)}</code></dd></div><div><dt>PLAYABLE FINGERPRINT</dt><dd><code>{pendingPromotion.scenario.fingerprint}</code></dd></div></dl>
      <div className="tax-source-register">{(pendingTaxClassification.sourceUrls ?? []).map((source) => <a key={source} href={source} target="_blank" rel="noreferrer">{source}</a>)}</div>
      <fieldset><legend>{locale === "en" ? "Confirm each reviewed control" : "Подтвердите каждый проверенный контроль"}</legend>{taxPublicationChecklist.map((key) => <label key={key}><input type="checkbox" checked={taxReviewChecks[key]} onChange={(event) => setTaxReviewChecks((current) => ({ ...current, [key]: event.target.checked }))}/><span>{taxReviewLabels[key][locale]}</span></label>)}</fieldset>
      <label className="tax-review-note"><span>{locale === "en" ? "Substantive reviewer note · minimum 20 characters" : "Содержательная заметка рецензента · минимум 20 символов"}</span><textarea minLength={20} maxLength={2000} value={taxReviewNote} onChange={(event) => setTaxReviewNote(event.target.value)} placeholder={locale === "en" ? "Record the reviewed rules, source dates and any assumptions or limitations…" : "Зафиксируйте проверенные правила, даты источников, допущения и ограничения…"}/></label>
      <footer><button type="button" className="secondary-cta" onClick={() => setPendingPromotion(null)} disabled={adminBusy === `promote:${pendingPromotion.item.id}`}>{locale === "en" ? "Cancel" : "Отмена"}</button><button type="button" className="primary-cta" onClick={() => void confirmTaxPromotion()} disabled={!taxReviewReady || adminBusy === `promote:${pendingPromotion.item.id}`}>{adminBusy === `promote:${pendingPromotion.item.id}` ? (locale === "en" ? "Publishing…" : "Публикация…") : (locale === "en" ? "Attest & publish immutable version" : "Подтвердить и опубликовать версию")}<Icon name="check"/></button></footer>
    </section>}
    <section className="admin-license-register"><div className="admin-section-heading"><div><span>SERVER ENTITLEMENTS & ACCOUNT RECOVERY</span><h2>{locale === "en" ? "Users, licences and safe reset" : "Пользователи, лицензии и безопасный сброс"}</h2></div><b>{adminUsers.length.toString().padStart(2, "0")}</b></div><p>{locale === "en" ? "Change sharing entitlements or send a one-time reset email to the address already stored for a local account. The administrator never receives or sets the user’s password, token or reset link." : "Изменяйте права на пересылку или отправляйте одноразовое письмо на уже сохранённый адрес локального аккаунта. Администратор никогда не получает и не задаёт пароль, токен или ссылку пользователя."} {!emailResetAvailable && (locale === "en" ? " Email delivery is disabled until the server sender is configured." : " Отправка писем отключена до настройки серверного отправителя.")}</p><div>{adminUsers.map((user) => <article key={user.id}><span><b>{user.displayName || user.email}</b><small>{user.email}{user.organisation ? ` · ${user.organisation}` : ""} · {user.hasLocalAccount ? (locale === "en" ? "local password active" : "локальный пароль активен") : (locale === "en" ? "no local password" : "нет локального пароля")}</small></span><div className="admin-user-actions"><select aria-label={locale === "en" ? `Licence for ${user.email}` : `Лицензия для ${user.email}`} value={user.licenseTier} disabled={adminBusy === `license:${user.email}`} onChange={(event) => changeLicense(user.email, event.target.value as AdminCommunityUser["licenseTier"])}><option value="community">Community</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select><button type="button" disabled={!emailResetAvailable || !user.hasLocalAccount || user.localAccountStatus !== "active" || adminBusy === `reset:${user.id}`} onClick={() => void sendPasswordReset(user)}>{adminBusy === `reset:${user.id}` ? (locale === "en" ? "Sending…" : "Отправка…") : (locale === "en" ? "Send reset email" : "Отправить сброс")}</button></div></article>)}</div></section>
    {selectedSubmission && selectedDraft && <section className="review-detail"><div><span>REVIEW RECORD</span><button onClick={() => setSelectedSubmission(null)} aria-label={locale === "en" ? "Close review record" : "Закрыть рецензию"}><Icon name="close"/></button></div><h2>{String(selectedSubmission.title)}</h2><dl><div><dt>CASE / VERSION</dt><dd>{String(selectedSubmission.caseId)} · v{String(selectedSubmission.version)}</dd></div><div><dt>FINGERPRINT</dt><dd><code>{String(selectedSubmission.fingerprint)}</code></dd></div><div><dt>DOMAIN / PRACTICE</dt><dd>{String(selectedClassification?.domain ?? "general")} · {String(selectedClassification?.practiceArea ?? "")}</dd></div><div><dt>GRAPH</dt><dd>{selectedNodes.length} nodes · {selectedLinks.length} links</dd></div></dl><p>{String(selectedDraft.premise ?? "")}</p><label><span>{locale === "en" ? "Substantive reviewer note" : "Содержательное замечание рецензента"}</span><textarea value={reviewerNote} minLength={10} maxLength={4000} onChange={(event) => setReviewerNote(event.target.value)}/></label><div><button className="secondary-cta" disabled={reviewerNote.trim().length < 10} onClick={() => reviewSubmission(Number(selectedSubmission.id), "changes_requested")}>{locale === "en" ? "Request changes" : "Запросить изменения"}</button><button className="primary-cta" disabled={reviewerNote.trim().length < 10} onClick={() => reviewSubmission(Number(selectedSubmission.id), "accepted")}>{locale === "en" ? "Accept for compilation" : "Принять для сборки"}<Icon name="check"/></button></div></section>}
    <p className="admin-publication-note">{locale === "en" ? "Accepted drafts remain non-public until an administrator compiles a playable-scenario-v1 manifest and publishes it through the immutable case-version API." : "Принятые черновики остаются непубличными, пока администратор не соберёт playable-scenario-v1 и не опубликует неизменяемую версию через API."}</p>
  </section>;
}

function commaList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

function HelpView({ locale, openCommunity, openStudio }: { locale: Locale; openCommunity: () => void; openStudio: () => void }) {
  const steps = locale === "en" ? [
    ["Choose a case", "Use search, practice filters, tags, difficulty and duration to select a relevant matter."],
    ["Work the record", "Review the opening situation, inbox, evidence provenance, deadlines and available decisions."],
    ["Inspect consequences", "Every confirmed action advances time and changes the legal, evidential and institutional position."],
    ["Control access", "Keep a case on this device, save a restricted custom case to your workspace, mark it Private, or prepare a reviewed version for the General Library."],
  ] : [
    ["Выберите кейс", "Используйте поиск, фильтры практики, теги, сложность и длительность."],
    ["Работайте с материалами", "Изучите ситуацию, Inbox, доказательства, сроки и доступные решения."],
    ["Разберите последствия", "Каждое действие продвигает время и меняет правовую и институциональную позицию."],
    ["Управляйте доступом", "Храните кейс на устройстве, сохраняйте ограниченный custom-кейс в workspace, включайте «Приватно» или готовьте проверенную версию для Общей библиотеки."],
  ];
  const editorTranscript = locale === "en" ? [
    "Open Case Studio. Every prompt and visual change stays in one authoring record.",
    "Add evidence, connect it to a decision, and rename an actor with the exact-command fallback.",
    "Review the deterministic operation plan before applying graph changes.",
    "Apply the plan as one transaction, inspect its exact diff, or undo it.",
    "Add, rename and connect a node directly in the visual editor.",
    "Relink an existing relationship, then check the graph and launch the player.",
  ] : [
    "Откройте Case Studio. Промпты и визуальные правки сохраняются в единой истории кейса.",
    "Добавьте доказательство, связь и переименуйте участника через резервный режим точных команд.",
    "До применения проверьте детерминированный план операций над графом.",
    "Примените план одной транзакцией, изучите точный diff или отмените изменение.",
    "Добавьте, переименуйте и соедините узел прямо в визуальном редакторе.",
    "Перепривяжите существующую связь, проверьте граф и запустите плеер.",
  ];
  const playTranscript = locale === "en" ? [
    "Confirm that Check & play reports the current graph as ready.",
    "Launch your case in the same Operations player used by published scenarios.",
    "Review the record, available evidence, deadline, and linked decision options.",
    "Confirm a decision and observe its consequence, clock, metrics, and deadline state.",
    "Finish the branch and inspect the complete debrief for your own case.",
  ] : [
    "Убедитесь, что раздел «Проверить и играть» отмечает текущий граф как готовый.",
    "Запустите кейс в том же плеере Operations, что используется для опубликованных сценариев.",
    "Изучите материалы, доказательства, срок и варианты связанного решения.",
    "Подтвердите выбор и проследите его последствия, время, метрики и состояние срока.",
    "Завершите ветвь и изучите полный разбор собственного кейса.",
  ];
  return <main className="help-view page-width">
    <section className="help-hero"><span>QUICK HELP</span><h1>{locale === "en" ? "How GENESIS: JURIS works" : "Как работает GENESIS: JURIS"}</h1><p>{locale === "en" ? "A practical legal-simulation system: read the evolving matter, make consequential decisions, learn from the debrief and help practitioners improve the next version." : "Практическая система юридических симуляций: изучайте развивающееся дело, принимайте значимые решения, анализируйте результат и помогайте улучшать следующую версию."}</p></section>
    <section className="help-steps">{steps.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{body}</p></article>)}</section>
    <section className="help-video-guides" aria-labelledby="help-video-guides-title">
      <header><span>GUIDED DEMOS</span><h2 id="help-video-guides-title">{locale === "en" ? "Create, refine, then play" : "Создайте, доработайте и пройдите"}</h2><p>{locale === "en" ? "Watch the two-minute AI demo, then explore the editor and player clips." : "Посмотрите двухминутное AI-демо, затем короткие ролики редактора и плеера."}</p></header>
      <div className="help-video-grid">
        <Suspense fallback={null}><StudioGuidedDemo locale={locale}/></Suspense>
        <article className="help-video-card">
          <video controls preload="metadata" playsInline poster="/help/case-studio-iterative-editing-poster.jpg" aria-describedby="editor-video-description editor-video-transcript">
            <source src="/help/case-studio-iterative-editing.mp4" type="video/mp4"/>
            <track kind="captions" src="/help/case-studio-iterative-editing.en.vtt" srcLang="en" label="English" default={locale === "en"}/>
            <track kind="captions" src="/help/case-studio-iterative-editing.ru.vtt" srcLang="ru" label="Русский" default={locale === "ru"}/>
            {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
          </video>
          <div className="help-video-copy"><span>01 · 00:26</span><h3>{locale === "en" ? "Visual editing & exact-command fallback" : "Визуальные правки и точные команды"}</h3><p id="editor-video-description">{locale === "en" ? "This recording demonstrates the deterministic fallback and stable graph controls. In the current release, Understand with AI is the primary entry point and always requires review before apply." : "Запись показывает детерминированный резервный режим и стабильные элементы графа. В текущей версии основной вход — «Понять с ИИ» с обязательной проверкой до применения."}</p></div>
          <details className="help-transcript" id="editor-video-transcript"><summary>{locale === "en" ? "Read transcript" : "Открыть расшифровку"}</summary><ol>{editorTranscript.map((item) => <li key={item}>{item}</li>)}</ol></details>
        </article>
        <article className="help-video-card">
          <video controls preload="metadata" playsInline poster="/help/play-your-studio-case-poster.jpg" aria-describedby="play-video-description play-video-transcript">
            <source src="/help/play-your-studio-case.mp4" type="video/mp4"/>
            <track kind="captions" src="/help/play-your-studio-case.en.vtt" srcLang="en" label="English" default={locale === "en"}/>
            <track kind="captions" src="/help/play-your-studio-case.ru.vtt" srcLang="ru" label="Русский" default={locale === "ru"}/>
            {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
          </video>
          <div className="help-video-copy"><span>02 · 00:17</span><h3>{locale === "en" ? "Play your own Studio case" : "Прохождение своего кейса"}</h3><p id="play-video-description">{locale === "en" ? "Compile the current graph into the complete runtime, make a linked decision, observe its operational consequences, and finish with a full debrief." : "Скомпилируйте текущий граф в полный игровой сценарий, примите связанное решение, проследите операционные последствия и завершите кейс полным разбором."}</p></div>
          <details className="help-transcript" id="play-video-transcript"><summary>{locale === "en" ? "Read transcript" : "Открыть расшифровку"}</summary><ol>{playTranscript.map((item) => <li key={item}>{item}</li>)}</ol></details>
        </article>
      </div>
    </section>
    <Suspense fallback={<section className="help-faq"><h2>{locale === "en" ? "Loading help…" : "Загрузка помощи…"}</h2></section>}><HelpFaq locale={locale}/></Suspense>
    <div className="help-actions"><button className="secondary-cta" onClick={openCommunity}>{locale === "en" ? "Register or update profile" : "Регистрация и профиль"}</button><button className="primary-cta" onClick={openStudio}>{locale === "en" ? "Open Case Studio" : "Открыть Case Studio"}<Icon name="arrow"/></button></div>
  </main>;
}

function FeedbackDialog({ locale, target, close, submitted }: { locale: Locale; target: FeedbackTarget; close: () => void; submitted: (audience?: string) => void }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("legal_accuracy");
  const [severity, setSeverity] = useState("suggestion");
  const [comment, setComment] = useState("");
  const [suggestedCorrection, setSuggestedCorrection] = useState("");
  const [citationUrl, setCitationUrl] = useState("");
  const [privacyMode, setPrivacyMode] = useState<"private_note" | "product_only">("private_note");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>(".modal-close")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]),select,textarea,input,a[href]"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); prior?.focus(); };
  }, [close]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setError("");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: target.caseId, caseVersion: target.version, source: target.source, studioFingerprint: target.fingerprint, customCaseId: target.source === "studio" && privacyMode !== "product_only" ? target.customCaseId : undefined, contextType: target.contextType ?? "case", contextId: target.contextId, rating, category, severity, comment, suggestedCorrection, citationUrl, privacyMode: target.privateCase ? privacyMode : undefined }) });
    if (response.status === 401) { router.push("/signin-with-chatgpt?return_to=%2F"); return; }
    const result = await response.json().catch(() => null) as { audience?: string; error?: string } | null;
    if (!response.ok) { setError(result?.error ?? (locale === "en" ? "Please complete the rating and comment." : "Заполните оценку и комментарий.")); setSending(false); return; }
    submitted(result?.audience);
  }
  const productOnly = target.privateCase && privacyMode === "product_only";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form ref={dialogRef} className="feedback-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="feedback-title"><button type="button" className="modal-close" onClick={close} aria-label={locale === "en" ? "Close feedback dialog" : "Закрыть форму отзыва"}><Icon name="close"/></button><span>{target.privateCase ? "PRIVATE CASE FEEDBACK" : `CASE-SPECIFIC FEEDBACK · ${target.source.toUpperCase()}`}</span><h2 id="feedback-title">{target.privateCase ? (locale === "en" ? "Choose who can receive this note" : "Выберите, кому доступна заметка") : (locale === "en" ? "Help improve this case" : "Помогите улучшить кейс")}</h2><p><b>{target.title}</b><br/><code>{target.caseId} · v{target.version}{target.contextId ? ` · ${target.contextType}:${target.contextId}` : ""}</code></p><aside className="feedback-privacy"><Icon name="alert"/>{locale === "en" ? "Do not include client-identifiable, privileged, personal or confidential information." : "Не включайте идентифицирующие клиента, привилегированные, персональные или конфиденциальные сведения."}</aside>{target.privateCase && <fieldset className="private-feedback-options"><legend>{locale === "en" ? "Resolve the private-feedback conflict" : "Разрешение коллизии приватного фидбэка"}</legend><label className={privacyMode === "private_note" ? "selected" : ""}><input type="radio" name="privacyMode" value="private_note" checked={privacyMode === "private_note"} onChange={() => setPrivacyMode("private_note")}/><span><b>{locale === "en" ? "Private note · owner only" : "Приватная заметка · только владелец"}</b><small>{locale === "en" ? "Stored with this case for you. Maxim and the review queue cannot see it." : "Сохраняется вместе с кейсом для вас. Максим и очередь рецензий её не видят."}</small></span></label><label className={privacyMode === "product_only" ? "selected" : ""}><input type="radio" name="privacyMode" value="product_only" checked={privacyMode === "product_only"} onChange={() => setPrivacyMode("product_only")}/><span><b>{locale === "en" ? "Anonymised case context · product feedback" : "Обезличенный контекст · отзыв о продукте"}</b><small>{locale === "en" ? "Your attributed comment, rating and category go to Maxim, but case ID, version, fingerprint, node context, citation and correction fields are stripped. Do not repeat case facts in the comment." : "Максим получит ваш авторизованный комментарий, оценку и категорию, но ID, версия, fingerprint, контекст узла, источник и поле исправления будут удалены. Не повторяйте факты кейса в комментарии."}</small></span></label><p>{locale === "en" ? "For substantive review of case content, turn off Private and share or submit an exact restricted version." : "Для содержательной рецензии отключите «Приватно» и предоставьте доступ либо отправьте точную ограниченную версию."}</p></fieldset>}<div className="feedback-fields"><label><span>{locale === "en" ? "Feedback category" : "Категория отзыва"}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="legal_accuracy">Legal / tax accuracy</option><option value="realism">Professional realism</option><option value="learning_value">Learning value</option><option value="usability">Usability</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label><span>{locale === "en" ? "Severity" : "Существенность"}</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="suggestion">Suggestion</option><option value="material">Material correction</option><option value="critical">Critical legal/safety issue</option></select></label></div><fieldset><legend>{locale === "en" ? "Overall rating" : "Общая оценка"}</legend><div className="rating-row">{[1,2,3,4,5].map((value) => <button type="button" key={value} className={value <= rating ? "active" : ""} onClick={() => setRating(value)} aria-label={`${value} / 5`}>★</button>)}</div></fieldset><label><span>{productOnly ? (locale === "en" ? "Product-level issue · do not include case facts" : "Проблема продукта · без фактов кейса") : (locale === "en" ? "What should be corrected or improved?" : "Что следует исправить или улучшить?")}</span><textarea required minLength={10} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={productOnly ? (locale === "en" ? "Describe the interface or workflow issue without referring to this case…" : "Опишите проблему интерфейса или процесса без ссылки на этот кейс…") : (locale === "en" ? "Identify the fact, rule, stage, node or decision branch…" : "Укажите факт, правило, стадию, узел или ветвь решения…")}/></label>{!productOnly && <><label><span>{locale === "en" ? "Suggested correction" : "Предлагаемое исправление"}</span><textarea value={suggestedCorrection} onChange={(event) => setSuggestedCorrection(event.target.value)} placeholder={locale === "en" ? "Optional replacement wording or branch logic" : "Необязательная новая формулировка или логика ветви"}/></label><label><span>{locale === "en" ? "Supporting HTTPS source" : "Подтверждающий HTTPS-источник"}</span><input type="url" value={citationUrl} onChange={(event) => setCitationUrl(event.target.value)} placeholder="https://…"/></label></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-cta" onClick={close}>{locale === "en" ? "Cancel" : "Отмена"}</button><button className="primary-cta" disabled={sending || comment.trim().length < 10}>{sending ? "Sending…" : target.privateCase && privacyMode === "private_note" ? (locale === "en" ? "Save private note" : "Сохранить приватную заметку") : locale === "en" ? "Submit feedback" : "Отправить отзыв"}<Icon name="arrow"/></button></div></form></div>;
}
