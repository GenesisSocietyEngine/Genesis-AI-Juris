"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { caseFingerprint, isRecord, isTaxClassification, normalizeStudioDraft, slugifyCaseId, studioStructuralIssues } from "./case-integrity";
import { bundledCataloguePresentation, mayUseBundledCatalogueFallback } from "./catalogue-fallback";
import { decisionAvailability, resolveDecisionTiming, resolveLegacyDecisionTiming } from "./game-engine";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import { resolvePlayedCaseScenario } from "./played-case-loader";
import { initialMetrics } from "./runtime-constants";
import { deviceDraftEnvelope, LEGACY_STUDIO_DRAFT_KEY, LEGACY_STUDIO_PRIVATE_KEY, mayPersistStudioDraftOnDevice, studioDeviceDraftKey, studioDeviceScope, unwrapDeviceDraft } from "./studio-device-storage";
import { addStudioLink, appendStudioHistory, applyStudioPromptIteration, deleteStudioLink, describeStudioPromptOperation, nextStudioLinkId, nextStudioNodeId, nextStudioNodePosition, planStudioPromptIteration, relinkStudioLink } from "./studio-editing";
import { compileStudioDraft } from "./studio-compiler";
import { applyStudioSnapshot, diffDraftToRevision, diffStudioSnapshots, emptyStudioTimeline, recordStudioRevision, snapshotStudioDraft, stepStudioTimeline, studioSnapshotsEqual, type StudioRevision, type StudioTimeline } from "./studio-revisions";
import type {
  DecisionOption,
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
type OutcomeClass = "strong" | "mixed" | "weak";
type DecisionRecord = { stageId: string; stage: string; option: DecisionOption };
type FeedbackTarget = { caseId: string; version: string; title: string; source: "playable" | "studio"; fingerprint?: string; contextType?: "case" | "stage" | "decision" | "node"; contextId?: string; privateCase?: boolean };

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
  schemaVersion: 2;
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
  outcome: OutcomeClass | null;
};

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
  schemaVersion: 3;
  exportedAt: string;
  case: {
    id: string;
    version: string;
    fingerprint: string;
    parent: StudioDraft["parent"];
    protection: StudioDraft["protection"];
    visibility?: "restricted" | "private";
  };
  draft: StudioDraft;
};

const ui = {
  en: {
    library: "Case Library", play: "Operations", studio: "Case Studio",
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
    library: "Библиотека дел", play: "Операции", studio: "Студия кейсов",
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

const iconPaths: Record<string, React.ReactNode> = {
  library: <><path d="M4 5.5h16M6 3v5M18 3v5M5 10h14v10H5z"/><path d="M9 14h6M9 17h4"/></>,
  play: <><path d="M4 19V8l8-4 8 4v11"/><path d="M8 19v-6h8v6M3 19h18"/></>,
  studio: <><path d="M6 5h4v4H6zM14 15h4v4h-4zM16 4v7M8 13v6M10 7h6M8 15h6"/></>,
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  arrow: <path d="M5 12h14M14 7l5 5-5 5"/>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  alert: <><path d="m12 3 9 17H3z"/><path d="M12 9v5M12 17.5v.1"/></>,
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
  const outcome = state.outcome === "strong" || state.outcome === "mixed" || state.outcome === "weak" ? state.outcome : null;
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
      outcome,
    },
    status: value.status,
    revision: value.revision,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
  };
}

const defaultPrompt = `A renewable-energy developer discovers that its community consultation map omitted two households before a permit hearing. The planning authority requests a corrected record within 36 hours. Create a case for counsel to preserve evidence, coordinate the developer and mapping contractor, decide whether to seek an adjournment, and reach either a credible corrected process or a compromised permit position.`;

const defaultDraft: StudioDraft = {
  caseId: "the_missing_boundary",
  version: "1.0.0",
  parent: null,
  title: "The Missing Boundary", jurisdiction: "UK · Planning", role: "Project counsel",
  premise: "A consultation map omitted two households before a permit hearing.", updatedAt: new Date(0).toISOString(),
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

export default function JurisApp() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("after-hours");
  const [view, setView] = useState<View>("library");
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
  const [legacyTimingMode, setLegacyTimingMode] = useState(false);
  const [playSessionSync, setPlaySessionSync] = useState<"opening" | "server" | "local" | "stale" | "error">("local");
  const [playSessionBusy, setPlaySessionBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraftState] = useState<StudioDraft>(defaultDraft);
  const [studioPrivate, setStudioPrivate] = useState(false);
  const [studioCustomCaseId, setStudioCustomCaseId] = useState<number | null>(null);
  const [studioCanManagePrivacy, setStudioCanManagePrivacy] = useState(true);
  const [studioServerFingerprint, setStudioServerFingerprint] = useState<string | null>(null);
  const [studioCanDuplicate, setStudioCanDuplicate] = useState(true);
  const [studioCopyProtectionLocked, setStudioCopyProtectionLocked] = useState(false);
  const [studioStorageScope, setStudioStorageScope] = useState<string | null>(null);
  const draftRef = useRef<StudioDraft>(defaultDraft);
  const [studioTimeline, setStudioTimelineState] = useState<StudioTimeline>(emptyStudioTimeline());
  const studioTimelineRef = useRef<StudioTimeline>(emptyStudioTimeline());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("decision-1");
  const [savedFlash, setSavedFlash] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number; startX: number; startY: number; lastX: number; lastY: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const playedCaseImportRef = useRef<HTMLInputElement>(null);
  const dragBeforeRef = useRef<StudioDraft | null>(null);
  const playSessionStartRef = useRef(0);
  const catalogueLaunchRef = useRef(0);
  const studioChangedBeforeRestoreRef = useRef(false);
  const text = ui[locale];

  useEffect(() => {
    let cancelled = false;
    // v12 used origin-wide keys that could cross account boundaries on shared
    // browsers. Never read them again; new drafts use an identity-scoped,
    // versioned envelope and workspace/private artifacts are excluded entirely.
    window.localStorage.removeItem(LEGACY_STUDIO_DRAFT_KEY);
    window.localStorage.removeItem(LEGACY_STUDIO_PRIVATE_KEY);
    void (async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const payload = await readJsonResponse<{ authenticated?: boolean; profile?: { email?: string } }>(response);
        const scope = await studioDeviceScope(response.ok && payload?.authenticated ? payload.profile?.email : null);
        if (!cancelled && scope) setStudioStorageScope(scope);
      } catch {
        // Fail closed: without a resolved identity scope the app does not read
        // or persist a device draft.
      }
    })();
    return () => { cancelled = true; };
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

  const refreshCatalogue = useCallback(async ({ filters = {}, cursor = null, append = false, force = false }: { filters?: CatalogueSearchFilters; cursor?: string | null; append?: boolean; force?: boolean } = {}) => {
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
      const response = await fetch(`/api/catalog?${params}`, force ? { cache: "no-store" } : undefined);
      const payload = await readJsonResponse<{ items?: unknown[]; nextCursor?: string | null; total?: number }>(response);
      if (!response.ok || !Array.isArray(payload?.items)) throw new Error("Catalogue response is unavailable");
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
      setCatalogueError(locale === "en" ? "The central catalogue is temporarily unavailable; bundled cases remain playable." : "Центральный каталог временно недоступен; встроенные кейсы остаются доступными.");
      if (!append) {
        const fallback = bundledCatalogueRecords().filter((record) => publishedRecordMatches(record, filters));
        setCatalogueRecords(fallback);
        setCatalogueTotal(fallback.length);
        setCatalogueNextCursor(null);
      }
    } finally {
      setCatalogueLoading(false);
    }
  }, [locale]);

  const featuredRecord = catalogueRecords.find((record) => record.id === featuredId) ?? catalogueRecords[0] ?? bundledCatalogueRecords()[0];
  const featured = catalogueScenarios.find((scenario) => scenario.caseId === featuredRecord.id && scenario.version === featuredRecord.currentVersion && scenario.fingerprint === featuredRecord.fingerprint) ?? null;
  const stage = activeScenario?.stages[stageIndex] ?? null;
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const checks = useMemo(() => validateDraft(draft, locale), [draft, locale]);

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
    setStudioCanDuplicate(true);
    setStudioCopyProtectionLocked(false);
    setSelectedNodeId(nextSelectedNodeId);
  }
  function updateStudioDraft(update: React.SetStateAction<StudioDraft>) {
    const current = draftRef.current;
    const next = typeof update === "function" ? update(current) : update;
    if (next !== current) syncStudioDraft(next);
  }
  function commitStudioDraft(update: React.SetStateAction<StudioDraft>, label: string, source: "prompt" | "visual", createdAt = new Date().toISOString()) {
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
    const createdAt = new Date().toISOString();
    const current = draftRef.current;
    if (studioSnapshotsEqual(snapshotStudioDraft(before), snapshotStudioDraft(current))) return;
    const after = appendStudioHistory(current, { role: "studio", source: "visual", action, message }, createdAt);
    syncStudioDraft(after);
    syncStudioTimeline(recordStudioRevision(studioTimelineRef.current, before, after, { label: message, source: "visual", createdAt }));
  }
  function travelStudioTimeline(direction: "undo" | "redo") {
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

  function navigate(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function restoreFromServerSession(session: ServerPlaySession, scenario: Scenario) {
    const restoredLog = session.state.decisions.flatMap((decision, index) => {
      const sourceStage = scenario.stages.find((item) => item.id === decision.stageId);
      const sourceOption = sourceStage?.options.find((option) => option.id === decision.optionId);
      if (!sourceStage || !sourceOption) return [];
      const nextStageId = session.state.decisions[index + 1]?.stageId ?? session.state.currentStageId;
      return [{ stageId: sourceStage.id, stage: local(sourceStage.headline, locale), option: { ...sourceOption, nextStageId } }];
    });
    const restoredStageIndex = scenario.stages.findIndex((item) => item.id === session.state.currentStageId);
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
  async function beginServerPlaySession(scenario: Scenario, requestVersion: number) {
    try {
      const response = await fetch("/api/play-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", caseId: scenario.caseId, version: scenario.version, fingerprint: scenario.fingerprint }),
      });
      if (requestVersion !== playSessionStartRef.current) return;
      if (response.status === 401 || response.status === 404) { setPlaySessionSync("local"); return; }
      const payload = await response.json().catch(() => null) as { session?: unknown } | null;
      const session = normalizeServerPlaySession(payload?.session);
      if (!response.ok || !session || session.caseId !== scenario.caseId || session.version !== scenario.version || session.fingerprint !== scenario.fingerprint) {
        setPlaySessionSync("error");
        return;
      }
      setServerPlaySession(session);
      setPlaySessionSync("server");
    } catch {
      if (requestVersion === playSessionStartRef.current) setPlaySessionSync("error");
    }
  }
  function startScenario(scenario: Scenario, options: { legacyTiming?: boolean } = {}) {
    const sessionRequestVersion = playSessionStartRef.current + 1;
    playSessionStartRef.current = sessionRequestVersion;
    const initialIndex = Math.max(0, scenario.stages.findIndex((item) => item.id === scenario.initialStageId));
    setActiveScenario(scenario); setStageIndex(initialIndex); setMetrics({ ...initialMetrics }); setDecisionLog([]);
    setCaseMinute(scenario.initialClockMinute); setActionUseCounts({}); setCompletedDeadlineIds([]); setMissedDeadlineIds([]);
    setServerPlaySession(null); setPlaySessionSync("opening"); setPlaySessionBusy(false);
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
    if (!decisionAvailability(selectedOption, metrics, actionUseCounts[selectedOption.id] ?? 0).available) {
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
    const applyTransition = (nextMetrics: Record<MetricKey, number>, transitionMinute: number, nextCompleted: string[], nextMissed: string[], nextUses: Record<string, number>, nextStageId: string) => {
      const deadlineReroute = nextStageId !== selected.nextStageId;
      const dispatchedOption: DecisionOption = deadlineReroute ? {
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
          applyTransition(authoritative.state.metrics, authoritative.state.clockMinute, authoritative.state.completedDeadlineIds, authoritative.state.missedDeadlineIds, authoritative.state.actionUseCounts, authoritative.state.currentStageId);
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
      { ...actionUseCounts, [selected.id]: (actionUseCounts[selected.id] ?? 0) + 1 },
      localNextStageId,
    );
  }
  function advanceStage() {
    if (!activeScenario) return; setResultOption(null);
    const nextStageId = resultOption?.nextStageId;
    if (!nextStageId) return;
    const nextIndex = activeScenario.stages.findIndex((item) => item.id === nextStageId);
    if (nextIndex < 0) return;
    setStageIndex(nextIndex);
    if (activeScenario.stages[nextIndex].terminal) setOutcome(activeScenario.stages[nextIndex].terminalOutcome ?? classifyOutcome(metrics));
  }
  function showSessionNotice(message: string) {
    setSessionNotice(message);
    window.setTimeout(() => setSessionNotice(null), 3200);
  }
  function exportPlayedCase() {
    if (!activeScenario) return;
    const decisions = decisionLog.map((entry, index) => {
      const sourceStage = activeScenario.stages.find((item) => item.id === entry.stageId);
      const sourceOption = sourceStage?.options.find((option) => option.id === entry.option.id);
      if (!sourceStage || !sourceOption) throw new Error("The current decision log does not match the scenario catalogue.");
      return { sequence: index + 1, stageId: sourceStage.id, optionId: sourceOption.id };
    });
    const payload: PlayedCaseFile = {
      format: "genesis-juris-played-case",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      scenario: {
        id: activeScenario.id,
        caseId: activeScenario.caseId,
        contentVersion: activeScenario.version,
        fingerprint: activeScenario.fingerprint,
      },
      playthrough: {
        status: outcome ? "completed" : "in_progress",
        currentStageId: activeScenario.stages[stageIndex].id,
        clockMinute: caseMinute,
        decisions,
        derivedMetrics: metrics,
        outcome,
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
        if (!isRecord(parsed) || parsed.format !== "genesis-juris-played-case" || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)) throw new Error("Unsupported played-case schema");
        if (!isRecord(parsed.scenario) || !isRecord(parsed.playthrough)) throw new Error("Missing played-case sections");
        const scenarioFile = parsed.scenario;
        const playthroughFile = parsed.playthrough;

        const resolvedScenario = await resolvePlayedCaseScenario({ id: scenarioFile.id, caseId: scenarioFile.caseId, contentVersion: scenarioFile.contentVersion, fingerprint: scenarioFile.fingerprint }, catalogueScenarios);
        const importedScenario = resolvedScenario.scenario;
        const legacyMode = resolvedScenario.legacyTiming;

        const importedDecisions = playthroughFile.decisions;
        const importedStatus = playthroughFile.status;
        const currentStageId = playthroughFile.currentStageId;
        if (!Array.isArray(importedDecisions) || (importedStatus !== "in_progress" && importedStatus !== "completed") || typeof currentStageId !== "string") {
          throw new Error("Invalid playthrough state");
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
          const priorUses = restoredActionUses[sourceOption.id] ?? 0;
          if (!decisionAvailability(sourceOption, restoredMetrics, priorUses).available) throw new Error("Decision was not available under the authored rules");
          restoredActionUses[sourceOption.id] = priorUses + 1;
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
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    const titleSeed = (sentences[0] ?? "Untitled legal scenario").replace(/[.!?]$/, "");
    const shortTitle = titleSeed.split(" ").slice(0, 6).join(" ");
    const deadlineMatch = clean.match(/(?:within|in|за|через)\s+([\d]+\s*(?:hours?|days?|час(?:а|ов)?|дн(?:я|ей)))/i);
    const actorCandidates = Array.from(clean.matchAll(/(?:the|a|an)\s+([A-Z][a-z-]+(?:\s+[A-Z]?[a-z-]+){0,2})/g)).map((match) => match[1]);
    const nodes: StudioNode[] = [
      { id: "trigger-1", type: "trigger", title: shortTitle, detail: sentences[0] ?? clean, x: 45, y: 235 },
      { id: "actor-1", type: "actor", title: actorCandidates[0] ?? "Client leadership", detail: "Primary institutional actor named in the prompt.", x: 265, y: 65 },
      { id: "actor-2", type: "actor", title: actorCandidates[1] ?? "Regulatory authority", detail: "Counterparty, authority or affected stakeholder.", x: 265, y: 390 },
      { id: "evidence-1", type: "evidence", title: "Preserve the source record", detail: sentences[1] ?? "Identify authoritative documents and physical evidence.", x: 300, y: 235 },
      { id: "deadline-1", type: "deadline", title: deadlineMatch ? `${deadlineMatch[1]} response window` : "Procedural response window", detail: "A visible, source-bound deadline.", x: 515, y: 70 },
      { id: "decision-1", type: "decision", title: "Choose the institutional response", detail: sentences[2] ?? "Create at least two complete, consequential responses.", x: 520, y: 280 },
      { id: "outcome-1", type: "outcome", title: "Position protected", detail: "Evidence and institutional process remain credible.", x: 760, y: 150 },
      { id: "outcome-2", type: "outcome", title: "Position compromised", detail: sentences.at(-1) ?? "The decision creates an open risk.", x: 760, y: 390 },
    ];
    const links = numberedStudioLinks([
      ["trigger-1", "actor-1"], ["trigger-1", "actor-2"], ["trigger-1", "evidence-1"],
      ["actor-1", "deadline-1"], ["evidence-1", "decision-1"], ["deadline-1", "decision-1"],
      ["decision-1", "outcome-1"], ["decision-1", "outcome-2"],
    ]);
    const createdAt = new Date().toISOString();
    let rebuilt: StudioDraft = { caseId: slugifyCaseId(shortTitle), version: "1.0.0", parent: null, title: shortTitle, jurisdiction: "Set jurisdiction", role: "Scenario counsel", premise: clean, classification: { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }, nodes, links, editHistory: [], updatedAt: createdAt };
    rebuilt = appendStudioHistory(rebuilt, { role: "author", source: "prompt", action: "prompt_submitted", message: clean }, createdAt);
    rebuilt = appendStudioHistory(rebuilt, { role: "studio", source: "prompt", action: "graph_rebuilt", message: locale === "en" ? `Built a new ${nodes.length}-node graph from this prompt. The previous draft was replaced by explicit author request.` : `По явной команде автора построен новый граф из ${nodes.length} узлов; предыдущий черновик заменён.` }, createdAt);
    enterNewLocalDraft(rebuilt, "decision-1");
    setPrompt("");
  }
  function applyPromptIteration() {
    const clean = prompt.trim();
    if (!clean) return;
    const createdAt = new Date().toISOString();
    const current = draftRef.current;
    const result = applyStudioPromptIteration(current, { instruction: clean, locale, nodeLabels: text.nodeTypes, selectedNodeId, createdAt });
    if (!result.changed) return;
    commitStudioDraft(result.draft, locale === "en" ? `Prompt iteration: ${clean.slice(0, 80)}` : `Итерация промпта: ${clean.slice(0, 80)}`, "prompt", createdAt);
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
  function exportDraft() {
    if (!studioCanDuplicate) {
      showSessionNotice(locale === "en" ? "This grant allows inspection only; export and copy are not enabled." : "Этот доступ разрешает только просмотр; экспорт и копирование не включены.");
      return;
    }
    const normalized = normalizeStudioDraft(draft);
    if (!normalized.protection || !/^sha256-[a-f0-9]{64}$/.test(normalized.protection.currentCode) || !/^hmac-sha256-[a-f0-9]{64}$/.test(normalized.protection.seal)) {
      showSessionNotice(locale === "en" ? "Save this exact version to the workspace before exporting its server-sealed JSON." : "Сохраните эту точную версию в workspace перед экспортом JSON с серверной печатью.");
      return;
    }
    const payload: CustomCaseFile = {
      format: "genesis-juris-custom-case",
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      case: {
        id: normalized.caseId,
        version: normalized.version,
        fingerprint: caseFingerprint(normalized),
        parent: normalized.parent,
        protection: normalized.protection,
        visibility: studioPrivate ? "private" : "restricted",
      },
      draft: { ...normalized, updatedAt: new Date().toISOString() },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
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
        let importedCanDuplicate = true;
        if (isRecord(parsed) && parsed.format === "genesis-juris-custom-case" && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2 || parsed.schemaVersion === 3) && isRecord(parsed.case)) {
          imported = normalizeStudioDraft(parsed.draft);
          if (parsed.case.id !== imported.caseId || parsed.case.version !== imported.version || parsed.case.fingerprint !== caseFingerprint(imported)) {
            throw new Error("Custom case identity or fingerprint mismatch");
          }
          if (parsed.schemaVersion === 3) {
            if (!imported.protection || !isRecord(parsed.case.protection) || parsed.case.protection.currentCode !== imported.protection.currentCode || parsed.case.protection.seal !== imported.protection.seal || parsed.case.protection.parentCode !== imported.protection.parentCode || parsed.case.protection.copyPolicy !== imported.protection.copyPolicy) throw new Error("Case protection metadata mismatch");
            const verificationResponse = await fetch("/api/case-protection/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: imported }) });
            const verification = await readJsonResponse<{ valid?: boolean; canDuplicate?: boolean; customCaseId?: number | null; fingerprint?: string }>(verificationResponse);
            if (!verificationResponse.ok || verification?.valid !== true) throw new Error("Case protection seal could not be verified");
            importedCanDuplicate = verification.canDuplicate === true;
            importedCustomCaseId = typeof verification.customCaseId === "number" ? verification.customCaseId : null;
            importedServerFingerprint = typeof verification.fingerprint === "string" ? verification.fingerprint : null;
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
    const payload = await readJsonResponse<{ customCase?: { id: number; isPrivate: boolean; canManagePrivacy: boolean; copyProtected: boolean; fingerprint: string; access: "owner" | "admin" | "shared" }; draft?: unknown; error?: string }>(response);
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
    if (!studioServerFingerprint) {
      showSessionNotice(locale === "en" ? "Save the exact parent version to the workspace before creating its child." : "Сохраните точную родительскую версию в workspace перед созданием дочерней.");
      return;
    }
    const createdAt = new Date().toISOString();
    commitStudioDraft((current) => appendStudioHistory({
      ...current,
      parent: { caseId: current.caseId, version: current.version, fingerprint: caseFingerprint(current) },
      ...(current.protection ? { protection: { ...current.protection, parentCode: current.protection.currentCode, currentCode: "", seal: "" } } : {}),
      version: bumpPatchVersion(current.version),
    }, { role: "studio", source: "visual", action: "case_updated", message: locale === "en" ? `Created child version from ${current.caseId} v${current.version}.` : `Создана дочерняя версия от ${current.caseId} v${current.version}.` }, createdAt), locale === "en" ? "Created child case version" : "Создана дочерняя версия кейса", "visual", createdAt);
    showSessionNotice(locale === "en" ? "Child version created with parent trace" : "Дочерняя версия создана со ссылкой на родителя");
  }
  function recordVisualEdit(action: StudioEditAction, message: string, before?: StudioDraft) {
    if (before) { checkpointStudioDraft(before, action, message); return; }
    const createdAt = new Date().toISOString();
    syncStudioDraft(appendStudioHistory(draftRef.current, { role: "studio", source: "visual", action, message }, createdAt));
  }
  function updateNode(change: Partial<StudioNode>) {
    if (!selectedNodeId) return;
    updateStudioDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNodeId ? { ...node, ...change } : node) }));
  }
  function addNode(type: StudioNodeType) {
    const createdAt = new Date().toISOString();
    if (draftRef.current.nodes.length >= 200) return;
    const id = nextStudioNodeId(draftRef.current.nodes, type);
    commitStudioDraft((current) => {
      const position = nextStudioNodePosition(current.nodes, current.nodes.find((node) => node.id === selectedNodeId));
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
      caseId: "cross_border_ip_financing_review", version: "1.0.0", parent: null,
      title: "Cross-border IP & Financing Review", jurisdiction: "Belgium · EU · International",
      role: "International tax counsel", premise: taxPrompt,
      classification: { domain: "tax", practiceArea: "International tax planning", difficulty: "Advanced", tags: ["tax", "cross-border", "advisory", "anti-abuse"], taxTopics: ["Treaty access", "Beneficial ownership", "Transfer pricing", "DEMPE", "Substance", "CFC", "PE", "Withholding tax", "DAC6", "Pillar Two"], complianceOnly: true, purpose: "lawful_planning", legalAsOf: "2026-08-21", sourceUrls: ["https://www.oecd.org/en/topics/global-minimum-tax.html", "https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/directive-administrative-cooperation-dac/dac6_en"] },
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
  function moveNode(event: React.PointerEvent<HTMLButtonElement>, node: StudioNode) {
    const canvas = event.currentTarget.closest(".graph-canvas"); if (!(canvas instanceof HTMLElement)) return; const rect = canvas.getBoundingClientRect();
    if (event.type === "pointerdown") { event.currentTarget.setPointerCapture(event.pointerId); dragBeforeRef.current = draftRef.current; setDragging({ id: node.id, dx: event.clientX - rect.left - node.x, dy: event.clientY - rect.top - node.y, startX: node.x, startY: node.y, lastX: node.x, lastY: node.y }); setSelectedNodeId(node.id); }
    else if (event.type === "pointermove" && dragging?.id === node.id) {
      const x = Math.max(12, Math.min(rect.width - 178, event.clientX - rect.left - dragging.dx));
      const y = Math.max(12, Math.min(rect.height - 92, event.clientY - rect.top - dragging.dy));
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
    const createdAt = new Date().toISOString();
    const clean = appendStudioHistory({ ...structuredClone(defaultDraft), updatedAt: createdAt }, { role: "studio", source: "visual", action: "graph_rebuilt", message: locale === "en" ? "Started a clean local draft from the starter case." : "Создан чистый локальный черновик из начального кейса." }, createdAt);
    enterNewLocalDraft(clean, "decision-1");
    setPrompt("");
  }
  function purgeLocalStudioState() {
    studioChangedBeforeRestoreRef.current = true;
    if (studioStorageScope) window.localStorage.removeItem(studioDeviceDraftKey(studioStorageScope));
    const clean = structuredClone(defaultDraft);
    const cleanTimeline = emptyStudioTimeline();
    draftRef.current = clean;
    studioTimelineRef.current = cleanTimeline;
    setDraftState(clean);
    setStudioTimelineState(cleanTimeline);
    setStudioPrivate(false);
    setStudioCustomCaseId(null);
    setStudioCanManagePrivacy(true);
    setStudioServerFingerprint(null);
    setStudioCanDuplicate(true);
    setStudioCopyProtectionLocked(false);
    setSelectedNodeId("decision-1");
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="atmosphere" aria-hidden="true"><span /><span /><span /></div>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("library")} aria-label="GENESIS: JURIS CODEX — Case Library">
          {/* The SVG is deliberately served directly; it is a tiny UI mark and does not need responsive image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/brand/genesis-juris-codex-mark.svg" alt="" />
          <span><b>GENESIS: JURIS</b><small><strong>CODEX</strong> · LEGAL SCENARIO SYSTEM</small></span>
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          <button className={view === "library" ? "active" : ""} aria-current={view === "library" ? "page" : undefined} onClick={() => navigate("library")}><Icon name="library" />{text.library}</button>
          <button className={view === "play" ? "active" : ""} aria-current={view === "play" ? "page" : undefined} onClick={() => activeScenario ? navigate("play") : void launchCatalogueCase(featuredRecord)}><Icon name="play" />{text.play}</button>
          <button className={view === "studio" ? "active" : ""} aria-current={view === "studio" ? "page" : undefined} onClick={() => navigate("studio")}><Icon name="studio" />{text.studio}<span className="nav-new">LAB</span></button>
          <button className={view === "community" ? "active" : ""} aria-current={view === "community" ? "page" : undefined} onClick={() => navigate("community")}><Icon name="globe" />{text.community}</button>
          <button className={view === "help" ? "active" : ""} aria-current={view === "help" ? "page" : undefined} onClick={() => navigate("help")}><Icon name="file" />{text.help}</button>
        </nav>
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
          <button className="utility-button" onClick={() => playedCaseImportRef.current?.click()} aria-label={text.importPlay} title={text.importPlay}><Icon name="upload" /><span>{text.importPlay}</span></button>
          {activeScenario && <button className="utility-button" onClick={exportPlayedCase} aria-label={text.exportPlay} title={text.exportPlay}><Icon name="download" /><span>{text.exportPlay}</span></button>}
          <button className="utility-button" onClick={() => setLocale(locale === "en" ? "ru" : "en")} aria-label="Switch language"><Icon name="globe" /><span>{locale.toUpperCase()}</span></button>
          <button className="utility-button" onClick={() => setTheme(theme === "office" ? "after-hours" : "office")} aria-label="Switch atmosphere"><Icon name={theme === "office" ? "sun" : "moon"} /><span>{theme === "office" ? text.office : text.night}</span></button>
        </div>
      </header>

      {view === "library" && <LibraryView locale={locale} text={text} records={catalogueRecords} loadedScenarios={catalogueScenarios} featuredRecord={featuredRecord} featuredScenario={featured} setFeaturedId={setFeaturedId} launchCase={(record) => void launchCatalogueCase(record)} requestFeedback={setFeedbackTarget} openTaxTemplate={loadTaxTemplate} searchCatalogue={refreshCatalogue} nextCursor={catalogueNextCursor} total={catalogueTotal} loading={catalogueLoading} error={catalogueError} />}
      {view === "play" && activeScenario && stage && <PlayView locale={locale} text={text} scenario={activeScenario} stage={stage} stageIndex={stageIndex} metrics={metrics} decisionLog={decisionLog} caseMinute={caseMinute} actionUseCounts={actionUseCounts} completedDeadlineIds={completedDeadlineIds} missedDeadlineIds={missedDeadlineIds} dossierRef={dossierRef} setDossierRef={setDossierRef} setSelectedOption={setSelectedOption} outcome={outcome} sessionSync={playSessionSync} exportSession={exportPlayedCase} replayCase={() => startScenario(activeScenario, { legacyTiming: legacyTimingMode })} returnLibrary={() => navigate("library")} requestFeedback={(contextType, contextId) => setFeedbackTarget({ caseId: activeScenario.caseId, version: activeScenario.version, title: activeScenario.title[locale], source: "playable", fingerprint: activeScenario.fingerprint, contextType, contextId })} />}
      {view === "studio" && <StudioView locale={locale} text={text} prompt={prompt} setPrompt={setPrompt} draft={draft} setDraft={updateStudioDraft} selectedNode={selectedNode} selectedNodeId={selectedNodeId} selectNode={setSelectedNodeId} checks={checks} generateDraft={generateDraft} applyPromptIteration={applyPromptIteration} saveDraft={saveDraft} savedFlash={savedFlash} exportDraft={exportDraft} importRef={importRef} importDraft={importDraft} createChildVersion={createChildVersion} updateNode={updateNode} recordVisualEdit={recordVisualEdit} addNode={addNode} addLink={addLink} relinkLink={relinkLink} deleteLink={deleteLink} deleteNode={deleteNode} moveNode={moveNode} resetDraft={resetStudioDraft} loadTaxTemplate={loadTaxTemplate} requestFeedback={() => setFeedbackTarget({ caseId: draft.caseId, version: draft.version, title: draft.title, source: "studio", fingerprint: caseFingerprint(draft), contextType: selectedNode ? "node" : "case", contextId: selectedNode?.id, privateCase: studioPrivate })} timeline={studioTimeline} undoDraft={() => travelStudioTimeline("undo")} redoDraft={() => travelStudioTimeline("redo")} restoreRevision={restoreStudioRevision} playDraft={playStudioDraft} isPrivate={studioPrivate} setPrivate={setStudioPrivate} customCaseId={studioCustomCaseId} setCustomCaseId={setStudioCustomCaseId} canManagePrivacy={studioCanManagePrivacy} setCanManagePrivacy={setStudioCanManagePrivacy} serverFingerprint={studioServerFingerprint} setServerFingerprint={setStudioServerFingerprint} copyProtectionLocked={studioCopyProtectionLocked} setCopyProtectionLocked={setStudioCopyProtectionLocked} canDuplicate={studioCanDuplicate} />}
      {view === "community" && <CommunityView locale={locale} cases={catalogueRecords} openCustomCase={openWorkspaceCustomCase} refreshCatalogue={() => refreshCatalogue({ force: true })} clearDeviceDraft={purgeLocalStudioState} />}
      {view === "help" && <HelpView locale={locale} openCommunity={() => navigate("community")} openStudio={() => navigate("studio")} />}
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
  { id: "be_commercial_failed_erp_001", currentVersion: "1.1.0", fingerprint: "sha256-2a3c1c410c8108eea6a44225589594b784eb7c5fd8e173ca564273faec695415", title: "Failed ERP Implementation", jurisdiction: "BE · Commercial", practiceArea: "Commercial disputes", sector: "Technology / implementation", difficulty: "Advanced", durationMinutes: 45, reviewLevel: "bundled_beta", authorName: "GENESIS: JURIS", reviewerName: "Expert review pending", legalAsOf: null, summary: "Asteron Systems pursues its ERP supplier after a failed implementation, while scope changes, acceptance language, causation, evidence, deadlines, and layered remedies shape the result.", tags: ["ERP", "evidence", "litigation"], updatedAt: "" },
  { id: "be_commercial_logistics_001", currentVersion: "1.1.0", fingerprint: "sha256-6c567481bf7c79b148800226d6dc832d6e640194b7587c96b8a9f46b91fdef40", title: "Unpaid Logistics Invoices", jurisdiction: "BE · Commercial", practiceArea: "Commercial recovery", sector: "Logistics", difficulty: "Intermediate", durationMinutes: 35, reviewLevel: "bundled_beta", authorName: "GENESIS", reviewerName: "Expert review pending", legalAsOf: null, summary: "Velmont Logistics seeks recovery of unpaid freight and warehousing invoices while Orbis Retail disputes service levels, detention charges, and contractual surcharges.", tags: ["logistics", "CMR", "insolvency"], updatedAt: "" },
  { id: "greenfire_first_72_hours", currentVersion: "0.3.0", fingerprint: "sha256-b131cace9de8bc9627e0642cc03a7ea5c9569cd536a05a6ae137ea51ce6cb279", title: "GreenFire — The First 72 Hours", jurisdiction: "NL · Corporate / Regulatory", practiceArea: "Environmental & crisis", sector: "Industrial / crisis", difficulty: "Intermediate", durationMinutes: 35, reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending", legalAsOf: null, summary: "An industrial fire places a chemical-storage company under simultaneous criminal, regulatory, environmental, insurance, and insolvency pressure.", tags: ["incident", "regulatory", "72h"], updatedAt: "" },
  { id: "nl_food_safety_goldenshell_001", currentVersion: "0.2.0", fingerprint: "sha256-6ead6fc8b4f388493448d06d9e2a59b8b0efd2d0fa052c78ffaed3a133176606", title: "GoldenShell — Recall at Dawn", jurisdiction: "NL · Food safety", practiceArea: "Food safety & product recall", sector: "Food safety", difficulty: "Advanced", durationMinutes: 40, reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending", legalAsOf: null, summary: "A food-safety authority blocks twelve poultry farms after traces of an unauthorised pesticide are detected in eggs.", tags: ["recall", "traceability", "claims"], updatedAt: "" },
  { id: "us_environmental_desert_water_001", currentVersion: "0.2.0", fingerprint: "sha256-67cc3c6ebc23b29940c417ef5a5692ca22c1624b2a6c9d49b18b175e5cb6c1c8", title: "Desert Water", jurisdiction: "US · Environmental", practiceArea: "Environmental mass claims", sector: "Environmental / mass claims", difficulty: "Expert", durationMinutes: 50, reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending", legalAsOf: null, summary: "Residents of Sundial Mesa suspect that hexavalent chromium from Caldera's cooling and compressor facility reached their wells.", tags: ["groundwater", "causation", "mass claims"], updatedAt: "" },
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
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot" />{text.catalogue} · {total.toString().padStart(2, "0")} CASES</div><h1>{text.library}</h1><p className="hero-deck">{locale === "en" ? "Enter a living legal crisis. Read the record, preserve provenance and make the decision that changes the institutional position." : "Войдите в живой юридический кризис. Изучайте материалы, сохраняйте происхождение доказательств и принимайте решения, меняющие институциональную позицию."}</p><div className="hero-facts"><span>03 {locale === "en" ? "legal systems" : "правовые системы"}</span><span>{total.toString().padStart(2, "0")} {locale === "en" ? "versioned cases" : "версионных кейсов"}</span><span>EN / RU</span></div></div>
      <div className="hero-index" aria-label="Catalogue index"><span>CASE INDEX</span><b>{String(Math.max(1, records.findIndex((record) => record.id === featuredRecord.id) + 1)).padStart(2, "0")}</b><small>/ {total.toString().padStart(2, "0")}</small></div>
    </section>
    <section className="positioning-band page-width"><div><span>PROFESSIONAL JUDGMENT · SIMULATED</span><h2>{locale === "en" ? "Train the decisions that legal work rarely lets you repeat." : "Тренируйте решения, которые реальная юридическая работа редко позволяет повторить."}</h2></div><p>{locale === "en" ? "GENESIS: JURIS is a platform for building, reviewing and playing branching legal simulations. It develops judgment under uncertainty, evidence discipline and risk-aware action — with versioned cases and practitioner feedback." : "GENESIS: JURIS — платформа для создания, рецензирования и прохождения разветвлённых юридических симуляций. Она развивает профессиональное суждение в условиях неопределённости, дисциплину доказательств и управление рисками."}</p></section>
    <section className="featured-case" style={{ "--case-accent": featured.accent } as React.CSSProperties}>
      <div className="case-visual" aria-hidden="true"><div className="case-grid" /><div className="case-orbit orbit-one"/><div className="case-orbit orbit-two"/><div className="case-signal"><span/>{featured.id === "greenfire_first_72_hours" ? "72H" : `0${featured.order / 10}`}</div><div className="file-stamp">LIVE MATTER<br/><b>{featured.version}</b></div></div>
      <div className="featured-content"><div className="case-kicker"><span>{featured.jurisdiction}</span><span>{featured.sector[locale]}</span></div><h2>{featured.title[locale]}</h2><p className="case-subtitle">{featured.subtitle[locale]}</p><p className="case-brief">{featured.opening[locale]}</p><div className="case-depth">{featured.stages.length ? <><span>{featured.stages.length} {locale === "en" ? "workflow stages" : "стадий процесса"}</span><span>{featured.stages.reduce((sum, item) => sum + item.options.length, 0)} {locale === "en" ? "actions" : "действий"}</span><span>{featured.deadlines.length} {locale === "en" ? "deadlines" : "дедлайнов"}</span></> : <span>{locale === "en" ? "Immutable manifest loads only when you launch this case" : "Неизменяемый manifest загружается только при запуске кейса"}</span>}</div><dl className="case-meta"><div><dt>{text.role}</dt><dd>{featured.role[locale]}</dd></div><div><dt>{text.jurisdiction}</dt><dd>{featured.jurisdiction}</dd></div><div><dt>CONTENT</dt><dd>v{featured.version}</dd></div></dl><div className="case-trust"><span>{(featuredMeta.reviewLevel ?? "bundled_beta").replaceAll("_", " ")}</span><span>{locale === "en" ? "Author" : "Автор"}: {featuredMeta.authorName ?? "GENESIS: JURIS"}</span><span>{featuredMeta.legalAsOf ? `${locale === "en" ? "Law as of" : "Право на"} ${featuredMeta.legalAsOf}` : (locale === "en" ? "Legal as-of review pending" : "Проверка актуальности права ожидается")}</span></div><div className="featured-actions"><button className="primary-cta" disabled={loading} onClick={() => launchCase(featuredRecord)}>{loading ? (locale === "en" ? "Loading…" : "Загрузка…") : text.launch}<Icon name="arrow"/></button><button className="secondary-cta" onClick={() => requestFeedback({ caseId: featuredRecord.id, version: featuredRecord.currentVersion, title: featured.title[locale], source: "playable", fingerprint: featuredRecord.fingerprint })}>{text.feedback}</button></div></div>
    </section>
    <section className="catalogue-filters page-width"><label className="filter-search"><span>{locale === "en" ? "Search cases and tags" : "Поиск по кейсам и тегам"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "e.g. evidence, recall, CMR" : "например: evidence, recall, CMR"}/></label><label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value)}><option value="all">{locale === "en" ? "All practices" : "Все практики"}</option>{practices.map((practice) => <option key={practice}>{practice}</option>)}</select></label><label><span>{locale === "en" ? "Jurisdiction" : "Юрисдикция"}</span><select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="all">{locale === "en" ? "All jurisdictions" : "Все юрисдикции"}</option>{jurisdictions.map((jurisdiction) => <option key={jurisdiction}>{jurisdiction}</option>)}</select></label><label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">{locale === "en" ? "All levels" : "Все уровни"}</option>{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label><span>{locale === "en" ? "Duration" : "Длительность"}</span><select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}><option value="all">{locale === "en" ? "Any duration" : "Любая"}</option><option value="short">≤ 35 min</option><option value="medium">36–45 min</option><option value="long">45+ min</option></select></label><label><span>{locale === "en" ? "Tag" : "Тег"}</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">{locale === "en" ? "All tags" : "Все теги"}</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label><div className="filter-result"><b>{filteredCases.length.toString().padStart(2, "0")} / {total.toString().padStart(2, "0")}</b><button onClick={resetFilters}>{locale === "en" ? "Reset" : "Сбросить"}</button></div></section>
    {error && <p className="catalogue-status page-width" role="status">{error}</p>}
    <section className="case-strip page-width"><div className="section-heading"><div><span>01 — {String(total).padStart(2,"0")}</span><h2>{locale === "en" ? "Choose the matter" : "Выберите дело"}</h2></div><p>{locale === "en" ? "Search and classification run on the server; full rules load only when a case is launched." : "Поиск и классификация выполняются на сервере; полные правила загружаются только при запуске кейса."}</p></div><div className="case-list">{filteredCases.map((scenario, index) => {
      const meta = metadataFor(scenario);
      const record = records.find((item) => item.id === scenario.caseId)!;
      return <div key={scenario.caseId} className="case-row-wrap"><button className={`case-row ${scenario.caseId === featuredRecord.id ? "selected" : ""}`} onClick={() => { setFeaturedId(scenario.caseId); launchCase(record); }} aria-label={`${text.launch}: ${scenario.title[locale]}`}><span className="row-number">{String(index + 1).padStart(2, "0")}</span><span className="row-main"><b>{scenario.title[locale]}</b><small>{scenario.subtitle[locale]}</small><em>{meta.tags.map((tag) => <i key={tag}>{tag}</i>)}</em></span><span className="row-meta"><i>{scenario.jurisdiction}</i><i>{meta.practice}</i><small>{meta.difficulty} · {meta.duration} min · v{scenario.version}</small><small>{(meta.reviewLevel ?? "bundled_beta").replaceAll("_", " ")}</small></span><span className={`urgency ${scenario.urgency}`}>{scenario.urgency}</span><Icon name="arrow"/></button><button className="case-row-feedback" onClick={() => requestFeedback({ caseId: scenario.caseId, version: scenario.version, title: scenario.title[locale], source: "playable", fingerprint: scenario.fingerprint })}>{text.feedback}</button></div>;
    })}{filteredCases.length === 0 && !loading && <div className="catalogue-empty"><b>{locale === "en" ? "No cases match these filters." : "Кейсы по этим фильтрам не найдены."}</b><button className="secondary-cta" onClick={resetFilters}>{locale === "en" ? "Reset filters" : "Сбросить фильтры"}</button></div>}</div>{nextCursor && <button className="catalogue-load-more secondary-cta" disabled={loading} onClick={() => void searchCatalogue({ filters: { q: query, practiceArea: practiceFilter, jurisdiction: jurisdictionFilter, difficulty: difficultyFilter, tag: tagFilter }, cursor: nextCursor, append: true })}>{loading ? (locale === "en" ? "Loading…" : "Загрузка…") : (locale === "en" ? "Load next 24 cases" : "Загрузить следующие 24 кейса")}</button>}</section>
    <section className="tax-capability page-width"><div><span>CROSS-BORDER TAX STRUCTURING · OFFSHORE COMPLIANCE</span><h2>{locale === "en" ? "Model lawful cross-border tax planning as a living system." : "Моделируйте законное трансграничное налоговое планирование как живую систему."}</h2><p>{locale === "en" ? "Map entities, jurisdictions, cash flows, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 and Pillar Two — with explicit anti-abuse and documentation gates." : "Связывайте компании, юрисдикции, денежные потоки, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 и Pillar Two — с обязательными anti-abuse и документальными проверками."}</p></div><button className="primary-cta" onClick={openTaxTemplate}>{locale === "en" ? "Open tax-planning template" : "Открыть налоговый шаблон"}<Icon name="arrow"/></button></section>
    <section className="authority-note page-width"><span className="authority-seal">β</span><div><b>{text.adaptation}</b><p>{text.canonNote}</p></div><code>WEB BETA · VERSIONED</code></section>
  </main>;
}
function PlayView({ locale, text, scenario, stage, stageIndex, metrics, decisionLog, caseMinute, actionUseCounts, completedDeadlineIds, missedDeadlineIds, dossierRef, setDossierRef, setSelectedOption, outcome, sessionSync, exportSession, replayCase, returnLibrary, requestFeedback }: { locale: Locale; text: UiText; scenario: Scenario; stage: Scenario["stages"][number]; stageIndex: number; metrics: Record<MetricKey, number>; decisionLog: DecisionRecord[]; caseMinute: number; actionUseCounts: Record<string, number>; completedDeadlineIds: string[]; missedDeadlineIds: string[]; dossierRef: string | null; setDossierRef: (ref: string) => void; setSelectedOption: (option: DecisionOption) => void; outcome: OutcomeClass | null; sessionSync: "opening" | "server" | "local" | "stale" | "error"; exportSession: () => void; replayCase: () => void; returnLibrary: () => void; requestFeedback: (contextType: "case" | "stage", contextId?: string) => void }) {
  const activeMaterial = scenario.materials.find((material) => material.ref === dossierRef) ?? scenario.materials[0];
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedInboxIndex, setSelectedInboxIndex] = useState(0);
  const decisionRef = useRef<HTMLElement>(null);
  const clock = formatCaseClock(caseMinute);
  const activeActionIds = new Set(stage.options.map((option) => option.id));
  const visitedStageIds = new Set(decisionLog.map((entry) => entry.stageId));
  const workflowInbox = scenario.workflowInbox.filter((item) => item.initiallyVisible || item.resolutionActions.some((action) => activeActionIds.has(action)));
  const unresolvedWorkflowInbox = workflowInbox.filter((item) => !item.resolutionActions.some((action) => (actionUseCounts[action] ?? 0) > 0));
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
  const deadlineRows = scenario.deadlines.map((deadline) => {
    const completed = completedDeadlineIds.includes(deadline.id);
    const missed = missedDeadlineIds.includes(deadline.id);
    const remaining = deadline.dueAtMinute - caseMinute;
    return { deadline, completed, missed, remaining };
  }).sort((left, right) => left.deadline.dueAtMinute - right.deadline.dueAtMinute);
  const nextDeadline = deadlineRows.find((row) => !row.completed && !row.missed);
  const availableCount = sessionSync === "opening" ? 0 : stage.options.filter((option) => {
    const uses = actionUseCounts[option.id] ?? 0;
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
  if (outcome) return <DebriefView locale={locale} text={text} scenario={scenario} metrics={metrics} decisionLog={decisionLog} outcome={outcome} exportSession={exportSession} replayCase={replayCase} returnLibrary={returnLibrary} requestFeedback={() => requestFeedback("case")}/>;
  return <main className="operations-view"><aside className="case-rail"><button className="rail-back" onClick={returnLibrary}><span>←</span>{text.library}</button><div className="rail-case"><small>ACTIVE MATTER</small><b>{scenario.title[locale]}</b><span>{scenario.jurisdiction}</span></div><div className="workflow-depth"><span>{scenario.stages.length} STAGES</span><span>{scenario.stages.reduce((sum, item) => sum + item.options.length, 0)} ACTIONS</span></div><div className={`run-authority ${sessionSync}`}><span>{sessionSync === "server" ? (locale === "en" ? "SERVER-AUTHORITATIVE RUN" : "РАСЧЁТ НА СЕРВЕРЕ") : sessionSync === "opening" ? (locale === "en" ? "OPENING RUN…" : "ЗАПУСК…") : sessionSync === "stale" ? (locale === "en" ? "SERVER STATE RESTORED" : "СОСТОЯНИЕ ВОССТАНОВЛЕНО") : sessionSync === "error" ? (locale === "en" ? "SYNC NEEDS RETRY" : "НУЖНА СИНХРОНИЗАЦИЯ") : (locale === "en" ? "LOCAL PREVIEW RUN" : "ЛОКАЛЬНЫЙ ПРЕДПРОСМОТР")}</span></div><ol className="stage-list">{scenario.stages.map((item, index) => <li key={item.id} className={index === stageIndex ? "active" : visitedStageIds.has(item.id) ? "done" : ""}><span>{visitedStageIds.has(item.id) && index !== stageIndex ? "✓" : index + 1}</span><div><b>{item.phase[locale]}</b><small>{item.terminal ? "TERMINAL" : item.id.replaceAll("_", " ")}</small></div></li>)}</ol><div className="rail-version">CONTENT v{scenario.version}<br/><code>{scenario.fingerprint}</code></div></aside>
    <section className="command-center">
      <div className="command-header">
        <div>
          <div className="eyebrow"><span className="live-dot"/>LIVE OPERATION · {text.day.toUpperCase()} {clock.day}</div>
          <h1>{scenario.title[locale]}</h1>
          <p>{stage.phase[locale]} <span>·</span> {clock.time}</p>
        </div>
        <div className="command-clock"><span>{clock.time}</span><small>{text.day} {clock.day} · FOREGROUND</small></div>
      </div>
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
        <div className="deadline-heading"><div><span>{locale === "en" ? "DEADLINE CONTROL" : "КОНТРОЛЬ СРОКОВ"}</span><h2>{locale === "en" ? "Time changes the case" : "Время изменяет дело"}</h2></div><code>{scenario.deadlines.length.toString().padStart(2,"0")} DEADLINES</code></div>
        {deadlineRows.length === 0 ? <p className="no-deadlines">{locale === "en" ? "No authored deadline is active in this introductory matter." : "В этом вводном деле нет настроенных дедлайнов."}</p> : <div className="deadline-list">{deadlineRows.map(({deadline,completed,missed,remaining}) => <div key={deadline.id} className={`deadline-row ${completed ? "complete" : missed ? "missed" : remaining <= 180 ? "urgent" : ""}`}><span className="deadline-state">{completed ? "✓" : missed ? "!" : "◷"}</span><div><b>{deadline.title[locale]}</b><small>{completed ? (locale === "en" ? "Completed" : "Выполнено") : missed ? remainingLabel(remaining) : remainingLabel(remaining)}</small></div><time>D{Math.floor(deadline.dueAtMinute/1440)+1} · {formatCaseClock(deadline.dueAtMinute).time}</time></div>)}</div>}
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
          {stage.options.map((option) => { const uses=actionUseCounts[option.id]??0; const availability=decisionAvailability(option,metrics,uses); const stateLabel=sessionSync === "opening" ? (locale === "en" ? "OPENING SERVER RUN" : "ЗАПУСК СЕРВЕРНОГО РАСЧЁТА") : availability.exhausted ? (locale === "en" ? "COMPLETED" : "ВЫПОЛНЕНО") : !availability.available ? (locale === "en" ? "LOCKED BY RULE" : "ЗАБЛОКИРОВАНО ПРАВИЛОМ") : `€ ${option.cost.toLocaleString()} · ${option.minutes} MIN${option.repeatability==="limited" ? ` · ${uses}/${option.maxUses}` : ""}`; return <button key={option.id} disabled={sessionSync === "opening" || !availability.available} onClick={() => setSelectedOption(option)} title={!availability.available && !availability.exhausted ? availability.blockedGuards.map((guard)=>`${guard.metric} ${guard.comparison} ${guard.value}`).join(", ") : undefined}><span>{option.label[locale]}</span><small>{stateLabel}</small><Icon name={sessionSync === "opening" || !availability.available ? availability.exhausted ? "check" : "alert" : "arrow"}/></button>;})}
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
    <aside className="dossier-pane"><div className="pane-heading"><span>{text.dossier}</span><b>{scenario.materials.length}</b></div><p className="pane-intro">{text.visibleMaterial} · {text.provenance}</p><div className="material-tabs">{scenario.materials.map((material) => <button key={material.ref} className={material.ref === activeMaterial.ref ? "active" : ""} onClick={() => setDossierRef(material.ref)}><code>{material.ref}</code><span>{material.title[locale]}</span></button>)}</div><article className="material-sheet"><div className="sheet-punch"/><div className="sheet-reg">{activeMaterial.ref}</div><span className="document-type">{activeMaterial.type[locale]}</span><h3>{activeMaterial.title[locale]}</h3><dl><div><dt>SOURCE</dt><dd>{activeMaterial.source[locale]}</dd></div><div><dt>DATE / TIME</dt><dd>{activeMaterial.date}</dd></div><div><dt>CASE</dt><dd>{scenario.caseId}</dd></div></dl><p>{locale === "en" ? "Visible case material. Source identity remains attached; opening this record does not recommend a decision." : "Видимый материал дела. Идентичность источника сохранена; открытие записи не рекомендует решение."}</p><div className="sheet-status"><Icon name="check"/> PROVENANCE ATTACHED</div></article>{decisionLog.length > 0 && <section className="mini-log"><h3>{text.actionLog}</h3>{decisionLog.map((entry,index) => <div key={`${entry.option.id}-${index}`}><span>{String(index+1).padStart(2,"0")}</span><p>{entry.option.label[locale]}</p></div>)}</section>}</aside></main>;
}

function DebriefView({ locale, text, scenario, metrics, decisionLog, outcome, exportSession, replayCase, returnLibrary, requestFeedback }: { locale: Locale; text: UiText; scenario: Scenario; metrics: Record<MetricKey, number>; decisionLog: DecisionRecord[]; outcome: OutcomeClass; exportSession: () => void; replayCase: () => void; returnLibrary: () => void; requestFeedback: () => void }) {
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
          <h2>{scenario.outcomes[outcome][locale]}</h2>
          <p>{presentation.explanation}</p>
        </div>
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
        <button className="secondary-cta" onClick={returnLibrary}>{text.returnLibrary}</button>
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

function DecisionModal({ locale, text, scenario, stageHeadline, option, isResult, busy, close, dispatch, advance, finalStage }: { locale: Locale; text: UiText; scenario: Scenario; stageHeadline: string; option: DecisionOption; isResult: boolean; busy: boolean; close: () => void; dispatch: () => void | Promise<void>; advance: () => void; finalStage: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isResult && !busy) close(); }}><section className={`decision-modal ${isResult ? "result" : ""}`} role="dialog" aria-modal="true" aria-labelledby="decision-title" aria-busy={busy}>{!isResult && <button className="modal-close" onClick={close} disabled={busy} aria-label={text.cancel}><Icon name="close"/></button>}<div className="modal-register">{isResult ? "DISPATCH RECORD" : "RESPONSE REVIEW"}<span>{scenario.caseId}</span></div><div className="modal-icon"><Icon name={isResult ? "check" : "file"} size={30}/></div><span className="modal-kicker">{isResult ? text.consequence : text.review}</span><h2 id="decision-title">{option.label[locale]}</h2><p className="modal-context">{isResult ? option.result[locale] : option.detail[locale]}</p>{!isResult && <><div className="modal-source"><small>CURRENT SITUATION</small><p>{stageHeadline}</p></div><dl className="decision-cost"><div><dt>{text.cost}</dt><dd>EUR {option.cost.toLocaleString()}</dd></div><div><dt>{text.duration}</dt><dd>{option.minutes} min</dd></div></dl><div className="effect-preview">{(Object.entries(option.effects) as Array<[MetricKey, number]>).map(([key,value]) => <span key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</span>)}</div></>}<div className="modal-actions">{!isResult && <button className="secondary-cta" onClick={close} disabled={busy}>{text.cancel}</button>}<button className="primary-cta" disabled={busy} onClick={isResult ? advance : dispatch}>{busy ? (locale === "en" ? "Recording…" : "Фиксация…") : isResult ? (finalStage ? text.debrief : text.continueCase) : text.confirm}<Icon name="arrow"/></button></div></section></div>;
}

type StudioViewProps = {
  locale: Locale; text: UiText; prompt: string; setPrompt: (value: string) => void; draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>; selectedNode: StudioNode | null; selectedNodeId: string | null;
  selectNode: (id: string | null) => void; checks: Array<{ level: "ok" | "warn"; text: string }>;
  generateDraft: () => void; applyPromptIteration: () => void; saveDraft: () => void; savedFlash: boolean;
  exportDraft: () => void; importRef: React.RefObject<HTMLInputElement | null>; importDraft: (file: File) => void;
  createChildVersion: () => void; updateNode: (change: Partial<StudioNode>) => void;
  recordVisualEdit: (action: StudioEditAction, message: string, before?: StudioDraft) => void; addNode: (type: StudioNodeType) => void;
  addLink: (from: string, to: string) => void; relinkLink: (previous: StudioLink, next: StudioLink) => void;
  deleteLink: (link: StudioLink) => void; deleteNode: () => void;
  moveNode: (event: React.PointerEvent<HTMLButtonElement>, node: StudioNode) => void; resetDraft: () => void;
  loadTaxTemplate: () => void; requestFeedback: () => void;
  timeline: StudioTimeline; undoDraft: () => void; redoDraft: () => void;
  restoreRevision: (revision: StudioRevision) => void; playDraft: () => void;
  isPrivate: boolean; setPrivate: (value: boolean) => void; customCaseId: number | null; setCustomCaseId: (value: number | null) => void;
  canManagePrivacy: boolean; setCanManagePrivacy: (value: boolean) => void;
  serverFingerprint: string | null; setServerFingerprint: (value: string | null) => void;
  copyProtectionLocked: boolean; setCopyProtectionLocked: (value: boolean) => void; canDuplicate: boolean;
};

function StudioView({ locale, text, prompt, setPrompt, draft, setDraft, selectedNode, selectedNodeId, selectNode, checks, generateDraft, applyPromptIteration, saveDraft, savedFlash, exportDraft, importRef, importDraft, createChildVersion, updateNode, recordVisualEdit, addNode, addLink, relinkLink, deleteLink, deleteNode, moveNode, resetDraft, loadTaxTemplate, requestFeedback, timeline, undoDraft, redoDraft, restoreRevision, playDraft, isPrivate, setPrivate, customCaseId, setCustomCaseId, canManagePrivacy, setCanManagePrivacy, serverFingerprint, setServerFingerprint, copyProtectionLocked, setCopyProtectionLocked, canDuplicate }: StudioViewProps) {
  const router = useRouter();
  const [workspaceState, setWorkspaceState] = useState<"idle" | "saving" | "saved" | "submitted" | "conflict" | "error">("idle");
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [relationStatus, setRelationStatus] = useState("");
  const fieldBefore = useRef("");
  const fieldBeforeDraft = useRef<StudioDraft | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [selectedRuleLinkId, setSelectedRuleLinkId] = useState<string | null>(null);
  const promptPlan = useMemo(() => planStudioPromptIteration(draft, { instruction: prompt, locale, nodeLabels: text.nodeTypes, selectedNodeId }), [draft, locale, prompt, selectedNodeId, text.nodeTypes]);
  const compiledDraft = useMemo(() => compileStudioDraft(draft), [draft]);
  const selectedRuleLink = draft.links.find((link) => link.id === selectedRuleLinkId) ?? null;
  const selectedRevision = timeline.revisions.find((revision) => revision.id === selectedRevisionId) ?? timeline.revisions.at(-1) ?? null;
  const selectedDiff = selectedRevision ? diffStudioSnapshots(selectedRevision.before, selectedRevision.after) : null;
  const restoreDiff = selectedRevision ? diffDraftToRevision(draft, selectedRevision) : null;

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

  async function shareDraft(action: "save" | "submit") {
    if (!canDuplicate) { setWorkspaceState("error"); return; }
    setWorkspaceState("saving");
    const childFromCurrent = Boolean(serverFingerprint && draft.parent?.fingerprint === serverFingerprint && draft.parent.version !== draft.version);
    const concurrency = serverFingerprint ? childFromCurrent ? { baseFingerprint: serverFingerprint } : { expectedFingerprint: serverFingerprint } : {};
    const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, draft, isPrivate, ...concurrency }) });
    if (response.status === 401) { router.push("/signin-with-chatgpt?return_to=%2F"); return; }
    if (!response.ok) {
      const failed = await response.json().catch(() => null) as { code?: string } | null;
      setWorkspaceState(response.status === 409 && failed?.code === "stale_draft" ? "conflict" : "error");
      return;
    }
    const saved = await readJsonResponse<{ customCase?: { id: number; isPrivate: boolean; fingerprint: string; protection?: StudioDraft["protection"] } }>(response);
    if (saved?.customCase) {
      setCustomCaseId(saved.customCase.id); setPrivate(saved.customCase.isPrivate === true); setCanManagePrivacy(true); setServerFingerprint(saved.customCase.fingerprint);
      if (saved.customCase.protection) {
        setDraft((current) => ({ ...current, protection: saved.customCase!.protection }));
        setCopyProtectionLocked(saved.customCase.protection.copyProtected === true);
      }
    }
    setWorkspaceState(action === "submit" ? "submitted" : "saved");
  }

  async function changePrivacy(next: boolean) {
    if (!canManagePrivacy) return;
    if (next && !window.confirm(locale === "en" ? "Make this case owner-only? Saving this setting revokes every existing share and hides the case from the platform administrator." : "Сделать кейс доступным только владельцу? Сохранение настройки отзовёт все приглашения и скроет кейс от администратора платформы.")) return;
    if (customCaseId) {
      const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_privacy", id: customCaseId, isPrivate: next, caseId: draft.caseId }) });
      if (!response.ok) { setWorkspaceState("error"); return; }
    }
    setPrivate(next);
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
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    selectNode(node.id);
    const before = draft;
    setDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, x: Math.max(0, Math.min(5_000, item.x + direction[0] * step)), y: Math.max(0, Math.min(5_000, item.y + direction[1] * step)) } : item) }));
    recordVisualEdit("node_moved", locale === "en" ? `Visual edit: nudged “${node.title}” ${event.key.replace("Arrow", "").toLowerCase()} by ${step}px.` : `Визуальная правка: узел «${node.title}» сдвинут на ${step}px.`, before);
  }

    return <main className="studio-view"><section className="studio-hero page-width"><div><div className="eyebrow"><span className="live-dot"/>AUTHORING LAB · VISUAL + PROMPT</div><h1>{text.author}</h1><p>{text.authorLead}</p></div><div className="studio-actions"><button className="secondary-cta" onClick={resetDraft}><Icon name="reset"/>{text.newDraft}</button><button className="secondary-cta" onClick={loadTaxTemplate}><Icon name="spark"/>{locale === "en" ? "Tax template" : "Налоговый шаблон"}</button><button className="secondary-cta" onClick={requestFeedback}><Icon name="file"/>{text.feedback}</button><button className="secondary-cta" onClick={() => importRef.current?.click()} disabled={!canDuplicate}><Icon name="upload"/>{text.importCustom}</button><button className="secondary-cta" onClick={exportDraft} disabled={!canDuplicate}><Icon name="download"/>{text.exportCustom}</button><button className="secondary-cta" onClick={() => shareDraft("save")} disabled={!canDuplicate || workspaceState === "saving"}><Icon name="save"/>{locale === "en" ? "Save to workspace" : "Сохранить в workspace"}</button><button className="primary-cta" onClick={() => shareDraft("submit")} disabled={!canDuplicate || isPrivate || workspaceState === "saving" || checks.some((check) => check.level === "warn")} title={isPrivate ? (locale === "en" ? "Turn off Private before submitting for review" : "Отключите «Приватно» перед отправкой на рецензию") : undefined}><Icon name="check"/>{locale === "en" ? "Submit for review" : "Отправить на рецензию"}</button><button className="secondary-cta" onClick={saveDraft} disabled={!canDuplicate}><Icon name="save"/>{locale === "en" ? "Save on this device" : "Сохранить на устройстве"}</button><input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file) importDraft(file); event.target.value=""; }}/></div>{savedFlash && <div className="save-toast"><Icon name="check"/>{text.saved}</div>}{workspaceState !== "idle" && workspaceState !== "saving" && <div className={`workspace-toast ${workspaceState}`} role="status">{workspaceState === "saved" ? (locale === "en" ? "Workspace draft and visibility saved." : "Черновик и режим видимости сохранены в workspace.") : workspaceState === "submitted" ? (locale === "en" ? "Submitted to the expert review queue." : "Отправлено в очередь экспертной рецензии.") : workspaceState === "conflict" ? (locale === "en" ? "A newer workspace version exists. Reopen the case before saving." : "В workspace уже есть более новая версия. Переоткройте кейс перед сохранением.") : !canDuplicate ? (locale === "en" ? "Inspection-only access: save, export and copy are disabled." : "Доступ только для просмотра: сохранение, экспорт и копирование отключены.") : (locale === "en" ? "The workspace change could not be saved. Check access, identity and case status." : "Не удалось сохранить изменение workspace. Проверьте доступ, идентификатор и статус кейса.")}</div>}</section>
    <aside className="confidentiality-notice page-width"><Icon name="alert"/><p>{locale === "en" ? "Confidentiality: do not enter client-identifiable, privileged, personal or secret information. Use synthetic or de-identified facts and public legal sources." : "Конфиденциальность: не вводите сведения, идентифицирующие клиента, адвокатскую тайну, персональные данные или секреты. Используйте синтетические или обезличенные факты и публичные источники права."}</p></aside>
    <section className="studio-history page-width" aria-labelledby="studio-history-title">
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
    </section>
    <section className="prompt-deck page-width"><div className="prompt-label"><span>{locale === "en" ? "Next prompt iteration" : "Следующая итерация промпта"}</span><code>PLAN · VALIDATE · APPLY</code></div><textarea value={prompt} maxLength={2000} placeholder={locale === "en" ? "Use explicit commands: Add evidence “Board minutes”; Connect evidence-2 to decision-1; Rename actor-1 to “Planning authority”…" : "Используйте явные команды: Добавь доказательство «Протокол»; Свяжи evidence-2 с decision-1; Переименуй actor-1 в «Орган планирования»…"} onChange={(event) => setPrompt(event.target.value)} aria-label={text.prompt}/><div className="prompt-actions"><button className="generate-button" disabled={!promptPlan.canApply} onClick={applyPromptIteration}><Icon name="spark" size={24}/><span>{locale === "en" ? `Apply ${promptPlan.operations.length || "context"} change${promptPlan.operations.length === 1 ? "" : "s"}` : `Применить: ${promptPlan.operations.length || "контекст"}`}<small>{locale === "en" ? "The deterministic plan below is applied as one undoable transaction" : "Детерминированный план ниже применяется одной обратимой транзакцией"}</small></span><Icon name="arrow"/></button><button className="rebuild-button" disabled={!prompt.trim()} onClick={() => { if (window.confirm(locale === "en" ? "Replace the current draft graph and lineage with a new graph built from this prompt?" : "Заменить текущий граф и родительскую линию новым графом из этого промпта?")) generateDraft(); }}><Icon name="reset"/>{locale === "en" ? "Build as new graph" : "Построить новый граф"}</button></div></section>
    {prompt.trim() && <section className={`prompt-plan page-width ${promptPlan.canApply ? "ready" : "blocked"}`} aria-live="polite"><header><div><span>{locale === "en" ? "Interpreted change plan" : "Распознанный план изменений"}</span><h2>{promptPlan.contextOnly ? (locale === "en" ? "Context-only turn" : "Только контекст") : (locale === "en" ? `${promptPlan.operations.length} explicit operation${promptPlan.operations.length === 1 ? "" : "s"}` : `Явных операций: ${promptPlan.operations.length}`)}</h2></div><b>{promptPlan.canApply ? "READY" : "REVIEW"}</b></header>{promptPlan.operations.length > 0 && <ol>{promptPlan.operations.map((operation, index) => <li key={`${operation.kind}-${index}`}><code>{String(index + 1).padStart(2,"0")}</code><span>{describeStudioPromptOperation(operation, locale)}</span></li>)}</ol>}{promptPlan.diagnostics.length > 0 && <ul>{promptPlan.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.level}-${index}`} className={diagnostic.level}><Icon name={diagnostic.level === "error" ? "alert" : "check"}/>{diagnostic.message}</li>)}</ul>}</section>}
    <section className="studio-meta page-width"><label><span>{text.title}</span><input value={draft.title} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,title:event.target.value}))} onBlur={(event)=>commitCaseField(text.title,event.currentTarget.value)}/></label><label><span>{text.jurisdiction}</span><input value={draft.jurisdiction} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,jurisdiction:event.target.value}))} onBlur={(event)=>commitCaseField(text.jurisdiction,event.currentTarget.value)}/></label><label><span>{text.role}</span><input value={draft.role} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,role:event.target.value}))} onBlur={(event)=>commitCaseField(text.role,event.currentTarget.value)}/></label></section>
    <section className="studio-classification page-width">
      <label><span>{locale === "en" ? "Case domain" : "Домен кейса"}</span><select value={draft.classification?.domain ?? (isTaxClassification(draft.classification) ? "tax" : "general")} onChange={(event) => applyCaseChange(locale === "en" ? "domain" : "домен", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), domain: event.target.value === "tax" ? "tax" : "general" } }))}><option value="general">General legal</option><option value="tax">Tax / cross-border structuring</option></select></label>
      <label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={draft.classification?.practiceArea ?? "General legal"} onChange={(event) => applyCaseChange(locale === "en" ? "practice area" : "область практики", (current) => ({ ...current, classification: { ...(current.classification ?? { difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), practiceArea: event.target.value } }))}><option>General legal</option><option>International tax planning</option><option>Corporate tax</option><option>Transfer pricing</option><option>Commercial disputes</option><option>AI regulation</option><option>Privacy & cybersecurity</option></select></label>
      <label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={draft.classification?.difficulty ?? "Intermediate"} onChange={(event) => applyCaseChange(locale === "en" ? "difficulty" : "сложность", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", tags: [], taxTopics: [], complianceOnly: true }), difficulty: event.target.value } }))}><option>Foundation</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></label>
      <label><span>{locale === "en" ? "Tax-case purpose" : "Цель налогового кейса"}</span><select value={draft.classification?.purpose ?? "compliance_review"} onChange={(event) => applyCaseChange(locale === "en" ? "tax-case purpose" : "цель налогового кейса", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), purpose: event.target.value as NonNullable<StudioDraft["classification"]>["purpose"] } }))}><option value="lawful_planning">Lawful planning</option><option value="compliance_review">Compliance review</option><option value="audit_defence">Audit defence</option><option value="evasion_detection">Evasion detection</option></select></label>
      <label><span>{locale === "en" ? "Law / guidance as of" : "Право / guidance на дату"}</span><input type="date" value={draft.classification?.legalAsOf ?? ""} onChange={(event) => applyCaseChange(locale === "en" ? "legal as-of date" : "дату актуальности права", (current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), legalAsOf: event.target.value } }))}/></label>
      <label className="wide-field"><span>{locale === "en" ? "Tags · comma separated" : "Теги · через запятую"}</span><input value={(draft.classification?.tags ?? []).join(", ")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", taxTopics: [], complianceOnly: true }), tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "tags" : "теги", event.currentTarget.value)}/></label>
      <label className="wide-field"><span>{locale === "en" ? "Tax topics · treaty, CFC, PE, WHT, DAC6…" : "Налоговые темы · treaty, CFC, PE, WHT, DAC6…"}</span><input value={(draft.classification?.taxTopics ?? []).join(", ")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], complianceOnly: true }), taxTopics: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "tax topics" : "налоговые темы", event.currentTarget.value)}/></label>
      <label className="source-field"><span>{locale === "en" ? "HTTPS legal sources · one per line" : "HTTPS-источники права · по одному в строке"}</span><textarea rows={3} value={(draft.classification?.sourceUrls ?? []).join("\n")} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), sourceUrls: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) } }))} onBlur={(event)=>commitCaseField(locale === "en" ? "legal sources" : "источники права", event.currentTarget.value)}/></label>
      <div className="compliance-gate"><Icon name="check"/><div><b>{locale === "en" ? "International tax safety & publication gate" : "Контроль безопасности и публикации налогового кейса"}</b><p>{locale === "en" ? "Lawful-planning, compliance, audit-defence and evasion-detection scenarios may model risky facts. Publication requires named reviewer confirmation that the case does not enable concealment, sham substance, false reporting or evasion; HTTPS sources and a legal as-of date are mandatory." : "Кейсы о законном планировании, compliance, налоговом споре и выявлении уклонения могут моделировать рискованные факты. Для публикации именная рецензия должна подтвердить, что кейс не помогает сокрытию, фиктивной substance, ложной отчётности или уклонению; HTTPS-источники и дата актуальности права обязательны."}</p></div></div>
    </section>
    <section className={`studio-access page-width ${isPrivate ? "private" : "restricted"}`} aria-labelledby="studio-access-title">
      <div><span>{locale === "en" ? "Access & visibility" : "Доступ и видимость"}</span><h2 id="studio-access-title">{isPrivate ? (locale === "en" ? "Private · owner only" : "Приватно · только владелец") : (locale === "en" ? "Restricted custom case" : "Ограниченный custom-кейс")}</h2><p id="studio-private-description">{isPrivate ? (locale === "en" ? "Only you can open this workspace case. The platform administrator, reviewers and previous recipients cannot see its content or metadata." : "Только вы можете открыть этот кейс в workspace. Администратор платформы, рецензенты и ранее приглашённые пользователи не видят его содержание и метаданные.") : (locale === "en" ? "Visible to you and the platform administrator. Other registered users need an explicit share; it is not part of the General Library." : "Виден вам и администратору платформы. Другим зарегистрированным пользователям требуется явное приглашение; в Общую библиотеку кейс не входит.")}</p></div>
      <label className={`privacy-toggle ${canManagePrivacy ? "" : "locked"}`}><input type="checkbox" checked={isPrivate} disabled={!canManagePrivacy} onChange={(event) => changePrivacy(event.target.checked)} aria-describedby="studio-private-description"/><span>{canManagePrivacy ? (locale === "en" ? "Private" : "Приватно") : (locale === "en" ? "Owner controls privacy" : "Приватность задаёт владелец")}</span><i aria-hidden="true"/></label>
      <div className="copy-protection-control"><div><span>{locale === "en" ? "JSON lineage protection" : "Защита JSON-линии"}</span><b>{draft.protection?.copyProtected ? (copyProtectionLocked ? (locale === "en" ? "Copy-protected · inherited" : "Копирование защищено · наследуется") : (locale === "en" ? "Protection pending save" : "Защита ожидает сохранения")) : (locale === "en" ? "Forks allowed" : "Форки разрешены")}</b><p>{locale === "en" ? "A server HMAC seal binds the current and parent codes. Once a saved lineage is locked, child versions cannot remove the policy." : "Серверная HMAC-печать связывает коды текущей и родительской версий. После фиксации защиты дочерние версии не могут её снять."}</p></div><label className={`privacy-toggle compact ${canManagePrivacy ? "" : "locked"}`}><input type="checkbox" checked={draft.protection?.copyProtected === true} disabled={!canManagePrivacy || (copyProtectionLocked && draft.protection?.copyProtected === true)} onChange={(event) => changeCopyProtection(event.target.checked)}/><span>{draft.protection?.copyProtected ? (locale === "en" ? "Protected" : "Защищено") : (locale === "en" ? "Protect" : "Защитить")}</span><i aria-hidden="true"/></label></div>
      {draft.protection && <dl className="protection-register"><div><dt>{locale === "en" ? "Parent code" : "Код родителя"}</dt><dd><code>{draft.protection.parentCode ?? (locale === "en" ? "Root · no parent" : "Корень · без родителя")}</code></dd></div><div><dt>{locale === "en" ? "Current version code" : "Код текущей версии"}</dt><dd><code>{draft.protection.currentCode || (locale === "en" ? "Pending workspace seal" : "Ожидает печати workspace")}</code></dd></div><div><dt>HMAC SEAL</dt><dd><code>{draft.protection.seal || (locale === "en" ? "Save to workspace to seal" : "Сохраните в workspace для печати")}</code></dd></div></dl>}
    </section>
    <section className="studio-version page-width">
      <div className="version-heading"><span>{text.customCase}</span><button className="secondary-cta" disabled={!canDuplicate} onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></div>
      <label><span>{text.caseId}</span><input value={draft.caseId} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,caseId:slugifyCaseId(event.target.value)}))} onBlur={(event)=>commitCaseField(text.caseId,event.currentTarget.value)}/></label>
      <label><span>{text.version}</span><input value={draft.version} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setDraft((current) => ({...current,version:event.target.value}))} onBlur={(event)=>commitCaseField(text.version,event.currentTarget.value)} aria-invalid={!/^\d+\.\d+\.\d+$/.test(draft.version)}/></label>
      <div className="version-value"><span>{text.fingerprint}</span><code>{caseFingerprint(draft)}</code></div>
      <div className="parent-trace"><span>{text.parentCase}</span>{draft.parent ? <><b>{draft.parent.caseId}</b><code>v{draft.parent.version} · {draft.parent.fingerprint}</code></> : <em>{locale === "en" ? "Root case · no parent" : "Корневой кейс · родителя нет"}</em>}</div>
    </section>
    <section className="studio-workspace">
      <aside className="node-palette"><div className="pane-heading"><span>{text.addNode}</span><b>{String(Object.keys(typeColors).length).padStart(2,"0")}</b></div>{(Object.keys(typeColors) as StudioNodeType[]).map((type) => <button key={type} disabled={draft.nodes.length >= 200} onClick={() => addNode(type)}><i style={{background:typeColors[type]}}/><span>{text.nodeTypes[type]}</span><Icon name="plus"/></button>)}<p>{locale === "en" ? "Add nodes here. On the graph, choose an output dot and then an input dot to create a relation. Every completed edit is added to the history." : "Добавляйте узлы здесь. На графе выберите выходную, затем входную точку, чтобы создать связь. Каждая завершённая правка попадёт в историю."}</p></aside>
      <section className="graph-deck">
        <div className="graph-heading"><div><span>{text.graph}</span><b>{draft.title}</b></div><div><code>{draft.nodes.length} NODES</code><code>{draft.links.length} LINKS</code></div></div>
        <div className="graph-connect-status" role="status" aria-live="polite"><span className={linkSourceId ? "armed" : ""}/>{relationStatus || (locale === "en" ? "Relation mode ready · OUT → IN" : "Режим связей готов · ВЫХОД → ВХОД")}{linkSourceId && <button onClick={() => { setLinkSourceId(null); setRelationStatus(""); }}>{locale === "en" ? "Cancel" : "Отмена"}</button>}</div>
        <div className="graph-canvas">
          <svg className="graph-links" aria-hidden="true">{draft.links.map((link) => { const from=draft.nodes.find((node)=>node.id===link.from); const to=draft.nodes.find((node)=>node.id===link.to); if(!from||!to)return null; return <g key={link.id}><path d={`M ${from.x+165} ${from.y+38} C ${from.x+205} ${from.y+38}, ${to.x-38} ${to.y+38}, ${to.x} ${to.y+38}`}/><circle cx={to.x} cy={to.y+38} r="3"/></g>; })}</svg>
          {draft.nodes.map((node) => <div key={node.id} className={`graph-node-shell ${node.id===selectedNodeId?"selected":""} ${node.id===linkSourceId?"link-source":""}`} style={{left:node.x,top:node.y,"--node-color":typeColors[node.type]} as React.CSSProperties}>
            <button className="node-port node-port-in" onClick={() => completeLink(node.id)} aria-label={locale === "en" ? `Use ${node.title} as relation destination` : `Использовать ${node.title} как назначение связи`}><span/></button>
            <button className="graph-node" onFocus={() => selectNode(node.id)} onKeyDown={(event) => nudgeNode(event, node)} onPointerDown={(event)=>moveNode(event,node)} onPointerMove={(event)=>moveNode(event,node)} onPointerUp={(event)=>moveNode(event,node)} onPointerCancel={(event)=>moveNode(event,node)} aria-label={`${text.nodeTypes[node.type]}: ${node.title}. ${locale === "en" ? "Use arrow keys to reposition." : "Используйте стрелки для перемещения."}`}><span><i/>{text.nodeTypes[node.type]}<code>{node.id.split("-").at(-1)}</code></span><b>{node.title}</b></button>
            <button className="node-port node-port-out" aria-pressed={node.id===linkSourceId} onClick={() => armLinkSource(node.id)} aria-label={locale === "en" ? `Start relation from ${node.title}` : `Начать связь от ${node.title}`}><span/></button>
          </div>)}
        </div>
        <div className="graph-legend">{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><span key={type}><i style={{background:typeColors[type]}}/>{text.nodeTypes[type]}</span>)}</div>
        <details className="graph-relations" open>
          <summary>{locale === "en" ? "Relationship & Rules DSL editor" : "Редактор связей и Rules DSL"} · {draft.links.length}</summary>
          {draft.links.length ? <>
            <ol>{draft.links.map((link, index) => <li key={link.id} className={selectedRuleLinkId === link.id ? "rules-selected" : ""}>
              <code>{String(index + 1).padStart(2,"0")}</code>
              <label><span>{locale === "en" ? "Source" : "Источник"}</span><select aria-label={locale === "en" ? `Source for relation ${index + 1}` : `Источник связи ${index + 1}`} value={link.from} onChange={(event) => changeRelation(link, "from", event.target.value)}>{draft.nodes.map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}</option>)}</select></label>
              <span className="relation-arrow">→</span>
              <label><span>{locale === "en" ? "Destination" : "Назначение"}</span><select aria-label={locale === "en" ? `Destination for relation ${index + 1}` : `Назначение связи ${index + 1}`} value={link.to} onChange={(event) => changeRelation(link, "to", event.target.value)}>{draft.nodes.map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}</option>)}</select></label>
              <button className="relation-rules" onClick={() => setSelectedRuleLinkId((current) => current === link.id ? null : link.id)} aria-expanded={selectedRuleLinkId === link.id}>{locale === "en" ? "Rules" : "Правила"}</button>
              <button className="relation-delete" onClick={() => { deleteLink(link); if (selectedRuleLinkId === link.id) setSelectedRuleLinkId(null); setRelationStatus(locale === "en" ? "Relation deleted." : "Связь удалена."); }} aria-label={locale === "en" ? `Delete relation ${index + 1}` : `Удалить связь ${index + 1}`}><Icon name="trash" size={15}/></button>
            </li>)}</ol>
            {selectedRuleLink && <RelationRuleEditor locale={locale} link={selectedRuleLink} beginFieldEdit={beginFieldEdit} setRule={(change) => setRelationRule(selectedRuleLink.id, change)} applyRule={(change, label) => applyRelationRuleChange(selectedRuleLink.id, change, label)} commitField={(label, value) => commitRelationRule(selectedRuleLink.id, label, value)}/>}
          </> : <p>{locale === "en" ? "No relations yet. Use node ports or the inspector to create one." : "Связей пока нет. Используйте порты узлов или инспектор."}</p>}
        </details>
      </section>
      <aside className="node-inspector"><div className="pane-heading"><span>{text.inspector}</span><b>{selectedNode?"01":"00"}</b></div>{selectedNode?<div className="inspector-form">
        <div className="selected-type"><i style={{background:typeColors[selectedNode.type]}}/><span>{text.nodeTypes[selectedNode.type]}</span><code>{selectedNode.id}</code></div>
        <label><span>{text.nodeType}</span><select value={selectedNode.type} onChange={(event)=>{ const type=event.target.value as StudioNodeType; if(type!==selectedNode.type){ const before=draft; updateNode({type}); recordVisualEdit("node_updated", locale === "en" ? `Visual edit: changed “${selectedNode.title}” from ${text.nodeTypes[selectedNode.type]} to ${text.nodeTypes[type]}.` : `Визуальная правка: тип узла «${selectedNode.title}» изменён на «${text.nodeTypes[type]}».`, before); } }}>{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><option key={type} value={type}>{text.nodeTypes[type]}</option>)}</select></label>
        <label><span>{text.title}</span><input value={selectedNode.title} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>updateNode({title:event.target.value})} onBlur={(event)=>commitNodeField(text.title,event.currentTarget.value)}/></label>
        <label><span>{text.detail}</span><textarea value={selectedNode.detail} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event)=>updateNode({detail:event.target.value})} onBlur={(event)=>commitNodeField(text.detail,event.currentTarget.value)}/></label>
        <fieldset className="node-runtime-fields"><legend>RULES DSL · STAGE</legend><label><span>{locale === "en" ? "Authored day" : "Заданный день"}</span><input type="number" min="1" max="10000" value={selectedNode.runtime?.day ?? ""} placeholder="auto" onChange={(event)=>applyNodeRuntimeChange({day:event.target.value ? Number(event.target.value) : undefined},locale === "en" ? "day" : "день")}/></label><label><span>{locale === "en" ? "Authored time" : "Заданное время"}</span><input type="time" value={selectedNode.runtime?.time ?? ""} onChange={(event)=>applyNodeRuntimeChange({time:event.target.value || undefined},locale === "en" ? "time" : "время")}/></label>{selectedNode.type === "outcome" && <label><span>{locale === "en" ? "Outcome class" : "Класс исхода"}</span><select value={selectedNode.runtime?.terminalOutcome ?? "auto"} onChange={(event)=>applyNodeRuntimeChange({terminalOutcome:event.target.value === "auto" ? undefined : event.target.value as "strong"|"mixed"|"weak"},locale === "en" ? "outcome class" : "класс исхода")}><option value="auto">Auto</option><option value="strong">Strong</option><option value="mixed">Mixed</option><option value="weak">Weak</option></select></label>}{selectedNode.type === "deadline" && <><label><span>{locale === "en" ? "Deadline day" : "День дедлайна"}</span><input type="number" min="1" max="10000" value={selectedNode.runtime?.deadlineDay ?? ""} placeholder="auto" onChange={(event)=>applyNodeRuntimeChange({deadlineDay:event.target.value ? Number(event.target.value) : undefined},locale === "en" ? "deadline day" : "день дедлайна")}/></label><label><span>{locale === "en" ? "Deadline time" : "Время дедлайна"}</span><input type="time" value={selectedNode.runtime?.deadlineTime ?? ""} onChange={(event)=>applyNodeRuntimeChange({deadlineTime:event.target.value || undefined},locale === "en" ? "deadline time" : "время дедлайна")}/></label><label><span>{locale === "en" ? "Missed route" : "Переход при пропуске"}</span><select value={selectedNode.runtime?.missedOutcomeNodeId ?? ""} onChange={(event)=>applyNodeRuntimeChange({missedOutcomeNodeId:event.target.value || undefined},locale === "en" ? "missed-deadline route" : "переход при пропуске")}><option value="">Auto · weakest outcome</option>{draft.nodes.filter((node)=>node.type==="outcome").map((node)=><option key={node.id} value={node.id}>{node.title}</option>)}</select></label></>}</fieldset>
        <label><span>{locale === "en" ? "Connect selected node to" : "Связать выбранный узел с"}</span><select value="" onChange={(event) => { const target=event.target.value; if(!target)return; const issue=canUseRelation(selectedNode.id,target); if(issue){setRelationStatus(issue);return;} addLink(selectedNode.id,target); setRelationStatus(locale === "en" ? "Relation created." : "Связь создана."); }}><option value="">{locale === "en" ? "Choose destination…" : "Выберите узел…"}</option>{draft.nodes.filter((node)=>node.id!==selectedNode.id).map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}</option>)}</select></label>
        <button className="danger-button" onClick={() => { const relations=draft.links.filter((link)=>link.from===selectedNode.id||link.to===selectedNode.id).length; if(!relations || window.confirm(locale === "en" ? `Delete this node and ${relations} connected relation(s)?` : `Удалить узел и связанные связи (${relations})?`)) deleteNode(); }}><Icon name="trash"/>{text.deleteNode}</button>
      </div>:<p className="empty-inspector">{text.noSelection}</p>}</aside>
    </section>
    <section className="studio-bottom page-width"><div className="checks-panel"><div className="panel-title"><span>{text.checks}</span><b>{checks.filter((check)=>check.level==="warn").length.toString().padStart(2,"0")}</b></div>{checks.map((check,index)=><div key={index} className={`check-row ${check.level}`}><Icon name={check.level==="ok"?"check":"alert"}/><span>{check.text}</span></div>)}<p>{text.localNote}</p></div><div className="preview-panel"><div className="panel-title"><span>{locale === "en" ? "Full player compilation" : "Сборка полноценного прохождения"}</span><b>{compiledDraft.scenario ? "READY" : "BLOCKED"}</b></div><div className="preview-card compiler-card"><div className="preview-index">GRAPH RUNTIME / {draft.nodes.length} NODES</div><h2>{draft.title||"Untitled matter"}</h2><p>{locale === "en" ? "The current graph is compiled deterministically into the same stages, decisions, deadlines, metrics, export and debrief runtime used by published cases." : "Текущий граф детерминированно собирается в тот же runtime стадий, решений, сроков, метрик, экспорта и разбора, что и опубликованные кейсы."}</p>{compiledDraft.scenario ? <><dl><div><dt>{locale === "en" ? "Playable stages" : "Игровых стадий"}</dt><dd>{compiledDraft.scenario.stages.length}</dd></div><div><dt>{locale === "en" ? "Decision actions" : "Вариантов действий"}</dt><dd>{compiledDraft.scenario.stages.reduce((sum, stage) => sum + stage.options.length, 0)}</dd></div></dl>{compiledDraft.warnings.map((warning) => <p className="compiler-warning" key={warning}>{warning}</p>)}<button className="primary-cta" onClick={playDraft}><Icon name="play"/>{locale === "en" ? "Play my current case" : "Пройти мой текущий кейс"}</button></> : <div className="compiler-issues">{compiledDraft.issues.map((issue) => <div key={issue.code}><Icon name="alert"/><span>{issue.message}{issue.nodeIds.length ? ` · ${issue.nodeIds.join(", ")}` : ""}</span></div>)}</div>}</div></div></section>
  </main>;
}

function RelationRuleEditor({ locale, link, beginFieldEdit, setRule, applyRule, commitField }: {
  locale: Locale;
  link: StudioLink;
  beginFieldEdit: (value: string) => void;
  setRule: (change: NonNullable<StudioLink["rule"]>) => void;
  applyRule: (change: NonNullable<StudioLink["rule"]>, label: string) => void;
  commitField: (label: string, value: string) => void;
}) {
  const rule = link.rule ?? {};
  const guard = rule.guards?.[0];
  const numberValue = (value: string) => value === "" ? undefined : Number(value);
  return <section className="relation-rule-editor" aria-label={locale === "en" ? `Runtime rules for ${link.id}` : `Runtime-правила для ${link.id}`}>
    <header><div><span>RULES DSL · {link.id}</span><h3>{locale === "en" ? "Author the action, not just the arrow" : "Настройте действие, а не только стрелку"}</h3></div><code>{link.from} → {link.to}</code></header>
    <div className="relation-rule-grid">
      <label className="wide-field"><span>{locale === "en" ? "Action label" : "Название действия"}</span><input value={rule.label ?? ""} placeholder={locale === "en" ? "Defaults to destination title" : "По умолчанию — название целевого узла"} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ label: event.target.value })} onBlur={(event) => commitField(locale === "en" ? "action label" : "название действия", event.currentTarget.value)}/></label>
      <label><span>{locale === "en" ? "Cost · EUR" : "Стоимость · EUR"}</span><input type="number" min="0" max="1000000000" value={rule.cost ?? ""} placeholder="0" onChange={(event) => applyRule({ cost: numberValue(event.target.value) }, locale === "en" ? "cost" : "стоимость")}/></label>
      <label><span>{locale === "en" ? "Duration · minutes" : "Длительность · минуты"}</span><input type="number" min="0" max="100000000" value={rule.minutes ?? ""} placeholder="20" onChange={(event) => applyRule({ minutes: numberValue(event.target.value) }, locale === "en" ? "duration" : "длительность")}/></label>
      {(Object.keys(metricLabels.en) as MetricKey[]).map((metric) => <label key={metric}><span>{metricLabels[locale][metric]} · Δ</span><input type="number" min="-100" max="100" value={rule.effects?.[metric] ?? ""} placeholder="auto" onChange={(event) => applyRule({ effects: { ...(rule.effects ?? {}), [metric]: numberValue(event.target.value) } }, `${metric} effect`)}/></label>)}
      <label><span>{locale === "en" ? "Repeatability" : "Повторяемость"}</span><select value={rule.repeatability ?? "once"} onChange={(event) => { const repeatability = event.target.value as NonNullable<StudioLink["rule"]>["repeatability"]; applyRule({ repeatability, maxUses: repeatability === "limited" ? rule.maxUses ?? 2 : undefined }, locale === "en" ? "repeatability" : "повторяемость"); }}><option value="once">Once</option><option value="repeatable">Repeatable</option><option value="limited">Limited</option></select></label>
      {rule.repeatability === "limited" && <label><span>{locale === "en" ? "Maximum uses" : "Максимум использований"}</span><input type="number" min="1" max="10000" value={rule.maxUses ?? 2} onChange={(event) => applyRule({ maxUses: Math.max(1, Number(event.target.value) || 1) }, locale === "en" ? "maximum uses" : "лимит использований")}/></label>}
      <label><span>{locale === "en" ? "Guard metric" : "Метрика условия"}</span><select value={guard?.metric ?? "none"} onChange={(event) => applyRule({ guards: event.target.value === "none" ? undefined : [{ metric: event.target.value as MetricKey, comparison: guard?.comparison ?? "gte", value: guard?.value ?? 50 }] }, locale === "en" ? "availability guard" : "условие доступности")}><option value="none">{locale === "en" ? "Always available" : "Всегда доступно"}</option>{(Object.keys(metricLabels.en) as MetricKey[]).map((metric) => <option key={metric} value={metric}>{metricLabels[locale][metric]}</option>)}</select></label>
      {guard && <><label><span>{locale === "en" ? "Comparison" : "Сравнение"}</span><select value={guard.comparison} onChange={(event) => applyRule({ guards: [{ ...guard, comparison: event.target.value as "gte" | "lte" | "eq" }] }, locale === "en" ? "guard comparison" : "сравнение условия")}><option value="gte">≥</option><option value="lte">≤</option><option value="eq">=</option></select></label><label><span>{locale === "en" ? "Threshold" : "Порог"}</span><input type="number" min="0" max="100" value={guard.value} onChange={(event) => applyRule({ guards: [{ ...guard, value: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }] }, locale === "en" ? "guard threshold" : "порог условия")}/></label></>}
      <label className="wide-field"><span>{locale === "en" ? "Consequence text" : "Текст последствия"}</span><textarea value={rule.result ?? ""} placeholder={locale === "en" ? "Defaults to destination detail" : "По умолчанию — описание целевого узла"} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ result: event.target.value })} onBlur={(event) => commitField(locale === "en" ? "consequence text" : "текст последствия", event.currentTarget.value)}/></label>
    </div>
    <p>{locale === "en" ? "Typed rules are validated and interpreted deterministically; no uploaded JavaScript or eval is executed." : "Типизированные правила валидируются и исполняются детерминированно; загружаемый JavaScript и eval не используются."}</p>
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
type AdminCommunityUser = { email: string; displayName: string; organisation: string; licenseTier: "community" | "professional" | "enterprise"; verifiedPractitioner: boolean };

function CommunityView({ locale, cases, openCustomCase, refreshCatalogue, clearDeviceDraft }: { locale: Locale; cases: PublishedCaseSummary[]; openCustomCase: (id: number) => void; refreshCatalogue: () => Promise<void>; clearDeviceDraft: () => void }) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [updates, setUpdates] = useState<CommunityUpdate[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [customCases, setCustomCases] = useState<CommunityCustomCase[]>([]);
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
        fetch("/api/custom-cases").then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[] }>(response)),
      ]);
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? []); setSubmissions(workspace?.submissions ?? []); setCustomCases(custom?.customCases ?? []); setStatus("ready");
    }).catch(() => setStatus("anonymous"));
  }, []);
  async function reloadCustomCases() {
    const payload = await fetch("/api/custom-cases").then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[] }>(response));
    setCustomCases(payload?.customCases ?? []);
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
    if (!window.confirm(locale === "en" ? "Delete your profile, subscriptions, drafts and feedback? This cannot be undone." : "Удалить профиль, подписки, черновики и отзывы? Это действие необратимо.")) return;
    const response = await fetch("/api/me", { method: "DELETE" });
    if (response.ok) { clearDeviceDraft(); setRegistered(false); setUpdates([]); setSubscriptions([]); setSubmissions([]); setCustomCases([]); setCaseShares({}); setCaseFeedback({}); setFormError(locale === "en" ? "Stored community and device-draft data deleted." : "Данные сообщества и локальный черновик удалены."); }
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
      <div className="profile-data-actions"><a className="secondary-cta" href="/account">{locale === "en" ? "Account & sign-out" : "Аккаунт и выход"}</a>{registered && <button type="button" className="danger-button" onClick={deleteProfile}>{locale === "en" ? "Delete my stored data" : "Удалить мои данные"}</button>}</div>
    </form>
    <section className="update-panel"><div className="panel-title"><span>{locale === "en" ? "Addressed update inbox" : "Адресный центр обновлений"}</span><b>{updates.filter((item) => !item.read).length.toString().padStart(2, "0")}</b></div>{updates.length ? updates.map((item) => <article key={item.id} className={item.read ? "" : "unread"}><span>{item.kind}</span><h3>{item.title}</h3><p>{item.body}</p><footer><small>{item.publishedAt?.slice(0, 10)}</small>{!item.read && <button onClick={() => markRead(item.id)}>{locale === "en" ? "Mark read" : "Прочитано"}</button>}</footer></article>) : <div className="empty-updates"><Icon name="check"/><b>{locale === "en" ? "You are up to date" : "У вас всё актуально"}</b><p>{locale === "en" ? "New releases matching your profile and explicit preferences will appear here." : "Здесь появятся релизы, соответствующие профилю и явным настройкам согласия."}</p></div>}</section>
    </section>
    <section className="subscription-panel"><div className="panel-title"><span>{locale === "en" ? "Follow individual cases" : "Подписки на отдельные кейсы"}</span><b>{subscriptions.length.toString().padStart(2, "0")}</b></div><div>{cases.map((item) => <button key={item.id} className={subscriptions.includes(item.id) ? "subscribed" : ""} onClick={() => toggleSubscription(item.id)}><span><b>{item.title}</b><small>{item.jurisdiction} · v{item.currentVersion}</small></span><em>{subscriptions.includes(item.id) ? (locale === "en" ? "Following" : "Подписка") : (locale === "en" ? "Follow" : "Подписаться")}</em></button>)}</div></section>
    <section className="workspace-panel"><div className="panel-title"><span>{locale === "en" ? "My Studio review workspace" : "Мои кейсы на рецензии"}</span><b>{submissions.length.toString().padStart(2, "0")}</b></div>{submissions.length ? <div className="workspace-list">{submissions.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.caseId} · v{item.version}</small></div><span>{item.status.replaceAll("_", " ")}</span>{item.reviewerNote && <p>{item.reviewerNote}</p>}</article>)}</div> : <p>{locale === "en" ? "Save or submit a Studio draft to start the moderated practitioner workflow." : "Сохраните или отправьте черновик Studio, чтобы начать модерируемый рабочий процесс."}</p>}</section>
    <section className="custom-access-panel" aria-labelledby="custom-access-title">
      <div className="panel-title"><span id="custom-access-title">{isAdmin ? (locale === "en" ? "Visible custom-case register" : "Реестр видимых custom-кейсов") : (locale === "en" ? "My & shared custom cases" : "Мои и доступные custom-кейсы")}</span><b>{customCases.length.toString().padStart(2, "0")}</b></div>
      <p className="custom-access-explainer">{locale === "en" ? "Workspace cases are never public by default. Restricted cases are visible to the owner, Maxim and invited registered users; Private cases are owner-only. Device-only saves do not appear here." : "Workspace-кейсы по умолчанию не публичны. Ограниченные кейсы видны владельцу, Максиму и приглашённым зарегистрированным пользователям; приватные — только владельцу. Локальные сохранения с устройства здесь не отображаются."}</p>
      {customMessage && <p className="custom-access-message" role="status">{customMessage}</p>}
      {customCases.length ? <div className="custom-case-grid">{customCases.map((item) => {
        const shares = caseShares[item.id];
        const feedback = caseFeedback[item.id];
        const mayDelegateReshare = item.access === "owner" || item.access === "admin";
        return <article className={`custom-case-card ${item.isPrivate ? "private" : "restricted"}`} key={item.id}>
          <header><div className="custom-case-badges"><span>{item.isPrivate ? "PRIVATE · OWNER ONLY" : item.access === "shared" ? "SHARED CUSTOM" : "RESTRICTED CUSTOM"}</span>{item.copyProtected && <span className="copy-lock-badge">LINEAGE LOCKED</span>}{item.status === "promoted" && <span className="library-badge">GENERAL LIBRARY SNAPSHOT</span>}</div><small>{item.access === "owner" ? (locale === "en" ? "You own this case" : "Вы владелец") : item.access === "admin" ? (locale === "en" ? `Admin view · ${item.ownerDisplayName ?? "Case author"}` : `Вид администратора · ${item.ownerDisplayName ?? "Автор кейса"}`) : (locale === "en" ? `Shared by ${item.ownerDisplayName ?? "case author"}` : `Предоставил доступ: ${item.ownerDisplayName ?? "автор кейса"}`)}</small></header>
          <h3>{item.title}</h3><code>{item.caseId} · v{item.currentVersion}</code>
          <p>{item.isPrivate ? (locale === "en" ? "No administrator, reviewer or previous recipient can discover this case." : "Администратор, рецензент и прежние получатели не могут обнаружить этот кейс.") : (locale === "en" ? `${item.shareCount} explicit share(s) · not in the public catalogue` : `Явных приглашений: ${item.shareCount} · не в публичном каталоге`)}</p>
          {item.status === "promoted" && <p className="promotion-note">{locale === "en" ? "An immutable copy is public. Changing this workspace source does not rewrite that published version." : "Неизменяемая копия опубликована. Изменения этого workspace-источника не переписывают опубликованную версию."}</p>}
          <div className="custom-case-actions"><button type="button" className="secondary-cta" onClick={() => openCustomCase(item.id)}><Icon name="studio"/>{locale === "en" ? "Open in Studio" : "Открыть в Studio"}</button>{item.canManagePrivacy && <label className="privacy-toggle compact"><input type="checkbox" checked={item.isPrivate} disabled={busyCaseId === item.id} onChange={(event) => setCustomPrivacy(item, event.target.checked)}/><span>{locale === "en" ? "Private" : "Приватно"}</span><i aria-hidden="true"/></label>}</div>
          {!item.isPrivate && item.canShare && <form className="custom-share-form" onSubmit={(event) => { event.preventDefault(); shareCustomCase(item); }}><label><span>{locale === "en" ? "Registered recipient email" : "Email зарегистрированного получателя"}</span><input type="email" value={shareEmails[item.id] ?? ""} onChange={(event) => setShareEmails((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="colleague@example.com"/></label>{mayDelegateReshare && <label className="reshare-check"><input type="checkbox" checked={shareReshare[item.id] === true} onChange={(event) => setShareReshare((current) => ({ ...current, [item.id]: event.target.checked }))}/><span>{locale === "en" ? "Allow forwarding (recipient still needs Professional or Enterprise)" : "Разрешить пересылку (получателю всё равно нужна лицензия Professional или Enterprise)"}</span></label>}<button className="primary-cta" disabled={busyCaseId === item.id || !(shareEmails[item.id] ?? "").trim()}>{locale === "en" ? "Grant access" : "Предоставить доступ"}<Icon name="arrow"/></button></form>}
          {!item.isPrivate && !item.canShare && <p className="license-hint">{item.access === "owner" ? (locale === "en" ? `Sharing requires Professional or Enterprise; current tier: ${profile.licenseTier}.` : `Для предоставления доступа нужна лицензия Professional или Enterprise; текущая: ${profile.licenseTier}.`) : (locale === "en" ? "Forwarding requires Professional or Enterprise plus an explicit reshare grant." : "Для пересылки нужна лицензия Professional или Enterprise и отдельное право на дальнейший доступ.")}</p>}
          {!item.isPrivate && (item.access === "owner" || item.access === "admin") && <div className="custom-share-register"><button type="button" onClick={() => loadCaseShares(item)} disabled={busyCaseId === item.id}>{shares ? (locale === "en" ? "Refresh access list" : "Обновить список доступа") : (locale === "en" ? `Manage access (${item.shareCount})` : `Управлять доступом (${item.shareCount})`)}</button>{shares?.map((share) => <div key={share.recipientEmail}><span><b>{share.recipientEmail}</b><small>{share.canReshare ? (locale === "en" ? "may forward with licence" : "может пересылать при наличии лицензии") : (locale === "en" ? "view only" : "только просмотр")}</small></span><button type="button" onClick={() => revokeCustomShare(item, share.recipientEmail)} disabled={busyCaseId === item.id}>{locale === "en" ? "Revoke" : "Отозвать"}</button></div>)}</div>}
          {item.access === "owner" && <div className="custom-feedback-register"><button type="button" onClick={() => loadCaseShares(item)} disabled={busyCaseId === item.id}>{feedback ? (locale === "en" ? "Refresh my case notes" : "Обновить мои заметки") : (locale === "en" ? "View my case notes" : "Мои заметки по кейсу")}</button>{feedback && (feedback.length ? feedback.map((entry) => <article key={entry.id}><span><b>{entry.audience === "owner_private" ? (locale === "en" ? "PRIVATE · OWNER ONLY" : "ПРИВАТНО · ТОЛЬКО ВЛАДЕЛЕЦ") : entry.category.replaceAll("_", " ")}</b><small>{entry.createdAt.slice(0, 10)} · {entry.rating}/5 · {entry.severity}</small></span><p>{entry.comment}</p>{entry.suggestedCorrection && <p><b>{locale === "en" ? "Suggested correction:" : "Предлагаемое исправление:"}</b> {entry.suggestedCorrection}</p>}{entry.citationUrl && <a href={entry.citationUrl} target="_blank" rel="noreferrer">{locale === "en" ? "Supporting source" : "Подтверждающий источник"}</a>}</article>) : <p>{locale === "en" ? "No notes for this case yet." : "Заметок по этому кейсу пока нет."}</p>)}</div>}
        </article>;
      })}</div> : <p>{locale === "en" ? "No workspace custom cases are visible to this account yet. Save a Studio case to the workspace first." : "Для аккаунта пока нет видимых workspace custom-кейсов. Сначала сохраните кейс из Studio в workspace."}</p>}
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
  const [adminBusy, setAdminBusy] = useState("");
  const [pendingPromotion, setPendingPromotion] = useState<PromotionCandidate | null>(null);
  const [taxReviewNote, setTaxReviewNote] = useState("");
  const [taxReviewChecks, setTaxReviewChecks] = useState<Record<TaxPublicationChecklistKey, boolean>>(() => Object.fromEntries(taxPublicationChecklist.map((key) => [key, false])) as Record<TaxPublicationChecklistKey, boolean>);
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/submissions").then((response) => readJsonResponse<{ submissions?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/feedback").then((response) => readJsonResponse<{ feedback?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/users").then((response) => readJsonResponse<{ users?: AdminCommunityUser[] }>(response)),
    ]).then(([submissionsPayload, feedbackPayload, usersPayload]) => {
      setQueue(submissionsPayload?.submissions ?? []);
      setFeedbackQueue(feedbackPayload?.feedback ?? []);
      setAdminUsers(usersPayload?.users ?? []);
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
    if (isTaxClassification(sourceDraft.classification)) {
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
    const response = await fetch("/api/admin/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customCaseId: candidate.item.id, draft: candidate.draft, playableScenario: candidate.scenario, authorName: candidate.item.ownerDisplayName ?? "Custom case author", reviewerName: "Maxim Hayan · platform administrator", reviewLevel: "community_beta", changeSummary: "Promoted from a restricted custom workspace to the General Library as an immutable snapshot.", durationMinutes: 45, sector: candidate.draft.classification?.practiceArea ?? "General legal", ...(taxSafetyAttestation ? { taxSafetyAttestation } : {}) }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      await Promise.all([reloadCustomCases(), refreshCatalogue()]);
      setPendingPromotion(null); setTaxReviewNote("");
      setMessage(locale === "en" ? "Immutable case version published to the General Library." : "Неизменяемая версия опубликована в Общей библиотеке.");
    } else setMessage(result?.error ?? (locale === "en" ? "Promotion failed validation." : "Кейс не прошёл проверки публикации."));
    setAdminBusy("");
  }
  async function confirmTaxPromotion() {
    if (!pendingPromotion || !pendingPromotion.draft.classification || !isTaxClassification(pendingPromotion.draft.classification)) return;
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
  const pendingTaxClassification = pendingPromotion && isTaxClassification(pendingPromotion.draft.classification) ? pendingPromotion.draft.classification : null;
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
    <section className="admin-license-register"><div className="admin-section-heading"><div><span>SERVER ENTITLEMENTS</span><h2>{locale === "en" ? "Sharing licences" : "Лицензии на пересылку"}</h2></div><b>{adminUsers.length.toString().padStart(2, "0")}</b></div><p>{locale === "en" ? "Professional and Enterprise users may share their own restricted cases. A recipient may forward somebody else’s case only when the owner or Maxim also granted a reshare permission." : "Пользователи Professional и Enterprise могут делиться собственными ограниченными кейсами. Получатель может переслать чужой кейс, только если владелец или Максим отдельно разрешил дальнейший доступ."}</p><div>{adminUsers.map((user) => <label key={user.email}><span><b>{user.displayName || user.email}</b><small>{user.email}{user.organisation ? ` · ${user.organisation}` : ""}</small></span><select value={user.licenseTier} disabled={adminBusy === `license:${user.email}`} onChange={(event) => changeLicense(user.email, event.target.value as AdminCommunityUser["licenseTier"])}><option value="community">Community</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></label>)}</div></section>
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
    "Open Case Studio: prompts and visual changes share one continuous authoring record.",
    "Describe several changes in one prompt, then inspect the deterministic operation plan before applying it.",
    "Apply the plan as one reversible transaction and inspect its exact field, node, and relationship diff.",
    "Add or rename a node directly on the graph; connect it through the source and target ports.",
    "Select an existing relationship and relink its endpoint without rebuilding the case.",
    "Compile the current valid graph and launch it in the full case player.",
  ] : [
    "Откройте Case Studio: промпты и визуальные правки образуют единую непрерывную историю кейса.",
    "Опишите несколько изменений одним промптом и до применения изучите детерминированный план операций.",
    "Примените план одной обратимой транзакцией и проверьте точный diff полей, узлов и связей.",
    "Добавьте или переименуйте узел на графе и соедините его через исходящий и входящий порты.",
    "Выберите существующую связь и перепривяжите её конец без пересборки кейса.",
    "Скомпилируйте валидный текущий граф и запустите его в полном плеере кейсов.",
  ];
  const playTranscript = locale === "en" ? [
    "Confirm that the Studio compiler reports the current graph as ready.",
    "Launch your case in the same Operations player used by published scenarios.",
    "Review the record, available evidence, deadline, and linked decision options.",
    "Confirm a decision and observe its consequence, clock, metrics, and deadline state.",
    "Finish the branch and inspect the complete debrief for your own case.",
  ] : [
    "Убедитесь, что компилятор Studio отмечает текущий граф как готовый.",
    "Запустите кейс в том же плеере Operations, что используется для опубликованных сценариев.",
    "Изучите материалы, доказательства, срок и варианты связанного решения.",
    "Подтвердите выбор и проследите его последствия, время, метрики и состояние срока.",
    "Завершите ветвь и изучите полный разбор собственного кейса.",
  ];
  return <main className="help-view page-width">
    <section className="help-hero"><span>QUICK HELP</span><h1>{locale === "en" ? "How GENESIS: JURIS works" : "Как работает GENESIS: JURIS"}</h1><p>{locale === "en" ? "A practical legal-simulation system: read the evolving matter, make consequential decisions, learn from the debrief and help practitioners improve the next version." : "Практическая система юридических симуляций: изучайте развивающееся дело, принимайте значимые решения, анализируйте результат и помогайте улучшать следующую версию."}</p></section>
    <section className="help-steps">{steps.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{body}</p></article>)}</section>
    <section className="help-video-guides" aria-labelledby="help-video-guides-title">
      <header><span>GUIDED DEMOS</span><h2 id="help-video-guides-title">{locale === "en" ? "Create, refine, then play" : "Создайте, доработайте и пройдите"}</h2><p>{locale === "en" ? "Two short, captioned walkthroughs use the live product interface. Open the transcript below either video for a text-only version." : "Два коротких ролика с субтитрами записаны в действующем интерфейсе. Под каждым видео доступна текстовая расшифровка."}</p></header>
      <div className="help-video-grid">
        <article className="help-video-card">
          <video controls preload="metadata" playsInline poster="/help/case-studio-iterative-editing-poster.jpg" aria-describedby="editor-video-description editor-video-transcript">
            <source src="/help/case-studio-iterative-editing.mp4" type="video/mp4"/>
            <track kind="captions" src="/help/case-studio-iterative-editing.en.vtt" srcLang="en" label="English" default={locale === "en"}/>
            <track kind="captions" src="/help/case-studio-iterative-editing.ru.vtt" srcLang="ru" label="Русский" default={locale === "ru"}/>
            {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
          </video>
          <div className="help-video-copy"><span>01 · 00:26</span><h3>{locale === "en" ? "Build and refine a case" : "Создание и итеративное редактирование"}</h3><p id="editor-video-description">{locale === "en" ? "Move from an iterative prompt to a reviewed operation plan, then add, rename, connect and relink nodes visually—with exact history, undo, and compilation." : "Перейдите от итеративного промпта к проверяемому плану операций, затем добавляйте, переименовывайте, связывайте и перепривязывайте узлы визуально — с точной историей, отменой и компиляцией."}</p></div>
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
    <section className="help-faq">
      <h2>{locale === "en" ? "Short answers" : "Короткие ответы"}</h2>
      <details open>
        <summary>{locale === "en" ? "Where is my Studio case saved?" : "Где сохраняется мой кейс Studio?"}</summary>
        <p>{locale === "en" ? "For a signed-in account, “Save on this device” is available only for a local, unprotected and non-Private draft. The browser copy is scoped to that account and cleared on sign-out; anonymous, workspace, protected and Private cases are never cached there. “Save to workspace” stores the custom case under your account for access and review management." : "Для авторизованного аккаунта «Сохранить на устройстве» доступно только для локального, незащищённого и неприватного черновика. Копия в браузере привязана к этому аккаунту и удаляется при выходе; анонимные, workspace-, защищённые и приватные кейсы там не кэшируются. «Сохранить в workspace» хранит custom-кейс в аккаунте для управления доступом и рецензированием."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "Who can see a custom case?" : "Кто видит custom-кейс?"}</summary>
        <p>{locale === "en" ? "A restricted custom case is visible to its owner, the platform administrator and registered people who receive an explicit access grant. It is not discoverable by other users and does not appear in the General Library." : "Ограниченный custom-кейс видят его владелец, администратор платформы и зарегистрированные пользователи с явно предоставленным доступом. Для остальных он недоступен и не появляется в Общей библиотеке."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "What changes when I turn on Private?" : "Что меняется при включении «Приватно»?"}</summary>
        <p>{locale === "en" ? "Only you can open the workspace case through the product: the administrator, reviewers and prior recipients are excluded and grants are revoked. This is application-level access control, not end-to-end encryption; do not store privileged, client-identifying or production secrets. A Private case cannot be submitted or promoted until Private is turned off." : "Через продукт кейс можете открыть только вы: администратор, рецензенты и прежние получатели исключаются, а доступы отзываются. Это контроль доступа приложения, а не сквозное шифрование; не храните адвокатскую тайну, идентифицирующие клиента сведения или рабочие секреты. Приватный кейс нельзя отправить или опубликовать, пока флаг не отключён."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "Where do the case rules live, and what protects them?" : "Где находятся правила кейса и как они защищены?"}</summary>
        <p>{locale === "en" ? "Rules DSL v1 is authored on graph relationships and runtime nodes: guards, metric effects, duration, cost, repeatability, deadlines, reroutes and terminal outcomes. Studio normalises the draft, the server recompiles the playable manifest, and both artifacts receive bound SHA-256 fingerprints. During a signed-in run, the server validates the current stage, guards, repeatability, time and deadlines before recording each decision. Fingerprints protect integrity and version identity; they do not make the rules secret." : "Rules DSL v1 задаётся на связях графа и runtime-полях узлов: guards, изменения метрик, длительность, стоимость, повторяемость, дедлайны, перенаправления и финальные исходы. Studio нормализует черновик, сервер заново компилирует playable-манифест, а оба артефакта получают связанные SHA-256 fingerprints. В авторизованном прохождении сервер перед фиксацией решения проверяет текущую стадию, guards, повторяемость, время и сроки. Fingerprints защищают целостность и идентичность версии, но не скрывают правила."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "What does JSON lineage protection prevent?" : "От чего защищает JSON lineage protection?"}</summary>
        <p>{locale === "en" ? "A workspace save receives a server-generated current-version code and HMAC seal bound to its exact Studio fingerprint, parent fingerprint/code and copy policy. If a parent is lineage-locked, every child remains locked; a shared recipient can inspect but cannot export, duplicate or save a fork through the product. This is tamper-evident lineage and application access control—not encryption or DRM—and it cannot prevent screenshots or manual re-authoring of material already displayed to an authorised user." : "При сохранении в workspace версия получает созданный сервером код и HMAC-печать, связанные с точным Studio fingerprint, fingerprint/кодом родителя и политикой копирования. Если родительская версия защищена, защита наследуется всеми дочерними версиями; приглашённый пользователь может изучать кейс, но не экспортировать, копировать или сохранять форк через продукт. Это контроль целостности линии и доступа приложения, а не шифрование или DRM; он не предотвращает скриншоты и ручное воспроизведение уже показанного авторизованному пользователю материала."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "What happens with hundreds of cases and about 100 users?" : "Что происходит при сотнях кейсов и примерно 100 пользователях?"}</summary>
        <p>{locale === "en" ? "The library requests paginated metadata only and downloads one immutable playable manifest when a case is launched. Signed-in decisions are calculated in the Worker and persisted as an optimistic, revisioned play session with an append-only event trail in D1; stale tabs receive a conflict instead of overwriting the run. This removes catalogue N+1 loading and keeps runtime work proportional to one decision, not to the size of the library." : "Библиотека запрашивает только постраничные метаданные и загружает один неизменяемый playable-манифест при запуске кейса. Решения авторизованного пользователя рассчитываются в Worker и сохраняются как ревизионная play-session с append-only журналом событий в D1; устаревшая вкладка получает конфликт, а не перезаписывает прохождение. Это устраняет N+1-загрузку каталога и делает стоимость расчёта пропорциональной одному решению, а не размеру библиотеки."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "How is a custom case promoted to the General Library?" : "Как custom-кейс попадает в Общую библиотеку?"}</summary>
        <p>{locale === "en" ? "After the case passes structural, provenance and any applicable legal or tax review gates, the administrator publishes an immutable playable snapshot. The published version becomes centrally managed; the custom workspace source remains separate. Making that source Private later does not withdraw or rewrite an already published snapshot." : "После структурных проверок, проверки источников и необходимых юридических или налоговых контрольных этапов администратор публикует неизменяемый игровой снимок. Опубликованная версия становится централизованно управляемой, а custom-источник остаётся отдельным. Последующее включение «Приватно» для источника не отзывает и не переписывает уже опубликованный снимок."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "How does feedback work for a Private case?" : "Как работает фидбэк по приватному кейсу?"}</summary>
        <p>{locale === "en" ? "Choose a private note to keep it owner-only, or send attributed product feedback with all case identifiers, fingerprint and node context stripped. For substantive review of the case itself, turn off Private and share or submit that exact restricted version; a private-feedback form never exposes the case indirectly." : "Выберите приватную заметку, чтобы сохранить её только для владельца, либо отправьте авторизованный продуктовый отзыв без ID кейса, версии, fingerprint и контекста узлов. Для содержательной рецензии самого кейса отключите «Приватно» и предоставьте доступ или отправьте на проверку точную ограниченную версию; форма приватного фидбэка не раскрывает кейс косвенно."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "Do I need an account?" : "Нужна ли регистрация?"}</summary>
        <p>{locale === "en" ? "No for General Library cases. Sign in to keep workspace cases, receive or grant access, submit attributed feedback, maintain a profile, follow cases and receive targeted updates. Local email/password access can be enrolled after one trusted ChatGPT identity confirmation; forgotten passwords are recovered with the one-time offline code or the same trusted identity path." : "Нет для кейсов Общей библиотеки. Вход нужен для хранения кейсов в workspace, получения и выдачи доступа, авторизованных отзывов, профиля, подписок и адресных обновлений. Локальный вход по email и паролю подключается после однократного подтверждения личности через ChatGPT; забытый пароль восстанавливается одноразовым офлайн-кодом или через тот же доверенный контур личности."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "Can I create tax-planning cases?" : "Можно ли создавать налоговые кейсы?"}</summary>
        <p>{locale === "en" ? "Yes. Studio includes entities, jurisdictions, cash flows and tax-rule nodes plus a compliance-first international tax template." : "Да. Studio поддерживает компании, юрисдикции, денежные потоки, налоговые правила и compliance-first шаблон международного планирования."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "What data is stored?" : "Какие данные сохраняются?"}</summary>
        <p>{locale === "en" ? "Your registration email, password hash and unique salt, hashed session/recovery secrets, profile, explicit inbox preferences, subscriptions, workspace cases with their access settings, attributed feedback and private notes. Plaintext passwords and recovery secrets are not stored. Communications default off, and the account/profile centres provide sign-out, recovery and deletion controls. Never submit privileged or client-identifying facts." : "Регистрационный email, хэш пароля и уникальная соль, хэши сессионных и recovery-секретов, профиль, явные настройки внутренних сообщений, подписки, кейсы workspace с настройками доступа, авторизованные отзывы и приватные заметки. Пароли и recovery-секреты в открытом виде не сохраняются. Сообщения по умолчанию выключены; в центрах аккаунта и профиля доступны выход, восстановление и удаление данных. Не отправляйте адвокатскую тайну или идентифицирующие клиента факты."}</p>
      </details>
      <details>
        <summary>{locale === "en" ? "Is this legal or tax advice?" : "Это юридическая или налоговая консультация?"}</summary>
        <p>{locale === "en" ? "No. Cases are simulations for training and structured professional discussion. Verify current law and facts before real-world use." : "Нет. Это симуляции для обучения и структурированного профессионального обсуждения. Для реальной ситуации проверяйте актуальное право и факты."}</p>
      </details>
    </section>
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
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: target.caseId, caseVersion: target.version, source: target.source, studioFingerprint: target.fingerprint, contextType: target.contextType ?? "case", contextId: target.contextId, rating, category, severity, comment, suggestedCorrection, citationUrl, privacyMode: target.privateCase ? privacyMode : undefined }) });
    if (response.status === 401) { router.push("/signin-with-chatgpt?return_to=%2F"); return; }
    const result = await response.json().catch(() => null) as { audience?: string; error?: string } | null;
    if (!response.ok) { setError(result?.error ?? (locale === "en" ? "Please complete the rating and comment." : "Заполните оценку и комментарий.")); setSending(false); return; }
    submitted(result?.audience);
  }
  const productOnly = target.privateCase && privacyMode === "product_only";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form ref={dialogRef} className="feedback-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="feedback-title"><button type="button" className="modal-close" onClick={close} aria-label={locale === "en" ? "Close feedback dialog" : "Закрыть форму отзыва"}><Icon name="close"/></button><span>{target.privateCase ? "PRIVATE CASE FEEDBACK" : `CASE-SPECIFIC FEEDBACK · ${target.source.toUpperCase()}`}</span><h2 id="feedback-title">{target.privateCase ? (locale === "en" ? "Choose who can receive this note" : "Выберите, кому доступна заметка") : (locale === "en" ? "Help improve this case" : "Помогите улучшить кейс")}</h2><p><b>{target.title}</b><br/><code>{target.caseId} · v{target.version}{target.contextId ? ` · ${target.contextType}:${target.contextId}` : ""}</code></p><aside className="feedback-privacy"><Icon name="alert"/>{locale === "en" ? "Do not include client-identifiable, privileged, personal or confidential information." : "Не включайте идентифицирующие клиента, привилегированные, персональные или конфиденциальные сведения."}</aside>{target.privateCase && <fieldset className="private-feedback-options"><legend>{locale === "en" ? "Resolve the private-feedback conflict" : "Разрешение коллизии приватного фидбэка"}</legend><label className={privacyMode === "private_note" ? "selected" : ""}><input type="radio" name="privacyMode" value="private_note" checked={privacyMode === "private_note"} onChange={() => setPrivacyMode("private_note")}/><span><b>{locale === "en" ? "Private note · owner only" : "Приватная заметка · только владелец"}</b><small>{locale === "en" ? "Stored with this case for you. Maxim and the review queue cannot see it." : "Сохраняется вместе с кейсом для вас. Максим и очередь рецензий её не видят."}</small></span></label><label className={privacyMode === "product_only" ? "selected" : ""}><input type="radio" name="privacyMode" value="product_only" checked={privacyMode === "product_only"} onChange={() => setPrivacyMode("product_only")}/><span><b>{locale === "en" ? "Anonymised case context · product feedback" : "Обезличенный контекст · отзыв о продукте"}</b><small>{locale === "en" ? "Your attributed comment, rating and category go to Maxim, but case ID, version, fingerprint, node context, citation and correction fields are stripped. Do not repeat case facts in the comment." : "Максим получит ваш авторизованный комментарий, оценку и категорию, но ID, версия, fingerprint, контекст узла, источник и поле исправления будут удалены. Не повторяйте факты кейса в комментарии."}</small></span></label><p>{locale === "en" ? "For substantive review of case content, turn off Private and share or submit an exact restricted version." : "Для содержательной рецензии отключите «Приватно» и предоставьте доступ либо отправьте точную ограниченную версию."}</p></fieldset>}<div className="feedback-fields"><label><span>{locale === "en" ? "Feedback category" : "Категория отзыва"}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="legal_accuracy">Legal / tax accuracy</option><option value="realism">Professional realism</option><option value="learning_value">Learning value</option><option value="usability">Usability</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label><span>{locale === "en" ? "Severity" : "Существенность"}</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="suggestion">Suggestion</option><option value="material">Material correction</option><option value="critical">Critical legal/safety issue</option></select></label></div><fieldset><legend>{locale === "en" ? "Overall rating" : "Общая оценка"}</legend><div className="rating-row">{[1,2,3,4,5].map((value) => <button type="button" key={value} className={value <= rating ? "active" : ""} onClick={() => setRating(value)} aria-label={`${value} / 5`}>★</button>)}</div></fieldset><label><span>{productOnly ? (locale === "en" ? "Product-level issue · do not include case facts" : "Проблема продукта · без фактов кейса") : (locale === "en" ? "What should be corrected or improved?" : "Что следует исправить или улучшить?")}</span><textarea required minLength={10} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={productOnly ? (locale === "en" ? "Describe the interface or workflow issue without referring to this case…" : "Опишите проблему интерфейса или процесса без ссылки на этот кейс…") : (locale === "en" ? "Identify the fact, rule, stage, node or decision branch…" : "Укажите факт, правило, стадию, узел или ветвь решения…")}/></label>{!productOnly && <><label><span>{locale === "en" ? "Suggested correction" : "Предлагаемое исправление"}</span><textarea value={suggestedCorrection} onChange={(event) => setSuggestedCorrection(event.target.value)} placeholder={locale === "en" ? "Optional replacement wording or branch logic" : "Необязательная новая формулировка или логика ветви"}/></label><label><span>{locale === "en" ? "Supporting HTTPS source" : "Подтверждающий HTTPS-источник"}</span><input type="url" value={citationUrl} onChange={(event) => setCitationUrl(event.target.value)} placeholder="https://…"/></label></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-cta" onClick={close}>{locale === "en" ? "Cancel" : "Отмена"}</button><button className="primary-cta" disabled={sending || comment.trim().length < 10}>{sending ? "Sending…" : target.privateCase && privacyMode === "private_note" ? (locale === "en" ? "Save private note" : "Сохранить приватную заметку") : locale === "en" ? "Submit feedback" : "Отправить отзыв"}<Icon name="arrow"/></button></div></form></div>;
}

function validateDraft(draft: StudioDraft, locale: Locale) {
  const count=(type:StudioNodeType)=>draft.nodes.filter((node)=>node.type===type).length;
  const outgoing=new Set(draft.links.map((link)=>link.from)); const incoming=new Set(draft.links.map((link)=>link.to));
  const warnings:Array<{level:"ok"|"warn";text:string}>=[]; const label=(en:string,ru:string)=>locale==="en"?en:ru;
  warnings.push(/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(draft.caseId)?{level:"ok",text:label("Stable custom case ID is defined","Стабильный ID custom-кейса определён")}:{level:"warn",text:label("Use a lowercase snake_case case ID","Используйте ID кейса в формате snake_case")});
  warnings.push(/^\d+\.\d+\.\d+$/.test(draft.version)?{level:"ok",text:label(`Semantic version ${draft.version} is valid`,`Семантическая версия ${draft.version} корректна`)}:{level:"warn",text:label("Use a semantic version such as 1.0.0","Укажите семантическую версию, например 1.0.0")});
  warnings.push(count("actor")>=1?{level:"ok",text:label(`${count("actor")} institutional actor(s) defined`,`Определено акторов: ${count("actor")}`)}:{level:"warn",text:label("Add at least one institutional actor","Добавьте хотя бы одного институционального актора")});
  warnings.push(count("evidence")>=1?{level:"ok",text:label("Evidence provenance node is present","Узел происхождения доказательств присутствует")}:{level:"warn",text:label("Add evidence with source provenance","Добавьте доказательство с источником происхождения")});
  warnings.push(count("decision")>=1?{level:"ok",text:label("A deliberate decision point is defined","Определена осознанная точка решения")}:{level:"warn",text:label("Add at least one decision point","Добавьте хотя бы одну точку решения")});
  warnings.push(count("outcome")>=2?{level:"ok",text:label("Multiple outcome paths preserve uncertainty","Несколько исходов сохраняют неопределённость")}:{level:"warn",text:label("Add at least two non-recommending outcomes","Добавьте хотя бы два исхода без рекомендации")});
  const orphaned=draft.nodes.filter((node)=>node.type!=="trigger"&&!incoming.has(node.id)&&!outgoing.has(node.id));
  warnings.push(orphaned.length===0?{level:"ok",text:label("No orphaned nodes","Изолированных узлов нет")}:{level:"warn",text:label(`${orphaned.length} orphaned node(s) need a relationship`,`Изолированных узлов: ${orphaned.length}`)});
  const serverGraphIssues=studioStructuralIssues(draft).filter((issue)=>["invalid_relationship","disconnected_graph","outcome_not_reachable_from_decision","decision_branch_required"].includes(issue));
  warnings.push(serverGraphIssues.length===0?{level:"ok",text:label("All nodes are reachable and decision branches terminate","Все узлы достижимы, а ветви решений ведут к исходам")}:{level:"warn",text:label("Reconnect the graph so every node is reachable from a trigger and every outcome from a decision","Перепривяжите граф: каждый узел должен быть достижим от триггера, а каждый исход — от решения")});
  warnings.push(draft.jurisdiction&&draft.role?{level:"ok",text:label("Jurisdiction and player role are explicit","Юрисдикция и роль игрока определены")}:{level:"warn",text:label("Set jurisdiction and player role","Укажите юрисдикцию и роль игрока")});
  if (isTaxClassification(draft.classification)) {
    const hasEntity = count("entity") >= 1;
    const hasTaxRule = count("tax_rule") >= 1;
    const hasFlow = count("cash_flow") >= 1;
    warnings.push(hasEntity && hasTaxRule && hasFlow
      ? {level:"ok",text:label("Tax structure maps entities, cash flows and governing rules","Налоговая структура связывает компании, денежные потоки и применимые правила")}
      : {level:"warn",text:label("Tax cases require entity, cash-flow and tax-rule nodes","Налоговые кейсы требуют узлы компании, денежного потока и налогового правила")});
    warnings.push(draft.classification?.complianceOnly
      ? {level:"ok",text:label("Lawful-planning and anti-abuse gate is enabled","Контроль законности и anti-abuse включён")}
      : {level:"warn",text:label("Enable the lawful-planning compliance gate","Включите контроль законности налогового планирования")});
    warnings.push(draft.classification?.purpose
      ? {level:"ok",text:label(`Tax-case purpose: ${draft.classification.purpose.replaceAll("_", " ")}`,`Цель налогового кейса: ${draft.classification.purpose.replaceAll("_", " ")}`)}
      : {level:"warn",text:label("Select a tax-case purpose","Выберите цель налогового кейса")});
    warnings.push(/^\d{4}-\d{2}-\d{2}$/.test(draft.classification?.legalAsOf ?? "")
      ? {level:"ok",text:label(`Legal sources reviewed as of ${draft.classification?.legalAsOf}`,`Источники права проверены на ${draft.classification?.legalAsOf}`)}
      : {level:"warn",text:label("Set the legal as-of date","Укажите дату актуальности права")});
    warnings.push((draft.classification?.sourceUrls ?? []).length > 0 && (draft.classification?.sourceUrls ?? []).every((item) => item.startsWith("https://"))
      ? {level:"ok",text:label("HTTPS legal sources are attached","HTTPS-источники права приложены")}
      : {level:"warn",text:label("Attach at least one HTTPS legal source","Добавьте хотя бы один HTTPS-источник права")});
  }
  return warnings;
}
