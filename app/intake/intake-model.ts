export const MAX_QUESTIONS = 12,
  TITLE_LIMIT = 120,
  QUESTION_LIMIT = 200,
  ANSWER_LIMIT = 2000;
export type Question = { label: string; required: boolean };
export type IntakeStatus = "available" | "archived" | "draft" | "complete";
export type IntakeRecord = {
  id: string;
  revision: number;
  title: string;
  questions: Question[];
  answers: string[];
  status: IntakeStatus;
  caseId: string | null;
  templateId: string | null;
  templateRevision: number | null;
  savedAt: string;
  canEdit: boolean;
};
type Version = { id: string; revision: number };
export type IntakeCommand = Version &
  (
    | { action: "design"; title: string; questions: Question[] }
    | { action: "archive" | "restore" | "reopen" }
    | {
        action: "answer";
        caseId: string;
        templateId: string;
        templateRevision: number;
        status: "draft" | "complete";
        answers: string[];
        deidentified: true;
      }
  );
export const intakeId = /^intake_[0-9a-f]{32}$/;
export const operationId = /^[\w-]{8,120}$/;
export function recordId() {
  return "intake_" + crypto.randomUUID().replaceAll("-", "");
}
function bounded(x: unknown, n: number, empty = false): string {
  if (
    typeof x !== "string" ||
    x.length > n ||
    (!empty && !x.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(x)
  )
    throw Error("invalid");
  return x.trim();
}
function version(x: unknown, min = 0): number {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < min || x >= Number.MAX_SAFE_INTEGER)
    throw Error("invalid");
  return x;
}
function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw Error("invalid");
  return x as Record<string, unknown>;
}
function keys(o: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(o).some((k) => !allowed.includes(k))) throw Error("invalid");
}
export function parseIntake(input: unknown): IntakeCommand {
  const o = object(input),
    action = o.action,
    id = o.id,
    revision = version(o.revision);
  if (typeof id !== "string" || !intakeId.test(id)) throw Error("invalid");
  const fields = (...names: string[]) => keys(o, ["operationKey", "action", "id", "revision", ...names]);
  if (action === "design") {
    fields("title", "questions");
    const title = bounded(o.title, TITLE_LIMIT);
    if (!Array.isArray(o.questions) || !o.questions.length || o.questions.length > MAX_QUESTIONS)
      throw Error("questions");
    const questions = o.questions.map((item) => {
      const q = object(item);
      keys(q, ["label", "required"]);
      if (typeof q.required !== "boolean") throw Error("questions");
      return { label: bounded(q.label, QUESTION_LIMIT), required: q.required };
    });
    if (new Set(questions.map((q) => q.label.toLowerCase())).size !== questions.length)
      throw Error("duplicateQuestion");
    return { action, id, revision, title, questions };
  }
  if (action === "answer") {
    fields("caseId", "templateId", "templateRevision", "status", "answers", "deidentified");
    if (o.deidentified !== true) throw Error("deidentified");
    if (
      typeof o.templateId !== "string" ||
      !intakeId.test(o.templateId) ||
      typeof o.caseId !== "string" ||
      !/^[\w-]{1,120}$/.test(o.caseId) ||
      (o.status !== "draft" && o.status !== "complete") ||
      !Array.isArray(o.answers) ||
      !o.answers.length ||
      o.answers.length > MAX_QUESTIONS
    )
      throw Error("invalid");
    return {
      action,
      id,
      revision,
      caseId: o.caseId,
      templateId: o.templateId,
      templateRevision: version(o.templateRevision, 1),
      status: o.status,
      answers: o.answers.map((a) => bounded(a, ANSWER_LIMIT, true)),
      deidentified: true,
    };
  }
  if (action === "archive" || action === "restore" || action === "reopen") {
    fields();
    if (!revision) throw Error("invalid");
    return { action, id, revision };
  }
  throw Error("invalid");
}
export function answersFit(questions: Question[], answers: string[], complete: boolean) {
  return (
    answers.length === questions.length &&
    (!complete || questions.every((q, i) => !q.required || Boolean(answers[i]?.trim())))
  );
}
export function hasAnswers(r: IntakeRecord) {
  return r.answers.filter((a) => a.trim()).length;
}
