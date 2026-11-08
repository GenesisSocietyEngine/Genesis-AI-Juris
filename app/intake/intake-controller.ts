import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import {
  answersFit,
  intakeId,
  parseIntake,
  recordId,
  type IntakeCommand,
  type IntakeRecord,
  type Question,
} from "./intake-model";

type CaseChoice = { id: string; title: string; canEdit: boolean };
type DraftValues = {
  title: string;
  questions: Question[];
  answers: string[];
  caseId: string;
  confirmed: boolean;
};
type Draft = DraftValues & {
  kind: "design" | "answer";
  id: string;
  revision: number;
  templateId: string;
  templateRevision: number;
  initial: string;
};
type Pending = IntakeCommand & { operationKey: string };
type State = {
  records: IntakeRecord[];
  cases: CaseChoice[];
  loaded: boolean;
  loading: boolean;
  canWrite: boolean;
  locked: boolean;
  saving: boolean;
  draft: Draft | null;
  pending: Pending | null;
  issue: string;
  notice: string;
  selected: string;
};
type Reply = {
  scope?: string;
  code?: string;
  canWrite?: boolean;
  records?: IntakeRecord[];
  cases?: CaseChoice[];
  next?: string | null;
  operationKey?: string;
  saved?: { id: string; revision: number } | null;
};
const empty = (): State => ({
  records: [],
  cases: [],
  loaded: false,
  loading: false,
  canWrite: false,
  locked: false,
  saving: false,
  draft: null,
  pending: null,
  issue: "",
  notice: "",
  selected: "",
});
const signature = ({ title, questions, answers, caseId, confirmed }: DraftValues) =>
  JSON.stringify([title, questions, answers, caseId, confirmed]);
export class IntakeController {
  private state = empty();
  private epoch = 0;
  private identity = "";
  private bound = "";
  private listeners = new Set<() => void>();
  constructor(
    private nav: NavigationController,
    private transport: (path: string, init: RequestInit) => Promise<Response>,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private context() {
    const s = this.nav.getSnapshot();
    if (s.phase !== "ready" || s.busy || s.endingSession || !s.actorId || !s.selected) return null;
    const identity = JSON.stringify([s.actorId, s.selected.selection]);
    return { identity, selection: s.selected.selection, scope: this.nav.authorityVersion + ":" + identity };
  }
  private hide(clear: boolean) {
    this.epoch++;
    this.bound = "";
    this.set({ ...empty(), ...(!clear ? { draft: this.state.draft, pending: this.state.pending } : {}) });
  }
  dirty() {
    const d = this.state.draft;
    return !!d && signature(d) !== d.initial;
  }
  attach() {
    const sync = () => {
      const c = this.context();
      if (!c) {
        if (this.bound) this.hide(false);
        return;
      }
      if (this.identity && this.identity !== c.identity) this.hide(true);
      this.identity = c.identity;
      if (this.bound !== c.scope) {
        this.bound = c.scope;
        void this.refresh();
      }
    };
    const stop = this.nav.subscribe(sync),
      remove = this.nav.register(this, {
        risk: () => (this.state.pending || this.state.saving ? "pending" : this.dirty() ? "dirty" : "clear"),
        changes: () => ["intake"],
        suspend: () => this.hide(false),
        deny: () => this.hide(true),
        lock: (locked) => this.set({ locked }),
        review: () => this.set({ issue: this.state.pending ? "unconfirmed" : "review" }),
        canSave: () => !!this.command(),
        save: () => this.save(),
      });
    sync();
    return () => {
      this.epoch++;
      this.bound = "";
      stop();
      remove();
    };
  }
  private request(
    c: NonNullable<ReturnType<IntakeController["context"]>>,
    suffix: string,
    command?: Pending,
  ) {
    return readWithTimeout(async (signal) => {
      const response = await this.transport("/api/library/intake" + suffix, {
        method: command ? "POST" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: {
          "x-genesis-organization": c.selection,
          ...(command ? { "Content-Type": "application/json" } : {}),
        },
        body: command ? JSON.stringify(command) : undefined,
      });
      const data = (await response.json()) as Reply;
      if (c.scope === this.context()?.scope && this.bound === c.scope) {
        if (response.status === 401) this.nav.invalidate("expired");
        if ([403, 404].includes(response.status) && !data.code) this.nav.invalidate("denied");
      }
      return { response, data };
    });
  }
  async refresh() {
    const c = this.context();
    if (!c || this.state.saving) return;
    const ticket = ++this.epoch,
      current = () => ticket === this.epoch && this.bound === this.context()?.scope && this.bound === c.scope;
    this.set({ loading: true });
    try {
      const records: IntakeRecord[] = [],
        seen = new Set<string>();
      let after = "",
        cases: CaseChoice[] = [],
        canWrite = false;
      do {
        const { response, data } = await this.request(c, after ? "?after=" + encodeURIComponent(after) : "");
        if (!current()) return;
        if (
          !response.ok ||
          data.scope !== c.selection ||
          !Array.isArray(data.records) ||
          !Array.isArray(data.cases)
        )
          throw Error();
        if (!after) {
          cases = data.cases;
          canWrite = data.canWrite === true;
        }
        for (const r of data.records) {
          if (
            !intakeId.test(r.id) ||
            seen.has(r.id) ||
            !Number.isSafeInteger(r.revision) ||
            !Array.isArray(r.questions) ||
            !Array.isArray(r.answers)
          )
            throw Error();
          seen.add(r.id);
          records.push(r);
        }
        if (
          data.next !== null &&
          (typeof data.next !== "string" || data.next === after || data.next !== data.records.at(-1)?.id)
        )
          throw Error();
        after = data.next ?? "";
      } while (after);
      const d = this.state.draft,
        p = this.state.pending;
      const lost = (id: string, rev: number, caseId?: string) =>
        !canWrite ||
        (!!caseId && !cases.some((v) => v.id === caseId && v.canEdit)) ||
        (rev > 0 && !records.some((v) => v.id === id && v.canEdit));
      const revoked =
        (d && lost(d.id, d.revision, d.caseId)) ||
        (p && lost(p.id, p.revision, p.action === "answer" ? p.caseId : undefined));
      this.set({
        records,
        cases,
        canWrite,
        loaded: true,
        loading: false,
        ...(revoked
          ? { draft: null, pending: null, issue: "caseAccess", notice: "" }
          : this.state.issue === "load"
            ? { issue: "" }
            : {}),
      });
    } catch {
      if (current())
        this.set({ records: [], cases: [], loaded: false, loading: false, canWrite: false, issue: "load" });
    }
  }
  private editable() {
    return (
      !!this.context() &&
      this.state.loaded &&
      this.state.canWrite &&
      !this.state.loading &&
      !this.state.locked &&
      !this.state.pending &&
      !this.state.saving
    );
  }
  select(id: string) {
    if (!this.state.draft && !this.state.pending) this.set({ selected: id, issue: "", notice: "" });
  }
  private open(d: Omit<Draft, "initial">) {
    if (this.editable() && !this.state.draft)
      this.set({ draft: { ...d, initial: signature(d) }, issue: "", notice: "" });
  }
  design(row?: IntakeRecord) {
    if (row && (!row.canEdit || row.status !== "available")) return;
    this.open({
      kind: "design",
      id: row?.id ?? recordId(),
      revision: row?.revision ?? 0,
      title: row?.title ?? "",
      questions: row?.questions ?? [{ label: "", required: true }],
      answers: [],
      confirmed: false,
      caseId: "",
      templateId: "",
      templateRevision: 0,
    });
  }
  answer(source: IntakeRecord, currentCase = "") {
    if (source.status !== "available" && !(source.status === "draft" && source.canEdit)) return;
    const fresh = source.status === "available";
    this.open({
      kind: "answer",
      id: fresh ? recordId() : source.id,
      revision: fresh ? 0 : source.revision,
      title: source.title,
      questions: source.questions,
      answers: fresh ? source.questions.map(() => "") : source.answers,
      caseId: fresh
        ? this.state.cases.some((c) => c.id === currentCase && c.canEdit)
          ? currentCase
          : ""
        : source.caseId!,
      templateId: fresh ? source.id : source.templateId!,
      templateRevision: fresh ? source.revision : source.templateRevision!,
      confirmed: false,
    });
  }
  update(patch: Partial<DraftValues>) {
    const d = this.state.draft;
    if (d && this.editable()) this.set({ draft: { ...d, ...patch }, issue: "" });
  }
  discard() {
    if (!this.state.pending && !this.state.saving && !this.state.locked) this.set({ draft: null, issue: "" });
  }
  command(complete = false): IntakeCommand | null {
    const d = this.state.draft;
    if (!d || !this.editable() || (!complete && !this.dirty())) return null;
    if (
      d.revision &&
      !this.state.records.some((r) => r.id === d.id && r.revision === d.revision && r.canEdit)
    )
      return null;
    try {
      if (d.kind === "design")
        return parseIntake({
          action: "design",
          id: d.id,
          revision: d.revision,
          title: d.title,
          questions: d.questions,
        });
      if (
        !d.confirmed ||
        !this.state.cases.some((c) => c.id === d.caseId && c.canEdit) ||
        !answersFit(d.questions, d.answers, complete)
      )
        return null;
      if (
        !d.revision &&
        !this.state.records.some(
          (r) => r.id === d.templateId && r.status === "available" && r.revision === d.templateRevision,
        )
      )
        return null;
      return parseIntake({
        action: "answer",
        id: d.id,
        revision: d.revision,
        caseId: d.caseId,
        templateId: d.templateId,
        templateRevision: d.templateRevision,
        answers: d.answers,
        status: complete ? "complete" : "draft",
        deidentified: true,
      });
    } catch {
      return null;
    }
  }
  async save(command?: IntakeCommand): Promise<boolean> {
    const c = this.context();
    if (
      !c ||
      !this.state.loaded ||
      this.state.loading ||
      this.state.saving ||
      this.state.locked ||
      !this.state.canWrite
    )
      return false;
    const prior = this.state.pending,
      chosen = command ?? this.command();
    if (!prior && !chosen) return false;
    const p = prior ?? { ...chosen!, operationKey: crypto.randomUUID() };
    const ticket = ++this.epoch,
      current = () => ticket === this.epoch && c.scope === this.context()?.scope && c.scope === this.bound;
    this.set({ saving: true, pending: p, issue: "", notice: "" });
    try {
      let result = prior ? await this.request(c, "?operation=" + encodeURIComponent(p.operationKey)) : null;
      if (!current()) return false;
      if (
        result &&
        (!result.response.ok ||
          result.data.scope !== c.selection ||
          result.data.operationKey !== p.operationKey ||
          result.data.saved === undefined)
      )
        throw Error();
      if (!result || result.data.saved === null) result = await this.request(c, "", p);
      if (!current()) return false;
      const { response, data } = result;
      if (!response.ok) {
        if ([400, 403, 404, 409].includes(response.status)) {
          this.set({
            pending: null,
            saving: false,
            issue: data.code ?? "changed",
            ...(data.code === "caseAccess" || data.code === "readOnly" ? { draft: null } : {}),
          });
          await this.refresh();
          return false;
        }
        throw Error();
      }
      if (
        data.scope !== c.selection ||
        data.operationKey !== p.operationKey ||
        data.saved?.id !== p.id ||
        data.saved.revision !== p.revision + 1
      )
        throw Error();
      this.set({
        saving: false,
        pending: null,
        draft: null,
        selected: p.id,
        notice: p.action === "answer" ? p.status : p.action,
      });
      await this.refresh();
      return c.scope === this.context()?.scope;
    } catch {
      if (current()) this.set({ saving: false, issue: "unconfirmed" });
      return false;
    }
  }
}
