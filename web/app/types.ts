export type MetricKey = "position" | "evidence" | "trust" | "exposure";

export type LocalText = {
  ru: string;
  en: string;
};

export type DecisionOption = {
  id: string;
  label: LocalText;
  detail: LocalText;
  result: LocalText;
  cost: number;
  minutes: number;
  effects: Partial<Record<MetricKey, number>>;
  nextStageId?: string;
  completionDayOffset?: number;
  completionMinuteOfDay?: number;
  repeatability?: "once" | "repeatable" | "limited";
  maxUses?: number;
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
};

export type StudioLink = {
  from: string;
  to: string;
};

export type TaxCasePurpose = "lawful_planning" | "compliance_review" | "audit_defence" | "evasion_detection";

export type StudioDraft = {
  caseId: string;
  version: string;
  parent: {
    caseId: string;
    version: string;
    fingerprint: string;
  } | null;
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
  updatedAt: string;
};
