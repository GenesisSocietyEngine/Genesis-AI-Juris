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
  | "outcome";

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
  nodes: StudioNode[];
  links: StudioLink[];
  updatedAt: string;
};
