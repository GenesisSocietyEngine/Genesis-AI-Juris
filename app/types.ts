export type MetricKey = "position" | "evidence" | "trust" | "exposure";

export type RuleComparison = "gte" | "lte" | "eq";

export type MetricGuard = {
  metric: MetricKey;
  comparison: RuleComparison;
  value: number;
};

export type LocalText = {
  ru: string;
  en: string;
};

export type DecisionOption = {
  id: string;
  /** Stable action identity from the canonical mobile/Rust scenario. */
  canonicalActionId?: string;
  label: LocalText;
  detail: LocalText;
  result: LocalText;
  cost: number;
  costAuthored?: boolean;
  minutes: number;
  billableMinutes?: number;
  fatigueDelta?: number;
  strainDelta?: number;
  resetsFatigue?: boolean;
  advanceToMinute?: number;
  resolvedOutcome?: {
    id: string;
    title: LocalText;
    summary: LocalText;
    classification: "strong" | "mixed" | "weak";
  };
  awardEur?: number;
  outcomeCostsEur?: number;
  effects: Partial<Record<MetricKey, number>>;
  nextStageId?: string;
  completionDayOffset?: number;
  completionMinuteOfDay?: number;
  repeatability?: "once" | "repeatable" | "limited";
  maxUses?: number;
  guards?: MetricGuard[];
};

export type ScenarioStage = {
  id: string;
  day: number;
  time: string;
  phase: LocalText;
  headline: LocalText;
  brief: LocalText;
  source: LocalText;
  pressure?: LocalText;
  materialRefs: string[];
  options: DecisionOption[];
  terminal?: boolean;
  terminalOutcome?: "strong" | "mixed" | "weak";
};

export type ScenarioDeadline = {
  id: string;
  title: LocalText;
  dueAtMinute: number;
  completionActions: string[];
  activationEvent?: string;
  missedNextStageId?: string;
};

export type ScenarioInboxItem = {
  id: string;
  subject: LocalText;
  body: LocalText;
  initiallyVisible: boolean;
  actionRequired: boolean;
  resolutionActions: string[];
};

export type Scenario = {
  id: string;
  caseId: string;
  order: number;
  title: LocalText;
  subtitle: LocalText;
  jurisdiction: string;
  role: LocalText;
  version: string;
  sector: LocalText;
  urgency: "critical" | "elevated" | "standard";
  fingerprint: string;
  sourceFingerprint?: string;
  accent: string;
  actors: LocalText[];
  materials: Array<{
    ref: string;
    type: LocalText;
    title: LocalText;
    source: LocalText;
    date: string;
  }>;
  stages: ScenarioStage[];
  opening: LocalText;
  initialStageId: string;
  initialClockMinute: number;
  deadlines: ScenarioDeadline[];
  workflowInbox: ScenarioInboxItem[];
  initialResources?: {
    authorizedBudgetEur: number;
    spendEur: number;
    billableMinutes: number;
    fatigue: number;
    cumulativeStrain: number;
    awardEur: number;
    outcomeCostsEur: number;
  };
  mobileParity?: {
    source: "canonical-mobile-bundle";
    sourceVersion: string;
    stageCount: number;
    actionCount: number;
    foregroundClock: boolean;
  };
  outcomes: {
    strong: LocalText;
    mixed: LocalText;
    weak: LocalText;
  };
};

export type StudioNodeType =
  | "trigger"
  | "actor"
  | "fact"
  | "evidence"
  | "deadline"
  | "decision"
  | "outcome"
  | "entity"
  | "tax_rule"
  | "cash_flow";

export type StudioNode = {
  id: string;
  type: StudioNodeType;
  title: string;
  detail: string;
  x: number;
  y: number;
  runtime?: {
    day?: number;
    time?: string;
    pressure?: string;
    terminalOutcome?: "strong" | "mixed" | "weak";
    deadlineDay?: number;
    deadlineTime?: string;
    missedOutcomeNodeId?: string;
  };
};

export type StudioLink = {
  id: string;
  from: string;
  to: string;
  rule?: {
    label?: string;
    detail?: string;
    result?: string;
    cost?: number;
    minutes?: number;
    effects?: Partial<Record<MetricKey, number>>;
    guards?: MetricGuard[];
    repeatability?: "once" | "repeatable" | "limited";
    maxUses?: number;
  };
};

export type StudioEditSource = "prompt" | "visual";

export type StudioEditAction =
  | "prompt_submitted"
  | "prompt_applied"
  | "graph_rebuilt"
  | "case_updated"
  | "node_added"
  | "node_updated"
  | "node_moved"
  | "node_deleted"
  | "link_added"
  | "link_relinked"
  | "link_deleted"
  | "undo_applied"
  | "redo_applied"
  | "revision_restored"
  | "compiled_for_play"
  | "history_compacted";

export type StudioEditEntry = {
  id: string;
  role: "author" | "studio";
  source: StudioEditSource;
  action: StudioEditAction;
  message: string;
  createdAt: string;
};

export type TaxCasePurpose = "lawful_planning" | "compliance_review" | "audit_defence" | "evasion_detection";

export type CaseCopyPolicy = "fork_allowed" | "lineage_locked";

/**
 * Public, server-attested lineage metadata. The codes and HMAC seal provide
 * tamper evidence; they do not encrypt or conceal the Studio case content.
 */
export type CaseProtectionV1 = {
  kind: "case-protection-v1";
  copyProtected: boolean;
  copyPolicy: CaseCopyPolicy;
  parentCode: string | null;
  currentCode: string;
  seal: string;
};

export type StudioDraft = {
  caseId: string;
  version: string;
  parent: {
    caseId: string;
    version: string;
    fingerprint: string;
  } | null;
  protection?: CaseProtectionV1;
  title: string;
  jurisdiction: string;
  role: string;
  premise: string;
  classification?: {
    domain?: "general" | "tax";
    practiceArea: string;
    difficulty: string;
    tags: string[];
    taxTopics: string[];
    complianceOnly: boolean;
    purpose?: TaxCasePurpose;
    legalAsOf?: string;
    sourceUrls?: string[];
  };
  nodes: StudioNode[];
  links: StudioLink[];
  editHistory: StudioEditEntry[];
  updatedAt: string;
};
