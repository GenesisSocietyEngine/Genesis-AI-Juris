export type Locale = "en" | "ru";
export const stages = ["intake", "assessment", "preparation", "review", "follow_up"] as const;
export type Stage = (typeof stages)[number];
export const leadStages = ["new", "contacted", "consultation", "decision", "not_pursuing"] as const;
const labels: Record<string, [string, string]> = {
  intake: ["Intake", "Приём"],
  assessment: ["Assessment", "Оценка"],
  preparation: ["Preparation", "Подготовка"],
  review: ["Review", "Проверка"],
  follow_up: ["Follow-up", "Сопровождение"],
  new: ["New inquiry", "Новое обращение"],
  contacted: ["Contacted", "Связались"],
  consultation: ["Consultation", "Консультация"],
  decision: ["Awaiting decision", "Ожидает решения"],
  not_pursuing: ["Not pursuing", "Без продолжения"],
  draft: ["Draft", "Черновик"],
  intake_review: ["Intake review", "Первичная проверка"],
  active: ["Active", "Активно"],
  awaiting_input: ["Awaiting information", "Ожидает сведений"],
  internal_review: ["Internal review", "Внутренняя проверка"],
  output_approved: ["Output approved", "Результат утверждён"],
  closed: ["Closed", "Закрыто"],
  archived: ["Archived", "В архиве"],
  declined: ["Declined", "Отклонено"],
  cancelled: ["Cancelled", "Отменено"],
  unset: ["No stage recorded", "Этап не указан"],
};
export const label = (k: string, l: Locale) => (labels[k] ?? labels.unset)[l === "en" ? 0 : 1];
export const statusChoices = [
  "draft",
  "intake_review",
  "active",
  "awaiting_input",
  "internal_review",
  "output_approved",
  "closed",
  "archived",
  "declined",
  "cancelled",
] as const;
export const terminal = (s: string) => ["closed", "archived", "declined", "cancelled"].includes(s);
export const tokens = {
  "case.title": ["Case name", "Название дела"],
  "case.reference": ["Case number", "Номер дела"],
  "case.jurisdiction": ["Jurisdiction", "Юрисдикция"],
  "case.stage": ["Case stage", "Этап дела"],
  "case.update": ["Latest status update", "Последнее сообщение"],
  "firm.name": ["Firm name", "Название фирмы"],
} as const;
export const tokenLabel = (k: keyof typeof tokens, l: Locale) => tokens[k][l === "en" ? 0 : 1];
export type CaseChoice = {
  id: string;
  title: string;
  reference: string;
  jurisdictions: string[];
  status: string;
  revision: number;
  canEdit: boolean;
};
export type RegisterFilter = { query: string; stage: string; status: string };
export type WorkRecord = {
  id: string;
  revision: number;
  kind: "template" | "document" | "progress" | "view";
  caseId: string | null;
  sourceId: string | null;
  sourceRevision: number | null;
  title: string;
  body: string;
  stage: string;
  statusFilter: string;
  archived: boolean;
  savedAt: string;
};
export type Command = { id: string; revision: number } & (
  | { action: "template"; title: string; body: string }
  | {
      action: "generate";
      title: string;
      caseId: string;
      caseRevision: number;
      sourceId: string;
      sourceRevision: number;
      preview: string;
      locale: Locale;
      deidentified: true;
    }
  | { action: "progress"; caseId: string; stage: Stage; body: string; deidentified: true }
  | { action: "view"; title: string; filter: RegisterFilter }
  | { action: "archive" | "restore" }
);
export const uid = (kind: "template" | "document" | "view") =>
  kind + "_" + crypto.randomUUID().replaceAll("-", "");
export const dossierId = /^dossier_[a-f0-9]{32}$/;
export const recordId = /^(?:(?:template|document|view)_[a-f0-9]{32}|progress_dossier_[a-f0-9]{32})$/;
export const operationKey = /^[\w-]{8,120}$/;
export function clean(v: unknown, max: number, blank = false): string {
  if (
    typeof v !== "string" ||
    v.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff\ufffe\uffff]/u.test(v) ||
    (!blank && !v.trim())
  )
    throw Error("fields");
  return v.replace(/\r\n?/g, "\n").trim();
}
function number(v: unknown, min: number) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v >= Number.MAX_SAFE_INTEGER)
    throw Error("fields");
  return v;
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("fields");
  return v as Record<string, unknown>;
}
export function fields(s: string) {
  const used = new Set<keyof typeof tokens>();
  const literal = s.replace(/\{\{([^{}]*)\}\}/g, (_, key: string) => {
    if (!Object.hasOwn(tokens, key)) throw Error("unknownField");
    used.add(key as keyof typeof tokens);
    return "";
  });
  if (literal.includes("{{") || literal.includes("}}")) throw Error("unknownField");
  return [...used];
}
export function describeTemplate(body: string, locale: Locale) {
  return body.replace(/\{\{([^{}]*)\}\}/g, (literal, key: keyof typeof tokens) =>
    Object.hasOwn(tokens, key) ? "«" + tokenLabel(key, locale) + "»" : literal,
  );
}
export function preview(
  body: string,
  firm: string,
  c: CaseChoice,
  update: Pick<WorkRecord, "stage" | "body"> | undefined,
  locale: Locale,
) {
  const values = {
    "case.title": c.title,
    "case.reference": c.reference,
    "case.jurisdiction": c.jurisdictions.join(", "),
    "case.stage": update?.stage ? label(update.stage, locale) : "",
    "case.update": update?.body ?? "",
    "firm.name": firm,
  };
  const missing = fields(body).filter((k) => !values[k]?.trim());
  const text = body.replace(
    /\{\{([^{}]*)\}\}/g,
    (literal, key: keyof typeof tokens) => values[key] || literal,
  );
  const display = missing.length
    ? body.replace(/\{\{([^{}]*)\}\}/g, (_, key: keyof typeof tokens) => values[key] || "«" + tokenLabel(key, locale) + "»")
    : text;
  return { text, missing, display };
}
export function parseCommand(input: unknown): Command {
  const x = object(input),
    a = x.action,
    id = x.id,
    revision = number(x.revision, 0);
  if (typeof id !== "string" || !recordId.test(id)) throw Error("fields");
  const keys = (...k: string[]) => {
    if (Object.keys(x).some((n) => !["id", "revision", "action", "operationKey", ...k].includes(n)))
      throw Error("fields");
  };
  if (a === "template" && id.startsWith("template_")) {
    keys("title", "body");
    const body = clean(x.body, 16000);
    fields(body);
    return { id, revision, action: a, title: clean(x.title, 120), body };
  }
  if (a === "view" && id.startsWith("view_")) {
    keys("title", "filter");
    const f = object(x.filter);
    if (
      Object.keys(f).some((k) => !["query", "stage", "status"].includes(k)) ||
      !["", "unset", ...stages].includes(String(f.stage)) ||
      !["", ...statusChoices].includes(String(f.status))
    )
      throw Error("fields");
    return {
      id,
      revision,
      action: a,
      title: clean(x.title, 80),
      filter: { query: clean(f.query, 120, true), stage: String(f.stage), status: String(f.status) },
    };
  }
  if (a === "archive" || a === "restore") {
    keys();
    if (revision === 0 || !/^template_|^view_/.test(id)) throw Error("fields");
    return { action: a, id, revision };
  }
  if (x.deidentified !== true || typeof x.caseId !== "string" || !dossierId.test(x.caseId))
    throw Error("fields");
  if (a === "progress" && id === "progress_" + x.caseId) {
    keys("caseId", "stage", "body", "deidentified");
    if (!stages.includes(x.stage as Stage)) throw Error("fields");
    return {
      id,
      revision,
      action: a,
      caseId: x.caseId,
      stage: x.stage as Stage,
      body: clean(x.body, 1200),
      deidentified: true,
    };
  }
  if (a === "generate" && !revision && id.startsWith("document_")) {
    keys(
      "title",
      "caseId",
      "caseRevision",
      "sourceId",
      "sourceRevision",
      "preview",
      "locale",
      "deidentified",
    );
    if (
      typeof x.sourceId !== "string" ||
      !/^template_[a-f0-9]{32}$/.test(x.sourceId) ||
      (x.locale !== "ru" && x.locale !== "en")
    )
      throw Error("fields");
    return {
      id,
      revision,
      action: a,
      title: clean(x.title, 120),
      caseId: x.caseId,
      sourceId: x.sourceId,
      sourceRevision: number(x.sourceRevision, 1),
      caseRevision: number(x.caseRevision, 1),
      preview: clean(x.preview, 36000),
      locale: x.locale,
      deidentified: true,
    };
  }
  throw Error("fields");
}
export const defaultFilter: RegisterFilter = { query: "", stage: "", status: "" };
export function filterCases(cases: CaseChoice[], records: WorkRecord[], f: RegisterFilter) {
  const updates = new Map(records.filter((r) => r.kind === "progress").map((r) => [r.caseId, r]));
  const query = f.query.trim().toLocaleLowerCase();
  return cases.filter(
    (c) =>
      (!f.stage || (updates.get(c.id)?.stage ?? "unset") === f.stage) &&
      (!f.status || c.status === f.status) &&
      (!query ||
        [c.title, c.reference, updates.get(c.id)?.body ?? ""].some((s) =>
          s.toLocaleLowerCase().includes(query),
        )),
  );
}
