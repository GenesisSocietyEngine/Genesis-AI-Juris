"use client";

import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { appendConnectedStudioItem } from "./studio-action-editing";
import { focusActionTarget } from "./ActionTile";
import type { StudioCheck } from "./studio-validation";
import type { StudioActionTarget } from "./StudioActionPanel";
import AppNavigation from "./AppNavigation";
import { useNavigationController } from "./NavigationSession";
import { registerStudioDeparture, studioDepartureFingerprint, type StudioSavedBaseline } from "./studio-departure";
import { clearStudioEvidenceInput, emptyStudioEvidenceInput, hasStudioEvidenceInput, updateStudioEvidenceInput, type StudioEvidenceBuffers, type StudioEvidenceInput } from "./studio-evidence-buffer";
import StudioWorkspaceTabs from "./StudioWorkspaceTabs";
import StudioRecoveryView, { type StudioRecovery } from "./StudioRecoveryView";
import StudioDecisionList from "./StudioDecisionList";
import { graphOverviewScale } from "./graph-viewport";
import CaseTemplates, { prepareCaseTemplate } from "./CaseTemplates";
import type { ExampleLaunch } from "./ExampleLaunchStatus";
import { retainStudioReplacement, purgeKnownStudioArchive, restoreArchivedStudioDraft, type ArchivedStudioDraft } from "./studio-draft-archive";
import { studioReplacementMessage } from "./studio-replacement-message";
import { matchingCategoryDemos } from "./category-demos";
import { CASE_TYPE_REGISTRY } from "./case-type-registry";
import DemoCatalogueCards, { matchesCanopy, type DemoFormat } from "./DemoCatalogueCards";
import { Icon, metricLabels, readJsonResponse } from "./JurisViewShared";
import { canonicalFingerprint, caseFingerprint, casePublicationFingerprint, isRecord, isTaxDraft, legacyCaseFingerprintV15, normalizeStudioDraft, slugifyCaseId } from "./case-integrity";
import { bundledCataloguePresentation, mayUseBundledCatalogueFallback } from "./catalogue-fallback";
import { actionUseKey, decisionAvailability, resolveDecisionTiming, resolveLegacyDecisionTiming } from "./game-engine";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import { isSupportedPlayedCaseSchemaRevision, PLAYED_CASE_SCHEMA_REVISION } from "./played-case-contract";
import { deriveRunLedger } from "./run-ledger";
import type { CanonicalRuntimeState } from "./canonical-runtime";
import { initialMetrics } from "./runtime-constants";
import { LatestRequestGate } from "./latest-request";
import { useInterfaceLocale, useWorkspaceLocation } from "./use-interface-locale";
import { workspaceSignInPath, workspaceDestination } from "./workspace-navigation";
import { createStudioAuthContinuation, readStudioAuthContinuationState, writeStudioAuthContinuation, LEGACY_STUDIO_AUTH_CONTINUATION_KEY, STUDIO_AUTH_CONTINUATION_KEY } from "./studio-auth-continuation";
import ReportErrorBoundary from "./ReportErrorBoundary";
import { withLocalChunkRecovery } from "./stale-chunk-recovery";
import { reportGenerationErrorMessage } from "./report-generation-error";
import { readStudioSaveResponse, savedStudioPath, verifiedStudioSaveReceipt } from "./studio-save-receipt";
import { mayChooseImportedPrivacy } from "./studio-import-privacy";
import { StudioSessionAuthority, shouldDiscardStudioDraft, type StudioReportAuthority } from "./studio-session-authority";
import { pendingSignOutMessage, subscribeSessionBoundary } from "./session-boundary";
import { LEGACY_STUDIO_DRAFT_KEY, LEGACY_STUDIO_PRIVATE_KEY, mayPersistReportReceiptOnDevice, mayPersistStudioDraftOnDevice, readStudioDeviceDraft, removeKnownStudioDeviceDrafts, writeStudioDeviceDraft } from "./studio-device-storage";
import { addStudioLink, appendStudioHistory, applyStudioPromptIteration, deleteStudioLink, describeStudioPromptOperation, nextStudioLinkId, nextStudioNodeId, nextStudioNodePosition, planStudioPromptIteration, relinkStudioLink, type StudioPromptPlan } from "./studio-editing";
import { applyValidatedAIStudioPlan, studioAIBaseFingerprint, toStudioAIContext } from "./studio-ai-plan";
import { compileStudioDraft } from "./studio-compiler";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { caseTypeReference } from "./case-type-reference";
import { hasTaxAttachment } from "./tax-authoring";
import { StudioTaxWriteBaseline, type StudioTaxWrite } from "./studio-tax-write-baseline";
import { freezeStudioDraftSnapshot, readStudioAggregate } from "./studio-aggregate";
import { STUDIO_NODE_MENU_PAGE_SIZE, studioNodeMenuOptions, studioNodeMenuPage } from "./studio-node-menu";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";
import type { CanopyScenarioId } from "./canopy-fixture";
import type { GuidedStudioStep } from "./StudioGuidedWizard";
import { parseStudioWorkflowStep, restoredStudioWorkflowStep, serializedStudioWorkflowStep, studioWorkflowStorageKey } from "./studio-workflow";
import { applyStudioSnapshot, diffDraftToRevision, diffStudioSnapshots, emptyStudioTimeline, recordStudioRevision, snapshotStudioDraft, stepStudioTimeline, studioSnapshotsEqual, type StudioRevision, type StudioTimeline } from "./studio-revisions";
import { applyDealChangeToTaxEconomics, calculateTaxEconomics, convertRentalTaxBase, defaultTaxEconomics, prefillTaxEconomicsFromDeal, rentalTaxBaseFromDeal } from "./tax-economics";
import { inferDealEconomicsFromText } from "./deal-economics";
import type {
  DecisionOption,
  CaseTypeId,
  LocalText,
  MetricKey,
  Scenario,
  StudioDraft,
  StudioEditAction,
  StudioLink,
  StudioNode,
  StudioNodeType,
} from "./types";

export type Locale = "en" | "ru";
type View = "templates" | "library" | "demos" | "play" | "studio" | "community" | "help";
type Theme = "office" | "after-hours";
type GraphOrientation = "vertical" | "horizontal";
type StudioAIEntitlement = "loading" | "anonymous" | "profile_required" | "ready" | "not_configured" | "unavailable";
type JurisAppProps = { studioOnly?: boolean; initialView?: View; autoStartCanopy?: boolean };
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
    width: Math.max(600, Math.ceil(nodes.reduce((value, node) => Math.max(value, node.x + 211), 0))),
    height: Math.max(570, Math.ceil(nodes.reduce((value, node) => {
      const titleLines = Math.max(1, Math.ceil(node.title.trim().length / 18));
      const runtimeHeight = node.runtime?.budgetCostEur !== undefined || node.runtime?.durationMinutes !== undefined ? 22 : 0;
      return Math.max(value, node.y + Math.max(150, 40 + titleLines * 17 + runtimeHeight) + 54);
    }, 0))),
  };
}
async function loadCategoryDemo(id: CaseTypeId, locale: Locale) {
  const [{ buildCategoryDemo }, { categoryDemoPrompt }] = await Promise.all([
    import("./category-demo-draft"), import("./category-demo-prompts"),
  ]);
  return { draft: buildCategoryDemo(id, locale), prompt: categoryDemoPrompt(id, locale) };
}

const CategoryDemoCards = lazy(() => import("./CategoryDemoCards"));
const HelpCenter = lazy(() => import("./HelpCenter"));
const StudioDraftArchive = lazy(() => import("./StudioDraftArchive"));
const CommunityView = lazy(() => import("./CommunityWorkspace"));
const PlayView = lazy(() => import("./PlayWorkspace"));
const DecisionModal = lazy(() => import("./PlayWorkspace").then(module => ({ default: module.DecisionModal })));
const StudioActionPanel = lazy(() => import("./StudioActionPanel"));
const StudioEvidenceComposer = lazy(() => import("./StudioActionPanel").then(module => ({ default: module.StudioEvidenceComposer })));
const StudioEntryScreen = lazy(() => import("./StudioEntryScreen"));
const StudioOverview = lazy(() => import("./StudioOverview"));
const StudioSourcesPanel = lazy(() => import("./StudioSourcesPanel"));
const StudioExpandedGraph = lazy(() => import("./StudioExpandedGraph"));
const StudioNodeSummary = lazy(() => import("./StudioNodeSummary"));
const FeedbackDialog = lazy(() => import("./FeedbackDialog"));
const StudioAIReview = lazy(() => import("./StudioAIReview"));
const StudioAIProgress = lazy(() => import("./StudioAIProgress"));
const DealOutcomePanel = lazy(() => import("./DealOutcomePanel"));
const TaxAnalysisEditor = lazy(() => import("./TaxAnalysisEditor"));
const CashFlowScenarioEditor = lazy(() => import("./CashFlowScenarioEditor"));
const GraphMilestones = lazy(() => import("./GraphMilestones"));
const CaseReportDialog = lazy(() => import("./CaseReportDialog"));
const CaseMarkdownDialog = lazy(() => import("./CaseMarkdownDialog"));
const CanonicalMarkdownReview = lazy(() => import("./CanonicalMarkdownReview"));
const StudioGuidedWizard = lazy(() => import("./StudioGuidedWizard"));
const StudioCaseTypeSelector = lazy(() => import("./StudioCaseTypeSelector"));
const StudioCaseViews = lazy(() => import("./StudioCaseViews"));
const StudioCasePlaybook = lazy(() => import("./StudioCasePlaybook"));
const StudioPackageValidationCard = lazy(() => import("./StudioPackageValidationCard"));
const StudioOutcomeParameters = lazy(() => import("./StudioOutcomeParameters"));
const StudioUserMoreActions = lazy(() => import("./StudioUserMoreActions"));
const CanonicalPromptAction = lazy(() => import("./StudioPromptAuxiliary").then((module) => ({default:module.CanonicalPromptAction})));
const CanonicalReadyAction = lazy(() => import("./StudioPromptAuxiliary").then((module) => ({default:module.CanonicalReadyAction})));
const StudioPromptPrivacyNote = lazy(() => import("./StudioPromptAuxiliary").then((module) => ({default:module.StudioPromptPrivacyNote})));
export type OutcomeClass = "strong" | "mixed" | "weak";
export type DecisionRecord = { stageId: string; stage: string; option: DecisionOption };
import type { FeedbackTarget } from "./FeedbackDialog";

function returnedAIStudioPlan(value: unknown, instruction: string): StudioPromptPlan | null {
  if (!isRecord(value) || value.planner !== "ai" || value.instruction !== instruction || typeof value.canApply !== "boolean"
    || typeof value.contextOnly !== "boolean" || !Array.isArray(value.operations) || !Array.isArray(value.diagnostics)) return null;
  const allowed = new Set(["add_node", "update_node", "add_link", "update_link", "append_context", "set_case_field", "set_classification", "set_deal_economics"]);
  if (value.operations.length > 100 || value.operations.some((operation) => !isRecord(operation) || typeof operation.kind !== "string" || !allowed.has(operation.kind))) return null;
  if (value.assumptions !== undefined && (!Array.isArray(value.assumptions) || value.assumptions.some((item) => typeof item !== "string"))) return null;
  if (value.warnings !== undefined && (!Array.isArray(value.warnings) || value.warnings.some((item) => typeof item !== "string"))) return null;
  return value as StudioPromptPlan;
}

export type InboxEntry = {
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

export type ServerPlaySessionState = {
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


const ui = {
  en: {
    library: "Demo cases", play: "Operations", studio: "Case Studio",
    office: "Office", night: "After hours", catalogue: "Examples & training",
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
    export: "Export JSON", import: "Import JSON", newDraft: "New draft", graph: "Decision map",
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
    library: "Демо-кейсы", play: "Операции", studio: "Студия кейсов",
    office: "Офис", night: "После работы", catalogue: "Примеры и обучение",
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
    export: "Экспорт JSON", import: "Импорт JSON", newDraft: "Новый черновик", graph: "Карта решений",
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

export type UiText = (typeof ui)["en"];

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

function local(value: LocalText, locale: Locale) { return value[locale]; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function numberedStudioLinks(pairs: Array<[string, string]>): StudioLink[] {
  return pairs.map(([from, to], index) => ({ id: `link-${index + 1}`, from, to }));
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

const PENDING_WORKSPACE_SAVE_KEY = "genesis.juris.pending-workspace-save.v2";
const PENDING_CASE_PROMPT_KEY = "genesis-juris-pending-case-prompt-v1";

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

// Restore the account-scoped draft before opening the starter demo.
const initialBlankDraft = blankStudioDraft(new Date(0).toISOString());

export default function JurisApp({ studioOnly = false, initialView = "studio", autoStartCanopy = false }: JurisAppProps) {
  const navigation = useNavigationController();
  const [locale, setLocale] = useInterfaceLocale();
  const [theme, setTheme] = useState<Theme>("office");
  const workspaceLocation = useWorkspaceLocation();
  const [view, setView] = useState<View>(initialView);
  const [catalogueRecords, setCatalogueRecords] = useState<PublishedCaseSummary[]>(() => bundledCatalogueRecords());
  const [catalogueNextCursor, setCatalogueNextCursor] = useState<string | null>(null);
  const [catalogueTotal, setCatalogueTotal] = useState(fallbackCatalogueRecords.length);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueScenarios, setCatalogueScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [privatePlayOrigin, setPrivatePlayOrigin] = useState<{ scope: string | null; customCaseId: number | null } | null>(null);
  const [playReturnView, setPlayReturnView] = useState<View>("studio");
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
  const [studioEvidenceBuffers, setStudioEvidenceBuffers] = useState<StudioEvidenceBuffers>({});
  const studioEvidenceBuffersRef = useRef<StudioEvidenceBuffers>({});
  const [studioOpenRevision, setStudioOpenRevision] = useState(0);
  const studioOperationPending = useRef(false);
  const studioSavedBaseline = useRef<StudioSavedBaseline | null>(null);
  const studioTaxWriteBaseline = useRef(new StudioTaxWriteBaseline());
  const [validatedDraft, setValidatedDraft] = useState<StudioDraft>(initialBlankDraft);
  const [studioPrivate, setStudioPrivate] = useState(false);
  const [studioCustomCaseId, setStudioCustomCaseId] = useState<number | null>(null);
  const [studioCanManagePrivacy, setStudioCanManagePrivacy] = useState(true);
  const [studioServerFingerprint, setStudioServerFingerprint] = useState<string | null>(null);
  const [studioServerPublicationFingerprint, setStudioServerPublicationFingerprint] = useState<string | null>(null);
  const [studioCanDuplicate, setStudioCanDuplicate] = useState(true);
  const [studioCopyProtectionLocked, setStudioCopyProtectionLocked] = useState(false);
  const [studioStorageScope, setStudioStorageScope] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveVersion, setArchiveVersion] = useState(0);
  const [studioRecovery, setStudioRecovery] = useState<StudioRecovery | null>(null);
  const [studioSessionAuthority] = useState(() => new StudioSessionAuthority());
  const studioSession = useSyncExternalStore(studioSessionAuthority.subscribe, studioSessionAuthority.getSnapshot, studioSessionAuthority.getSnapshot);
  const recoveryVisible = studioRecovery !== null && studioRecovery.scope === studioSession.scope && (studioSession.phase === "ready" || studioRecovery.scope === null && studioSession.phase === "anonymous");
  const studioDiscardVersion = useRef(0);
  const activeProtectedCaseId = view === "play" && privatePlayOrigin ? privatePlayOrigin.customCaseId : studioCustomCaseId;
  const studioCaseAccessRef = useRef(activeProtectedCaseId);
  const studioReportAuthority = studioSessionAuthority.reportAuthority(
    studioCustomCaseId !== null || studioPrivate, studioStorageScope, studioCustomCaseId,
  );
  const studioConcealed = (studioCustomCaseId !== null || studioPrivate) && !studioReportAuthority.visible;
  const privatePlayAuthority = studioSessionAuthority.reportAuthority(Boolean(privatePlayOrigin), privatePlayOrigin?.scope ?? null, privatePlayOrigin?.customCaseId ?? null);
  const privatePlayConcealed = Boolean(privatePlayOrigin) && !privatePlayAuthority.visible;
  const [studioAIEntitlement, setStudioAIEntitlement] = useState<StudioAIEntitlement>("loading");
  const [studioRestoreReady, setStudioRestoreReady] = useState(false);
  const [savedCaseRestorePending, setSavedCaseRestorePending] = useState<number | null>(null);
  const savedCaseRequestRef = useRef(0);
  const currentStudioScopeRef = useRef<string | null>(null);
  const restoredSavedCaseRef = useRef<string | null>(null);
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
  const exampleRequestGateRef = useRef(new LatestRequestGate());
  const [exampleLaunch, setExampleLaunch] = useState<ExampleLaunch | null>(null);
  const exampleContext = JSON.stringify([locale, view, workspaceLocation, studioSession.scope, studioSession.epoch, prompt]);
  const exampleContextRef = useRef(exampleContext);
  exampleContextRef.current = exampleContext;
  const visibleExampleLaunch = exampleLaunch?.context === exampleContext ? exampleLaunch : null;
  useEffect(() => { const gate = exampleRequestGateRef.current; return () => { gate.abort(); catalogueLaunchRef.current += 1; }; }, [exampleContext]);
  const studioChangedBeforeRestoreRef = useRef(false);
  const starterCancelledRef = useRef(false);
  const text = ui[locale];

  const studioDepartureInput = useRef({ draft, prompt, deviceEligible: mayPersistStudioDraftOnDevice({ draft, canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate }), scope: studioStorageScope, customCaseId: studioCustomCaseId, serverFingerprint: studioServerFingerprint, serverPublicationFingerprint: studioServerPublicationFingerprint });
  studioDepartureInput.current = { draft, prompt, deviceEligible: mayPersistStudioDraftOnDevice({ draft, canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate }), scope: studioStorageScope, customCaseId: studioCustomCaseId, serverFingerprint: studioServerFingerprint, serverPublicationFingerprint: studioServerPublicationFingerprint };
  useEffect(() => registerStudioDeparture(navigation, () => ({ ...studioDepartureInput.current, draft: draftRef.current, blank: initialBlankDraft, operationPending: studioOperationPending.current, evidencePending: hasStudioEvidenceInput(studioEvidenceBuffersRef.current), saved: studioSavedBaseline.current })), [navigation]);

  useEffect(() => {
    // v12 used origin-wide keys that could cross account boundaries on shared
    // browsers. Never read them again; new drafts use an identity-scoped,
    // versioned envelope and workspace/private artifacts are excluded entirely.
    try {
      window.localStorage.removeItem(LEGACY_STUDIO_DRAFT_KEY);
      window.localStorage.removeItem(LEGACY_STUDIO_PRIVATE_KEY);
      window.sessionStorage.removeItem(PENDING_WORKSPACE_SAVE_KEY);
    } catch { /* Storage restrictions must not prevent identity resolution. */ }
    const resolveIdentityBoundary = () => { void studioSessionAuthority.refresh(false, studioCaseAccessRef.current); };
    const visible = () => { if (document.visibilityState === "visible") resolveIdentityBoundary(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { studioSessionAuthority.invalidate("suspend"); resolveIdentityBoundary(); } };
    const unsubscribe = subscribeSessionBoundary(studioSessionAuthority.sessionBoundary);
    resolveIdentityBoundary();
    window.addEventListener("focus", resolveIdentityBoundary);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", restored);
    return () => { unsubscribe(); window.removeEventListener("focus", resolveIdentityBoundary); document.removeEventListener("visibilitychange", visible); window.removeEventListener("pageshow", restored); };
  }, [studioSessionAuthority]);

  useEffect(() => {
    studioCaseAccessRef.current = activeProtectedCaseId;
    if (activeProtectedCaseId !== null) void studioSessionAuthority.refresh(false, activeProtectedCaseId);
  }, [activeProtectedCaseId, studioSessionAuthority]);

  const reconcileStudioSession = useEffectEvent((studioSession: ReturnType<typeof studioSessionAuthority.getSnapshot>) => {
    if (privatePlayOrigin && studioSession.phase !== "ready" && (playSessionBusy || playSessionSync === "opening")) {
      // An interrupted operation may have reached the server. Preserve the run,
      // stop its stale callbacks, and let the user review it without auto-retry.
      playSessionStartRef.current += 1;
      setPlaySessionBusy(false);
      setPlaySessionSync("error");
    }
    if (studioSession.discardVersion !== studioDiscardVersion.current) {
      studioDiscardVersion.current = studioSession.discardVersion;
      if (privatePlayOrigin) {
        playSessionStartRef.current += 1;
        setPrivatePlayOrigin(null); setActiveScenario(null); setSelectedOption(null); setResultOption(null);
        setDecisionLog([]); setOutcome(null); setDossierRef(null); setServerPlaySession(null); setLocalCanonicalState(null);
        localCanonicalRuntimeRef.current = null; setPlaySessionBusy(false); setFeedbackTarget(null);
      }
      if (shouldDiscardStudioDraft(studioSession.discardLocal, studioCustomCaseId, studioPrivate)) {
        savedCaseRequestRef.current += 1;
        purgeLocalStudioState();
        setStudioOpenRevision((revision) => revision + 1);
        restoredSavedCaseRef.current = null;
        setPrompt("");
        setFeedbackTarget(null);
        setSessionNotice("Access ended or changed. Reopen saved work through the signed-in account’s access checks. / Доступ завершён или изменён. Откройте сохранённую работу после проверки доступа аккаунта.");
      }
    }
    if (currentStudioScopeRef.current !== studioSession.scope) { setStudioRecovery(null); studioTaxWriteBaseline.current.clear(); }
    if (currentStudioScopeRef.current !== studioSession.scope) cancelCategoryDemo();
    currentStudioScopeRef.current = studioSession.scope;
    setStudioStorageScope(studioSession.scope);
    setStudioAIEntitlement(studioSession.phase === "ready"
      ? (studioSession.registered ? (studioSession.studioAI ? "ready" : "not_configured") : "profile_required")
      : studioSession.phase === "checking" ? "loading" : studioSession.phase === "anonymous" ? "anonymous" : "unavailable");
  });
  useEffect(() => studioSessionAuthority.subscribe(() => reconcileStudioSession(studioSessionAuthority.getSnapshot())), [studioSessionAuthority]);

  useEffect(() => {
    function restoreView() {
      cancelCategoryDemo();
      catalogueLaunchRef.current += 1;
      setCatalogueLoading(false);
      const requested = new URLSearchParams(window.location.search).get("view");
      if (requested === "templates" || requested === "library" || requested === "demos" || requested === "studio"
        || requested === "help" || requested === "community") {
        setView(requested);
      } else if (requested === "play") {
        setView("play");
      } else {
        setView(initialView);
      }
    }
    const update = window.setTimeout(restoreView, 0);
    window.addEventListener("popstate", restoreView);
    window.addEventListener("genesis-studio-navigation", restoreView);
    return () => {
      window.clearTimeout(update);
      window.removeEventListener("popstate", restoreView); window.removeEventListener("genesis-studio-navigation", restoreView);
    };
  }, [studioOnly, activeScenario, initialView]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("example") !== "canopy" || url.searchParams.has("auth_continue")) return;
    let cancelled = false;
    void import("./canopy-fixture").then(({ buildCanopyPackage }) => {
      if (cancelled || studioChangedBeforeRestoreRef.current) return;
      const exact = buildCanopyPackage("base").draft;
      studioChangedBeforeRestoreRef.current = true;
      draftRef.current = exact;
      setDraftState(exact);
      setSelectedNodeId(exact.nodes[0]?.id ?? null);
      url.searchParams.delete("example");
      url.searchParams.set("studio_step", "case_map");
      url.searchParams.set("studio_panel", "overview");
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new Event("genesis-studio-navigation"));
    window.dispatchEvent(new Event("genesis-interface-change"));
    }).catch(() => { if (!cancelled) setSessionNotice("The Canopy example could not be opened. Refresh and retry. / Не удалось открыть пример Canopy. Обновите страницу."); });
    return () => { cancelled = true; };
  }, []);

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
    if (studioAIEntitlement === "loading" || studioAIEntitlement === "unavailable") return;
    const timer = window.setTimeout(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("auth_continue");
    if (!id) return;
    // Resolve identity first, then consume the same-tab continuation once.
    let pending: Extract<ReturnType<typeof readStudioAuthContinuationState>, { status: "restored" }>["continuation"] | null = null;
    try {
      const currentRaw = window.sessionStorage.getItem(STUDIO_AUTH_CONTINUATION_KEY);
      const key = currentRaw === null ? LEGACY_STUDIO_AUTH_CONTINUATION_KEY : STUDIO_AUTH_CONTINUATION_KEY;
      const raw = currentRaw === null ? window.sessionStorage.getItem(key) : currentRaw;
      const result = readStudioAuthContinuationState(raw, id, studioStorageScope);
      if (studioAIEntitlement === "anonymous" && result.status === "denied") {
        setSessionNotice(locale === "en" ? "Sign-in was not completed. Your temporary draft is retained for 15 minutes; sign in to the same account to restore it." : "Вход не завершён. Временный черновик хранится 15 минут; войдите в тот же аккаунт для восстановления.");
        return;
      }
      if (result.status === "unsupported" || result.status === "corrupt") {
        studioChangedBeforeRestoreRef.current = true;
        setStudioRecovery({ scope: studioStorageScope, reason: result.reason, rawText: result.rawText, canExport: true, filename: "studio-sign-in-recovery.json" });
        return;
      }
      if (result.status === "restored") { pending = result.continuation; window.sessionStorage.removeItem(key); }
    } catch {
      studioChangedBeforeRestoreRef.current = true;
      setStudioRecovery({ scope: studioStorageScope, reason: "The sign-in draft could not be read. Retry after browser storage becomes available.", canExport: false, filename: "studio-sign-in-recovery.json" });
      return;
    }
    url.searchParams.delete("auth_continue");
    if (pending?.action) { url.searchParams.set("studio_step", "run_compare"); url.searchParams.set("resume_action", pending.action); }
    window.history.replaceState(window.history.state, "", url);
    if (!pending) {
      setSessionNotice(locale === "en" ? "The sign-in draft expired or belongs to another account. Reopen your saved case or import the file again." : "Черновик для входа истёк или принадлежит другому аккаунту. Откройте сохранённый кейс или повторите импорт.");
      return;
    }
    studioChangedBeforeRestoreRef.current = true;
    draftRef.current = pending.draft;
    setDraftState(pending.draft);
    setPrompt(pending.prompt);
    setSelectedNodeId(pending.selectedNodeId);
    if (pending.action) window.dispatchEvent(new Event("genesis-studio-navigation"));
    setSessionNotice(locale === "en" ? "Your prompt and case are restored. Review the next action before continuing." : "Промпт и кейс восстановлены. Проверьте следующий шаг перед продолжением.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studioAIEntitlement, studioStorageScope, locale]);

  useEffect(() => {
    if (studioAIEntitlement === "loading" || studioAIEntitlement === "unavailable") return;
    let cancelled = false;
    const restore = window.setTimeout(() => {
      try {
      if (studioChangedBeforeRestoreRef.current || new URLSearchParams(window.location.search).has("custom_case")) return;
      try {
        const stored = studioStorageScope ? readStudioDeviceDraft(window.localStorage, studioStorageScope) : { status: "empty" as const };
        if (stored.status !== "empty" && stored.status !== "editable") {
          studioChangedBeforeRestoreRef.current = true;
          setStudioRecovery({ scope: studioStorageScope, reason: stored.reason, rawText: "rawText" in stored ? stored.rawText : undefined, canExport: "canExport" in stored && stored.canExport, filename: "studio-device-recovery.json" });
          return;
        }
        if (stored.status === "editable" && studioStorageScope) {
          const restored = stored.draft;
          studioSavedBaseline.current = { kind: "device", scope: studioStorageScope, customCaseId: null, fingerprint: studioDepartureFingerprint(restored) };
          const emptyTimeline = emptyStudioTimeline();
          studioChangedBeforeRestoreRef.current = true;
          draftRef.current = restored;
          studioTimelineRef.current = emptyTimeline;
          setDraftState(restored);
          setStudioOpenRevision((revision) => revision + 1);
          setStudioTimelineState(emptyTimeline);
          setStudioPrivate(false);
          setStudioCustomCaseId(null);
          setStudioCanManagePrivacy(true);
          setStudioServerFingerprint(null);
          setStudioServerPublicationFingerprint(null);
          setStudioCanDuplicate(true);
          setStudioCopyProtectionLocked(restored.protection?.copyProtected === true && Boolean(restored.protection.seal));
          return;
        }
      } catch {
        studioChangedBeforeRestoreRef.current = true;
        setStudioRecovery({ scope: studioStorageScope, reason: "Device storage could not be read. The retained document has not been replaced.", canExport: false, filename: "studio-device-recovery.json" });
        return;
      }
      if (!autoStartCanopy || starterCancelledRef.current || prompt.trim()) return;
      void import("./canopy-fixture").then(({ buildCanopyPackage }) => {
        if (cancelled || studioChangedBeforeRestoreRef.current || starterCancelledRef.current) return;
        const url = new URL(window.location.href);
        if (![null, "studio", "play"].includes(url.searchParams.get("view"))) return;
        const starter = buildCanopyPackage("base", true).draft;
        studioChangedBeforeRestoreRef.current = true;
        draftRef.current = starter;
        setDraftState(starter);
        setSelectedNodeId(starter.nodes[0]?.id ?? null);
        setStudioOpenRevision((revision) => revision + 1);
        url.searchParams.set("view", "studio");
        url.searchParams.set("studio_step", "case_map");
        window.history.replaceState(window.history.state, "", url);
        window.dispatchEvent(new Event("genesis-studio-navigation"));
    window.dispatchEvent(new Event("genesis-interface-change"));
      }).catch(() => {
        if (!cancelled) setSessionNotice(locale === "en" ? "Canopy could not be opened. Choose it from Demo cases to retry." : "Не удалось открыть Canopy. Повторите попытку в разделе «Демо-кейсы».");
      });
      } finally { if (!cancelled) setStudioRestoreReady(true); }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(restore); };
  }, [studioStorageScope, studioAIEntitlement, autoStartCanopy, prompt, locale]);

  useEffect(() => {
    if (studioAIEntitlement === "loading" || studioAIEntitlement === "unavailable") return;
    const value = new URLSearchParams(window.location.search).get("custom_case");
    if (!value || restoredSavedCaseRef.current === value || String(studioCustomCaseId) === value) return;
    if (studioAIEntitlement === "anonymous") {
      const timer = window.setTimeout(() => setSessionNotice(locale === "en" ? "Sign in from Account to reopen this saved case. Access is checked before its contents are loaded." : "Войдите через Аккаунт, чтобы открыть сохранённый кейс. Сначала будет проверен доступ."), 0);
      return () => window.clearTimeout(timer);
    }
    if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) return;
    restoredSavedCaseRef.current = value;
    void openWorkspaceCustomCase(Number(value), true);
    // The exact URL is restored once after identity resolves; normal edits never retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioAIEntitlement, studioStorageScope, studioCustomCaseId]);

  useEffect(() => {
    if (!studioStorageScope) return;
    if (!mayPersistStudioDraftOnDevice({ canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate, draft })) {
      try { removeKnownStudioDeviceDrafts(window.localStorage, studioStorageScope); } catch { /* Failed cleanup cannot replace retained work. */ }
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
    checks: StudioCheck[];
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
    cancelCategoryDemo();
    studioChangedBeforeRestoreRef.current = true;
    draftRef.current = next;
    setDraftState(next);
  }
  function syncStudioTimeline(next: StudioTimeline) {
    studioTimelineRef.current = next;
    setStudioTimelineState(next);
  }
  function replaceStudioDraft(next: StudioDraft, confirmed = false) {
    if (!mayLeaveStudio()) return false;
    const eligible = mayPersistStudioDraftOnDevice({ draft: draftRef.current, canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate });
    const retention = eligible && studioSessionAuthority.getSnapshot().phase === "ready" && studioStorageScope !== null;
    const hasWork = Boolean(draftRef.current.nodes.length || draftRef.current.links.length || draftRef.current.title || draftRef.current.editHistory.length || prompt.trim() || hasStudioEvidenceInput(studioEvidenceBuffersRef.current));
    if (!confirmed && hasWork && !window.confirm(studioReplacementMessage(locale, next.title, retention))) return false;
    try {
      if (studioStorageScope) {
        retainStudioReplacement(window.localStorage, studioStorageScope, retention ? { draft: draftRef.current, prompt } : null);
        removeKnownStudioDeviceDrafts(window.localStorage, studioStorageScope);
        setArchiveVersion(value => value + 1);
      }
    } catch {
      showSessionNotice(locale === "en" ? "Replacement stopped: earlier drafts could not be retained. Your open case is unchanged. Open Earlier device drafts, export recovery data and explicitly delete an unwanted entry if the archive is full; otherwise recover browser storage, then retry." : "Замена остановлена: не удалось сохранить предыдущие черновики. Открытый кейс не изменён. Откройте предыдущие черновики, экспортируйте данные и явно удалите ненужную запись, если архив заполнен; иначе восстановите хранилище и повторите попытку.");
      return false;
    }
    clearStudioEvidenceBuffers();
    studioTaxWriteBaseline.current.clear();
    setStudioOpenRevision((revision) => revision + 1);
    syncStudioDraft(next);
    syncStudioTimeline(emptyStudioTimeline());
    return true;
  }
  function clearStudioEvidenceBuffers() {
    studioEvidenceBuffersRef.current = {};
    setStudioEvidenceBuffers({});
  }
  function changeStudioEvidenceInput(type: StudioNodeType, patch: Partial<StudioEvidenceInput>) {
    cancelCategoryDemo();
    studioChangedBeforeRestoreRef.current = true;
    const next = updateStudioEvidenceInput(studioEvidenceBuffersRef.current, type, patch);
    studioEvidenceBuffersRef.current = next;
    setStudioEvidenceBuffers(next);
  }
  function clearStudioEvidenceType(type: StudioNodeType) {
    const next = clearStudioEvidenceInput(studioEvidenceBuffersRef.current, type);
    studioEvidenceBuffersRef.current = next;
    setStudioEvidenceBuffers(next);
  }
  function enterNewLocalDraft(next: StudioDraft, nextSelectedNodeId: string | null, confirmed = false) {
    const isolated = structuredClone(next);
    delete isolated.protection;
    isolated.parent = null;
    if (!replaceStudioDraft(isolated, confirmed)) return false;
    studioSavedBaseline.current = null;
    savedCaseRequestRef.current += 1;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("custom_case"); cleanUrl.searchParams.delete("resume_action");
    window.history.replaceState(window.history.state, "", cleanUrl);
    restoredSavedCaseRef.current = null;
    setStudioPrivate(false);
    setStudioCustomCaseId(null);
    setStudioCanManagePrivacy(true);
    setStudioServerFingerprint(null);
    setStudioServerPublicationFingerprint(null);
    setStudioCanDuplicate(true);
    setStudioCopyProtectionLocked(false);
    setSelectedNodeId(nextSelectedNodeId);
    return true;
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

  function mayLeaveStudio() {
    if (!studioOperationPending.current) return true;
    showSessionNotice(locale === "en" ? "A Studio operation is still running. Keep this case open until its result is known." : "Операция Studio ещё выполняется. Оставьте кейс открытым до получения результата.");
    return false;
  }
  function rememberStudioWorkspaceSave(savedDraft: StudioDraft, customCaseId: number) {
    studioSavedBaseline.current = { kind: "workspace", scope: currentStudioScopeRef.current, customCaseId, fingerprint: studioDepartureFingerprint(savedDraft) };
    studioTaxWriteBaseline.current.capture(savedDraft, currentStudioScopeRef.current);
  }
  function navigate(next: View, step?: GuidedStudioStep) {
    if (next !== "studio" && !mayLeaveStudio()) return;
    if (next !== "studio") starterCancelledRef.current = true;
    cancelCategoryDemo();
    const destination = next;
    const url = new URL(window.location.href);
    url.searchParams.set("view", destination);
    url.searchParams.delete("studio_panel");
    if (destination !== "studio") url.searchParams.delete("studio_step");
    else if (step) url.searchParams.set("studio_step", serializedStudioWorkflowStep(step));
    else url.searchParams.delete("studio_step");
    window.history.pushState(window.history.state, "", url);
    setView(destination);
    window.dispatchEvent(new Event("genesis-studio-navigation"));
    window.dispatchEvent(new Event("genesis-interface-change"));
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
  async function beginLocalCanonicalSession(scenario: Scenario, requestVersion: number, authorityCurrent: () => boolean = () => true) {
    if (!scenario.mobileParity) return false;
    try {
      const runtimeModule = await import("./canonical-runtime");
      if (requestVersion !== playSessionStartRef.current || !authorityCurrent()) return false;
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
  async function beginServerPlaySession(scenario: Scenario, requestVersion: number, authorityCurrent: () => boolean = () => true) {
    try {
      const response = await fetch("/api/play-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", caseId: scenario.caseId, version: scenario.version, fingerprint: scenario.fingerprint }),
      });
      if (requestVersion !== playSessionStartRef.current || !authorityCurrent()) return;
      if (response.status === 401 || response.status === 404) {
        if (await beginLocalCanonicalSession(scenario, requestVersion, authorityCurrent)) return;
        if (!authorityCurrent()) return;
        setPlaySessionSync("local");
        return;
      }
      const payload = await response.json().catch(() => null) as { session?: unknown } | null;
      if (requestVersion !== playSessionStartRef.current || !authorityCurrent()) return;
      const session = normalizeServerPlaySession(payload?.session);
      if (!response.ok || !session || session.caseId !== scenario.caseId || session.version !== scenario.version || session.fingerprint !== scenario.fingerprint) {
        if (!await beginLocalCanonicalSession(scenario, requestVersion, authorityCurrent) && authorityCurrent()) setPlaySessionSync("error");
        return;
      }
      restoreFromServerSession(session, scenario);
      setPlaySessionSync("server");
    } catch {
      if (requestVersion === playSessionStartRef.current && authorityCurrent() && !await beginLocalCanonicalSession(scenario, requestVersion, authorityCurrent) && authorityCurrent()) setPlaySessionSync("error");
    }
  }
  function startScenario(scenario: Scenario, options: { legacyTiming?: boolean; privateOrigin?: typeof privatePlayOrigin } = {}) {
    if (view !== "play") setPlayReturnView(view);
    const sessionRequestVersion = playSessionStartRef.current + 1;
    playSessionStartRef.current = sessionRequestVersion;
    const initialIndex = Math.max(0, scenario.stages.findIndex((item) => item.id === scenario.initialStageId));
    setPrivatePlayOrigin(options.privateOrigin ?? null);
    setActiveScenario(scenario); setStageIndex(initialIndex); setMetrics({ ...initialMetrics }); setDecisionLog([]);
    setCaseMinute(scenario.initialClockMinute); setActionUseCounts({}); setCompletedDeadlineIds([]); setMissedDeadlineIds([]);
    localCanonicalRuntimeRef.current = null; setLocalCanonicalState(null); setServerPlaySession(null); setPlaySessionSync("opening"); setPlaySessionBusy(false);
    setLegacyTimingMode(options.legacyTiming === true);
    setOutcome(null); setSelectedOption(null); setResultOption(null); setDossierRef(scenario.materials[0]?.ref ?? null); navigate("play");
    const epoch = studioSessionAuthority.getSnapshot().epoch;
    void beginServerPlaySession(scenario, sessionRequestVersion, () => !options.privateOrigin || studioSessionAuthority.getSnapshot().epoch === epoch);
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
            showSessionNotice(locale === "en" ? "Opened the included example." : "Открыт встроенный пример.");
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
    const operationVersion = playSessionStartRef.current, authorityEpoch = studioSessionAuthority.getSnapshot().epoch;
    const current = () => operationVersion === playSessionStartRef.current && (!privatePlayOrigin || authorityEpoch === studioSessionAuthority.getSnapshot().epoch);
    if (privatePlayConcealed) return;
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
        if (!current()) return;
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
        if (!current()) return;
        setPlaySessionSync("error");
        showSessionNotice(locale === "en" ? "The run could not be synchronised. Retry when the connection is restored." : "Не удалось синхронизировать прохождение. Повторите после восстановления соединения.");
        return;
      } finally {
        if (current()) setPlaySessionBusy(false);
      }
    }

    if (activeScenario.mobileParity && localCanonicalRuntimeRef.current && selected.canonicalActionId) {
      setPlaySessionBusy(true);
      try {
        const runtimeModule = await import("./canonical-runtime");
        if (!current()) return;
        const runtime = runtimeModule.dispatchCanonicalAction(localCanonicalRuntimeRef.current, selected.canonicalActionId);
        const currentDecisions = localCanonicalState?.decisions ?? [];
        const currentAdvances = localCanonicalState?.timeAdvances ?? [];
        const nextSequence = Math.max(0, ...currentDecisions.map((item) => item.sequence), ...currentAdvances.map((item) => item.sequence)) + 1;
        const nextState = storeLocalCanonicalRuntime(runtime, runtimeModule, [...currentDecisions, { sequence: nextSequence, stageId: sourceStage.id, optionId: selected.id }], currentAdvances);
        applyTransition(nextState.metrics, nextState.clockMinute, nextState.completedDeadlineIds, nextState.missedDeadlineIds, nextState.actionUseCounts, nextState.currentStageId, nextState.canonicalOutcome);
        return;
      } catch {
        if (!current()) return;
        showSessionNotice(locale === "en" ? "The canonical action could not be applied." : "Не удалось применить каноническое действие.");
        return;
      } finally {
        if (current()) setPlaySessionBusy(false);
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
    const operationVersion = playSessionStartRef.current, authorityEpoch = studioSessionAuthority.getSnapshot().epoch;
    const current = () => operationVersion === playSessionStartRef.current && (!privatePlayOrigin || authorityEpoch === studioSessionAuthority.getSnapshot().epoch);
    if (privatePlayConcealed) return;
    if ((!serverPlaySession || serverPlaySession.status !== "active") && localCanonicalRuntimeRef.current) {
      setPlaySessionBusy(true);
      try {
        const runtimeModule = await import("./canonical-runtime");
        if (!current()) return;
        const runtime = runtimeModule.advanceCanonicalTime(localCanonicalRuntimeRef.current, minutes);
        const currentDecisions = localCanonicalState?.decisions ?? [];
        const currentAdvances = localCanonicalState?.timeAdvances ?? [];
        const nextSequence = Math.max(0, ...currentDecisions.map((item) => item.sequence), ...currentAdvances.map((item) => item.sequence)) + 1;
        const state = storeLocalCanonicalRuntime(runtime, runtimeModule, currentDecisions, [...currentAdvances, { sequence: nextSequence, minutes }]);
        restoreLocalCanonicalView(state, activeScenario);
        showSessionNotice(locale === "en" ? `Case clock advanced by ${minutes / 60}h.` : `Время дела продвинуто на ${minutes / 60} ч.`);
      } catch {
        if (!current()) return;
        showSessionNotice(locale === "en" ? "The case clock could not be advanced." : "Не удалось продвинуть время дела.");
      } finally {
        if (current()) setPlaySessionBusy(false);
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
      if (!current()) return;
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
      if (!current()) return;
      setPlaySessionSync("error");
      showSessionNotice(locale === "en" ? "The case clock could not be synchronised." : "Не удалось синхронизировать время дела.");
    } finally {
      if (current()) setPlaySessionBusy(false);
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
  async function exportPlayedCase() {
    if (!activeScenario) return;
    if (privatePlayOrigin) {
      try { const current = await privatePlayAuthority.verify(); if (!current()) return; }
      catch { showSessionNotice(locale === "en" ? "Export needs verified access. Sign in and refresh access." : "Для экспорта нужен подтверждённый доступ. Войдите и обновите доступ."); return; }
    }
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

        const { requirePlayedCaseServerSession, resolvePlayedCaseScenario, restoredPlayedCaseOutcome } = await import("./played-case-loader");
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
            setPrivatePlayOrigin(null);
            setActiveScenario(importedScenario);
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
          setPrivatePlayOrigin(null);
          setActiveScenario(importedScenario);
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

        setPrivatePlayOrigin(null);
        setActiveScenario(importedScenario);
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
        setOutcome(restoredPlayedCaseOutcome(completed, importedScenario.stages[restoredStageIndex], restoredLog.at(-1)?.option, classifyOutcome(restoredMetrics)));
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
    if (!enterNewLocalDraft(rebuilt, "decision-1")) return;
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
    if (!enterNewLocalDraft(restored, restored.nodes.find((node) => node.type === "decision")?.id ?? restored.nodes[0]?.id ?? null)) return false;
    setPrompt("");
    return true;
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
    let next: StudioDraft;
    try { next = writeStudioDeviceDraft(window.localStorage, studioStorageScope, { ...draftRef.current, updatedAt: new Date().toISOString() }); }
    catch (error) { setSavedFlash(false); showSessionNotice(error instanceof Error ? error.message : "Device save failed. Your input remains in this tab."); return; }
    syncStudioDraft(next);
    studioSavedBaseline.current = { kind: "device", scope: studioStorageScope, customCaseId: null, fingerprint: studioDepartureFingerprint(next) };
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
    try {
      const read = readStudioAggregate(JSON.stringify(draft), { kind: "draft" });
      if (read.status !== "editable") throw new Error(read.reason);
      normalized = read.draft;
    } catch {
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
    let current: () => boolean;
    try { current = await studioReportAuthority.verify(); }
    catch { showSessionNotice(locale === "en" ? "Export needs verified access. Sign in and refresh access." : "Для экспорта нужен подтверждённый доступ. Войдите и обновите доступ."); return; }
    const exportedAt = new Date().toISOString();
    const { buildStudioCustomCaseExport } = await import("./studio-tax-export");
    if (!current()) return;
    try { const refreshed = await studioReportAuthority.verify(); if (!current() || !refreshed()) return; }
    catch { showSessionNotice(locale === "en" ? "Export needs verified access. Sign in and refresh access." : "Для экспорта нужен подтверждённый доступ. Войдите и обновите доступ."); return; }
    let rawText: string;
    try { rawText = buildStudioCustomCaseExport(normalized, { exportedAt, visibility: studioPrivate ? "private" : "restricted" }).rawText; }
    catch (error) { showSessionNotice(error instanceof Error ? error.message : "This case could not be exported without changing its data."); return; }
    const blob = new Blob([rawText], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${normalized.caseId}-v${normalized.version}.juris-case.json`;
    link.click(); URL.revokeObjectURL(url);
  }
  function importDraft(file: File, loaded?: (draft: StudioDraft) => void) {
    cancelCategoryDemo();
    if (!mayLeaveStudio()) return;
    const importGeneration = ++savedCaseRequestRef.current;
    const source = draftRef.current;
    const scope = currentStudioScopeRef.current;
    const location = new URL(window.location.href);
    const currentImport = () => {
      const current = new URL(window.location.href);
      return importGeneration === savedCaseRequestRef.current && source === draftRef.current && scope === currentStudioScopeRef.current
        && current.pathname === location.pathname && current.searchParams.get("view") === location.searchParams.get("view")
        && current.searchParams.get("custom_case") === location.searchParams.get("custom_case");
    };
    if (file.size > 1_000_000) { setSessionNotice(locale === "en" ? "The case file exceeds 1 MB. Export a smaller Studio JSON file, or shorten node details before retrying. Your current case is unchanged." : "Файл больше 1 МБ. Экспортируйте меньший JSON Studio или сократите описания узлов. Текущий кейс сохранён без изменений."); return; }
    const reader = new FileReader(); reader.onload = async () => {
      if (!currentImport()) return;
      try {
        if (!(reader.result instanceof ArrayBuffer)) throw new Error("The case file could not be read as bytes");
        const rawText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(reader.result);
        const { parsePreservedJson } = await import("./preserved-json");
        let parsed: unknown;
        try { parsed = parsePreservedJson(rawText); }
        catch {
          if (!currentImport()) return;
          setSessionNotice("");
          setStudioRecovery({ scope, reason: "The original case file contains invalid or ambiguous JSON. It is retained for recovery; your open case is unchanged.", rawText, canExport: false, filename: "studio-import-recovery.json" });
          setView("studio"); return;
        }
        const { readStudioCustomCaseExport } = await import("./studio-tax-export");
        const aggregate = isRecord(parsed) && parsed.format === "genesis-juris-custom-case"
          ? readStudioCustomCaseExport(rawText) : readStudioAggregate(rawText, { kind: "draft" });
        if (!currentImport()) return;
        if (aggregate.status === "unsupported" || aggregate.status === "corrupt" || aggregate.status === "denied") {
          // An unverified file cannot establish copy/export authority. Keep the
          // exact original and current editor without reopening a downgraded draft.
          setSessionNotice("");
          setStudioRecovery({ scope, reason: aggregate.reason, rawText, canExport: false, filename: "studio-import-recovery.json" });
          setView("studio"); return;
        }
        let imported: StudioDraft;
        let newUnsealedRawDraft = false;
        let importedPrivate = false;
        let importedCustomCaseId: number | null = null;
        let importedServerFingerprint: string | null = null;
        let importedServerPublicationFingerprint: string | null = null;
        let importedCanDuplicate = true;
        if (isRecord(parsed) && parsed.format === "genesis-juris-custom-case" && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2 || parsed.schemaVersion === 3 || parsed.schemaVersion === 4 || parsed.schemaVersion === 5) && isRecord(parsed.case)) {
          imported = aggregate.status === "editable" ? aggregate.draft : normalizeStudioDraft(parsed.draft);
          const currentFingerprint = caseFingerprint(imported);
          const legacyFingerprint = legacyCaseFingerprintV15(imported);
          if (parsed.case.id !== imported.caseId || parsed.case.version !== imported.version
            || (parsed.case.fingerprint !== currentFingerprint && parsed.case.fingerprint !== legacyFingerprint)) {
            throw new Error("Custom case identity or fingerprint mismatch");
          }
          if (parsed.schemaVersion === 4 || parsed.schemaVersion === 5) {
            const { projectCaseCoreV2 } = await import("./case-core");
            const resolvedCaseType = imported.caseType ?? caseTypeReference("general_advisory");
            if (parsed.case.coreSchemaVersion !== 2 || canonicalFingerprint(parsed.case.caseType) !== canonicalFingerprint(resolvedCaseType)
              || canonicalFingerprint(parsed.core) !== canonicalFingerprint(projectCaseCoreV2(imported))) throw new Error("Case Core or case-type package mismatch");
          }
          if (parsed.schemaVersion === 3 || parsed.schemaVersion === 4 || parsed.schemaVersion === 5) {
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
          if (aggregate.status !== "editable") throw new Error("Unsupported raw draft");
          imported = aggregate.draft;
          if (imported.protection) throw new Error("Protected cases require a sealed v3 export envelope");
          newUnsealedRawDraft = true;
        }
        if (!currentImport() || !mayLeaveStudio()) return;
        const restored = { ...imported, updatedAt: new Date().toISOString() };
        if (!replaceStudioDraft(restored)) return;
        if (importedServerFingerprint) studioTaxWriteBaseline.current.capture(restored, scope, importedServerFingerprint);
        savedCaseRequestRef.current += 1;
        const importUrl = new URL(window.location.href);
        importUrl.searchParams.delete("custom_case");
        importUrl.searchParams.delete("resume_action");
        window.history.replaceState(window.history.state, "", importUrl);
        restoredSavedCaseRef.current = null;
        setStudioPrivate(importedPrivate);
        setStudioCustomCaseId(importedCustomCaseId);
        setStudioCanManagePrivacy(mayChooseImportedPrivacy({ newUnsealedRawDraft, verifiedOwnerCustomCaseId: importedCustomCaseId }));
        setStudioServerFingerprint(importedServerFingerprint);
        setStudioServerPublicationFingerprint(importedServerPublicationFingerprint);
        setStudioCanDuplicate(importedCanDuplicate);
        setStudioCopyProtectionLocked(imported.protection?.copyProtected === true);
        setPrompt("");
        setSelectedNodeId(restored.nodes[0]?.id ?? null);
        navigate("studio");
        loaded?.(restored);
        showSessionNotice(importedCanDuplicate ? (locale === "en" ? "Custom case loaded in the visual editor" : "Custom-кейс открыт в визуальном редакторе") : (locale === "en" ? "Protected case seal verified; opened for inspection only" : "Печать защищённого кейса проверена; открыт режим просмотра"));
      } catch { if (!currentImport()) return; setSessionNotice(locale === "en" ? "The file could not be imported. Use a Studio draft JSON or an unchanged GENESIS custom-case export. Protected exports require sign-in and access to the original case. Your current case is unchanged." : "Не удалось импортировать файл. Используйте JSON-черновик Studio или неизменённый экспорт custom-кейса GENESIS. Защищённый экспорт требует входа и доступа к исходному кейсу. Текущий кейс не изменён."); }
    };
    reader.onerror = () => { if (currentImport()) setSessionNotice(locale === "en" ? "The file could not be read. Download it again, then retry the import." : "Файл не читается. Скачайте его заново и повторите импорт."); };
    reader.readAsArrayBuffer(file);
  }
  async function openWorkspaceCustomCase(customCaseId: number, preserveStep = false) {
    const requestId = ++savedCaseRequestRef.current;
    const source = draftRef.current;
    const sourceScope = currentStudioScopeRef.current;
    const sourceLocation = new URL(window.location.href);
    const requestIsCurrent = () => {
      const currentLocation = new URL(window.location.href);
      return requestId === savedCaseRequestRef.current && draftRef.current === source && currentStudioScopeRef.current === sourceScope
        && currentLocation.pathname === sourceLocation.pathname
        && currentLocation.searchParams.get("view") === sourceLocation.searchParams.get("view")
        && currentLocation.searchParams.get("custom_case") === sourceLocation.searchParams.get("custom_case");
    };
    setSavedCaseRestorePending(requestId);
    try {
      const response = await fetch(`/api/custom-cases?id=${customCaseId}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const payload = await readJsonResponse<{ customCase?: { id: number; isPrivate: boolean; canManagePrivacy: boolean; copyProtected: boolean; fingerprint: string; publicationFingerprint: string; access: "owner" | "admin" | "shared" }; draft?: unknown; recovery?: { status: string; reason: string; rawText?: string; canExport: boolean }; error?: string }>(response);
      if (!requestIsCurrent()) return;
      if (response.ok && payload?.customCase?.id === customCaseId && payload.recovery && ["unsupported", "corrupt"].includes(payload.recovery.status) && typeof payload.recovery.reason === "string") {
        studioChangedBeforeRestoreRef.current = true;
        setSessionNotice("");
        setStudioRecovery({ scope: sourceScope, reason: payload.recovery.reason,
          rawText: typeof payload.recovery.rawText === "string" ? payload.recovery.rawText : undefined,
          canExport: payload.customCase.access === "owner" && payload.recovery.canExport === true,
          filename: `studio-workspace-${customCaseId}-recovery.json` });
        setView("studio");
        return;
      }
      if (!response.ok || !payload?.customCase || payload.customCase.id !== customCaseId || !payload.draft) {
        showSessionNotice(response.status === 401 ? (locale === "en" ? "Your session expired. Sign in from Account, then reopen the saved case. Your open draft is unchanged." : "Сессия истекла. Войдите через Аккаунт и повторно откройте кейс. Черновик не изменён.") : (locale === "en" ? "This saved case could not be opened. Check your account and access, then retry. Your open draft is unchanged." : "Не удалось открыть сохранённый кейс. Проверьте аккаунт и доступ. Черновик не изменён."));
        restoredSavedCaseRef.current = null;
        return;
      }
      const restored = normalizeStudioDraft(payload.draft);
      if ((caseFingerprint(restored) !== payload.customCase.fingerprint && legacyCaseFingerprintV15(restored) !== payload.customCase.fingerprint) || casePublicationFingerprint(restored) !== payload.customCase.publicationFingerprint) throw new Error("Saved case receipt mismatch");
      if (!replaceStudioDraft(restored)) { restoredSavedCaseRef.current = null; return; }
      studioSavedBaseline.current = { kind: "workspace", scope: sourceScope, customCaseId, fingerprint: studioDepartureFingerprint(restored) };
      studioTaxWriteBaseline.current.capture(restored, sourceScope, payload.customCase.fingerprint);
      setStudioPrivate(payload.customCase.isPrivate === true);
      setStudioCustomCaseId(payload.customCase.id);
      setStudioCanManagePrivacy(payload.customCase.canManagePrivacy === true);
      setStudioServerFingerprint(payload.customCase.fingerprint);
      setStudioServerPublicationFingerprint(payload.customCase.publicationFingerprint);
      setStudioCanDuplicate(payload.customCase.access === "owner" || (payload.customCase.access === "shared" && payload.customCase.copyProtected !== true));
      setStudioCopyProtectionLocked(payload.customCase.copyProtected === true);
      setPrompt("");
      setSelectedNodeId(restored.nodes[0]?.id ?? null);
      const step = preserveStep ? new URLSearchParams(window.location.search).get("studio_step") ?? "case_map" : "case_map";
      const panel = preserveStep ? new URLSearchParams(window.location.search).get("studio_panel") : null;
      window.history.replaceState(window.history.state, "", savedStudioPath(customCaseId, step, locale, panel));
      restoredSavedCaseRef.current = String(customCaseId);
      setView("studio");
      window.dispatchEvent(new Event("genesis-studio-navigation"));
      showSessionNotice(locale === "en" ? "Saved workspace case loaded and verified." : "Сохранённый кейс загружен и проверен.");
    } catch {
      if (!requestIsCurrent()) return;
      restoredSavedCaseRef.current = null;
      showSessionNotice(locale === "en" ? "The saved case could not be verified or reached. Retry when connected; your current draft is unchanged." : "Не удалось получить или проверить кейс. Повторите при наличии связи; текущий черновик не изменён.");
    } finally {
      setSavedCaseRestorePending(current => current === requestId ? null : current);
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
        { id: "cash_flow-1", type: "cash_flow", title: "Royalty and interest flows", detail: "For each payer to payee flow: instrument, amount/currency, WHT, deductibility, treaty basis and beneficial owner.", x: 615, y: 55 },
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
    if (!enterNewLocalDraft(template, "decision-1")) return false;
    setPrompt("");
    navigate("studio", 3);
    return true;
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
      updateStudioDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, x: item.x + x - node.x, y: item.y + y - node.y } : item) }));
      setDragging((current) => current?.id === node.id ? { ...current, lastX: x, lastY: y } : current);
    } else if (event.type === "pointerup" || event.type === "pointercancel") {
      const completed = dragging;
      setDragging(null);
      if (completed?.id === node.id && (Math.round(completed.startX) !== Math.round(completed.lastX) || Math.round(completed.startY) !== Math.round(completed.lastY))) recordVisualEdit("node_moved", locale === "en" ? `Visual edit: moved “${node.title}” to (${Math.round(completed.lastX)}, ${Math.round(completed.lastY)}).` : `Визуальная правка: узел «${node.title}» перемещён в (${Math.round(completed.lastX)}, ${Math.round(completed.lastY)}).`, dragBeforeRef.current ?? undefined);
      dragBeforeRef.current = null;
    }
  }

  function playStudioDraft() {
    if (!studioCanDuplicate || !studioReportAuthority.allowed) return;
    const compiled = compileStudioDraft(draftRef.current);
    if (!compiled.scenario) {
      window.alert((locale === "en" ? "This graph cannot be played yet:\n" : "Граф пока нельзя пройти:\n") + compiled.issues.map((issue) => `• ${issue.message}${issue.nodeIds.length ? ` (${issue.nodeIds.join(", ")})` : ""}`).join("\n"));
      return;
    }
    const createdAt = new Date().toISOString();
    syncStudioDraft(appendStudioHistory(draftRef.current, { role: "studio", source: "visual", action: "compiled_for_play", message: locale === "en" ? `Compiled the current ${draftRef.current.nodes.length}-node graph and opened it in the full case player.` : `Текущий граф из ${draftRef.current.nodes.length} узлов собран и открыт в полноценном проигрывателе.` }, createdAt));
    startScenario(compiled.scenario, { privateOrigin: studioCustomCaseId !== null || studioPrivate ? { scope: studioStorageScope, customCaseId: studioCustomCaseId } : null });
  }
  function resetStudioDraft(next = blankStudioDraft(), nextPrompt = "", replacementMessage?: string) {
    if (!mayLeaveStudio()) return false;
    cancelCategoryDemo();
    const hasWork = Boolean(draftRef.current.nodes.length || draftRef.current.links.length || draftRef.current.title || draftRef.current.editHistory.length || prompt.trim() || hasStudioEvidenceInput(studioEvidenceBuffersRef.current));
    const retention = Boolean(studioStorageScope && studioSessionAuthority.getSnapshot().phase === "ready" && mayPersistStudioDraftOnDevice({ draft: draftRef.current, canDuplicate: studioCanDuplicate, customCaseId: studioCustomCaseId, isPrivate: studioPrivate }));
    if (hasWork && !window.confirm(replacementMessage ?? studioReplacementMessage(locale, next.title, retention))) return false;
    if (!enterNewLocalDraft(next, null, true)) return false;
    setPrompt(nextPrompt);
    return true;
  }
  function startCaseTemplate(id: CaseTypeId) {
    starterCancelledRef.current = true;
    const prepared = prepareCaseTemplate(blankStudioDraft(), id, locale);
    if (!resetStudioDraft(prepared.draft, prepared.prompt)) return;
    navigate("studio", 1);
  }
  function cancelCategoryDemo() {
    exampleRequestGateRef.current.abort();
    setExampleLaunch(null);
  }
  async function openCategoryDemo(id: CaseTypeId) {
    if (!mayLeaveStudio()) return;
    cancelCategoryDemo();
    catalogueLaunchRef.current += 1;
    starterCancelledRef.current = true;
    const ticket = exampleRequestGateRef.current.start();
    const context = exampleContextRef.current;
    const before = draftRef.current;
    const { epoch, scope } = studioSessionAuthority.getSnapshot();
    const current = () => exampleRequestGateRef.current.isCurrent(ticket)
      && context === exampleContextRef.current && before === draftRef.current
      && epoch === studioSessionAuthority.getSnapshot().epoch
      && scope === studioSessionAuthority.getSnapshot().scope;
    setExampleLaunch({ id, phase: "loading", context });
    try {
      const { draft: next, prompt: nextPrompt } = await loadCategoryDemo(id, locale);
      if (!current()) return;
      if (!mayLeaveStudio()) { cancelCategoryDemo(); return; }
      if (!resetStudioDraft(next, nextPrompt)) { cancelCategoryDemo(); return; }
      navigate("studio", 4);
    } catch {
      if (!current()) return;
      setExampleLaunch({ id, phase: "error", context });
    } finally {
      if (current()) {
        setExampleLaunch(value => value?.phase === "loading" ? null : value);
        exampleRequestGateRef.current.finish(ticket);
      }
    }
  }
  function purgeLocalStudioState() {
    cancelCategoryDemo();
    setArchiveOpen(false);
    setStudioRecovery(null);
    studioTaxWriteBaseline.current.clear();
    clearStudioEvidenceBuffers();
    studioSavedBaseline.current = null;
    studioChangedBeforeRestoreRef.current = true;
    try { const scope = currentStudioScopeRef.current; if (scope) { removeKnownStudioDeviceDrafts(window.localStorage, scope); purgeKnownStudioArchive(window.localStorage, scope); } } catch { /* Memory state still clears when browser storage is restricted. */ }
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
  function restoreEarlierDraft(entry: ArchivedStudioDraft) {
    if (!studioStorageScope || studioSessionAuthority.getSnapshot().phase !== "ready" || currentStudioScopeRef.current !== studioStorageScope) return;
    try {
      if (!resetStudioDraft(restoreArchivedStudioDraft(entry), entry.prompt)) return;
      setArchiveOpen(false);
      navigate("studio", 1);
    } catch { showSessionNotice(locale === "en" ? "This earlier draft needs recovery. Your open case is unchanged." : "Предыдущий черновик требует восстановления. Открытый кейс не изменён."); }
  }
  async function loadCanopyDemo(id: CanopyScenarioId) {
    starterCancelledRef.current = true;
    if (!mayLeaveStudio()) return;
    cancelCategoryDemo();
    const before = draftRef.current;
    const launchVersion = ++catalogueLaunchRef.current;
    const { buildCanopyPackage } = await import("./canopy-fixture");
    if (launchVersion !== catalogueLaunchRef.current) return;
    if (draftRef.current !== before) return;
    const prepared = buildCanopyPackage(id, true);
    if (!enterNewLocalDraft(prepared.draft, prepared.draft.nodes.find(node => node.type === "decision")?.id ?? prepared.draft.nodes[0]?.id ?? null)) return;
    setPrompt("");
    navigate("studio", 4);
    const overviewUrl = new URL(window.location.href);
    overviewUrl.searchParams.set("studio_panel", "overview");
    window.history.replaceState(window.history.state, "", overviewUrl);
    window.dispatchEvent(new Event("genesis-studio-navigation"));
  }
  function loadExampleDraft() {
    void loadCanopyDemo("base").catch(() => showSessionNotice(locale === "en" ? "Canopy could not be opened. Please try again." : "Не удалось открыть Canopy. Попробуйте ещё раз."));
  }
  async function openOperations() {
    starterCancelledRef.current = true;
    if (activeScenario) { navigate("play"); return; }
    navigate("play");
  }

  return (
    <div className={`app-shell theme-${theme}${studioOnly ? " studio-only-shell studio-host-falcon" : ""}`}>
      <div className="atmosphere" aria-hidden="true"><span /><span /><span /></div>
      <AppNavigation allowDeparture={mayLeaveStudio} newCase={() => { if (resetStudioDraft()) navigate("studio", 1); }} importCase={() => { if (!mayLeaveStudio()) return; flushSync(() => navigate("studio", 1)); importRef.current?.click(); }} locale={locale} view={view} studioOnly={studioOnly} workspaceLocation={workspaceLocation} navigate={navigate} openOperations={() => void openOperations()} restoreSession={() => playedCaseImportRef.current?.click()} exportSession={exportPlayedCase} hasActiveScenario={Boolean(activeScenario) && !privatePlayConcealed} toggleLocale={() => setLocale(locale === "en" ? "ru" : "en")} toggleTheme={() => setTheme(theme === "office" ? "after-hours" : "office")} dark={theme === "after-hours"}/>
      <input ref={playedCaseImportRef} className="visually-hidden" type="file" accept=".json,application/json" aria-label={locale === "en" ? "Restore a play session" : "Восстановить прохождение"} onChange={(event) => { const file = event.target.files?.[0]; if (file) importPlayedCase(file); event.target.value = ""; }} />

      {studioSession.phase === "ready" && studioStorageScope && <div className="page-width"><button type="button" className="secondary-cta" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(value => !value)}>{locale === "en" ? "Earlier device drafts" : "Предыдущие черновики устройства"}</button>{archiveOpen && <Suspense fallback={<p role="status">{locale === "en" ? "Loading earlier drafts…" : "Загрузка предыдущих черновиков…"}</p>}><StudioDraftArchive key={`${studioStorageScope}:${archiveVersion}`} scope={studioStorageScope} locale={locale} context={`${exampleContext}:${studioOpenRevision}:${draft.updatedAt}`} restore={restoreEarlierDraft}/></Suspense>}</div>}
      {view === "templates" && <CaseTemplates locale={locale} onStart={startCaseTemplate} onExample={openCategoryDemo} exampleLaunch={visibleExampleLaunch} cancelExample={cancelCategoryDemo} onDemo={() => navigate("demos")} />}
      {(view === "library" || view === "demos") && <LibraryView locale={locale} restorePlaySession={() => playedCaseImportRef.current?.click()} text={text} records={catalogueRecords} loadedScenarios={catalogueScenarios} launchCase={(record) => void launchCatalogueCase(record)} requestFeedback={setFeedbackTarget} openCanopy={loadCanopyDemo} canopyWorkflowHref={workspaceDestination("/canopy", workspaceLocation)} openTemplates={() => navigate("templates")} openCategoryDemo={openCategoryDemo} exampleLaunch={visibleExampleLaunch} cancelExample={cancelCategoryDemo} searchCatalogue={refreshCatalogue} nextCursor={catalogueNextCursor} total={catalogueTotal} loading={catalogueLoading} error={catalogueError} />}
      {view === "play" && !activeScenario && <main className="workspace-empty page-width"><span className="workspace-eyebrow">{locale === "en" ? "Operations" : "Операции"}</span><h1>{locale === "en" ? "Choose a case to work through" : "Выберите кейс для прохождения"}</h1><p>{locale === "en" ? "Open a playable demo, or restore a previous session to continue its decisions and deadlines." : "Откройте игровой демо-кейс или восстановите сессию, чтобы продолжить решения и задачи."}</p><div><button type="button" className="primary-cta" onClick={() => navigate("demos")}>{locale === "en" ? "Open demo case" : "Открыть демо-кейс"}</button><button type="button" className="secondary-cta" onClick={() => playedCaseImportRef.current?.click()}>{locale === "en" ? "Restore session" : "Восстановить сессию"}</button></div></main>}
      {view === "play" && !privatePlayConcealed && activeScenario && stage && runLedger && <Suspense fallback={<p className="page-width" role="status">{locale === "en" ? "Loading the operation…" : "Загрузка операции…"}</p>}><PlayView
        locale={locale} text={text} scenario={activeScenario} stage={stage} stageIndex={stageIndex} metrics={metrics} ledger={runLedger}
        decisionLog={decisionLog} caseMinute={caseMinute} actionUseCounts={actionUseCounts} completedDeadlineIds={completedDeadlineIds}
        missedDeadlineIds={missedDeadlineIds} canonicalState={canonicalPlayState ?? undefined} dossierRef={dossierRef} setDossierRef={setDossierRef}
        setSelectedOption={setSelectedOption} advanceTime={(minutes) => void advanceCaseTime(minutes)} timeBusy={playSessionBusy} outcome={outcome}
        sessionSync={playSessionSync} exportSession={exportPlayedCase} replayCase={() => startScenario(activeScenario, { legacyTiming: legacyTimingMode, privateOrigin: privatePlayOrigin })}
        returnLibrary={() => navigate(playReturnView)} returnToStudio={playReturnView === "studio"} returnLabel={playReturnView === "demos" ? (locale === "en" ? "Demo cases" : "Демо-кейсы") : playReturnView === "help" ? text.help : playReturnView === "community" ? text.community : undefined} requestFeedback={(contextType, contextId) => setFeedbackTarget({ caseId: activeScenario.caseId, version: activeScenario.version, title: activeScenario.title[locale], source: "playable", fingerprint: activeScenario.fingerprint, contextType, contextId })}
      /></Suspense>}
      {view === "studio" && !studioRecovery && <><div hidden={studioConcealed} inert={studioConcealed ? true : undefined}><StudioView evidenceBuffers={studioEvidenceBuffers} onEvidenceChange={changeStudioEvidenceInput} onEvidenceClear={clearStudioEvidenceType} onWorkspaceSaved={rememberStudioWorkspaceSave} prepareTaxWrite={studioTaxWriteBaseline.current.prepare} onDocumentRecovery={(reason, rawText, filename) => { setSessionNotice(""); setStudioRecovery({scope: currentStudioScopeRef.current, reason, rawText, filename, canExport: false}); }} onAuthDeparture={approved => approved ? navigation.approvePageDeparture() : navigation.cancelPageDeparture()} onOperationInterrupted={() => showSessionNotice(locale === "en" ? "A Studio operation was interrupted. Its result may still have been saved. Inspect the saved version before repeating the operation." : "Операция Studio прервана. Результат мог сохраниться. Проверьте сохранённую версию перед повтором.")} operationPending={studioOperationPending} key={studioOpenRevision} standalone={studioOnly} locale={locale} text={text} prompt={prompt} setPrompt={setPrompt} draft={draft} setDraft={updateStudioDraft} selectedNode={selectedNode} selectedNodeId={selectedNodeId} selectNode={setSelectedNodeId} checks={checks} packageRequiresPlayableRoute={packageRequiresPlayableRoute} generateDraft={generateDraft} applyPromptIteration={applyPromptIteration} applyReviewedAIPlan={applyReviewedAIPlan} applyCanonicalMarkdownDraft={applyCanonicalMarkdownDraft} saveDraft={saveDraft} savedFlash={savedFlash} exportDraft={exportDraft} importRef={importRef} importDraft={importDraft} createChildVersion={createChildVersion} updateNode={updateNode} recordVisualEdit={recordVisualEdit} addNode={addNode} addLink={addLink} relinkLink={relinkLink} deleteLink={deleteLink} deleteNode={deleteNode} moveNode={moveNode} resetDraft={resetStudioDraft} loadExample={loadExampleDraft} loadTaxTemplate={loadTaxTemplate} requestFeedback={() => setFeedbackTarget({ caseId: draft.caseId, version: draft.version, title: draft.title, source: "studio", fingerprint: caseFingerprint(draft), customCaseId: studioCustomCaseId, contextType: selectedNode ? "node" : "case", contextId: selectedNode?.id, privateCase: studioPrivate })} timeline={studioTimeline} undoDraft={() => travelStudioTimeline("undo")} redoDraft={() => travelStudioTimeline("redo")} restoreRevision={restoreStudioRevision} playDraft={playStudioDraft} isPrivate={studioPrivate} setPrivate={setStudioPrivate} customCaseId={studioCustomCaseId} setCustomCaseId={setStudioCustomCaseId} canManagePrivacy={studioCanManagePrivacy} setCanManagePrivacy={setStudioCanManagePrivacy} serverFingerprint={studioServerFingerprint} setServerFingerprint={setStudioServerFingerprint} serverPublicationFingerprint={studioServerPublicationFingerprint} setServerPublicationFingerprint={setStudioServerPublicationFingerprint} copyProtectionLocked={studioCopyProtectionLocked} setCopyProtectionLocked={setStudioCopyProtectionLocked} canDuplicate={studioCanDuplicate && studioReportAuthority.allowed} reportAuthority={studioReportAuthority} reportReceiptStorageScope={studioStorageScope} persistReportReceiptOnDevice={reportReceiptDeviceEligible} aiEntitlement={studioAIEntitlement} restorePending={(savedCaseRestorePending !== null && savedCaseRestorePending === savedCaseRequestRef.current) || studioAIEntitlement === "loading" || (studioAIEntitlement !== "unavailable" && !studioRestoreReady)} /></div></>}
      {view === "studio" && studioRecovery && recoveryVisible && <StudioRecoveryView recovery={studioRecovery} locale={locale} onReturn={() => setStudioRecovery(null)} />}
      {view === "studio" && studioRecovery && !recoveryVisible && <section className="studio-entry"><p role="status">{locale === "en" ? "Verify account access before opening the retained document." : "Подтвердите доступ аккаунта перед открытием сохранённого документа."}</p><a href="/account">{locale === "en" ? "Account" : "Аккаунт"}</a></section>}
      {((view === "studio" && studioConcealed) || (view === "play" && privatePlayConcealed)) && <section className="studio-entry"><h2>{locale === "en" ? "Verify access to this workspace" : "Подтвердите доступ к workspace"}</h2><p id="studio-access-status" role="status">{studioSession.signOutPending ? pendingSignOutMessage(locale) : locale === "en" ? "Private content is concealed. Sign in, then refresh access. Unsaved input stays in this tab while access is unconfirmed." : "Приватное содержимое скрыто. Войдите и обновите доступ. Пока доступ не подтверждён, несохранённый ввод остаётся в памяти этой вкладки."}</p><a href="/account">{locale === "en" ? "Account" : "Аккаунт"}</a><button type="button" disabled={studioSession.signOutPending} aria-describedby="studio-access-status" onClick={() => void studioSessionAuthority.refresh(true, activeProtectedCaseId)}>{locale === "en" ? "Refresh access" : "Обновить доступ"}</button></section>}
      {view === "community" && <Suspense fallback={<p className="page-width" role="status">{locale === "en" ? "Loading saved Studio drafts…" : "Загрузка сохранённых черновиков Studio…"}</p>}><CommunityView locale={locale} cases={catalogueRecords} openCustomCase={openWorkspaceCustomCase} refreshCatalogue={() => refreshCatalogue({ force: true })} clearDeviceDraft={purgeLocalStudioState} /></Suspense>}
      {view === "help" && <Suspense fallback={<p className="page-width" role="status">{locale === "en" ? "Loading Help…" : "Загрузка помощи…"}</p>}><HelpCenter locale={locale} onNavigate={navigate} /></Suspense>}
      {!privatePlayConcealed && (selectedOption || resultOption) && activeScenario && stage && <Suspense fallback={<p className="page-width" role="status">{locale === "en" ? "Loading the decision…" : "Загрузка решения…"}</p>}><DecisionModal locale={locale} text={text} scenario={activeScenario} stageHeadline={local(stage.headline, locale)} option={selectedOption ?? resultOption!} isResult={Boolean(resultOption)} busy={playSessionBusy} close={() => { if (!playSessionBusy) { setSelectedOption(null); setResultOption(null); } }} dispatch={dispatchDecision} advance={advanceStage} finalStage={Boolean(activeScenario.stages.find((item) => item.id === (selectedOption ?? resultOption)?.nextStageId)?.terminal)} /></Suspense>}
      {sessionNotice && <div className="session-toast" role="status"><Icon name="check" />{sessionNotice}</div>}
      {feedbackTarget && !studioConcealed && !privatePlayConcealed && <Suspense fallback={<p className="session-toast" role="status">{locale === "en" ? "Loading feedback form…" : "Загрузка формы отзыва…"}</p>}><FeedbackDialog Icon={Icon} locale={locale} target={feedbackTarget} close={() => setFeedbackTarget(null)} submitted={(audience) => { const privateProductFeedback = feedbackTarget.privateCase && audience !== "owner_private"; setFeedbackTarget(null); showSessionNotice(audience === "owner_private" ? (locale === "en" ? "Private note saved for you only." : "Приватная заметка сохранена только для вас.") : privateProductFeedback ? (locale === "en" ? "Redacted product feedback sent to Maxim." : "Обезличенный отзыв о продукте отправлен Максиму.") : (locale === "en" ? "Feedback submitted for expert review." : "Отзыв отправлен на экспертную проверку.")); }} /></Suspense>}
    </div>
  );
}

type CatalogueSearchFilters = { q?: string; jurisdiction?: string; practiceArea?: string; difficulty?: string; tag?: string };
export type PublishedCaseSummary = {
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

function LibraryView({ locale, restorePlaySession, text, records, loadedScenarios, launchCase, requestFeedback, openCanopy, canopyWorkflowHref, openTemplates, openCategoryDemo, exampleLaunch, cancelExample, searchCatalogue, nextCursor, total, loading, error }: { locale: Locale; restorePlaySession: () => void; text: UiText; records: PublishedCaseSummary[]; loadedScenarios: Scenario[]; launchCase: (record: PublishedCaseSummary) => void; requestFeedback: (target: FeedbackTarget) => void; openCanopy: (id: CanopyScenarioId) => Promise<void>; canopyWorkflowHref: string; openTemplates: () => void; openCategoryDemo: (id: CaseTypeId) => void; exampleLaunch: ExampleLaunch | null; cancelExample: () => void; searchCatalogue: (options?: { filters?: CatalogueSearchFilters; cursor?: string | null; append?: boolean; force?: boolean }) => Promise<void>; nextCursor: string | null; total: number; loading: boolean; error: string }) {
  const [format, setFormat] = useState<DemoFormat>("all");
  const [query, setQuery] = useState("");
  const [practiceFilter, setPracticeFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const cases = useMemo(() => records.map((record, index) => loadedScenarios.find((scenario) => scenario.caseId === record.id && scenario.version === record.currentVersion && scenario.fingerprint === record.fingerprint) ?? summaryScenario(record, index)), [loadedScenarios, records]);
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
  const practices = Array.from(new Set(["Business decision", ...CASE_TYPE_REGISTRY.map(type => type.practiceArea), ...facetRecords.map((item) => item.practiceArea)])).sort();
  const jurisdictions = Array.from(new Set(["Fictional Gulf market", locale === "en" ? "Fictional / unspecified" : "Учебная / не указана", ...facetRecords.map((item) => item.jurisdiction)])).sort();
  const difficulties = Array.from(new Set(["Intermediate", ...facetRecords.map((item) => item.difficulty)])).sort();
  const tags = Array.from(new Set(["category-demo", ...facetRecords.flatMap((item) => item.tags)])).sort();
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
  const resetFilters = () => { setFormat("all"); setQuery(""); setPracticeFilter("all"); setJurisdictionFilter("all"); setDifficultyFilter("all"); setDurationFilter("all"); setTagFilter("all"); };

  const showCanopy = matchesCanopy({ query, practice: practiceFilter, jurisdiction: jurisdictionFilter, difficulty: difficultyFilter, duration: durationFilter, tag: tagFilter, format });
  const categoryDemos = matchingCategoryDemos({ query, practice: practiceFilter, jurisdiction: jurisdictionFilter, difficulty: difficultyFilter, duration: durationFilter, tag: tagFilter, format }, locale);
  const cards = (format === "walkthrough" || format === "worked" ? [] : filteredCases).map(scenario => {
    const meta = metadataFor(scenario);
    return { id: scenario.caseId, title: scenario.title[locale], summary: scenario.opening[locale], jurisdiction: scenario.jurisdiction, practice: meta.practice, duration: meta.duration, version: scenario.version, review: editorialReviewLabel(meta.reviewLevel, locale), author: meta.authorName ?? "GENESIS: JURIS", legalAsOf: meta.legalAsOf };
  });
  return <main className="library-view demo-catalogue">
    <header className="demo-catalogue-header page-width"><div><h1>{text.library}</h1><p>{locale === "en" ? "Choose an example. Guided walkthroughs explain the workflow; worked Studio examples cover every case category; decision simulations let you make the choices." : "Выберите пример. Пошаговый обзор объясняет процесс; учебные примеры Studio охватывают все категории; в симуляции решения принимаете вы."}</p></div><button type="button" className="secondary-cta" onClick={openTemplates}>{locale === "en" ? "Start your own case · Templates" : "Создать свой кейс · Шаблоны"}</button></header>
    <section className="catalogue-filters page-width"><label className="filter-search"><span>{locale === "en" ? "Search demo cases" : "Поиск демо-кейсов"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "Title, topic or jurisdiction…" : "Название, тема или юрисдикция…"}/></label><label><span>{locale === "en" ? "Format" : "Формат"}</span><select value={format} onChange={event => setFormat(event.target.value as DemoFormat)}><option value="all">{locale === "en" ? "All formats" : "Все форматы"}</option><option value="walkthrough">{locale === "en" ? "Guided walkthrough" : "Пошаговый обзор"}</option><option value="worked">{locale === "en" ? "Worked Studio example" : "Учебный пример Studio"}</option><option value="simulation">{locale === "en" ? "Decision simulation" : "Симуляция решений"}</option></select></label><details className="catalogue-filter-more"><summary>{locale === "en" ? "More filters" : "Другие фильтры"}</summary><div><label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value)}><option value="all">{locale === "en" ? "All practices" : "Все практики"}</option>{practices.map((practice) => <option key={practice}>{practice}</option>)}</select></label><label><span>{locale === "en" ? "Jurisdiction" : "Юрисдикция"}</span><select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="all">{locale === "en" ? "All jurisdictions" : "Все юрисдикции"}</option>{jurisdictions.map((jurisdiction) => <option key={jurisdiction}>{jurisdiction}</option>)}</select></label><label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">{locale === "en" ? "All levels" : "Все уровни"}</option>{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label><span>{locale === "en" ? "Duration" : "Длительность"}</span><select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}><option value="all">{locale === "en" ? "Any duration" : "Любая"}</option><option value="short">≤ 35 min</option><option value="medium">36–45 min</option><option value="long">45+ min</option></select></label><label><span>{locale === "en" ? "Tag" : "Тег"}</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">{locale === "en" ? "All tags" : "Все теги"}</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label></div></details><div className="filter-result"><b role="status" aria-live="polite" aria-atomic="true">{cards.length + Number(showCanopy) + categoryDemos.length} {locale === "en" ? "shown" : "показано"}</b><button onClick={resetFilters}>{locale === "en" ? "Reset" : "Сбросить"}</button></div></section>
    {loading && <p className="catalogue-status page-width" role="status">{locale === "en" ? "Loading demo cases…" : "Загрузка демо-кейсов…"}</p>}
    {error && <p className="catalogue-status page-width" role="status">{error}</p>}
    <section className="page-width demo-catalogue-results" aria-label={text.library} aria-busy={loading}>
      <DemoCatalogueCards locale={locale} cards={cards} showCanopy={showCanopy} busy={loading} openCanopy={openCanopy} canopyWorkflowHref={canopyWorkflowHref} launch={id => { const record = records.find(item => item.id === id); if (record) launchCase(record); }} feedback={id => { const record = records.find(item => item.id === id); if (record) requestFeedback({ caseId: record.id, version: record.currentVersion, title: record.title, source: "playable", fingerprint: record.fingerprint }); }}/>
      {categoryDemos.length > 0 && <Suspense fallback={<p role="status">{locale === "en" ? "Loading worked examples…" : "Загрузка учебных примеров…"}</p>}><CategoryDemoCards demos={categoryDemos} locale={locale} onOpen={openCategoryDemo} exampleLaunch={exampleLaunch} cancelExample={cancelExample}/></Suspense>}
      {!showCanopy && cards.length === 0 && categoryDemos.length === 0 && !loading && <div className="catalogue-empty"><b>{locale === "en" ? "No demo cases match these filters." : "По этим фильтрам демо-кейсы не найдены."}</b><button type="button" className="secondary-cta" onClick={resetFilters}>{locale === "en" ? "Reset filters" : "Сбросить фильтры"}</button></div>}
      {nextCursor && (format === "all" || format === "simulation") && <button className="catalogue-load-more secondary-cta" disabled={loading} onClick={() => void searchCatalogue({ filters: { q: query, practiceArea: practiceFilter, jurisdiction: jurisdictionFilter, difficulty: difficultyFilter, tag: tagFilter }, cursor: nextCursor, append: true })}>{locale === "en" ? `More simulations (${records.length} / ${total})` : `Ещё симуляции (${records.length} / ${total})`}</button>}
    </section>
    <div className="library-restore page-width"><span>{locale === "en" ? "Have saved simulation progress?" : "Есть сохранённое прохождение?"}</span><button className="secondary-cta" onClick={restorePlaySession}><Icon name="upload"/>{locale === "en" ? "Restore a play session" : "Восстановить прохождение"}</button></div>
  </main>;
}

type StudioViewProps = {
  evidenceBuffers: StudioEvidenceBuffers;
  onEvidenceChange: (type: StudioNodeType, patch: Partial<StudioEvidenceInput>) => void;
  onEvidenceClear: (type: StudioNodeType) => void;
  onWorkspaceSaved?: (draft: StudioDraft, customCaseId: number) => void;
  onDocumentRecovery: (reason: string, rawText: string, filename: string) => void;
  prepareTaxWrite: (draft: StudioDraft, scope: string | null, serverFingerprint: string | null) => Promise<StudioTaxWrite>;
  onAuthDeparture?: (approved: boolean) => void;
  operationPending: React.RefObject<boolean>;
  onOperationInterrupted: () => void;
  standalone?: boolean;
  locale: Locale; text: UiText; prompt: string; setPrompt: React.Dispatch<React.SetStateAction<string>>; draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>; selectedNode: StudioNode | null; selectedNodeId: string | null;
  selectNode: (id: string | null) => void; checks: StudioCheck[]; packageRequiresPlayableRoute: boolean;
  generateDraft: () => void; applyPromptIteration: () => void; applyReviewedAIPlan: (plan: StudioPromptPlan, baseFingerprint: string) => boolean; applyCanonicalMarkdownDraft: (draft: StudioDraft) => boolean; saveDraft: () => void; savedFlash: boolean;
  exportDraft: () => void; importRef: React.RefObject<HTMLInputElement | null>; importDraft: (file: File, loaded?: (draft: StudioDraft) => void) => void;
  createChildVersion: () => void; updateNode: (change: Partial<StudioNode>) => void;
  recordVisualEdit: (action: StudioEditAction, message: string, before?: StudioDraft) => void; addNode: (type: StudioNodeType, preferredPosition?: { x: number; y: number }) => void;
  addLink: (from: string, to: string) => void; relinkLink: (previous: StudioLink, next: StudioLink) => void;
  deleteLink: (link: StudioLink) => void; deleteNode: () => void;
  moveNode: (event: React.PointerEvent<HTMLButtonElement>, node: StudioNode, graphScale?: number) => void; resetDraft: () => boolean | void;
  loadExample: () => void; loadTaxTemplate: () => boolean; requestFeedback: () => void;
  timeline: StudioTimeline; undoDraft: () => void; redoDraft: () => void;
  restoreRevision: (revision: StudioRevision) => void; playDraft: () => void;
  isPrivate: boolean; setPrivate: (value: boolean) => void; customCaseId: number | null; setCustomCaseId: (value: number | null) => void;
  canManagePrivacy: boolean; setCanManagePrivacy: (value: boolean) => void;
  serverFingerprint: string | null; setServerFingerprint: (value: string | null) => void;
  serverPublicationFingerprint: string | null; setServerPublicationFingerprint: (value: string | null) => void;
  copyProtectionLocked: boolean; setCopyProtectionLocked: (value: boolean) => void; canDuplicate: boolean; aiEntitlement: StudioAIEntitlement; restorePending: boolean;
  reportReceiptStorageScope: string | null; persistReportReceiptOnDevice: boolean; reportAuthority: StudioReportAuthority;
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

function StudioView({ evidenceBuffers, onEvidenceChange, onEvidenceClear, onWorkspaceSaved, prepareTaxWrite, onDocumentRecovery, onAuthDeparture, operationPending, onOperationInterrupted, locale, text, prompt, setPrompt, draft, setDraft, selectedNode, selectedNodeId, selectNode, checks, packageRequiresPlayableRoute, generateDraft, applyPromptIteration, applyReviewedAIPlan, applyCanonicalMarkdownDraft, saveDraft, savedFlash, exportDraft, importRef, importDraft, createChildVersion, updateNode, recordVisualEdit, addNode, addLink, relinkLink, deleteLink, deleteNode, moveNode, resetDraft, loadExample, loadTaxTemplate, requestFeedback, timeline, undoDraft, redoDraft, restoreRevision, playDraft, isPrivate, setPrivate, customCaseId, setCustomCaseId, canManagePrivacy, setCanManagePrivacy, serverFingerprint, setServerFingerprint, serverPublicationFingerprint, setServerPublicationFingerprint, copyProtectionLocked, setCopyProtectionLocked, canDuplicate, reportAuthority, reportReceiptStorageScope, persistReportReceiptOnDevice, aiEntitlement, restorePending }: StudioViewProps) {
  const [workspaceState, setWorkspaceState] = useState<"idle" | "saving" | "saved" | "submitted" | "conflict" | "auth_required" | "error">(customCaseId && serverFingerprint && serverPublicationFingerprint ? "saved" : "idle");
  const [workspaceSavedAt, setWorkspaceSavedAt] = useState<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [relationStatus, setRelationStatus] = useState("");
  const fieldBefore = useRef("");
  const fieldBeforeDraft = useRef<StudioDraft | null>(null);
  const economicPromptSyncRef = useRef(0);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [selectedRuleLinkId, setSelectedRuleLinkId] = useState<string | null>(null);
  const [aiState, setAIState] = useState<"idle" | "analysing" | "ready" | "error">("idle");
  operationPending.current = workspaceState === "saving" || aiState === "analysing";
  const interruptionNotice = useRef(onOperationInterrupted);
  interruptionNotice.current = onOperationInterrupted;
  useEffect(() => () => {
    if (operationPending.current) interruptionNotice.current();
    operationPending.current = false;
  }, [operationPending]);
  const [aiError, setAIError] = useState("");
  const [promptLimitNotice, setPromptLimitNotice] = useState(false);
  const [aiResult, setAIResult] = useState<{ key: string; baseFingerprint: string; plan: StudioPromptPlan; model: string | null; requestId: string | null } | null>(null);
  const [editorOpened, setEditorOpened] = useState(false);
  const [displayMode, setDisplayMode] = useState<"user" | "developer">("user");
  const [guidedStep, setGuidedStep] = useState<GuidedStudioStep>(1);
  const [overviewSelected, setOverviewSelected] = useState(false);
  const trainingWorkflow = draft.caseType?.id === "training_simulation";
  const showOverview = displayMode === "user" && overviewSelected && !trainingWorkflow;
  const visibleStep = showOverview ? null : guidedStep;
  const [workspaceSavedFingerprint, setWorkspaceSavedFingerprint] = useState<string | null>(() => customCaseId && serverFingerprint && serverPublicationFingerprint ? `${studioAIBaseFingerprint(draft)}\u0000${isPrivate ? "private" : "restricted"}` : null);
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
  const [graphPresentation, setGraphPresentation] = useState<"overview" | "detail" | "list">("overview");
  const expandedGraphContext = JSON.stringify([reportAuthority.epoch, reportReceiptStorageScope, customCaseId, draft.caseId, draft.version]);
  const [expandedGraphOpening, setExpandedGraphOpening] = useState<string | null>(null);
  const expandedGraphOpen = reportAuthority.visible && expandedGraphOpening === expandedGraphContext;
  // A native modal in a hidden/inert subtree still blocks the visible recovery
  // controls. Invalidate the opening during render, including suspended access,
  // so recovery cannot resurrect it or wait for a passive effect to close it.
  if (expandedGraphOpening !== null && !expandedGraphOpen) setExpandedGraphOpening(null);
  const [graphOrientation, setGraphOrientation] = useState<GraphOrientation>("vertical");
  const [graphReferenceNodes, setGraphReferenceNodes] = useState(draft.nodes);
  const knownGraphNodes = new Set(graphReferenceNodes.map((node) => node.id));
  const newGraphNodes = draft.nodes.filter((node) => !knownGraphNodes.has(node.id));
  if (newGraphNodes.length) setGraphReferenceNodes([...graphReferenceNodes, ...newGraphNodes]);
  const [layoutEngine, setLayoutEngine] = useState<typeof import("./studio-layout") | null>(null);
  const [layoutError, setLayoutError] = useState(false);
  const [layoutAttempt, setLayoutAttempt] = useState(0);
  const graphDraftIdentity = `${draft.caseId}\u0000${draft.version}`;
  const graphViewportKey = `${graphDraftIdentity}\u0000${draft.nodes.map((node) => node.id).join("\u0001")}\u0000${layoutEngine ? "ready" : "loading"}`;
  const guidedWorkflowKey = studioWorkflowStorageKey(draft.caseId);
  const guidedDraftIsEmpty = !draft.title.trim() && draft.nodes.length === 0 && draft.links.length === 0;
  const graphDraftIdentityRef = useRef(graphDraftIdentity);
  const guidedWorkflowRestoredRef = useRef(false);
  const [caseReportOpen, setCaseReportOpen] = useState(false);
  const [caseReportFingerprint, setCaseReportFingerprint] = useState("");
  const [caseReportStatus, setCaseReportStatus] = useState("");
  const [caseMarkdownOpen, setCaseMarkdownOpen] = useState(false);
  const [canonicalCandidate, setCanonicalCandidate] = useState<{ draft: StudioDraft; fingerprint: string; status: "amended"|"final"; language: "en"|"ru" } | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const graphDeckRef = useRef<HTMLElement | null>(null);
  const graphViewportRef = useRef<HTMLDivElement | null>(null);
  const moreActionsRef = useRef<HTMLDetailsElement | null>(null);
  const pendingAuthActionRef = useRef<"save" | "submit">(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("resume_action") === "submit" ? "submit" : "save");
  const saveOperationRef = useRef(0);
  const saveMountedRef = useRef(true);
  const saveContextRef = useRef({ caseId: draft.caseId, version: draft.version, scope: reportReceiptStorageScope });
  saveContextRef.current = { caseId: draft.caseId, version: draft.version, scope: reportReceiptStorageScope };
  const [workspaceError, setWorkspaceError] = useState("");
  const [accountTabNeeded, setAccountTabNeeded] = useState(false);
  useEffect(() => { saveMountedRef.current = true; return () => { saveMountedRef.current = false; }; }, []);
  const derivationsSettled = studioDerivations.source === draft;
  const promptDerivationsSettled = derivationsSettled && derivedPrompt === prompt;
  const [actionTarget, setActionTarget] = useState<StudioActionTarget | null>(null);
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    if (!actionTarget) return;
    let frame = 0;
    const focus = () => { if (focusActionTarget(actionTarget.id)) observer.disconnect(); };
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(focus); });
    observer.observe(document.body, { childList: true, subtree: true });
    frame = requestAnimationFrame(focus);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [actionTarget]);
  const canonicalPrompt = prompt.includes("GENESIS-JURIS-CANONICAL-");
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
  function openWorkspaceAuthorization(action: "save" | "submit") {
    pendingAuthActionRef.current = action;
    setWorkspaceState("auth_required");
    if (!mayPersistStudioDraftOnDevice({ draft, customCaseId, isPrivate, canDuplicate })) {
      setAccountTabNeeded(true);
      setWorkspaceError(locale === "en" ? "Keep this Studio tab open. Sign in to the same account in a separate tab, return here and retry the save. Unsaved protected content stays in this tab." : "Оставьте эту вкладку открытой. Войдите в тот же аккаунт в другой вкладке, вернитесь и повторите сохранение. Защищённый черновик остаётся здесь.");
      return;
    }
    openStudioAccess(true, action);
  }
  function openStudioAccess(profileOnly = false, action?: "save" | "submit") {
    if (hasStudioEvidenceInput(evidenceBuffers)) {
      setAccountTabNeeded(true);
      setWorkspaceState("auth_required");
      setWorkspaceError(locale === "en" ? "An unadded working item is still in this tab. Add or discard it before continuing to sign-in, or open Account in another tab and return here." : "В этой вкладке остался недобавленный рабочий элемент. Добавьте или отмените его перед переходом ко входу либо откройте Аккаунт в другой вкладке и вернитесь сюда.");
      return;
    }
    try {
      const pending = createStudioAuthContinuation({ draft, prompt, selectedNodeId, scope: reportReceiptStorageScope, customCaseId, isPrivate, canDuplicate, action });
      writeStudioAuthContinuation(window.sessionStorage, pending);
      const url = new URL(window.location.href);
      url.searchParams.delete("custom_case");
      url.searchParams.set("auth_continue", pending.id);
      url.searchParams.set("lang", locale);
      // Back/cancel and successful sign-in both return to the exact task.
      window.history.replaceState(window.history.state, "", url);
      const destination = "/account?lang=" + locale + "&return_to=" + encodeURIComponent(url.pathname + url.search + url.hash);
      onAuthDeparture?.(true);
      window.location.assign(profileOnly ? destination : workspaceSignInPath(destination));
    } catch {
      onAuthDeparture?.(false);
      setAccountTabNeeded(true);
      setWorkspaceState("auth_required");
      setWorkspaceError(locale === "en" ? "Temporary draft storage is unavailable. Keep this tab open, sign in from Account in another tab, then return and retry. Your work is still open here." : "Временное хранилище недоступно. Оставьте вкладку открытой, войдите через Аккаунт в другой вкладке, затем вернитесь и повторите. Работа остаётся здесь.");
    }
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
  const graphNodes = useMemo(() => layoutEngine?.projectStudioNodes(draft.nodes, draft.links, graphOrientation, graphReferenceNodes) ?? [], [draft.nodes, draft.links, graphOrientation, graphReferenceNodes, layoutEngine]);
  const nodeById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const nodeNumberById = useMemo(() => new Map(draft.nodes.map((node, index) => [node.id, index + 1])), [draft.nodes]);
  const graphBounds = useMemo(() => graphBoundsForNodes(graphNodes), [graphNodes]);
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
    const bounds = graphBoundsRef.current;
    const scale = graphOverviewScale({ width, height: viewport?.clientHeight ?? 500 }, bounds);
    setGraphPresentation("overview");
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
  const taxAttached = hasTaxAttachment(draft);
  const taxModel = useMemo(() => editableDealModel && !taxAttached
    ? prefillTaxEconomicsFromDeal(draft.taxEconomics, editableDealModel)
    : draft.taxEconomics ?? defaultTaxEconomics(), [draft.taxEconomics, editableDealModel, taxAttached]);
  const taxResult = useMemo(() => taxDraft && !taxAttached ? calculateTaxEconomics(taxModel) : null, [taxDraft, taxModel, taxAttached]);
  const taxBaseBreakdown = useMemo(() => {
    if (!editableDealModel || taxAttached) return null;
    const source = rentalTaxBaseFromDeal(editableDealModel);
    if (!source) return null;
    if (source.currency === taxModel.currency) return source;
    const rate = taxModel.fx?.sourceCurrency === source.currency && taxModel.fx.targetCurrency === taxModel.currency ? taxModel.fx.rate : null;
    return rate ? convertRentalTaxBase(source, taxModel.currency, rate) : null;
  }, [editableDealModel, taxModel.currency, taxModel.fx, taxAttached]);
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
    let cancelled = false;
    // Loading only sets the engine; no draft or completion marker is mutated.
    void import("./studio-layout").then((engine) => {
      if (!cancelled) { setLayoutEngine(engine); setLayoutError(false); }
    }).catch(() => { if (!cancelled) setLayoutError(true); });
    return () => { cancelled = true; };
  }, [layoutAttempt]);


  useEffect(() => {
    if (graphDraftIdentityRef.current === graphDraftIdentity) return;
    graphDraftIdentityRef.current = graphDraftIdentity;
    setGraphOrientation("vertical");
    setGraphReferenceNodes(draft.nodes);
  }, [graphDraftIdentity, draft.nodes]);

  useEffect(() => {
    function restoreEntry() {
      const params = new URL(window.location.href).searchParams;
      setEditorOpened(["studio_step", "example", "import", "auth_continue", "dossier"].some((key) => Boolean(params.get(key))));
      setOverviewSelected(params.get("studio_panel") === "overview");
    }
    restoreEntry();
    window.addEventListener("popstate", restoreEntry);
    window.addEventListener("genesis-studio-navigation", restoreEntry);
    return () => { window.removeEventListener("popstate", restoreEntry); window.removeEventListener("genesis-studio-navigation", restoreEntry); };
  }, []);

  useEffect(() => {
    guidedWorkflowRestoredRef.current = false;
    if (!editorOpened || restorePending) return;
    const timer = window.setTimeout(() => {
      const queryStep = parseStudioWorkflowStep(new URL(window.location.href).searchParams.get("studio_step"));
      let storedStep: GuidedStudioStep | null = null;
      try { storedStep = parseStudioWorkflowStep(window.localStorage.getItem(guidedWorkflowKey)); } catch { /* URL state remains authoritative when device storage is unavailable. */ }
      const restoredStep = restoredStudioWorkflowStep(guidedDraftIsEmpty, queryStep, storedStep);
      guidedWorkflowRestoredRef.current = true;
      const stage = serializedStudioWorkflowStep(restoredStep);
      try { window.localStorage.setItem(guidedWorkflowKey, stage); } catch { /* Guided navigation remains available without device persistence. */ }
      const url = new URL(window.location.href);
      if (url.searchParams.get("studio_step") !== stage) {
        url.searchParams.set("studio_step", stage);
        window.history.replaceState(window.history.state, "", url);
      }
      setGuidedStep(restoredStep);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [guidedDraftIsEmpty, guidedWorkflowKey, editorOpened, restorePending]);

  useEffect(() => {
    if (!editorOpened || restorePending || !guidedWorkflowRestoredRef.current) return;
    const stage = serializedStudioWorkflowStep(guidedStep);
    try { window.localStorage.setItem(guidedWorkflowKey, stage); } catch { /* Guided navigation still works without device persistence. */ }
    const url = new URL(window.location.href);
    if (url.searchParams.get("studio_step") === stage) return;
    url.searchParams.set("studio_step", stage);
    window.history.replaceState(window.history.state, "", url);
  }, [guidedStep, guidedWorkflowKey, editorOpened, restorePending]);

  useEffect(() => {
    function restoreGuidedStepFromHistory() {
      if (restorePending) return;
      const step = parseStudioWorkflowStep(new URL(window.location.href).searchParams.get("studio_step"));
      if (step) setGuidedStep(guidedDraftIsEmpty ? 1 : step);
    }
    window.addEventListener("popstate", restoreGuidedStepFromHistory);
    window.addEventListener("genesis-studio-navigation", restoreGuidedStepFromHistory);
    return () => { window.removeEventListener("popstate", restoreGuidedStepFromHistory); window.removeEventListener("genesis-studio-navigation", restoreGuidedStepFromHistory); };
  }, [guidedDraftIsEmpty, restorePending]);

  useEffect(() => {
    // Opening a source adjusts the viewport only. Node positions belong to the
    // signed draft; changing them requires the explicit, recorded layout action.
    let fitFrame: number | null = null;
    const layoutFrame = window.requestAnimationFrame(() => {
      fitFrame = window.requestAnimationFrame(fitGraph);
    });
    return () => {
      window.cancelAnimationFrame(layoutFrame);
      if (fitFrame !== null) window.cancelAnimationFrame(fitFrame);
    };
  }, [fitGraph, graphViewportKey]);

  useEffect(() => {
    if (visibleStep !== 4 || graphPresentation !== "overview") return;
    const frame = window.requestAnimationFrame(fitGraph);
    return () => window.cancelAnimationFrame(frame);
  }, [visibleStep, graphPresentation, graphBounds.width, graphBounds.height, fitGraph]);

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
    if (taxAttached || !taxDraft || JSON.stringify(draft.taxEconomics) === JSON.stringify(taxModel)) return;
    const nextDraft = { ...draft, taxEconomics: taxModel };
    setDraft((current) => current === draft ? nextDraft : current);
    syncEconomicPrompt(nextDraft);
  }, [draft, setDraft, syncEconomicPrompt, taxDraft, taxModel, taxAttached]);

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
      const sourceKey = aiInputKey;
      const scope = reportReceiptStorageScope;
      const current = () => saveMountedRef.current && aiInputKeyRef.current === sourceKey && saveContextRef.current.scope === scope;
      setAIState("analysing");
      setAIError("");
      setCanonicalCandidate(null);
      try {
        const { readStudioCanonicalMarkdown } = await import("./studio-tax-export");
        const read = await readStudioCanonicalMarkdown(prompt);
        if (!current()) return;
        if (read.status === "unsupported" || read.status === "corrupt") {
          // Finish local verification before recovery unmounts this editor;
          // any separate pending workspace save retains its interruption flag.
          flushSync(() => setAIState("idle"));
          onDocumentRecovery(read.reason, read.rawText, "studio-canonical-recovery.md");
          return;
        }
        const { parseCaseMarkdown } = await import("./case-markdown");
        const candidate = await parseCaseMarkdown(prompt);
        if (!current()) return;
        if (!candidate) throw new Error();
        setCanonicalCandidate(candidate);
        setAIState("idle");
      } catch {
        if (!current()) return;
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
      if (response.status === 401 || (response.status === 403 && isRecord(payload) && payload.code === "profile_required")) throw new Error(locale === "en" ? "AI access requires sign-in and a confirmed profile. Use the access action to return to this task afterwards." : "Для AI нужен вход и подтверждённый профиль. Кнопка доступа вернёт вас к этой задаче.");
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
      if (displayMode === "user") selectGuidedStep(3);
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
      await withLocalChunkRecovery(() => import("./CaseReportDialog"));
      setCaseReportStatus("");
      setCaseReportFingerprint(derivationsSettled ? studioDerivations.caseFingerprint : caseFingerprint(draft));
      setCaseReportOpen(true);
    } catch (error) {
      setCaseReportStatus(reportGenerationErrorMessage(error, locale));
    }
  }

  function centerGraph() {
    const viewport = graphViewportRef.current;
    if (viewport) viewport.scrollTo({ left: Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2), top: Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2), behavior: "smooth" });
  }

  function visibleGraphCenter() {
    const viewport = graphViewportRef.current;
    if (!viewport) return { x: 430, y: 210 };
    const scale = Number.isFinite(graphZoom) && graphZoom > 0 ? graphZoom : 1;
    return {
      x: Math.max(20, Math.round((viewport.scrollLeft + viewport.clientWidth / 2) / scale - 82.5)),
      y: Math.max(20, Math.round((viewport.scrollTop + viewport.clientHeight / 2) / scale - 48)),
    };
  }

  async function autoLayoutGraph(orientation: GraphOrientation = graphOrientation) {
    if (!canDuplicate || !layoutEngine || draft.nodes.length < 2) { fitGraph(); return; }
    const before = draft;
    const nodes = layoutEngine.layoutStudioNodes(before.nodes, before.links, orientation);
    setGraphReferenceNodes(nodes);
    const changed = nodes.some((node, index) => node.x !== before.nodes[index]?.x || node.y !== before.nodes[index]?.y);
    if (changed) {
      setDraft({ ...before, nodes });
      recordVisualEdit("node_moved", locale === "en" ? `Visual edit: applied ${orientation} auto-layout.` : `Визуальная правка: авто-раскладка ${orientation === "vertical" ? "сверху вниз" : "слева направо"}.`, before);
    }
    setGraphZoom(1);
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

  function loadCasePrompt(value: string) {
    if (!canDuplicate) return;
    aiAbortRef.current?.abort();
    setCanonicalCandidate(null);
    setAIResult(null);
    setAIState("idle");
    setAIError("");
    setPromptLimitNotice(false);
    setPrompt(value);
    selectGuidedStep(1);
    moreActionsRef.current?.removeAttribute("open");
    setCaseReportStatus(locale === "en" ? "Prompt loaded. Review the description, then verify or analyse it before applying any changes." : "Промпт загружен. Проверьте описание, затем проверьте или проанализируйте его перед применением изменений.");
    window.requestAnimationFrame(() => document.getElementById("studio-case-brief")?.focus());
  }

  const fileImportSequence = useRef(0);
  const fileImportContext = useRef({ draft, prompt, scope: reportReceiptStorageScope });
  fileImportContext.current = { draft, prompt, scope: reportReceiptStorageScope };
  async function loadStudioFile(file: File) {
    if (!canDuplicate || operationPending.current) return;
    const sequence = ++fileImportSequence.current;
    const current = () => saveMountedRef.current && sequence === fileImportSequence.current && fileImportContext.current.draft === draft && fileImportContext.current.prompt === prompt && fileImportContext.current.scope === reportReceiptStorageScope;
    try {
      const { studioImportFileKind, readStudioPromptFile, studioPromptFileError } = await import("./studio-prompt-file");
      if (!current()) return;
      const kind = studioImportFileKind(file);
      if (kind === "case") {
        importDraft(file, (restored) => {
          clearTransientEditorSelection();
          setCanonicalCandidate(null);
          setCaseReportStatus("");
          moreActionsRef.current?.removeAttribute("open");
          selectGuidedStep(!restored.title.trim() && !restored.nodes.length && !restored.links.length ? 1 : 4);
        });
      } else if (kind === "prompt") {
        try { const value = await readStudioPromptFile(file); if (current()) loadCasePrompt(value); }
        catch (error) { if (current()) setCaseReportStatus(studioPromptFileError(error, locale)); }
      } else {
        setCaseReportStatus(locale === "en" ? "Choose a Studio JSON case or a Markdown (.md) / text (.txt) prompt. Your current work is unchanged." : "Выберите JSON-кейс Studio или промпт Markdown (.md) / текст (.txt). Текущая работа не изменена.");
      }
    } catch {
      if (!current()) return;
      setCaseReportStatus(locale === "en" ? "File tools could not be loaded. Refresh and retry. Your current work is unchanged." : "Не удалось загрузить модуль импорта. Обновите страницу и повторите. Текущая работа не изменена.");
    }
  }

  const focusRelationStatus = useCallback(() => {
    window.requestAnimationFrame(() => document.getElementById("graph-connect-status")?.focus());
  }, []);

  function startBlankDraft() {
    const reset = resetDraft();
    if (reset !== false) { clearTransientEditorSelection(); setGraphOrientation("vertical"); selectGuidedStep(1); }
    return reset !== false;
  }

  function startExampleDraft() {
    loadExample();
  }

  function startTaxTemplate() {
    const hasWork = Boolean(draft.nodes.length || draft.links.length || draft.title || draft.editHistory.length || prompt.trim());
    if (hasWork && !window.confirm(locale === "en" ? "Replace the current draft with the tax template? The current unsaved graph will be removed." : "Заменить текущий черновик налоговым шаблоном? Текущая несохранённая схема будет удалена.")) return;
    if (!loadTaxTemplate()) return;
    clearTransientEditorSelection();
    setGraphOrientation("vertical");
    selectGuidedStep(3);
  }

  useEffect(() => {
    function deleteSelectedGraphItem(event: KeyboardEvent) {
      if ((event.key !== "Delete" && event.key !== "Backspace") || event.metaKey || event.ctrlKey || event.altKey || !canDuplicate) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      // A retained selection must never turn Delete on navigation/report controls
      // into an edit. Keyboard deletion belongs to the visible graph itself.
      if ((displayMode !== "developer" && visibleStep !== 4) || graphPresentation === "list") return;
      if (!(target instanceof Element) || !target.closest(".graph-node, .graph-node-number, .graph-link")) return;
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
  }, [canDuplicate, deleteLink, deleteNode, displayMode, draft.links, draft.nodes, focusRelationStatus, graphPresentation, locale, selectedNodeId, selectedRuleLinkId, visibleStep]);

  async function shareDraft(action: "save" | "submit") {
    const draftAtStart = draft;
    const targetDraft = freezeStudioDraftSnapshot(draftAtStart);
    const targetPrivate = isPrivate;
    const targetServerFingerprint = serverFingerprint;
    const targetServerPublicationFingerprint = serverPublicationFingerprint;
    if (!canDuplicate || studioJsonBytes(targetDraft) > STUDIO_DRAFT_SERIALIZED_LIMIT || !derivationsSettled || workspaceState === "saving") { setWorkspaceState("error"); return; }
    if ((targetServerFingerprint === null) !== (targetServerPublicationFingerprint === null)) { setWorkspaceState("conflict"); return; }
    pendingAuthActionRef.current = action;
    if (aiEntitlement === "anonymous" || aiEntitlement === "profile_required") { openWorkspaceAuthorization(action); return; }
    const operation = ++saveOperationRef.current;
    const context = saveContextRef.current;
    const isCurrent = () => saveMountedRef.current && operation === saveOperationRef.current && saveContextRef.current.caseId === context.caseId && saveContextRef.current.version === context.version && saveContextRef.current.scope === context.scope;
    setWorkspaceState("saving"); setWorkspaceError("");
    let taxWrite: StudioTaxWrite;
    try { taxWrite = await prepareTaxWrite(targetDraft, context.scope, targetServerFingerprint); }
    catch (error) {
      if (!isCurrent()) return;
      setWorkspaceState("error");
      setWorkspaceError(error instanceof Error ? error.message : "The prior tax attachment could not be verified. Keep these edits and reopen the saved case before retrying.");
      return;
    }
    if (!isCurrent()) return;
    if (!taxWrite.current()) {
      setWorkspaceState("error"); setWorkspaceError("The saved-case authority changed before this save. Your edits remain open; reopen the exact saved case before retrying.");
      return;
    }
    try {
      const childFromCurrent = Boolean(targetServerFingerprint && targetServerPublicationFingerprint && targetDraft.parent?.fingerprint === targetServerFingerprint && targetDraft.parent.version !== targetDraft.version);
      const concurrency = targetServerFingerprint && targetServerPublicationFingerprint
        ? childFromCurrent ? { baseFingerprint: targetServerFingerprint, basePublicationFingerprint: targetServerPublicationFingerprint }
          : { expectedFingerprint: targetServerFingerprint, expectedPublicationFingerprint: targetServerPublicationFingerprint } : {};
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, draft: targetDraft, isPrivate: targetPrivate, ...concurrency, taxAttachmentMutation: taxWrite.mutation }) });
      const body = await readStudioSaveResponse(response);
      if (!isCurrent()) return;
      if (response.status === 401) { setWorkspaceState("auth_required"); setWorkspaceError(locale === "en" ? "Your session expired. Your draft remains open. Sign in and retry this save." : "Сессия истекла. Черновик остаётся открытым. Войдите и повторите сохранение."); return; }
      if (!response.ok) {
        const code = isRecord(body) ? body.code : null;
        const message = isRecord(body) && typeof body.error === "string" ? body.error.slice(0, 500) : "";
        setWorkspaceState(code === "profile_required" ? "auth_required" : response.status === 409 && code === "stale_draft" ? "conflict" : "error");
        setWorkspaceError(message || (locale === "en" ? "Save was not confirmed. Your edits are still open; retry when connected." : "Сохранение не подтверждено. Правки остаются открытыми; повторите при наличии связи."));
        return;
      }
      const saved = verifiedStudioSaveReceipt(body, targetDraft, action);
      if (!saved) { setWorkspaceState("error"); setWorkspaceError(locale === "en" ? "The server did not confirm this exact case version. Your edits remain open. Reopen the saved version separately before retrying." : "Сервер не подтвердил эту версию кейса. Правки остаются открытыми. Проверьте сохранённую версию отдельно перед повтором."); return; }
      onWorkspaceSaved?.(saved.protection ? { ...targetDraft, protection: saved.protection } : targetDraft, saved.id);
      setCustomCaseId(saved.id); setPrivate(saved.isPrivate); setCanManagePrivacy(true); setServerFingerprint(saved.fingerprint); setServerPublicationFingerprint(saved.publicationFingerprint);
      if (saved.protection) {
        setDraft(current => current === draftAtStart ? { ...current, protection: saved.protection } : current);
        setCopyProtectionLocked(saved.protection.copyProtected === true);
      }
      setWorkspaceSavedFingerprint(`${studioAIBaseFingerprint(targetDraft)}\u0000${saved.isPrivate ? "private" : "restricted"}`);
      setWorkspaceSavedAt(saved.savedAt);
      setWorkspaceState(action === "submit" ? "submitted" : "saved");
      const currentParams = new URLSearchParams(window.location.search);
      const currentStep = currentParams.get("studio_step") ?? "run_compare";
      window.history.replaceState(window.history.state, "", savedStudioPath(saved.id, currentStep, locale, currentParams.get("studio_panel")));
    } catch {
      if (!isCurrent()) return;
      setWorkspaceState("error"); setWorkspaceError(locale === "en" ? "Connection lost before save confirmation. The save may have completed. Keep this draft open and inspect the saved version separately before retrying." : "Связь прервалась до подтверждения. Сохранение могло завершиться. Оставьте черновик открытым и проверьте сохранённую версию отдельно перед повтором.");
    }
  }

  async function changePrivacy(next: boolean) {
    if (!canManagePrivacy || workspaceState === "saving") return;
    if (next && !window.confirm(locale === "en" ? "Make this case owner-only? Saving this setting revokes every existing share and hides the case from the platform administrator." : "Сделать кейс доступным только владельцу? Сохранение настройки отзовёт приглашения и скроет кейс от администратора платформы.")) return;
    if (!customCaseId) { setPrivate(next); return; }
    const operation = ++saveOperationRef.current;
    const context = saveContextRef.current;
    try {
      const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_privacy", id: customCaseId, isPrivate: next, caseId: draft.caseId }) });
      const body = await readJsonResponse<{ customCase?: { id: number; isPrivate: boolean } }>(response);
      if (!saveMountedRef.current || operation !== saveOperationRef.current || saveContextRef.current.caseId !== context.caseId || saveContextRef.current.scope !== context.scope) return;
      if (!response.ok || body?.customCase?.id !== customCaseId || body.customCase.isPrivate !== next) throw new Error("Visibility was not confirmed");
      setPrivate(next);
      // Visibility does not persist the open draft's content.
      setWorkspaceSavedFingerprint(previous => previous ? previous.split("\u0000")[0] + "\u0000" + (next ? "private" : "restricted") : null);
      setActionNotice(locale === "en" ? "Visibility updated. Save any remaining draft edits separately." : "Видимость обновлена. Несохранённые правки черновика сохраните отдельно.");
    } catch {
      if (!saveMountedRef.current || operation !== saveOperationRef.current || saveContextRef.current.caseId !== context.caseId || saveContextRef.current.scope !== context.scope) return;
      setWorkspaceState("error"); setWorkspaceError(locale === "en" ? "Visibility could not be confirmed. Your draft remains open; retry when connected." : "Не удалось подтвердить видимость. Черновик остаётся открытым; повторите при наличии связи.");
    }
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
    if (taxAttached) return;
    const before = draft;
    const nextDraft = { ...draft, taxEconomics: { ...taxModel, ...change } };
    setDraft(nextDraft);
    syncEconomicPrompt(nextDraft);
    recordVisualEdit("case_updated", locale === "en" ? `Visual edit: changed tax economics ${label}.` : `Визуальная правка: изменено поле налоговой экономики «${label}».`, before);
  }
  function setDealEconomicsChange(change: Partial<NonNullable<StudioDraft["dealEconomics"]>>) {
    if (!editableDealModel) return;
    const nextDeal = { ...editableDealModel, ...(draft.dealEconomics ?? {}), ...change };
    const nextTax = taxDraft && !taxAttached ? applyDealChangeToTaxEconomics(taxModel, nextDeal, change) : draft.taxEconomics;
    const nextDraft = { ...draft, dealEconomics: nextDeal, ...(nextTax ? { taxEconomics: nextTax } : {}) };
    setDraft(nextDraft);
    syncEconomicPrompt(nextDraft);
  }
  async function changeTaxEconomicsCurrency(targetCurrency: string) {
    if (taxAttached) return { ok: false, message: locale === "en" ? "The retained tax analysis requires the shared Rust editor before currency changes." : "Для смены валюты сохранённого налогового анализа нужен редактор на общем движке Rust." };
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
    setGraphPresentation("detail");
    setGraphZoom(1);
    setRelationStatus(locale === "en" ? `Focused node N${String(nodeNumberById.get(nodeId) ?? 0).padStart(2,"0")}.` : `В центре схемы нода N${String(nodeNumberById.get(nodeId) ?? 0).padStart(2,"0")}.`);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const viewport = graphViewportRef.current;
      const nodeButton = document.getElementById(`studio-node-${nodeId}`);
      if (viewport) {
        const scale = 1;
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

  const visibleChecks = displayMode === "developer" ? checks : checks.filter((check) => check.level === "warn");
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
    url.searchParams.delete("studio_panel");
    url.searchParams.set("studio_step", serializedStudioWorkflowStep(step));
    window.history.pushState(window.history.state, "", url);
    setOverviewSelected(false);
    setGuidedStep(step);
  }
  function openOverview() {
    const url = new URL(window.location.href);
    url.searchParams.set("studio_panel", "overview");
    window.history.pushState(window.history.state, "", url);
    setOverviewSelected(true);
  }
  function openOverviewNode(nodeId: string) {
    setGraphPresentation("detail"); setGraphZoom(1);
    selectGuidedStep(4);
    selectGraphNode(nodeId);
    setActionTarget({ step: 4, id: `studio-node-${nodeId}`, nodeId });
  }
  function openStudioAction(target: StudioActionTarget) {
    if (target.developer) changeDisplayMode("developer");
    if (target.nodeId) selectNode(target.nodeId);
    selectGuidedStep(target.step);
    setActionNotice("");
    setActionTarget(target);
  }
  function returnToActions(message = "") {
    changeDisplayMode("user");
    selectGuidedStep(5);
    setActionTarget({ step: 5, id: "studio-next-actions" });
    setActionNotice(message);
  }
  function addConnectedItem(value: { type: StudioNodeType; title: string; detail: string; relatedId: string }) {
    if (!canDuplicate || !value.title || !value.detail || draft.nodes.length >= 200 || draft.links.length >= 500 || !draft.nodes.some(node => node.id === value.relatedId)) return;
    const added = appendConnectedStudioItem(draft, value);
    if (!added) return;
    applyCaseChange(locale === "en" ? "connected case item" : "связанный элемент", added.draft);
    onEvidenceClear(value.type);
    selectNode(added.nodeId);
    returnToActions(locale === "en" ? "Item added to the working draft and connected. Checks are updating; save to workspace to persist it." : "Элемент добавлен в черновик и связан. Проверки обновляются; сохраните кейс в рабочем пространстве.");
  }
  async function changeCaseType(id: CaseTypeId) {
    if (id !== "tax_compliance" && id !== "tax_planning" && draft.nodes.some((node) => node.type === "entity" || node.type === "tax_rule" || node.type === "cash_flow")) {
      setRelationStatus(locale === "en" ? "Tax-specific nodes keep this matter in the Tax & compliance package. Remove or convert those nodes before switching case type." : "Налоговые узлы сохраняют пакет «Налоги и compliance». Удалите или преобразуйте их перед сменой типа кейса.");
      return;
    }
    const { applyCaseType } = await import("./case-type-registry");
    applyCaseChange(locale === "en" ? "case type" : "тип кейса", (current) => applyCaseType(current, id));
  }
  function browseDemos() {
    if (operationPending.current) { setCaseReportStatus(locale === "en" ? "Wait for the current operation before opening Demo." : "Дождитесь завершения операции перед открытием демо."); return; }
    const url = new URL(window.location.href);
    url.searchParams.set("view", "demos");
    url.searchParams.delete("studio_step");
    window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new Event("genesis-studio-navigation"));
    window.dispatchEvent(new Event("genesis-interface-change"));
  }
  function enterEditor() { setEditorOpened(true); }
  if (!editorOpened && displayMode === "user") return <>
    <Suspense fallback={<main className="studio-entry"><p role="status">{locale === "en" ? "Loading your workspace…" : "Загрузка рабочего пространства…"}</p></main>}><StudioEntryScreen locale={locale} savedCasesHref={workspaceDestination("/matters", typeof window === "undefined" ? "/studio" : window.location.pathname + window.location.search + window.location.hash)} recentTitle={draft.title.trim() || (draft.nodes.length || prompt.trim() ? (locale === "en" ? "Untitled case" : "Кейс без названия") : "")}
      onCreate={() => { if (startBlankDraft()) setEditorOpened(true); }} onImport={() => importRef.current?.click()} onDemo={startExampleDraft} onBrowseDemos={browseDemos} onContinue={enterEditor}/></Suspense>
    <input ref={importRef} className="visually-hidden" type="file" accept=".json,.md,.txt,application/json,text/markdown,text/plain" aria-label={locale === "en" ? "Import case or prompt" : "Импортировать кейс или промпт"} onChange={(event) => { const file = event.target.files?.[0]; if (file) { enterEditor(); void loadStudioFile(file); } event.target.value = ""; }}/>
  </>;
  const portableStudioActions = <Suspense fallback={null}><StudioUserMoreActions grouped={displayMode === "user"} locale={locale} canDuplicate={canDuplicate} exportReady={derivationsSettled && Boolean(draft.title.trim()) && Boolean(draft.nodes.length)} feedbackLabel={text.feedback} importLabel={text.importCustom} exportLabel={text.exportCustom} startExample={browseDemos} startTax={startTaxTemplate} requestFeedback={requestFeedback} importJson={()=>importRef.current?.click()} exportJson={exportDraft} saveDevice={saveDraft} markdownLoaded={loadCasePrompt} markdownOpened={()=>{setCaseReportStatus("");setCaseMarkdownOpen(true);}} markdownFailed={setCaseReportStatus}/></Suspense>;
  const reportUnavailable = !canDuplicate || !draft.title.trim() || !draft.nodes.length;
  const reportRequirements = <>
    <p role="status">{!canDuplicate
      ? (locale === "en" ? "PDF reports are unavailable in inspection-only mode. Ask the case owner for an editable working copy." : "PDF-отчёты недоступны в режиме просмотра. Запросите у владельца редактируемую рабочую копию.")
      : !draft.title.trim() && !draft.nodes.length
        ? (locale === "en" ? "PDF reports need a case title and at least one case record. Add a title, then use the case brief to create structured content; brief text alone is not included as a case record." : "Для PDF-отчёта нужны название кейса и хотя бы одна запись. Добавьте название, затем создайте структуру из описания кейса; сам текст описания не является записью.")
        : !draft.title.trim()
          ? (locale === "en" ? "Add a case title before creating a PDF report. Your existing case records remain available." : "Добавьте название кейса перед созданием PDF-отчёта. Существующие записи кейса сохранены в черновике.")
          : (locale === "en" ? "PDF reports need at least one case record, such as a fact or decision. Use the case brief to create structured content, then return to Reports." : "Для PDF-отчёта нужна хотя бы одна запись, например факт или решение. Создайте структуру из описания кейса, затем вернитесь в «Отчёты».")}</p>
    {canDuplicate && !draft.title.trim() && <button type="button" className="secondary-cta" onClick={() => openStudioAction({ step: 3, id: "studio-title" })}>{locale === "en" ? "Add case title" : "Добавить название кейса"}</button>}
    {canDuplicate && !draft.nodes.length && <button type="button" className="secondary-cta" onClick={() => openStudioAction({ step: 1, id: "studio-case-brief" })}>{locale === "en" ? "Open case brief" : "Открыть описание кейса"}</button>}
  </>;
    return <main className={`studio-view studio-${displayMode}-view studio-guided-step-${guidedStep} ${canDuplicate ? "" : "studio-inspection-view"}`} data-readonly={!canDuplicate || undefined}>
      <section className="studio-hero studio-compact-hero page-width">
        <div>
          <div className="studio-case-breadcrumb"><button type="button" onClick={() => { const url = new URL(window.location.href); url.searchParams.delete("studio_step"); url.searchParams.delete("studio_panel"); window.history.pushState(window.history.state, "", url); setOverviewSelected(false); setEditorOpened(false); }}>{locale === "en" ? "Case Studio" : "Студия кейсов"}</button><span aria-hidden="true">/</span><span>{locale === "en" ? "Working draft" : "Рабочий черновик"}</span></div>
          <h1>{draft.title.trim() || (locale === "en" ? "Describe your case" : "Опишите свой кейс")}</h1>
          <p id="studio-save-status" className="studio-save-status" role="status">
            <span>{locale === "en" ? "Studio draft" : "Черновик Studio"} · </span>
            <strong>{visibleWorkspaceState === "saving" ? (locale === "en" ? "Saving…" : "Сохранение…")
              : visibleWorkspaceState === "saved" || visibleWorkspaceState === "submitted" ? (locale === "en" ? "Saved to workspace" : "Сохранено в workspace")
              : visibleWorkspaceState === "conflict" ? (locale === "en" ? "Save conflict — edits remain open" : "Конфликт сохранения — правки открыты")
              : visibleWorkspaceState === "error" ? (locale === "en" ? "Save not confirmed" : "Сохранение не подтверждено")
              : (locale === "en" ? "Not saved to workspace" : "Не сохранено в workspace")}</strong>
            {(visibleWorkspaceState === "saved" || visibleWorkspaceState === "submitted") && workspaceSavedAt && <> · <time dateTime={workspaceSavedAt}>{new Date(workspaceSavedAt).toLocaleString(locale === "en" ? "en-GB" : "ru-RU")}</time></>}
            <span> · {visibleWorkspaceState === "submitted" ? (locale === "en" ? "Submitted for review" : "Отправлено на проверку") : (locale === "en" ? "Human approval is separate" : "Утверждение человеком — отдельно")}</span>
            {aiEntitlement === "anonymous" && <span className="studio-guest-save-hint">{locale === "en" ? "Sign in to save. Current edits remain in this tab; workspace and device saving require a verified account." : "Войдите для сохранения. Текущие правки остаются в этой вкладке; сохранение в workspace и на устройстве требует подтверждённого аккаунта."}</span>}
          </p>
          {hasStudioEvidenceInput(evidenceBuffers) && <aside className="studio-evidence-pending" role="status"><p>{locale === "en" ? "Unadded working items remain in this tab. They are not included in case saves or reports until you add them." : "В этой вкладке остались недобавленные рабочие элементы. Они не включаются в сохранённый кейс и отчёты, пока вы их не добавите."}</p>{(Object.keys(evidenceBuffers) as StudioNodeType[]).filter(type => hasStudioEvidenceInput({ [type]: evidenceBuffers[type] })).map(type => <button key={type} type="button" className="secondary-cta" onClick={() => openStudioAction({ step: 3, id: "studio-evidence-composer", nodeType: type })}>{locale === "en" ? `Continue ${text.nodeTypes[type].toLowerCase()} item` : `Продолжить элемент: ${text.nodeTypes[type].toLowerCase()}`}</button>)}</aside>}
          <details className="studio-technical-controls"><summary>{locale === "en" ? "Technical view" : "Технический вид"}</summary><label className="studio-view-select"><span>{locale === "en" ? "View" : "Вид"}</span><select aria-label={locale === "en" ? "Studio view" : "Вид Студии"} value={displayMode} onChange={event => changeDisplayMode(event.target.value as "user" | "developer")}><option value="user">{locale === "en" ? "User view" : "Вид пользователя"}</option><option value="developer">{locale === "en" ? "Developer view" : "Вид разработчика"}</option></select></label></details>
        </div>
        <div className="studio-actions">
          <button className="secondary-cta" onClick={startBlankDraft}><Icon name="reset"/>{text.newDraft}</button>
          <button className="secondary-cta" onClick={() => shareDraft("save")} disabled={!canDuplicate || !draftWithinEnvelope || !derivationsSettled || workspaceState === "saving"}><Icon name="save"/>{workspaceState === "saving" ? (locale === "en" ? "Saving…" : "Сохранение…") : (locale === "en" ? "Save to workspace" : "Сохранить в workspace")}</button>
          <button className="secondary-cta report-cta" disabled={!canDuplicate || !draft.title.trim() || !draft.nodes.length} aria-describedby={reportUnavailable ? "studio-report-requirements" : undefined} onClick={() => void openCaseReport()} title={locale === "en" ? "Preview a preliminary report; independent approval is separate" : "Предпросмотр предварительного отчёта; независимое утверждение выполняется отдельно"}><Icon name="download"/>{locale === "en" ? "Create analytical report" : "Сформировать аналитический отчёт"}</button>
          {displayMode === "developer" && <button className="primary-cta" onClick={() => shareDraft("submit")} disabled={Boolean(submitBlocker) || workspaceState === "saving"} title={submitBlocker || undefined} aria-describedby={submitBlocker ? "studio-submit-blocker" : undefined}><Icon name="check"/>{locale === "en" ? "Submit for review" : "Отправить на рецензию"}</button>}
          {displayMode === "developer" ? portableStudioActions : <details ref={moreActionsRef} className="studio-more-actions"><summary><Icon name="plus"/>{locale === "en" ? "More actions" : "Другие действия"}</summary>{portableStudioActions}</details>}
          <input ref={importRef} className="visually-hidden" type="file" accept=".json,.md,.txt,application/json,text/markdown,text/plain" onChange={(event) => { const file=event.target.files?.[0]; if(file) void loadStudioFile(file); event.target.value=""; }}/>
        </div>
        {reportUnavailable && <aside id="studio-report-requirements" className="studio-evidence-pending">{reportRequirements}</aside>}
        {submitBlocker && displayMode === "developer" && <p id="studio-submit-blocker" className="studio-submit-blocker"><Icon name="alert"/><span>{submitBlocker}</span>{derivationError && <button type="button" onClick={() => { setDerivationError(false); setDerivationAttempt((attempt) => attempt + 1); }}>{locale === "en" ? "Retry check" : "Повторить проверку"}</button>}{isPrivate && submitBlocker !== firstSubmissionWarning && <button type="button" onClick={() => document.getElementById("studio-case-settings")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{locale === "en" ? "Change visibility" : "Изменить видимость"}</button>}{firstSubmissionWarning && submitBlocker === firstSubmissionWarning && <button type="button" onClick={() => document.getElementById("studio-checks")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{locale === "en" ? "Review issue" : "Перейти к замечанию"}</button>}</p>}
        {savedFlash && <div className="save-toast"><Icon name="check"/>{text.saved}</div>}
        {caseReportStatus && <div className="save-toast report-toast" role="status"><Icon name="check"/>{caseReportStatus}</div>}
        {visibleWorkspaceState !== "idle" && <div className={`workspace-toast ${visibleWorkspaceState}`} role={visibleWorkspaceState === "error" || visibleWorkspaceState === "conflict" ? "alert" : "status"}>
          {workspaceError || (visibleWorkspaceState === "saving" ? (locale === "en" ? "Saving this case version…" : "Сохраняется эта версия кейса…") : visibleWorkspaceState === "saved" ? (locale === "en" ? "Case saved to your workspace." : "Кейс сохранён в workspace.") : visibleWorkspaceState === "submitted" ? (locale === "en" ? "Case saved and submitted for review." : "Кейс сохранён и отправлен на рецензию.") : visibleWorkspaceState === "conflict" ? (locale === "en" ? "A newer saved version exists. Your edits remain open; inspect the saved version before retrying." : "Существует более новая версия. Ваши правки открыты; проверьте сохранённую версию перед повтором.") : visibleWorkspaceState === "auth_required" ? (locale === "en" ? "Sign in or complete your profile, then return to save this case." : "Войдите или заполните профиль, затем вернитесь для сохранения.") : (locale === "en" ? "This case could not be saved. Your draft remains open." : "Не удалось сохранить кейс. Черновик остаётся открытым."))}
          {visibleWorkspaceState === "auth_required" && (accountTabNeeded ? <a href="/account" target="_blank" rel="noopener noreferrer">{locale === "en" ? "Open Account in another tab" : "Открыть Аккаунт в другой вкладке"}</a> : <button type="button" onClick={() => openWorkspaceAuthorization(pendingAuthActionRef.current)}>{locale === "en" ? "Continue to Account" : "Продолжить через Аккаунт"}</button>)}
          {["error", "conflict", "auth_required"].includes(visibleWorkspaceState) && <button type="button" onClick={() => void shareDraft(pendingAuthActionRef.current)}>{locale === "en" ? "Retry save" : "Повторить сохранение"}</button>}
          {customCaseId && ["conflict", "error", "saved", "submitted"].includes(visibleWorkspaceState) && <a href={savedStudioPath(customCaseId, "run_compare", locale)} target="_blank" rel="noopener noreferrer">{locale === "en" ? "Inspect saved version in another tab" : "Проверить сохранённую версию в другой вкладке"}</a>}
        </div>}
      </section>
    {!canDuplicate && <aside className="studio-readonly-notice page-width" role="status"><Icon name="file"/><div><b>{locale === "en" ? "Inspection-only case" : "Кейс только для просмотра"}</b><p>{locale === "en" ? "You can inspect the graph and rules, but this protected case cannot be edited, copied, exported or saved. Start a blank draft or open the worked example to author a separate case." : "Вы можете изучать схему и правила, но этот защищённый кейс нельзя редактировать, копировать, экспортировать или сохранять. Создайте новый черновик или откройте учебный пример для отдельной работы."}</p></div></aside>}
    <aside className="confidentiality-notice page-width"><Icon name="alert"/><p>{locale === "en" ? "Confidentiality: do not enter client-identifiable, privileged, personal or secret information. Use synthetic or de-identified facts and public legal sources." : "Конфиденциальность: не вводите сведения, идентифицирующие клиента, адвокатскую тайну, персональные данные или секреты. Используйте синтетические или обезличенные факты и публичные источники права."}</p></aside>
    {(displayMode === "developer" || !draftWithinEnvelope) && <div className={`draft-envelope page-width ${draftWithinEnvelope ? "" : "limit"}`} role={draftWithinEnvelope ? undefined : "alert"}><span>{locale === "en" ? "Studio case envelope" : "Объём кейса Studio"}</span><progress max={STUDIO_DRAFT_SERIALIZED_LIMIT} value={Math.min(draftBytes, STUDIO_DRAFT_SERIALIZED_LIMIT)}/><b>{Math.ceil(draftBytes / 1_000).toLocaleString()} / 900 KB</b>{!draftWithinEnvelope && <em>{locale === "en" ? "Shorten node or relation details before AI, workspace save or submission." : "Сократите описания узлов или связей перед AI-анализом, сохранением или отправкой."}</em>}</div>}
    {displayMode === "user" && !trainingWorkflow && <StudioWorkspaceTabs locale={locale} activeStep={guidedStep} overview={showOverview} onOverview={openOverview} onStep={selectGuidedStep}/>}
    {showOverview && <Suspense fallback={<p role="status">{locale === "en" ? "Opening case overview…" : "Открывается обзор дела…"}</p>}><StudioOverview draft={draft} locale={locale} onStep={selectGuidedStep} onNode={openOverviewNode} onAction={openStudioAction}/></Suspense>}
    {displayMode === "user" && trainingWorkflow && <Suspense fallback={null}><StudioGuidedWizard locale={locale} activeStep={guidedStep} playableRoute={packageRequiresPlayableRoute} readiness={guidedReadiness} caseName={draft.title} saveState={visibleWorkspaceState} validationReady={validationReady} onStepChange={selectGuidedStep} onFocusBrief={() => document.getElementById("studio-case-brief")?.focus()} onStartExample={startExampleDraft} onBrowseDemos={() => { if (operationPending.current) return; const url = new URL(window.location.href); url.searchParams.set("view", "demos"); window.history.pushState(window.history.state, "", url); window.dispatchEvent(new Event("genesis-studio-navigation"));
    window.dispatchEvent(new Event("genesis-interface-change")); }} onImport={() => importRef.current?.click()}/></Suspense>}
    {visibleStep === 3 && displayMode === "user" && !trainingWorkflow && <Suspense fallback={null}><StudioSourcesPanel draft={draft} locale={locale} onStep={selectGuidedStep} onNode={openOverviewNode} onAction={openStudioAction}/></Suspense>}
    {displayMode === "user" && timeline.revisions.length > 0 && <section className="studio-user-undo page-width" aria-label={locale === "en" ? "Recent changes" : "Последние изменения"} inert={!canDuplicate}><div><Icon name="file"/><span>{locale === "en" ? `${timeline.cursor} draft change${timeline.cursor === 1 ? "" : "s"} in this session` : `Изменений в этой сессии: ${timeline.cursor}`}</span></div><div><button onClick={undoDraft} disabled={timeline.cursor === 0 || !canDuplicate}><Icon name="arrow"/>{locale === "en" ? "Undo" : "Отменить"}</button><button onClick={redoDraft} disabled={timeline.cursor >= timeline.revisions.length || !canDuplicate}>{locale === "en" ? "Redo" : "Повторить"}<Icon name="arrow"/></button></div></section>}
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
    {(displayMode === "developer" || visibleStep === 1) && <section className="prompt-deck page-width" inert={!canDuplicate}>
      <div className="prompt-label"><span>{locale === "en" ? "Describe the case or the change you need" : "Опишите кейс или нужное изменение"}</span>{displayMode === "developer" && <code>AI PLAN · REVIEW · APPLY</code>}</div>
      <textarea id="studio-case-brief" value={prompt} maxLength={STUDIO_PROMPT_CHARACTER_LIMIT} placeholder={locale === "en" ? "Describe, paste, or load a canonical .md case." : "Опишите, вставьте или загрузите канонический .md кейс."} onPaste={(event) => { const input=event.currentTarget; const finalLength=input.value.length-(input.selectionEnd-input.selectionStart)+event.clipboardData.getData("text").length; if(finalLength>STUDIO_PROMPT_CHARACTER_LIMIT)setPromptLimitNotice(true); }} onChange={(event) => { aiAbortRef.current?.abort(); setAIState("idle"); setAIResult(null); setCanonicalCandidate(null); setAIError(""); if(event.target.value.length<STUDIO_PROMPT_CHARACTER_LIMIT)setPromptLimitNotice(false); setPrompt(event.target.value); }} aria-label={text.prompt}/>
      {(displayMode === "developer" || promptLimitNotice) && <div className={`prompt-counter ${promptLimitNotice ? "limit" : ""}`} role={promptLimitNotice ? "alert" : undefined}><span>{prompt.length.toLocaleString()} / 64,000 {locale === "en" ? "characters" : "символов"}</span>{promptLimitNotice && <b>{locale === "en" ? "The text exceeds 64,000 characters." : "Текст превышает 64 000 символов."}</b>}</div>}
      <div className="prompt-actions">
        {canonicalCandidate
          ? <Suspense fallback={null}><CanonicalReadyAction locale={locale} review={() => document.getElementById("canonical-case-review")?.scrollIntoView({behavior:"smooth",block:"start"})}/></Suspense>
          : activeAIResult
            ? <button className="generate-button" onClick={() => document.getElementById("ai-plan-review")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon name="file" size={24}/><span>{locale === "en" ? "Review the AI proposal below" : "Проверьте AI-предложение ниже"}<small>{locale === "en" ? "Applying is available only after the complete operation list" : "Кнопка применения находится после полного списка операций"}</small></span><Icon name="arrow"/></button>
          : canonicalPrompt
            ? <Suspense fallback={null}><CanonicalPromptAction locale={locale} analysing={aiState === "analysing"} disabled={!prompt.trim() || aiState === "analysing" || !canDuplicate || !draftWithinEnvelope || !derivationsSettled} verify={() => { if (displayMode === "user") selectGuidedStep(2); void analysePromptWithAI(); }}/></Suspense>
          : aiEntitlement === "ready"
            ? <button className="generate-button" disabled={!prompt.trim() || aiState === "analysing" || !canDuplicate || !draftWithinEnvelope || !derivationsSettled} onClick={() => { if (displayMode === "user") selectGuidedStep(2); void analysePromptWithAI(); }}><Icon name="spark" size={24}/><span>{aiState === "analysing" ? (locale === "en" ? "AI is mapping the case…" : "AI строит смысловую схему…") : !derivationsSettled ? (locale === "en" ? "Finishing the latest edit…" : "Завершается последняя правка…") : (locale === "en" ? "Understand with AI" : "Понять и структурировать с AI")}<small>{locale === "en" ? "First create a reviewable proposal; nothing is changed yet" : "Сначала создаётся план для проверки; схема пока не меняется"}</small></span><Icon name="arrow"/></button>
            : aiEntitlement === "anonymous"
              ? <button className="generate-button" onClick={() => openStudioAccess()}><Icon name="person" size={24}/><span>{locale === "en" ? "Sign in to use AI" : "Войдите для работы с AI"}<small>{locale === "en" ? "Return to this prompt and case in the same tab" : "Вернитесь к этому промпту и кейсу в той же вкладке"}</small></span><Icon name="arrow"/></button>
              : aiEntitlement === "profile_required"
                ? <button className="generate-button" onClick={() => openStudioAccess(true)}><Icon name="person" size={24}/><span>{locale === "en" ? "Confirm your profile to use AI" : "Подтвердите профиль для работы с AI"}<small>{locale === "en" ? "Name and role only; then return to your case" : "Только имя и роль — затем возврат к кейсу"}</small></span><Icon name="arrow"/></button>
                : aiEntitlement === "not_configured"
                  ? <button className="generate-button" disabled><Icon name="spark" size={24}/><span>{locale === "en" ? "AI assistant is awaiting activation" : "AI-ассистент ожидает активации"}<small>{locale === "en" ? "The safe rule-based builder remains available; no data is sent" : "Безопасный локальный конструктор доступен; данные никуда не отправляются"}</small></span><Icon name="arrow"/></button>
                  : <button className="generate-button" disabled><Icon name="spark" size={24}/><span>{aiEntitlement === "loading" ? (locale === "en" ? "Checking AI access…" : "Проверка доступа к AI…") : (locale === "en" ? "AI access status is unavailable" : "Статус AI временно недоступен")}<small>{locale === "en" ? "The local case builder remains available" : "Локальный конструктор кейса остаётся доступен"}</small></span><Icon name="arrow"/></button>}
        {activeAIResult && <button className="rebuild-button" onClick={analysePromptWithAI} disabled={aiState === "analysing"}><Icon name="spark"/>{locale === "en" ? "Analyse again" : "Проанализировать снова"}</button>}
        {!canonicalPrompt && (displayMode === "developer" || userLocalFallback) && <button className="rebuild-button" disabled={!promptDerivationsSettled || !promptPlan.canApply || !canDuplicate} onClick={() => { applyPromptIteration(); if (displayMode === "user") selectGuidedStep(3); }}><Icon name="file"/>{displayMode === "developer" ? (locale === "en" ? "Use exact commands" : "Применить точные команды") : promptPlan.contextOnly ? (locale === "en" ? "Add this text to case context" : "Добавить текст в контекст кейса") : (locale === "en" ? "Apply locally interpreted changes" : "Применить локально распознанные изменения")}</button>}
        {!canonicalPrompt && draft.nodes.length === 0 && (displayMode === "developer" || userLocalFallback) && <button className="rebuild-button" disabled={!prompt.trim() || !canDuplicate} onClick={() => { if (window.confirm(locale === "en" ? "Use the rule-based eight-node fallback instead of AI?" : "Использовать шаблон из восьми узлов вместо AI?")){ clearTransientEditorSelection(); generateDraft(); if (displayMode === "user") selectGuidedStep(3); } }}><Icon name="reset"/>{locale === "en" ? "Quick rule-based template" : "Быстрый шаблон по правилам"}</button>}
      </div>
      <Suspense fallback={null}><StudioPromptPrivacyNote locale={locale} canonical={canonicalPrompt}/></Suspense>
    </section>}
    {(displayMode === "developer" || visibleStep === 2) && canonicalCandidate && <Suspense fallback={null}><CanonicalMarkdownReview locale={locale} draft={canonicalCandidate.draft} fingerprint={canonicalCandidate.fingerprint} status={canonicalCandidate.status} apply={() => { if (!applyCanonicalMarkdownDraft(canonicalCandidate.draft)) return; setCanonicalCandidate(null); setAIState("idle"); setAIError(""); if (displayMode === "user") selectGuidedStep(3); }}/></Suspense>}
    {displayMode === "user" && visibleStep === 2 && userLocalFallback && !activeAIResult && prompt.trim() && promptDerivationsSettled && <section className={`simple-plan-preview page-width ${promptPlan.canApply ? "ready" : "blocked"}`}><header><div><span>{locale === "en" ? "Local fallback · review before applying" : "Локальный резервный режим · проверьте перед применением"}</span><b>{promptPlan.contextOnly ? (locale === "en" ? "This will only add text to the case context; it will not create nodes" : "Будет дополнен только контекст кейса; новые узлы не появятся") : (locale === "en" ? `${promptPlan.operations.length} proposed change${promptPlan.operations.length === 1 ? "" : "s"}` : `Предложено изменений: ${promptPlan.operations.length}`)}</b></div><small>{locale === "en" ? "No information is sent outside the application" : "Информация не отправляется за пределы приложения"}</small></header>{promptPlan.operations.length > 0 && <ol>{promptPlan.operations.map((operation,index)=><li key={`${operation.kind}-${index}`}><span aria-hidden="true">{index+1}</span><p>{describeStudioPromptOperation(operation,locale,simplePlanNodeTitles,{showIds:false,linkEndpoints:reviewLinkEndpoints})}</p></li>)}</ol>}{promptPlan.diagnostics.length > 0 && <ul>{promptPlan.diagnostics.map((diagnostic,index)=><li key={`${diagnostic.level}-${index}`} className={diagnostic.level}>{diagnostic.message}</li>)}</ul>}</section>}
    {(displayMode === "developer" || visibleStep === 2) && prompt.trim() && aiState === "analysing" && <Suspense fallback={<section className="prompt-ai-status prompt-ai-progress page-width analysing" role="status"><Icon name="spark"/><div className="ai-progress-body"><b>{locale === "en" ? "Reading and structuring the case…" : "Кейс анализируется и структурируется…"}</b><progress className="ai-progress-fallback" max={100} value={8}/></div></section>}><StudioAIProgress locale={locale}/></Suspense>}
    {(displayMode === "developer" || visibleStep === 2) && prompt.trim() && aiState === "error" && <section className="prompt-ai-status page-width error" role="alert"><Icon name="alert"/><div><b>{locale === "en" ? "No changes were made" : "Изменения не внесены"}</b><p>{aiError}</p><small>{displayMode === "developer" ? (locale === "en" ? "Retry AI analysis or inspect the exact-command preview below." : "Повторите AI-анализ или проверьте точный командный план ниже.") : (locale === "en" ? "Go back to the brief to retry AI analysis or apply the safe local interpretation." : "Вернитесь к описанию, чтобы повторить AI-анализ или применить безопасную локальную интерпретацию.")}</small></div></section>}
    {(displayMode === "developer" || visibleStep === 2) && activeAIResult && <Suspense fallback={<section className="prompt-ai-status page-width" role="status"><Icon name="spark"/><div><b>{locale === "en" ? "Preparing the proposed scheme…" : "Подготавливается предлагаемая схема…"}</b></div></section>}><StudioAIReview locale={locale} draft={draft} plan={activeAIResult.plan} nodeTitles={aiNodeTitles} linkEndpoints={reviewLinkEndpoints} nodeLabels={text.nodeTypes} applyEnabled={canDuplicate && aiState !== "analysing"} showTechnicalIds={displayMode === "developer"} onApply={applyActiveAIPlan}/></Suspense>}
    {displayMode === "developer" && !canonicalPrompt && prompt.trim() && <details className="prompt-fallback-preview page-width"><summary>{locale === "en" ? "Exact-command fallback preview" : "План точных команд — резервный режим"}</summary>{promptDerivationsSettled && <section className={`prompt-plan ${promptPlan.canApply ? "ready" : "blocked"}`}><header><div><span>{locale === "en" ? "Rule-based interpretation" : "Интерпретация по правилам"}</span><h2>{promptPlan.contextOnly ? (locale === "en" ? "Context-only turn" : "Только контекст") : (locale === "en" ? `${promptPlan.operations.length} exact operation${promptPlan.operations.length === 1 ? "" : "s"}` : `Точных операций: ${promptPlan.operations.length}`)}</h2></div><b>{promptPlan.canApply ? "READY" : "REVIEW"}</b></header>{promptPlan.operations.length > 0 && <ol>{promptPlan.operations.map((operation, index) => <li key={`${operation.kind}-${index}`}><code>{String(index + 1).padStart(2,"0")}</code><span>{describeStudioPromptOperation(operation, locale)}</span></li>)}</ol>}{promptPlan.diagnostics.length > 0 && <ul>{promptPlan.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.level}-${index}`} className={diagnostic.level}><Icon name={diagnostic.level === "error" ? "alert" : "check"}/>{diagnostic.message}</li>)}</ul>}</section>}</details>}
    {actionTarget && actionTarget.id !== "studio-next-actions" && <div className="action-return page-width"><button type="button" onClick={() => returnToActions()}>{locale === "en" ? "← Back to case actions" : "← Вернуться к действиям"}</button><span>{locale === "en" ? "Changes stay in the working draft; save to workspace when ready." : "Изменения остаются в черновике; затем сохраните кейс в рабочем пространстве."}</span></div>}
    {actionNotice && <p className="action-notice page-width" role="status">{actionNotice}</p>}
    {displayMode === "user" && visibleStep === 5 && <Suspense fallback={<p role="status">Checking actions…</p>}><StudioActionPanel draft={draft} checks={checks} locale={locale} checking={!derivationsSettled} canEdit={canDuplicate} onOpen={openStudioAction} onReport={() => void openCaseReport()} onSave={() => void shareDraft("save")} saved={visibleWorkspaceState === "saved" || visibleWorkspaceState === "submitted"} saving={workspaceState === "saving"} withinEnvelope={draftWithinEnvelope}/></Suspense>}
    {visibleStep === 3 && actionTarget?.nodeType && <Suspense fallback={null}><StudioEvidenceComposer draft={draft} type={actionTarget.nodeType} locale={locale} canEdit={canDuplicate} value={evidenceBuffers[actionTarget.nodeType] ?? emptyStudioEvidenceInput()} onChange={patch => onEvidenceChange(actionTarget.nodeType!, patch)} onClear={() => onEvidenceClear(actionTarget.nodeType!)} onSave={addConnectedItem}/></Suspense>}
    {(displayMode === "developer" || visibleStep === 3) && <><details id="studio-case-settings" className="studio-settings-stack studio-settings-disclosure page-width" open={displayMode === "developer" || trainingWorkflow ? true : undefined}><summary>{locale === "en" ? "Case settings & context" : "Настройки и контекст дела"}</summary><Suspense fallback={null}><StudioCaseTypeSelector locale={locale} value={draft.caseType} disabled={!canDuplicate} onChange={changeCaseType}/><StudioCasePlaybook locale={locale} draft={draft} phase="intake"/></Suspense>
    <section className="studio-meta page-width" inert={!canDuplicate}>
      <label><span>{text.title}</span><input id="studio-title" value={draft.title} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,title:event.target.value}))} onBlur={(event)=>commitCaseField(text.title,event.currentTarget.value)}/></label>
      <label><span>{text.jurisdiction}</span><input id="studio-jurisdiction" value={draft.jurisdiction} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,jurisdiction:event.target.value}))} onBlur={(event)=>commitCaseField(text.jurisdiction,event.currentTarget.value)}/></label>
      <label><span>{text.role}</span><input id="studio-role" value={draft.role} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,role:event.target.value}))} onBlur={(event)=>commitCaseField(text.role,event.currentTarget.value)}/></label>
      <div className="studio-context-field"><label htmlFor="studio-publishable-context">{locale === "en" ? "Publishable case context" : "Публикуемый контекст кейса"}</label><textarea id="studio-publishable-context" maxLength={8000} value={draft.premise} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,premise:event.target.value,premisePublication:"author-reviewed"}))} onBlur={(event)=>commitCaseField(locale === "en" ? "case context" : "контекст кейса",event.currentTarget.value)}/><small>{locale === "en" ? "This context is included in case reports. Verify it before review or sharing; the raw AI prompt is kept out of published artifacts." : "Этот контекст включается в отчёты по делу. Проверьте его перед рецензией или передачей; исходный AI-промпт не публикуется."}</small><button type="button" className="secondary-cta" disabled={!canDuplicate || !draft.premise.trim()} onClick={() => { applyCaseChange("reviewed context", current => ({ ...current, premisePublication: "author-reviewed" })); returnToActions(locale === "en" ? "Case context confirmed in the working draft." : "Контекст подтверждён в черновике."); }}>{locale === "en" ? "Confirm context and return to actions" : "Подтвердить контекст и вернуться"}</button></div>
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
          ...(hasTaxAttachment(current) ? {} : tax ? { taxEconomics: current.taxEconomics ?? defaultTaxEconomics(current.dealEconomics?.currency ?? inferredDealModel?.currency ?? "EUR") } : { taxEconomics: undefined }),
        }));
      }}><option value="general">{locale === "en" ? "General legal" : "Общеправовой"}</option><option value="tax">{locale === "en" ? "Tax / cross-border structuring" : "Налоги / трансграничное структурирование"}</option></select></label>
      <label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={draft.classification?.practiceArea ?? "General legal"} onChange={(event) => applyCaseChange(locale === "en" ? "practice area" : "область практики", (current) => ({ ...current, classification: { ...(current.classification ?? { difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), practiceArea: event.target.value } }))}><option value="General legal">{locale === "en" ? "General legal" : "Общая юридическая практика"}</option><option value="International tax planning">{locale === "en" ? "International tax planning" : "Международное налоговое планирование"}</option><option value="Corporate tax">{locale === "en" ? "Corporate tax" : "Корпоративные налоги"}</option><option value="Transfer pricing">{locale === "en" ? "Transfer pricing" : "Трансфертное ценообразование"}</option><option value="Commercial disputes">{locale === "en" ? "Commercial disputes" : "Коммерческие споры"}</option><option value="AI regulation">{locale === "en" ? "AI regulation" : "Регулирование ИИ"}</option><option value="Privacy & cybersecurity">{locale === "en" ? "Privacy & cybersecurity" : "Приватность и кибербезопасность"}</option></select></label>
      {trainingWorkflow && <label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={draft.classification?.difficulty ?? "Intermediate"} onChange={(event) => applyCaseChange(locale === "en" ? "difficulty" : "сложность", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", tags: [], taxTopics: [], complianceOnly: true }), difficulty: event.target.value } }))}><option value="Foundation">{locale === "en" ? "Foundation" : "Базовый"}</option><option value="Intermediate">{locale === "en" ? "Intermediate" : "Средний"}</option><option value="Advanced">{locale === "en" ? "Advanced" : "Продвинутый"}</option><option value="Expert">{locale === "en" ? "Expert" : "Экспертный"}</option></select></label>}
      {taxDraft && <><label><span>{locale === "en" ? "Tax-case purpose" : "Цель налогового кейса"}</span><select value={draft.classification?.purpose ?? "compliance_review"} onChange={(event) => applyCaseChange(locale === "en" ? "tax-case purpose" : "цель налогового кейса", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), purpose: event.target.value as NonNullable<StudioDraft["classification"]>["purpose"] } }))}><option value="lawful_planning">{locale === "en" ? "Lawful planning" : "Законное планирование"}</option><option value="compliance_review">{locale === "en" ? "Compliance review" : "Проверка соответствия"}</option><option value="audit_defence">{locale === "en" ? "Audit defence" : "Защита при проверке"}</option><option value="evasion_detection">{locale === "en" ? "Evasion detection" : "Выявление уклонения"}</option></select></label>
      </>}<label><span>{locale === "en" ? "Law / guidance as of" : "Право / guidance на дату"}</span><input id="studio-legal-date" type="date" value={draft.classification?.legalAsOf ?? ""} onChange={(event) => applyCaseChange(locale === "en" ? "legal as-of date" : "дату актуальности права", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), legalAsOf: event.target.value } }))}/></label>
      <label className="wide-field"><span>{locale === "en" ? "Tags · comma separated" : "Теги · через запятую"}</span><input value={(draft.classification?.tags ?? []).join(", ")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", taxTopics: [], complianceOnly: true }), tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "tags" : "теги", event.currentTarget.value)}/></label>
      {taxDraft && <><label className="wide-field"><span>{locale === "en" ? "Tax topics · treaty, CFC, PE, WHT, DAC6…" : "Налоговые темы · treaty, CFC, PE, WHT, DAC6…"}</span><input value={(draft.classification?.taxTopics ?? []).join(", ")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], complianceOnly: true }), taxTopics: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "tax topics" : "налоговые темы", event.currentTarget.value)}/></label>
      </>}<label className="source-field"><span>{locale === "en" ? "HTTPS legal sources · one per line" : "HTTPS-источники права · по одному в строке"}</span><textarea id="studio-source-urls" rows={3} value={(draft.classification?.sourceUrls ?? []).join("\n")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), sourceUrls: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "legal sources" : "источники права", event.currentTarget.value)}/></label>
      {taxDraft && <div id="studio-compliance" className="compliance-gate"><label><input type="checkbox" checked={draft.classification?.complianceOnly === true} onChange={event => applyCaseChange("compliance control", current => ({ ...current, classification: { ...current.classification!, complianceOnly: event.target.checked } }))}/><span>{locale === "en" ? "Enable lawful-planning controls" : "Включить контроль законности"}</span></label><Icon name="check"/><div><b>{locale === "en" ? "International tax safety & publication gate" : "Контроль безопасности и публикации налогового кейса"}</b><p>{locale === "en" ? "Lawful-planning, compliance, audit-defence and evasion-detection scenarios may model risky facts. Publication requires named reviewer confirmation that the case does not enable concealment, sham substance, false reporting or evasion; HTTPS sources and a legal as-of date are mandatory." : "Кейсы о законном планировании, compliance, налоговом споре и выявлении уклонения могут моделировать рискованные факты. Для публикации именная рецензия должна подтвердить, что кейс не помогает сокрытию, фиктивной substance, ложной отчётности или уклонению; HTTPS-источники и дата актуальности права обязательны."}</p></div></div>}
    </section>
    <section className={`studio-access page-width ${isPrivate ? "private" : "restricted"}`} aria-labelledby="studio-access-title" inert={!canDuplicate}>
      <div><span>{locale === "en" ? "Access & visibility" : "Доступ и видимость"}</span><h2 id="studio-access-title">{isPrivate ? (locale === "en" ? "Private · owner only" : "Приватно · только владелец") : (locale === "en" ? "Restricted custom case" : "Ограниченный custom-кейс")}</h2><p id="studio-private-description">{isPrivate ? (locale === "en" ? "Only you can open this workspace case. The platform administrator, reviewers and previous recipients cannot see its content or metadata." : "Только вы можете открыть этот кейс в workspace. Администратор платформы, рецензенты и ранее приглашённые пользователи не видят его содержание и метаданные.") : (locale === "en" ? "Visible to you and the platform administrator. Other registered users need an explicit share; it is not part of the General Library." : "Виден вам и администратору платформы. Другим зарегистрированным пользователям требуется явное приглашение; в Общую библиотеку кейс не входит.")}</p></div>
      <label className={`privacy-toggle ${canManagePrivacy ? "" : "locked"}`}><input type="checkbox" checked={isPrivate} disabled={!canManagePrivacy} onChange={(event) => changePrivacy(event.target.checked)} aria-describedby="studio-private-description"/><span>{canManagePrivacy ? (locale === "en" ? "Private" : "Приватно") : (locale === "en" ? "Owner controls privacy" : "Приватность задаёт владелец")}</span><i aria-hidden="true"/></label>
      <div className="copy-protection-control"><div><span>{displayMode === "developer" ? (locale === "en" ? "JSON lineage protection" : "Защита JSON-линии") : (locale === "en" ? "Copy protection" : "Защита от копирования")}</span><b>{draft.protection?.copyProtected ? (copyProtectionLocked ? (locale === "en" ? "Copy-protected · inherited" : "Копирование защищено · наследуется") : (locale === "en" ? "Protection pending save" : "Защита ожидает сохранения")) : (locale === "en" ? "Forks allowed" : "Форки разрешены")}</b><p>{displayMode === "developer" ? (locale === "en" ? "A server HMAC seal binds the current and parent codes. Once a saved lineage is locked, child versions cannot remove the policy." : "Серверная HMAC-печать связывает коды текущей и родительской версий. После фиксации защиты дочерние версии не могут её снять.") : (locale === "en" ? "When enabled, this protection is inherited by every later version and cannot be removed from that lineage." : "После включения защита наследуется всеми последующими версиями и не может быть снята в этой линии кейса.")}</p></div><label className={`privacy-toggle compact ${canManagePrivacy ? "" : "locked"}`}><input type="checkbox" checked={draft.protection?.copyProtected === true} disabled={!canManagePrivacy || (copyProtectionLocked && draft.protection?.copyProtected === true)} onChange={(event) => changeCopyProtection(event.target.checked)}/><span>{draft.protection?.copyProtected ? (locale === "en" ? "Protected" : "Защищено") : (locale === "en" ? "Protect" : "Защитить")}</span><i aria-hidden="true"/></label></div>
      {displayMode === "developer" && draft.protection && <dl className="protection-register"><div><dt>{locale === "en" ? "Parent code" : "Код родителя"}</dt><dd><code>{draft.protection.parentCode ?? (locale === "en" ? "Root · no parent" : "Корень · без родителя")}</code></dd></div><div><dt>{locale === "en" ? "Current version code" : "Код текущей версии"}</dt><dd><code>{draft.protection.currentCode || (locale === "en" ? "Pending workspace seal" : "Ожидает печати workspace")}</code></dd></div><div><dt>HMAC SEAL</dt><dd><code>{draft.protection.seal || (locale === "en" ? "Save to workspace to seal" : "Сохраните в workspace для печати")}</code></dd></div></dl>}
    </section>
    {displayMode === "developer" ? <section className="studio-version page-width" inert={!canDuplicate}>
      <div className="version-heading"><span>{text.customCase}</span><button className="secondary-cta" disabled={!canDuplicate} onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></div>
      <label><span>{text.caseId}</span><input id="studio-case-identity" value={draft.caseId} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,caseId:slugifyCaseId(event.target.value)}))} onBlur={(event)=>commitCaseField(text.caseId,event.currentTarget.value)}/></label>
      <label><span>{text.version}</span><input id="studio-case-version" value={draft.version} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,version:event.target.value}))} onBlur={(event)=>commitCaseField(text.version,event.currentTarget.value)} aria-invalid={!/^\d+\.\d+\.\d+$/.test(draft.version)}/></label>
      <div className="version-value"><span>{text.fingerprint}</span><code>{derivationsSettled ? studioDerivations.caseFingerprint : (locale === "en" ? "checking latest edit…" : "проверяется последняя правка…")}</code></div>
      <div className="parent-trace"><span>{text.parentCase}</span>{draft.parent ? <><b>{draft.parent.caseId}</b><code>v{draft.parent.version} · {draft.parent.fingerprint}</code></> : <em>{locale === "en" ? "Root case · no parent" : "Корневой кейс · родителя нет"}</em>}</div>
    </section> : <section className="studio-version-simple page-width" inert={!canDuplicate}><div><span>{locale === "en" ? "Current version" : "Текущая версия"}</span><b>v{draft.version}</b><small>{draft.parent ? (locale === "en" ? `Child version of v${draft.parent.version}` : `Дочерняя версия от v${draft.parent.version}`) : (locale === "en" ? "Original case" : "Исходный кейс")}</small></div><button className="secondary-cta" disabled={!canDuplicate} onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></section>}
    </details>
    {(taxDraft || taxAttached) && <Suspense fallback={<p role="status">{locale === "en" ? "Loading tax editor…" : "Загрузка налогового редактора…"}</p>}><TaxAnalysisEditor draft={draft} locale={locale} disabled={!canDuplicate || restorePending || !reportAuthority.allowed} authorityKey={JSON.stringify([reportAuthority.epoch, reportReceiptStorageScope, customCaseId, reportAuthority.visible, reportAuthority.allowed])} onChange={(expected, document) => {
      setDraft(current => current === expected ? { ...current, taxAnalysis: { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify(document) } } : current);
    }}/></Suspense>}
    {(editableDealModel || (taxDraft && taxResult)) && <Suspense fallback={null}><StudioOutcomeParameters locale={locale} dealModel={editableDealModel} taxModel={taxModel} taxResult={taxDraft ? taxResult : null} taxBaseBreakdown={taxBaseBreakdown} ratePrompt={derivedPrompt} rateDraft={draft} disabled={!canDuplicate} beginFieldEdit={beginFieldEdit} commitDealField={commitDealEconomicsField} setDealModel={setDealEconomicsChange} changeRepaymentBasis={(repaymentBasis) => { const before=draft; setDealEconomicsChange({repaymentBasis}); recordVisualEdit("case_updated", locale === "en" ? "Visual edit: changed cash-flow repayment basis." : "Визуальная правка: изменён вид погашения cash-flow.", before); }} applyTaxChange={applyTaxEconomicsChange} changeTaxCurrency={changeTaxEconomicsCurrency}/></Suspense>}
    {(draft.dealEconomics || draft.nodes.some((node) => node.type === "cash_flow")) && <Suspense fallback={<section className="deal-outcome deal-outcome-empty page-width" role="status"><p>{locale === "en" ? "Calculating case cash flow…" : "Расчёт денежного потока…"}</p></section>}><DealOutcomePanel locale={locale} draft={draft}/></Suspense>}
    </>}
    {(displayMode === "developer" || visibleStep === 4) && <details className="studio-map-context page-width" open={displayMode === "developer" ? true : undefined}><summary>{locale === "en" ? "Explore evidence, issues & options" : "Доказательства, вопросы и варианты"}</summary><Suspense fallback={null}><StudioCaseViews locale={locale} draft={draft} developerView={displayMode === "developer"} onFocusNode={(nodeId) => { focusGraphNode(nodeId); document.querySelector(".studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}/></Suspense></details>}
    {(displayMode === "developer" || visibleStep === 4) && <section className="studio-workspace">
      <details className="graph-add-controls" open={displayMode === "developer" ? true : undefined}><summary>{locale === "en" ? "Add to decision map" : "Добавить на карту решений"}</summary>
      <aside className="node-palette" inert={!canDuplicate}><div className="pane-heading"><span>{text.addNode}</span><b>{String(paletteNodeTypes.length).padStart(2,"0")}</b></div>{paletteNodeTypes.map((type) => <button key={type} disabled={!canDuplicate || draft.nodes.length >= 200} onClick={() => { addNode(type, visibleGraphCenter()); setRelationStatus(locale === "en" ? "Node added in view centre." : "Нода добавлена по центру."); }}><i style={{background:typeColors[type]}}/><span>{text.nodeTypes[type]}</span><Icon name="plus"/></button>)}<p>{locale === "en" ? "New nodes open in the visible centre. Connect OUT to IN; edits remain undoable." : "Ноды появляются по центру. Соединяйте ВЫХОД со ВХОДОМ; правки можно отменить."}</p></aside>
      </details>
{expandedGraphOpen && <Suspense fallback={<p role="status">{locale === "en" ? "Opening expanded map…" : "Открывается карта…"}</p>}><StudioExpandedGraph nodes={graphNodes} links={draft.links} locale={locale} onClose={() => setExpandedGraphOpening(null)} onNode={focusGraphNode}/></Suspense>}
      <section className="graph-deck" ref={graphDeckRef}>
        <div className="graph-heading"><div><span>{text.graph}</span><b>{draft.title}</b></div><div className="graph-heading-actions"><div>{displayMode === "developer" ? <><code>{draft.nodes.length} NODES</code><code>{draft.links.length} LINKS</code></> : <span className="graph-counts">{draft.nodes.length} {locale === "en" ? "nodes" : "узлов"} · {draft.links.length} {locale === "en" ? "connections" : "связей"}</span>}</div><div className="graph-zoom-controls" aria-label={locale === "en" ? "Graph view controls" : "Управление видом схемы"}><label className="graph-orientation-control"><span>{locale === "en" ? "Flow" : "Поток"}</span><select disabled={!layoutEngine} value={graphOrientation} onChange={(event) => { const orientation = event.target.value as GraphOrientation; setGraphOrientation(orientation); void autoLayoutGraph(orientation); }} aria-label={locale === "en" ? "Graph orientation" : "Ориентация схемы"}><option value="vertical">{locale === "en" ? "Vertical" : "Вертикально"}</option><option value="horizontal">{locale === "en" ? "Horizontal" : "Горизонтально"}</option></select></label><button type="button" disabled={!canDuplicate || !layoutEngine || draft.nodes.length < 2} onClick={() => void autoLayoutGraph()}>{locale === "en" ? "Auto-layout" : "Авто-раскладка"}</button><button type="button" onClick={fitGraph}>{locale === "en" ? "Fit" : "Вместить"}</button><button type="button" aria-pressed={graphPresentation === "detail"} onClick={() => { setGraphPresentation("detail"); setGraphZoom(1); }}>{locale === "en" ? "Detail · 100%" : "Подробно · 100%"}</button><button type="button" aria-pressed={graphPresentation === "list"} onClick={() => setGraphPresentation("list")}>{locale === "en" ? "List" : "Список"}</button><button type="button" onClick={centerGraph}>{locale === "en" ? "Center" : "По центру"}</button><button type="button" disabled={!graphNodes.length} onClick={() => { if (reportAuthority.visible) setExpandedGraphOpening(expandedGraphContext); }}>{locale === "en" ? "Expand map" : "Развернуть карту"}</button></div></div></div>
        <div id="graph-connect-status" className="graph-connect-status" role="status" aria-live="polite" tabIndex={-1}><span className={linkSourceId || selectedRuleLinkId || selectedNodeId ? "armed" : ""}/>{relationStatus || (displayMode === "user" ? (locale === "en" ? "Select a step to read its evidence and reasoning. Scroll down to follow the route." : "Выберите этап, чтобы изучить доказательства и обоснования. Прокрутите вниз по маршруту.") : (locale === "en" ? "Connect: select OUT then IN. Select a node or relation and press Delete to remove it." : "Связь: выберите ВЫХОД, затем ВХОД. Выделите узел или связь и нажмите Delete для удаления."))}{linkSourceId && <button onClick={() => { setLinkSourceId(null); setRelationStatus(""); }}>{locale === "en" ? "Cancel" : "Отмена"}</button>}</div>
        <details className="graph-milestone-disclosure" open={displayMode === "developer" ? true : undefined}><summary>{locale === "en" ? "Timeline & milestones" : "Временная шкала и этапы"}</summary><Suspense fallback={null}><GraphMilestones locale={locale} nodes={draft.nodes} select={focusGraphNode}/></Suspense></details>
        {graphPresentation === "list" && <StudioDecisionList draft={draft} locale={locale} onNode={focusGraphNode}/>}<div hidden={graphPresentation === "list"} className="graph-viewport" ref={graphViewportRef} aria-label={locale === "en" ? "Resizable graph viewport" : "Изменяемое окно схемы"}>
        <div className={`graph-canvas graph-orientation-${graphOrientation}`} style={{ zoom: graphZoom, width: graphBounds.width, height: graphBounds.height }}>
          <svg className="graph-links" aria-label={locale === "en" ? "Case relationships" : "Связи кейса"}>{draft.links.map((link) => { const from=nodeById.get(link.from); const to=nodeById.get(link.to); if(!from||!to)return null; const geometry=graphLinkGeometry(from,to,graphOrientation); const selected=selectedRuleLinkId===link.id; return <g key={link.id} className={`graph-link ${selected?"selected":""}`} role="button" tabIndex={0} aria-pressed={selected} aria-label={locale === "en" ? `Relation from ${from.title} to ${to.title}. Press Delete to remove.` : `Связь от «${from.title}» к «${to.title}». Нажмите Delete для удаления.`} onClick={() => selectGraphLink(link)} onKeyDown={(event) => { if(event.key==="Enter"||event.key===" "){event.preventDefault();selectGraphLink(link);} }}><title>{from.title} → {to.title}</title><path className="graph-link-hit" d={geometry.path}/><path className="graph-link-visible" d={geometry.path}/><circle cx={geometry.endX} cy={geometry.endY} r="3"/></g>; })}</svg>
          {!layoutEngine && draft.nodes.length > 0 && <div className="graph-empty-state" role="status"><p>{layoutError ? (locale === "en" ? "The decision map could not be opened." : "Не удалось открыть карту решений.") : (locale === "en" ? "Opening decision map…" : "Открывается карта решений…")}</p>{layoutError && <button type="button" onClick={() => { setLayoutError(false); setLayoutAttempt((attempt) => attempt + 1); }}>{locale === "en" ? "Try again" : "Повторить"}</button>}</div>}
          {draft.nodes.length === 0 && <div className="graph-empty-state"><Icon name="spark"/><h3>{locale === "en" ? "Start with a description or one node" : "Начните с описания или первого узла"}</h3><p>{locale === "en" ? "Describe the matter above and choose “Understand with AI”, or add a Trigger from the left palette." : "Опишите ситуацию выше и нажмите «Понять и структурировать с AI» либо добавьте «Триггер» в палитре слева."}</p></div>}
          {graphNodes.map((node) => <div key={node.id} className={`graph-node-shell ${node.id===selectedNodeId?"selected":""} ${node.id===linkSourceId?"link-source":""}`} style={{left:node.x,top:node.y,"--node-color":typeColors[node.type]} as React.CSSProperties}>
            <button className="node-port node-port-in" style={graphOrientation === "vertical" ? {top:-17,left:"50%",right:"auto",bottom:"auto",transform:"translateX(-50%)"} : {top:24,left:-17,right:"auto",bottom:"auto",transform:"none"}} disabled={!canDuplicate} onClick={() => completeLink(node.id)} aria-label={locale === "en" ? `Use ${node.title} as relation destination` : `Использовать ${node.title} как назначение связи`}><span/></button>
            <button className="graph-node-number" type="button" onClick={(event)=>{event.stopPropagation();focusGraphNode(node.id);}} aria-label={`${locale === "en" ? "Focus node" : "Показать ноду"} ${nodeNumberById.get(node.id) ?? ""}`}>N{String(nodeNumberById.get(node.id) ?? 0).padStart(2,"0")}</button>
            <button id={`studio-node-${node.id}`} className="graph-node" onFocus={() => selectGraphNode(node.id)} onKeyDown={(event) => { if (canDuplicate) nudgeNode(event, node); }} onPointerDown={(event)=>{setSelectedRuleLinkId(null);if(canDuplicate)moveNode(event,node,graphZoom);else selectGraphNode(node.id);}} onPointerMove={(event)=>{if(canDuplicate)moveNode(event,node,graphZoom);}} onPointerUp={(event)=>{if(canDuplicate)moveNode(event,node,graphZoom);}} onPointerCancel={(event)=>{if(canDuplicate)moveNode(event,node,graphZoom);}} aria-label={`N${String(nodeNumberById.get(node.id) ?? 0).padStart(2,"0")} · ${text.nodeTypes[node.type]}: ${node.title}. ${canDuplicate ? (locale === "en" ? "Use arrow keys to reposition; press Delete to remove." : "Используйте стрелки для перемещения; нажмите Delete для удаления.") : (locale === "en" ? "Inspection only." : "Только просмотр.")}`}><span><i/>{text.nodeTypes[node.type]}</span><b>{node.title}</b>{(node.runtime?.budgetCostEur !== undefined || node.runtime?.durationMinutes !== undefined) && <small className="node-runtime-summary">{node.runtime?.budgetCostEur !== undefined ? `€${node.runtime.budgetCostEur.toLocaleString()}` : (displayMode === "developer" ? "€ auto" : locale === "en" ? "cost automatic" : "стоимость автоматически")} · {node.runtime?.durationMinutes !== undefined ? `${node.runtime.durationMinutes} min` : (displayMode === "developer" ? "time auto" : locale === "en" ? "time automatic" : "время автоматически")}</small>}</button>
            <button className="node-port node-port-out" style={graphOrientation === "vertical" ? {top:"auto",left:"50%",right:"auto",bottom:-17,transform:"translateX(-50%)"} : {top:24,left:"auto",right:-17,bottom:"auto",transform:"none"}} disabled={!canDuplicate} aria-pressed={node.id===linkSourceId} onClick={() => armLinkSource(node.id)} aria-label={locale === "en" ? `Start relation from ${node.title}` : `Начать связь от ${node.title}`}><span/></button>
          </div>)}
        </div></div>
        <div className="graph-resize-hint"><span aria-hidden="true">↕</span>{locale === "en" ? "Drag the lower edge to resize the graph window" : "Потяните нижний край, чтобы изменить высоту окна схемы"}</div>
        <div className="graph-legend">{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><span key={type}><i style={{background:typeColors[type]}}/>{text.nodeTypes[type]}</span>)}</div>
        <details id="studio-relations" className="graph-relations" open={displayMode === "developer" ? true : undefined}>
          <summary>{displayMode === "developer" ? (locale === "en" ? "Relationship & Rules DSL editor" : "Редактор связей и Rules DSL") : (locale === "en" ? "Connections and decision rules" : "Связи и правила решений")} · {draft.links.length}</summary>
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
      <aside className="node-inspector"><div className="pane-heading"><span>{text.inspector}</span><b>{selectedNode?"01":"00"}</b></div>{selectedNode?<>{displayMode === "user" && <Suspense fallback={<p role="status">{locale === "en" ? "Loading step…" : "Загрузка шага…"}</p>}><StudioNodeSummary node={selectedNode} locale={locale}/></Suspense>}<details className="inspector-edit" open={displayMode === "developer" ? true : undefined}><summary>{locale === "en" ? "Edit this step" : "Редактировать шаг"}</summary><div className="inspector-form" inert={!canDuplicate}>
        <div className="selected-type"><i style={{background:typeColors[selectedNode.type]}}/><span>{text.nodeTypes[selectedNode.type]}</span>{displayMode === "developer" && <code>{selectedNode.id}</code>}</div>
        <label><span>{text.nodeType}</span><select value={selectedNode.type} onChange={(event)=>{ const type=event.target.value as StudioNodeType; if(type!==selectedNode.type){ const before=draft; updateNode({type,runtime:runtimeForNodeType(selectedNode.runtime,type)}); recordVisualEdit("node_updated", locale === "en" ? `Visual edit: changed “${selectedNode.title}” from ${text.nodeTypes[selectedNode.type]} to ${text.nodeTypes[type]}.` : `Визуальная правка: тип узла «${selectedNode.title}» изменён на «${text.nodeTypes[type]}».`, before); } }}>{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><option key={type} value={type}>{text.nodeTypes[type]}</option>)}</select></label>
        <label><span>{text.title}</span><input value={selectedNode.title} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>updateNode({title:event.target.value})} onBlur={(event)=>commitNodeField(text.title,event.currentTarget.value)}/></label>
        <label><span>{text.detail}</span><textarea value={selectedNode.detail} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>updateNode({detail:event.target.value})} onBlur={(event)=>commitNodeField(text.detail,event.currentTarget.value)}/></label>
        {displayMode === "developer" && <fieldset className="node-runtime-fields" disabled={!canDuplicate}>
          <legend>{locale === "en" ? "Node position" : "Положение узла"}</legend>
          <p>{locale === "en" ? "Set an exact position without dragging. This edits the source and can be undone; Fit changes only the view." : "Задайте точное положение без перетаскивания. Правка изменяет исходник и может быть отменена; «Вписать» меняет только вид."}</p>
          {(["x", "y"] as const).map((axis) => <label key={axis}><span>{locale === "en" ? `${axis.toUpperCase()} position` : `Координата ${axis.toUpperCase()}`}</span><input type="number" min="0" max="5000" step="any" value={selectedNode[axis]} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 5000) updateNode({ [axis]: value }); }} onBlur={(event) => commitNodeField(locale === "en" ? `${axis.toUpperCase()} position` : `координата ${axis.toUpperCase()}`, event.currentTarget.value)}/></label>)}
        </fieldset>}
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
        <div className="inspector-destination-picker">{destinationNodes.length > STUDIO_NODE_MENU_PAGE_SIZE && <label className="node-menu-search"><span>{locale === "en" ? "Find destination" : "Найти назначение"}</span><input type="search" value={destinationNodeQuery} placeholder={locale === "en" ? "Title, type or ID" : "Название, тип или ID"} onChange={(event) => { setDestinationNodeQuery(event.target.value); setDestinationNodePage(0); }}/></label>}<label><span>{locale === "en" ? "Connect selected node to" : "Связать выбранный узел с"}</span><select id="studio-connect-node" value="" onChange={(event) => { const target=event.target.value; if(!target)return; const issue=canUseRelation(selectedNode.id,target); if(issue){setRelationStatus(issue);return;} addLink(selectedNode.id,target); setRelationStatus(locale === "en" ? "Relation created." : "Связь создана."); }}><option value="">{locale === "en" ? "Choose destination…" : "Выберите узел…"}</option>{destinationNodeMenu.nodes.map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}{displayMode === "developer" ? ` · ${node.id}` : ""}</option>)}</select></label>{destinationNodeMenu.pageCount > 1 && <div className="node-menu-pagination"><span>{destinationNodeMenu.start}–{destinationNodeMenu.end} / {destinationNodeMenu.total}</span><button type="button" disabled={destinationNodeMenu.page === 0} onClick={() => setDestinationNodePage(destinationNodeMenu.page - 1)} aria-label={locale === "en" ? "Previous destinations" : "Предыдущие назначения"}><Icon name="arrow"/></button><button type="button" disabled={destinationNodeMenu.page >= destinationNodeMenu.pageCount - 1} onClick={() => setDestinationNodePage(destinationNodeMenu.page + 1)} aria-label={locale === "en" ? "Next destinations" : "Следующие назначения"}><Icon name="arrow"/></button></div>}</div>
        <button className="danger-button" onClick={() => { const relations=draft.links.filter((link)=>link.from===selectedNode.id||link.to===selectedNode.id).length; if(!relations || window.confirm(locale === "en" ? `Delete this node and ${relations} connected relation(s)?` : `Удалить узел и связанные связи (${relations})?`)) deleteNode(); }}><Icon name="trash"/>{text.deleteNode}</button>
      </div></details></>:<p className="empty-inspector">{text.noSelection}</p>}</aside>
    </section>}
    {(displayMode === "developer" || (visibleStep === 5 && packageRequiresPlayableRoute)) && <details className="studio-simulation-tools page-width" open={trainingWorkflow || displayMode === "developer" ? true : undefined}><summary>{locale === "en" ? "Optional route simulation" : "Дополнительная симуляция маршрута"}</summary><section className="studio-bottom"><div id="studio-checks" className="checks-panel" hidden={displayMode === "user"}><div className="panel-title"><span>{displayMode === "developer" ? text.checks : (locale === "en" ? "Before final review" : "Перед итоговой проверкой")}</span><b>{checks.filter((check)=>check.level==="warn").length.toString().padStart(2,"0")}</b></div>{visibleChecks.length === 0 && displayMode === "user" && <p>{locale === "en" ? "Completeness checks passed. Review the evidence and reasoning before sharing." : "Проверки полноты пройдены. Проверьте доказательства и обоснование перед отправкой."}</p>}{visibleChecks.map((check,index)=><div key={index} className={`check-row ${check.level}`}><Icon name={check.level==="ok"?"check":"alert"}/><span>{check.text}</span></div>)}<p>{text.localNote}</p></div><div className="preview-panel"><div className="panel-title"><span>{locale === "en" ? "Test readiness" : "Готовность к тесту"}</span><b>{draft.nodes.length === 0 ? (locale === "en" ? "START" : "СТАРТ") : !derivationsSettled ? (locale === "en" ? "CHECKING" : "ПРОВЕРКА") : compiledDraft.scenario ? (locale === "en" ? "READY" : "ГОТОВО") : `${compiledDraft.issues.length} ${locale === "en" ? "TO FIX" : "ИСПРАВИТЬ"}`}</b></div><div className="preview-card compiler-card"><div className="preview-index">{locale === "en" ? "PLAYABLE CASE PREVIEW" : "ПРЕДПРОСМОТР ИГРАБЕЛЬНОГО КЕЙСА"}</div><h2>{locale === "en" ? "Test the case you built" : "Проверьте собранный кейс"}</h2>{draft.nodes.length === 0 ? <div className="compiler-empty"><p>{locale === "en" ? "Your new draft is empty. Return to the brief or decision map; validation will start after the first node appears." : "Новый черновик пуст. Вернитесь к описанию или карте решений — проверка начнётся после появления первого узла."}</p></div> : !derivationsSettled ? <div className="compiler-empty" role="status"><p>{locale === "en" ? "Checking the latest edit in the background. Test and save will unlock when this exact graph is ready." : "Последняя правка проверяется в фоне. Тест и сохранение станут доступны для этой точной версии схемы."}</p></div> : <><p>{locale === "en" ? `Case: ${draft.title || "Untitled case"}. Before testing, every route must start clearly and finish at an Outcome.` : `Кейс: ${draft.title || "Без названия"}. Перед тестом каждый маршрут должен иметь понятное начало и завершаться узлом «Исход».`}</p>{compiledDraft.scenario ? <><dl><div><dt>{locale === "en" ? "Playable stages" : "Игровых стадий"}</dt><dd>{compiledDraft.scenario.stages.length}</dd></div><div><dt>{locale === "en" ? "Player choices" : "Вариантов действий"}</dt><dd>{compiledDraft.scenario.stages.reduce((sum, stage) => sum + stage.options.length, 0)}</dd></div></dl>{compiledDraft.warnings.map((warning) => <p className="compiler-warning" key={warning}>{warning}</p>)}<button className="primary-cta" onClick={playDraft}><Icon name="play"/>{locale === "en" ? "Test this case" : "Протестировать кейс"}</button></> : <div className="compiler-issues">{compiledDraft.issues.map((issue) => <div key={issue.code}><Icon name="alert"/><span>{compilerIssueText(issue)}</span>{issue.nodeIds[0] && <button type="button" onClick={() => { const nodeId=issue.nodeIds[0]; selectGraphNode(nodeId); selectGuidedStep(4); }}>{locale === "en" ? "Fix on decision map" : "Исправить на карте"}</button>}</div>)}</div>}</>}</div></div></section></details>}
    {(displayMode === "developer" || visibleStep === 5) && !packageRequiresPlayableRoute && <Suspense fallback={null}><StudioPackageValidationCard locale={locale} draft={draft} warningCount={checks.filter((check) => check.level === "warn").length}/></Suspense>}
    {displayMode === "user" && visibleStep === 6 && <Suspense fallback={null}><StudioCasePlaybook locale={locale} draft={draft} phase="outputs"/></Suspense>}
    {displayMode === "user" && visibleStep === 6 && <section className="studio-finish page-width" aria-labelledby="studio-finish-title">
      <header><div><span>{locale === "en" ? "FINAL STEP · YOUR CASE STAYS EDITABLE" : "ФИНАЛЬНЫЙ ЭТАП · КЕЙС ОСТАЁТСЯ РЕДАКТИРУЕМЫМ"}</span><h2 id="studio-finish-title">{locale === "en" ? "Choose what happens next" : "Выберите следующее действие"}</h2></div><b className={validationReady ? "ready" : "blocked"}>{validationReady ? (locale === "en" ? "READY" : "ГОТОВО") : (locale === "en" ? "REVIEW NEEDED" : "НУЖНА ПРОВЕРКА")}</b></header>
      <div className="studio-finish-options">
        <article><Icon name="save"/><span>01</span><h3>{locale === "en" ? "Keep working later" : "Продолжить позже"}</h3><p>{locale === "en" ? "Save the exact draft and visibility settings to your workspace." : "Сохраните точный черновик и настройки видимости в workspace."}</p><button className="secondary-cta" onClick={() => shareDraft("save")} disabled={!canDuplicate || !draftWithinEnvelope || !derivationsSettled || workspaceState === "saving"}>{locale === "en" ? "Save to workspace" : "Сохранить в workspace"}</button></article>
        <article><Icon name="download"/><span>02</span><h3>{locale === "en" ? "Create an analytical report" : "Сформировать аналитический отчёт"}</h3><p>{locale === "en" ? "Preview a preliminary PDF from this draft. Independent approval is a separate step in your case." : "Просмотрите предварительный PDF из этого черновика. Независимое утверждение — отдельный шаг в деле."}</p><button className="secondary-cta report-cta" onClick={() => void openCaseReport()} disabled={!canDuplicate || !draft.title.trim() || !draft.nodes.length} aria-describedby={reportUnavailable ? "studio-report-card-requirements" : undefined}>{locale === "en" ? "Open PDF options" : "Открыть параметры PDF"}</button>{reportUnavailable && <div id="studio-report-card-requirements">{reportRequirements}</div>}</article>
        <article><Icon name="check"/><span>03</span><h3>{locale === "en" ? "Request expert review" : "Запросить экспертную рецензию"}</h3><p>{locale === "en" ? "Submit only when validation is green and the visibility setting is correct." : "Отправляйте только после зелёной проверки и подтверждения режима видимости."}</p><button className="primary-cta" onClick={() => shareDraft("submit")} disabled={Boolean(submitBlocker) || workspaceState === "saving"} title={submitBlocker || undefined}>{locale === "en" ? "Submit for review" : "Отправить на рецензию"}</button></article>
      </div>
      {submitBlocker && <p className="studio-finish-note"><Icon name="alert"/>{submitBlocker}</p>}
    </section>}
    {caseReportOpen && <ReportErrorBoundary locale={locale} onClose={() => setCaseReportOpen(false)}><Suspense fallback={<div className="case-report-backdrop"><section className="case-report-dialog" role="status">{locale === "en" ? "Opening report options…" : "Открываются параметры отчёта…"}</section></div>}><CaseReportDialog
      locale={locale}
      draft={draft}
      customCaseId={customCaseId}
      currentFingerprint={caseReportFingerprint || studioDerivations.caseFingerprint || caseFingerprint(draft)}
      workspaceFingerprint={serverFingerprint}
      currentPublicationFingerprint={casePublicationFingerprint(draft)}
      workspacePublicationFingerprint={serverPublicationFingerprint}
      privateCase={isPrivate}
      canGenerateReport={canDuplicate && reportAuthority.allowed}
      reportAuthorityEpoch={reportAuthority.epoch}
      verifyReportAuthority={reportAuthority.verify}
      developerView={displayMode === "developer"}
      reportReceiptStorageScope={reportReceiptStorageScope}
      persistReportReceiptOnDevice={persistReportReceiptOnDevice}
      close={() => setCaseReportOpen(false)}
      completed={() => {
        setCaseReportStatus(locale === "en" ? "PDF download started." : "Скачивание PDF началось.");
      }}
    /></Suspense></ReportErrorBoundary>}
    {caseMarkdownOpen && <Suspense fallback={null}><CaseMarkdownDialog key={reportAuthority.epoch} locale={locale} draft={draft} canExport={canDuplicate && reportAuthority.allowed} verifyAuthority={reportAuthority.verify} close={() => setCaseMarkdownOpen(false)} completed={() => setCaseReportStatus(locale === "en" ? "Markdown downloaded." : "Markdown скачан.")}/></Suspense>}
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
