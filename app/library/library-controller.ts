import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import { firmFolder, type FirmDocument, type IncompleteFirmUpload } from "./firm-document-model";

export type UploadDraft = {
  id?: string;
  expectedVersion: number;
  title: string;
  folder: string;
  file: File | null;
  mediaType: string;
  acknowledged: boolean;
  kind?: "folder";
  restored?: IncompleteFirmUpload;
};
type State = {
  documents: FirmDocument[];
  folders: string[];
  incomplete: IncompleteFirmUpload[];
  history: FirmDocument[];
  nextVersion: number | null;
  loaded: boolean;
  loading: boolean;
  canWrite: boolean;
  issue: string;
  notice: string;
  draft: UploadDraft | null;
  pending: FormData | null;
  saving: boolean;
  locked: boolean;
};
const empty = (): State => ({
  documents: [],
  folders: [],
  incomplete: [],
  history: [],
  nextVersion: null,
  loaded: false,
  loading: false,
  canWrite: false,
  issue: "",
  notice: "",
  draft: null,
  pending: null,
  saving: false,
  locked: false,
});
const blank = (): UploadDraft => ({
  expectedVersion: 0,
  title: "",
  folder: "",
  file: null,
  mediaType: "application/pdf",
  acknowledged: false,
});
const validDoc = (v: FirmDocument) =>
  v &&
  /^firm_doc_[a-f0-9]{64}$/.test(v.id) &&
  Number.isSafeInteger(v.version) &&
  v.version > 0 &&
  typeof v.filename === "string" &&
  typeof v.title === "string" &&
  typeof v.folder === "string" &&
  Number.isSafeInteger(v.bytes) &&
  v.bytes > 0 &&
  Number.isFinite(Date.parse(v.occurredAt));
export class LibraryController {
  private state = empty();
  private listeners = new Set<() => void>();
  private epoch = 0;
  private identity = "";
  private active = true;
  private historyRequest = 0;
  constructor(
    private navigation: NavigationController,
    private transport: (url: string, init?: RequestInit) => Promise<Response>,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private context() {
    const s = this.navigation.getSnapshot();
    return s.phase === "ready" && !s.endingSession && !s.busy && s.actorId && s.selected
      ? {
          identity: `${s.actorId}:${s.selected.selection}`,
          scope: `${this.navigation.authorityVersion}:${s.actorId}:${s.selected.selection}`,
          selection: s.selected.selection,
        }
      : null;
  }
  private current(epoch: number, scope: string) {
    return this.active && epoch === this.epoch && scope === this.context()?.scope;
  }
  private hide(clear: boolean) {
    this.epoch++;
    this.publish({ ...empty(), ...(!clear ? { draft: this.state.draft, pending: this.state.pending } : {}) });
  }
  attach() {
    this.active = true;
    const sync = () => {
      const c = this.context();
      if (!c) {
        this.hide(false);
        return;
      }
      if (this.identity && this.identity !== c.identity) this.hide(true);
      this.identity = c.identity;
      if (!this.state.saving) void this.refresh();
    };
    const stop = this.navigation.subscribe(sync),
      unregister = this.navigation.register(this, {
        risk: () =>
          this.state.pending || this.state.saving ? "pending" : this.state.draft ? "dirty" : "clear",
        suspend: () => this.hide(false),
        deny: () => this.hide(true),
        lock: (locked) => this.publish({ locked }),
        review: () => this.publish({ notice: "Review the retained upload in Library." }),
        canSave: () => this.canSave(),
        save: () => this.upload(),
      });
    sync();
    return () => {
      this.active = false;
      this.epoch++;
      stop();
      unregister();
    };
  }
  private async request(path: string, selection: string, init?: RequestInit) {
    const scope = this.context()?.scope;
    const response = await this.transport(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: { ...init?.headers, "x-genesis-organization": selection },
    });
    if (this.active && scope && scope === this.context()?.scope) {
      if (response.status === 401) this.navigation.invalidate("expired");
      if ([403, 404].includes(response.status)) this.navigation.invalidate("denied");
    }
    return response;
  }
  async refresh() {
    const c = this.context();
    if (!c || this.state.saving || this.state.locked) return;
    const epoch = ++this.epoch;
    this.publish({ loading: true, issue: "" });
    try {
      const documents: FirmDocument[] = [],
        ids = new Set<string>(),
        seen = new Set<string>();
      let cursor = "",
        canWrite = false,
        folders: string[] = [],
        incomplete: IncompleteFirmUpload[] = [];
      do {
        const data = await readWithTimeout(async (signal) => {
          const r = await this.request(
            `/api/library/firm${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
            c.selection,
            { signal },
          );
          if (!r.ok) throw Error("Could not load firm documents. Refresh to retry.");
          return r.json() as Promise<{
            scope: string;
            documents: FirmDocument[];
            nextCursor: string | null;
            canWrite: boolean;
            folders?: string[];
            incomplete?: IncompleteFirmUpload[];
          }>;
        });
        if (!this.current(epoch, c.scope)) return;
        if (
          data.scope !== c.selection ||
          !Array.isArray(data.documents) ||
          data.documents.some((v) => !validDoc(v) || ids.has(v.id))
        )
          throw Error("Invalid document scope.");
        if (!cursor) {
          folders = data.folders ?? [];
          incomplete = data.incomplete ?? [];
          if (
            !Array.isArray(folders) ||
            folders.some((f) => typeof f !== "string") ||
            !Array.isArray(incomplete) ||
            incomplete.some(
              (v) =>
                !v ||
                typeof v.key !== "string" ||
                typeof v.filename !== "string" ||
                !Number.isSafeInteger(v.expectedVersion),
            )
          )
            throw Error("Invalid document scope.");
        }
        for (const doc of data.documents) {
          if (ids.has(doc.id)) throw Error("Invalid document scope.");
          ids.add(doc.id);
          documents.push(doc);
        }
        canWrite = data.canWrite === true;
        cursor = data.nextCursor ?? "";
        if (cursor && (seen.has(cursor) || seen.size >= 199))
          throw Error("The library changed while loading. Refresh to retry.");
        seen.add(cursor);
      } while (cursor);
      if (this.current(epoch, c.scope))
        this.publish({
          documents,
          folders: [...new Set([...folders, ...documents.map((v) => v.folder).filter(Boolean)])].sort(),
          incomplete,
          history: [],
          nextVersion: null,
          canWrite,
          loaded: true,
          loading: false,
        });
    } catch (error) {
      if (this.current(epoch, c.scope))
        this.publish({
          documents: [],
          folders: [],
          incomplete: [],
          history: [],
          nextVersion: null,
          canWrite: false,
          loaded: false,
          loading: false,
          issue: error instanceof Error ? error.message : "Documents unavailable.",
        });
    }
  }
  private mayEdit() {
    return Boolean(
      this.context() &&
      this.state.loaded &&
      this.state.canWrite &&
      !this.state.draft &&
      !this.state.pending &&
      !this.state.locked &&
      !this.state.saving,
    );
  }
  edit(document?: FirmDocument, folder = "") {
    if (this.mayEdit())
      this.publish({
        draft: {
          ...blank(),
          id: document?.id,
          expectedVersion: document?.version ?? 0,
          title: document?.title ?? "",
          folder: document?.folder ?? folder,
        },
        issue: "",
        notice: "",
      });
  }
  editFolder() {
    if (this.mayEdit()) this.publish({ draft: { ...blank(), kind: "folder" }, issue: "", notice: "" });
  }
  resume(item: IncompleteFirmUpload) {
    if (this.mayEdit() && this.state.incomplete.some((v) => v.key === item.key))
      this.publish({
        draft: {
          ...blank(),
          restored: item,
          id: item.id ?? undefined,
          expectedVersion: item.expectedVersion,
          title: item.title,
          folder: item.folder,
        },
        issue: "",
        notice: "",
      });
  }
  update(draft: UploadDraft) {
    const old = this.state.draft;
    if (old && !this.state.pending && !this.state.saving && !this.state.locked)
      this.publish({
        draft: {
          ...draft,
          kind: old.kind,
          id: old.id,
          expectedVersion: old.expectedVersion,
          restored: old.restored,
          ...(old.restored ? { title: old.title, folder: old.folder } : {}),
        },
      });
  }
  discard() {
    if (!this.state.pending && !this.state.saving && !this.state.locked)
      this.publish({ draft: null, issue: "" });
  }
  stale() {
    const d = this.state.draft;
    return Boolean(
      d?.id &&
      this.state.loaded &&
      this.state.documents.find((v) => v.id === d.id)?.version !== d.expectedVersion,
    );
  }
  compare() {
    const d = this.state.draft,
      latest = this.state.documents.find((v) => v.id === d?.id);
    if (d && latest && !d.restored && !this.state.pending && !this.state.saving && !this.state.locked)
      this.publish({ draft: { ...d, expectedVersion: latest.version }, issue: "", notice: "" });
  }
  canSave() {
    const d = this.state.draft;
    return Boolean(
      this.context() &&
      d?.title.trim() &&
      this.state.canWrite &&
      this.state.loaded &&
      !this.stale() &&
      !this.state.pending &&
      !this.state.saving &&
      !this.state.locked &&
      (d.kind === "folder" ||
        (d.file && d.acknowledged && (!d.restored || d.file.name === d.restored.filename))),
    );
  }
  private matches(data: Record<string, unknown>, body: FormData) {
    if (data.operation !== body.get("operationKey")) return false;
    if (body.get("action") === "folder") return data.folder === firmFolder(body.get("folder"));
    const doc = data.document as FirmDocument,
      file = body.get("file");
    return Boolean(
      doc &&
      validDoc(doc) &&
      file &&
      typeof file !== "string" &&
      doc.version === Number(body.get("expectedVersion")) + 1 &&
      (!body.has("id") || doc.id === body.get("id")) &&
      doc.title === String(body.get("title")).trim() &&
      doc.folder === firmFolder(body.get("folder")) &&
      doc.filename === file.name &&
      doc.bytes === file.size &&
      doc.mediaType === body.get("mediaType"),
    );
  }
  private async complete(notice: string) {
    this.publish({ draft: null, pending: null, saving: false, notice });
    await this.refresh();
    return true;
  }
  async upload() {
    const c = this.context(),
      d = this.state.draft;
    if (!c || !d || !this.state.canWrite || this.state.saving || this.state.locked) return false;
    let body = this.state.pending;
    if (!body) {
      if (!this.canSave()) return false;
      body = new FormData();
      body.set("operationKey", d.restored?.key ?? crypto.randomUUID());
      if (d.kind === "folder") {
        body.set("action", "folder");
        body.set("folder", d.title);
      } else {
        body.set("file", d.file!);
        body.set("title", d.title);
        body.set("folder", d.folder);
        body.set("expectedVersion", String(d.expectedVersion));
        body.set("mediaType", d.mediaType);
        body.set("privacyAcknowledgement", "synthetic_or_deidentified");
        if (d.id) body.set("id", d.id);
      }
    }
    const epoch = ++this.epoch;
    this.publish({ pending: body, saving: true, issue: "" });
    try {
      const { r, data } = await readWithTimeout(
        async (signal) => {
          const r = await this.request("/api/library/firm", c.selection, { method: "POST", body, signal });
          return { r, data: (await r.json()) as Record<string, unknown> };
        },
        { timeoutMs: 60000 },
      );
      if (!this.current(epoch, c.scope)) return false;
      if (!r.ok) {
        if ([400, 409, 507].includes(r.status)) this.publish({ pending: null });
        throw Error(typeof data.error === "string" ? data.error : "Upload not confirmed.");
      }
      if (!this.matches(data, body)) throw Error("Save receipt did not match. Check saved status.");
      return await this.complete(
        d.kind === "folder" ? "Folder saved." : "Document saved. Earlier versions remain available.",
      );
    } catch (error) {
      if (this.current(epoch, c.scope))
        this.publish({
          issue:
            error instanceof TypeError ||
            (error instanceof Error && /^(Response lost|Lost response)$/i.test(error.message))
              ? "Save status unknown. Check saved status."
              : error instanceof Error
                ? error.message
                : "Upload not confirmed.",
        });
      return false;
    } finally {
      if (this.current(epoch, c.scope)) this.publish({ saving: false });
    }
  }
  async checkSaved() {
    const c = this.context(),
      body = this.state.pending;
    if (!c || !body || this.state.saving || this.state.locked) return;
    const epoch = ++this.epoch;
    this.publish({ saving: true, issue: "" });
    try {
      const data = await readWithTimeout(async (signal) => {
        const r = await this.request(
          `/api/library/firm?operation=${encodeURIComponent(String(body.get("operationKey")))}`,
          c.selection,
          { signal },
        );
        if (!r.ok) throw Error();
        return (await r.json()) as Record<string, unknown>;
      });
      if (!this.current(epoch, c.scope)) return;
      if (data.scope !== c.selection || data.operation !== body.get("operationKey")) throw Error();
      if (data.state === "committed" && this.matches(data, body)) {
        await this.complete(
          body.get("action") === "folder" ? "Folder saved." : "Save confirmed. No file was resent.",
        );
        return;
      }
      if (data.state === "cancelled") {
        await this.complete("Incomplete upload cancelled. No version was published.");
        return;
      }
      this.publish({ issue: "Save is not confirmed. Retry the original operation." });
    } catch {
      if (this.current(epoch, c.scope))
        this.publish({ issue: "Save status unavailable. Retry the status check." });
    } finally {
      if (this.current(epoch, c.scope)) this.publish({ saving: false });
    }
  }
  async cancelIncomplete(key: string) {
    const c = this.context();
    if (
      !c ||
      this.state.saving ||
      this.state.locked ||
      !this.state.canWrite ||
      (!this.state.incomplete.some((v) => v.key === key) && this.state.pending?.get("operationKey") !== key)
    )
      return;
    const epoch = ++this.epoch;
    this.publish({ saving: true, issue: "" });
    try {
      const body = new FormData();
      body.set("action", "cancel");
      body.set("operationKey", key);
      const data = await readWithTimeout(async (signal) => {
        const r = await this.request("/api/library/firm", c.selection, { method: "POST", body, signal });
        if (!r.ok) throw Error();
        return r.json() as Promise<Record<string, unknown>>;
      });
      if (!this.current(epoch, c.scope)) return;
      if (
        data.scope !== c.selection ||
        data.operation !== key ||
        !["committed", "cancelled"].includes(String(data.state))
      )
        throw Error();
      if (data.state === "committed") {
        const pending = this.state.pending,
          expected = this.state.incomplete.find((v) => v.key === key),
          doc = data.document as FirmDocument;
        if (
          pending
            ? !this.matches(data, pending)
            : !expected ||
              !validDoc(doc) ||
              (expected.id && expected.id !== doc.id) ||
              doc.version !== expected.expectedVersion + 1 ||
              doc.filename !== expected.filename ||
              doc.title !== expected.title ||
              doc.folder !== expected.folder
        )
          throw Error();
      }
      await this.complete(
        data.state === "committed"
          ? "Save confirmed. No file was resent."
          : "Incomplete upload cancelled. No version was published.",
      );
    } catch {
      if (this.current(epoch, c.scope))
        this.publish({ issue: "Cancellation not confirmed. Check saved status or refresh the Library." });
    } finally {
      if (this.current(epoch, c.scope)) this.publish({ saving: false });
    }
  }
  async versions(id: string, older = false) {
    const ticket = ++this.historyRequest,
      c = this.context();
    if (!c || this.state.locked) return;
    const epoch = this.epoch,
      before = older && this.state.history[0]?.id === id ? this.state.nextVersion : null;
    if (older && !before) return;
    const previous = before ? this.state.history : [];
    this.publish({ history: previous, nextVersion: null, issue: "" });
    try {
      const data = await readWithTimeout(async (signal) => {
        const r = await this.request(
          `/api/library/firm?id=${encodeURIComponent(id)}${before ? `&before=${before}` : ""}`,
          c.selection,
          { signal },
        );
        if (!r.ok) throw Error("Version history unavailable.");
        return r.json() as Promise<{ scope: string; documents: FirmDocument[]; nextVersion?: number | null }>;
      });
      if (
        data.scope !== c.selection ||
        !Array.isArray(data.documents) ||
        data.documents.some(
          (v, i) =>
            !validDoc(v) ||
            v.id !== id ||
            v.version >= (i ? data.documents[i - 1].version : (before ?? Infinity)),
        )
      )
        throw Error("Document scope changed.");
      if (this.current(epoch, c.scope) && ticket === this.historyRequest)
        this.publish({ history: [...previous, ...data.documents], nextVersion: data.nextVersion ?? null });
    } catch (error) {
      if (this.current(epoch, c.scope) && ticket === this.historyRequest)
        this.publish({
          nextVersion: before,
          issue: error instanceof Error ? error.message : "History unavailable.",
        });
    }
  }
  async download(document: FirmDocument) {
    const c = this.context();
    if (!c || this.state.locked) return null;
    const epoch = this.epoch;
    try {
      const blob = await readWithTimeout(
        async (signal) => {
          const r = await this.request(
            `/api/library/firm?id=${document.id}&version=${document.version}&download=1`,
            c.selection,
            { signal },
          );
          if (!r.ok) throw Error("Download unavailable. Refresh access and retry.");
          return r.blob();
        },
        { timeoutMs: 60000 },
      );
      return this.current(epoch, c.scope) ? blob : null;
    } catch (error) {
      if (this.current(epoch, c.scope))
        this.publish({ issue: error instanceof Error ? error.message : "Download unavailable." });
      return null;
    }
  }
}
