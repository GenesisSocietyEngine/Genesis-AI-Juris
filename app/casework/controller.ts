import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import {
  defaultFilter,
  parseCommand,
  preview,
  recordId,
  uid,
  type CaseChoice,
  type Command,
  type Locale,
  type RegisterFilter,
  type WorkRecord,
} from "./model";
export type Editor = {
  action: "template" | "generate" | "progress" | "view";
  id: string;
  revision: number;
  title: string;
  body: string;
  caseId: string;
  stage: string;
  filter: RegisterFilter;
  sourceId: string;
  sourceRevision: number;
  caseRevision: number;
  confirmed: boolean;
  proof: string | null;
  locale: Locale;
};
type Pending = Command & { operationKey: string };
type State = {
  records: WorkRecord[];
  cases: CaseChoice[];
  firm: string;
  loaded: boolean;
  loading: boolean;
  canWrite: boolean;
  locked: boolean;
  saving: boolean;
  draft: Editor | null;
  pending: Pending | null;
  issue: string;
  notice: string;
  selected: string;
  history: WorkRecord[];
  historyCase: string;
  before: number | null;
  historyBusy: boolean;
};
const empty = (): State => ({
  records: [],
  cases: [],
  firm: "",
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
  history: [],
  historyCase: "",
  before: null,
  historyBusy: false,
});
const newEditor = (action: Editor["action"], id: string): Editor => ({
  action,
  id,
  revision: 0,
  title: "",
  body: "",
  stage: "",
  caseId: "",
  sourceId: "",
  sourceRevision: 0,
  caseRevision: 0,
  confirmed: false,
  proof: null,
  locale: "en",
  filter: { ...defaultFilter },
});
export class CaseworkController {
  private state = empty();
  private listeners = new Set<() => void>();
  private scope = "";
  private identity = "";
  private initial = "";
  private epoch = 0;
  private historyEpoch = 0;
  constructor(
    private nav: NavigationController,
    private transport: (p: string, i: RequestInit) => Promise<Response>,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(p: Partial<State>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((f) => f());
  }
  private context() {
    const s = this.nav.getSnapshot();
    if (s.phase !== "ready" || s.endingSession || s.busy || !s.selected || !s.actorId) return null;
    const id = JSON.stringify([s.actorId, s.selected.selection]);
    return { id, scope: this.nav.authorityVersion + ":" + id, org: s.selected.selection };
  }
  private hide(clear: boolean) {
    this.epoch++;
    this.historyEpoch++;
    this.scope = "";
    if (clear) this.initial = "";
    this.set({ ...empty(), ...(!clear ? { draft: this.state.draft, pending: this.state.pending } : {}) });
  }
  dirty() {
    return !!this.state.draft && JSON.stringify(this.state.draft) !== this.initial;
  }
  attach() {
    const sync = () => {
      const c = this.context();
      if (!c) {
        if (this.scope) this.hide(false);
        return;
      }
      if (this.identity && this.identity !== c.id) this.hide(true);
      this.identity = c.id;
      if (this.scope !== c.scope) {
        this.scope = c.scope;
        void this.refresh();
      }
    };
    const stop = this.nav.subscribe(sync),
      remove = this.nav.register(this, {
        risk: () => (this.state.pending || this.state.saving ? "pending" : this.dirty() ? "dirty" : "clear"),
        changes: () => ["case_work"],
        suspend: () => this.hide(false),
        deny: () => this.hide(true),
        lock: (locked) => this.set({ locked }),
        canSave: () => !!this.command(),
        save: () => this.save(),
        review: () => this.set({ issue: this.state.pending ? "unconfirmed" : "review" }),
      });
    sync();
    return () => {
      this.epoch++;
      this.historyEpoch++;
      this.scope = "";
      stop();
      remove();
    };
  }
  private async request(
    c: NonNullable<ReturnType<CaseworkController["context"]>>,
    path: string,
    p?: Pending,
  ) {
    return readWithTimeout(async (signal) => {
      const response = await this.transport("/api/casework" + path, {
        method: p ? "POST" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: { "x-genesis-organization": c.org, ...(p ? { "Content-Type": "application/json" } : {}) },
        body: p ? JSON.stringify(p) : undefined,
      });
      const data = (await response.json()) as {
        scope?: string;
        records?: WorkRecord[];
        cases?: CaseChoice[];
        firm?: string;
        canWrite?: boolean;
        next?: string | null;
        operationKey?: string;
        saved?: { id: string; revision: number } | null;
        code?: string;
        history?: WorkRecord[];
        before?: number | null;
      };
      if (this.scope === c.scope && c.scope === this.context()?.scope) {
        if (response.status === 401) this.nav.invalidate("expired");
        else if ([403, 404].includes(response.status) && !data.code) this.nav.invalidate("denied");
      }
      return { response, data };
    });
  }
  private valid(c: { scope: string }, e: number) {
    return this.epoch === e && this.scope === c.scope && this.context()?.scope === c.scope;
  }
  async refresh() {
    const c = this.context();
    if (!c || this.state.saving) return;
    const e = ++this.epoch;
    this.historyEpoch++;
    this.set({ loading: true, history: [], historyCase: "", historyBusy: false, before: null });
    try {
      const records: WorkRecord[] = [],
        seen = new Set<string>();
      let after = "",
        cases: CaseChoice[] = [],
        firm = "",
        canWrite = false;
      do {
        const { response, data } = await this.request(c, after ? "?after=" + encodeURIComponent(after) : "");
        if (!this.valid(c, e)) return;
        if (
          !response.ok ||
          data.scope !== c.org ||
          !Array.isArray(data.records) ||
          !Array.isArray(data.cases) ||
          typeof data.firm !== "string"
        )
          throw Error("load");
        if (!after) {
          cases = data.cases;
          firm = data.firm;
          canWrite = data.canWrite === true;
        }
        for (const r of data.records) {
          if (!recordId.test(r.id) || seen.has(r.id) || !Number.isSafeInteger(r.revision))
            throw Error("load");
          seen.add(r.id);
          records.push(r);
        }
        if (
          data.next !== null &&
          (typeof data.next !== "string" || data.next === after || data.next !== data.records.at(-1)?.id)
        )
          throw Error("load");
        after = data.next ?? "";
      } while (after);
      const d = this.state.draft,
        p = this.state.pending;
      const lost = (v: { id: string; revision: number; caseId?: string }) =>
        (!canWrite && !v.id.startsWith("view_")) ||
        (!!v.caseId && !cases.some((k) => k.id === v.caseId && k.canEdit)) ||
        (v.revision > 0 && !seen.has(v.id));
      const revoked = (d && lost(d)) || (p && lost(p));
      this.set({
        records,
        cases,
        firm,
        canWrite,
        loaded: true,
        loading: false,
        ...(revoked
          ? { draft: null, pending: null, issue: "access", notice: "" }
          : this.state.issue === "load"
            ? { issue: "" }
            : {}),
      });
    } catch {
      if (this.valid(c, e))
        this.set({ records: [], cases: [], loaded: false, loading: false, canWrite: false, issue: "load" });
    }
  }
  editable() {
    const s = this.state;
    return !!this.context() && s.loaded && !s.loading && !s.saving && !s.pending && !s.locked;
  }
  private open(d: Editor) {
    if (!this.editable() || this.state.draft) return;
    this.initial = JSON.stringify(d);
    this.set({ draft: d, issue: "", notice: "" });
  }
  template(r?: WorkRecord) {
    if (!this.state.canWrite || (r && (r.kind !== "template" || r.archived))) return;
    this.open({
      ...newEditor("template", r?.id ?? uid("template")),
      revision: r?.revision ?? 0,
      title: r?.title ?? "",
      body: r?.body ?? "",
    });
  }
  generate(r: WorkRecord, current: string, locale: Locale) {
    if (!this.state.canWrite || r.kind !== "template" || r.archived) return;
    this.open({
      ...newEditor("generate", uid("document")),
      sourceId: r.id,
      sourceRevision: r.revision,
      title: r.title,
      caseId: this.state.cases.some((c) => c.id === current && c.canEdit) ? current : "",
      locale,
    });
  }
  progress(c: CaseChoice) {
    if (!c.canEdit) return;
    const p = this.state.records.find((v) => v.id === "progress_" + c.id);
    this.open({
      ...newEditor("progress", "progress_" + c.id),
      caseId: c.id,
      stage: p?.stage ?? "",
      revision: p?.revision ?? 0,
    });
  }
  view(filter: RegisterFilter, r?: WorkRecord) {
    this.open({
      ...newEditor("view", r?.id ?? uid("view")),
      revision: r?.revision ?? 0,
      title: r?.title ?? "",
      filter: { ...filter },
    });
  }
  update(patch: Partial<Pick<Editor, "title" | "body" | "caseId" | "stage" | "confirmed">>) {
    const d = this.state.draft;
    if (!d || !this.editable()) return;
    this.set({
      draft: { ...d, ...patch, ...("caseId" in patch ? { proof: null, confirmed: false } : {}) },
      issue: "",
    });
  }
  discard() {
    if (!this.state.saving && !this.state.pending && !this.state.locked) this.set({ draft: null, issue: "" });
  }
  select(id: string) {
    if (!this.state.draft && !this.state.pending) this.set({ selected: id, issue: "", notice: "" });
  }
  projection() {
    const d = this.state.draft;
    if (d?.action !== "generate") return null;
    const c = this.state.cases.find((v) => v.id === d.caseId && v.canEdit),
      r = this.state.records.find((v) => v.id === d.sourceId && v.kind === "template" && !v.archived);
    if (!c || !r) return null;
    return {
      ...preview(
        r.body,
        this.state.firm,
        c,
        this.state.records.find((v) => v.id === "progress_" + c.id),
        d.locale,
      ),
      sourceRevision: r.revision,
      caseRevision: c.revision,
    };
  }
  reviewPreview() {
    const d = this.state.draft,
      v = this.projection();
    if (this.editable() && d && v && !v.missing.length && v.text.length <= 36000)
      this.set({
        draft: {
          ...d,
          proof: v.text,
          caseRevision: v.caseRevision,
          sourceRevision: v.sourceRevision,
          confirmed: false,
        },
        issue: "",
      });
  }
  command(): Command | null {
    const s = this.state,
      d = s.draft;
    if (!d || !this.dirty() || !this.editable()) return null;
    const old = s.records.find((r) => r.id === d.id);
    if ((old?.revision ?? 0) !== d.revision || old?.archived || (!s.canWrite && d.action !== "view"))
      return null;
    try {
      const v = { action: d.action, id: d.id, revision: d.revision };
      if (d.action === "template") return parseCommand({ ...v, title: d.title, body: d.body });
      if (d.action === "view") return parseCommand({ ...v, title: d.title, filter: d.filter });
      if (!s.cases.some((c) => c.id === d.caseId && c.canEdit) || !d.confirmed) return null;
      if (d.action === "progress")
        return parseCommand({ ...v, caseId: d.caseId, body: d.body, stage: d.stage, deidentified: true });
      const pr = this.projection();
      if (
        !pr ||
        pr.missing.length ||
        d.proof !== pr.text ||
        d.sourceRevision !== pr.sourceRevision ||
        d.caseRevision !== pr.caseRevision
      )
        return null;
      return parseCommand({
        ...v,
        title: d.title,
        caseId: d.caseId,
        caseRevision: d.caseRevision,
        sourceId: d.sourceId,
        sourceRevision: d.sourceRevision,
        locale: d.locale,
        preview: d.proof,
        deidentified: true,
      });
    } catch {
      return null;
    }
  }
  async save(cmd?: Command): Promise<boolean> {
    const c = this.context(),
      s = this.state;
    if (!c || s.saving || s.locked || !s.loaded || s.loading) return false;
    const prior = s.pending,
      chosen = cmd ?? this.command();
    if (!prior && !chosen) return false;
    const p = prior ?? { ...chosen!, operationKey: crypto.randomUUID() },
      e = ++this.epoch;
    this.set({ saving: true, pending: p, issue: "", notice: "" });
    try {
      let r = prior ? await this.request(c, "?operation=" + encodeURIComponent(p.operationKey)) : null;
      if (!this.valid(c, e)) return false;
      if (
        r &&
        (!r.response.ok ||
          r.data.operationKey !== p.operationKey ||
          r.data.scope !== c.org ||
          r.data.saved === undefined)
      )
        throw Error();
      if (!r || r.data.saved === null) r = await this.request(c, "", p);
      if (!this.valid(c, e)) return false;
      const { data, response } = r;
      if (!response.ok) {
        if (![400, 403, 404, 409].includes(response.status)) throw Error();
        this.set({
          saving: false,
          pending: null,
          issue: data.code ?? "changed",
          ...(data.code === "access" || data.code === "readOnly" ? { draft: null } : {}),
        });
        await this.refresh();
        return false;
      }
      if (
        data.scope !== c.org ||
        data.operationKey !== p.operationKey ||
        data.saved?.id !== p.id ||
        data.saved.revision !== p.revision + 1
      )
        throw Error();
      this.set({ saving: false, pending: null, draft: null, selected: p.id, notice: p.action });
      await this.refresh();
      return this.context()?.scope === c.scope;
    } catch {
      if (this.valid(c, e)) this.set({ saving: false, issue: "unconfirmed" });
      return false;
    }
  }
  async history(caseId: string, more = false) {
    const c = this.context(),
      s = this.state;
    if (
      !c ||
      !s.loaded ||
      s.loading ||
      (s.historyBusy && more) ||
      !s.cases.some((k) => k.id === caseId) ||
      (more && (s.historyCase !== caseId || s.before === null))
    )
      return;
    const stamp = ++this.historyEpoch,
      e = this.epoch;
    this.set({ historyBusy: true, historyCase: caseId, ...(!more ? { history: [], before: null } : {}) });
    try {
      const { response, data } = await this.request(
        c,
        "?history=" + caseId + (more ? "&before=" + s.before : ""),
      );
      if (stamp !== this.historyEpoch || !this.valid(c, e)) return;
      if (
        !response.ok ||
        data.scope !== c.org ||
        !Array.isArray(data.history) ||
        data.history.some((v) => v.caseId !== caseId || v.kind !== "progress")
      )
        throw Error();
      this.set({
        history: [...(more ? s.history : []), ...data.history],
        before: data.before ?? null,
        historyBusy: false,
      });
    } catch {
      if (stamp === this.historyEpoch && this.valid(c, e)) {
        this.set({ history: [], before: null, historyBusy: false, issue: "history" });
        await this.refresh();
      }
    }
  }
  async download(id: string) {
    const c = this.context(),
      e = this.epoch;
    if (!c || !this.state.records.some((r) => r.kind === "document" && r.id === id)) return null;
    try {
      const b = await readWithTimeout(async (signal) => {
        const r = await this.transport("/api/casework?download=" + id, {
          signal,
          cache: "no-store",
          credentials: "same-origin",
          headers: { "x-genesis-organization": c.org },
        });
        if (!r.ok || r.headers.get("X-Workspace-Scope") !== c.org) throw Error();
        return r.blob();
      });
      return this.valid(c, e) ? b : null;
    } catch {
      if (this.valid(c, e)) {
        this.set({ issue: "download" });
        await this.refresh();
      }
      return null;
    }
  }
}
