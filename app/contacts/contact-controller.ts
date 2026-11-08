import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import {
  blankContact,
  contactProfile,
  matchesContact,
  type Contact,
  type ContactCommand,
  type ContactKind,
  type ContactProfile,
  type ImportBatch,
} from "./contact-model";
import { reviewContactCsv } from "./contact-import";

type ProfileDraft = {
  type: "profile";
  id: string;
  revision: number;
  initial: ContactProfile;
  profile: ContactProfile;
  reviewed: string[];
};
type CsvDraft = { type: "csv"; text: string; reviewed: boolean };
type Pending = ContactCommand & { operationKey: string };
type ContactReply = {
  scope?: string;
  code?: string;
  contacts?: Contact[];
  batches?: ImportBatch[];
  next?: string | null;
  canWrite?: boolean;
  operationKey?: string;
  ids?: string[] | null;
};
type State = {
  entries: Contact[];
  batches: ImportBatch[];
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  locked: boolean;
  canWrite: boolean;
  draft: ProfileDraft | CsvDraft | null;
  pending: Pending | null;
  issue: string;
  notice: string;
  savedId: string;
};
const empty = (): State => ({
  entries: [],
  batches: [],
  loaded: false,
  loading: false,
  saving: false,
  locked: false,
  canWrite: false,
  draft: null,
  pending: null,
  issue: "",
  notice: "",
  savedId: "",
});
const profileOf = (c: Contact): ContactProfile =>
  Object.fromEntries(
    Object.keys(blankContact(c.kind)).map((k) => [
      k,
      c[k as keyof ContactProfile] ?? blankContact(c.kind)[k as keyof ContactProfile],
    ]),
  ) as ContactProfile;
export class ContactController {
  private state = empty();
  private listeners = new Set<() => void>();
  private epoch = 0;
  private identity = "";
  private boundScope = "";
  constructor(
    private navigation: NavigationController,
    private transport: (path: string, init: RequestInit) => Promise<Response>,
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
    if (s.phase !== "ready" || s.busy || s.endingSession || !s.actorId || !s.selected) return null;
    const identity = JSON.stringify([s.actorId, s.selected.selection]);
    return {
      identity,
      scope: `${this.navigation.authorityVersion}:${identity}`,
      selection: s.selected.selection,
    };
  }
  private hide(clear: boolean) {
    this.epoch++;
    this.boundScope = "";
    this.publish({ ...empty(), ...(!clear ? { draft: this.state.draft, pending: this.state.pending } : {}) });
  }
  dirty() {
    const d = this.state.draft;
    return d?.type === "csv"
      ? Boolean(d.text)
      : d?.type === "profile" && JSON.stringify(d.profile) !== JSON.stringify(d.initial);
  }
  attach() {
    const sync = () => {
      const c = this.context();
      if (!c) {
        this.hide(false);
        return;
      }
      if (this.identity && this.identity !== c.identity) this.hide(true);
      this.identity = c.identity;
      if (this.boundScope !== c.scope) {
        this.boundScope = c.scope;
        void this.refresh();
      }
    };
    const stop = this.navigation.subscribe(sync);
    const remove = this.navigation.register(this, {
      risk: () => (this.state.pending || this.state.saving ? "pending" : this.dirty() ? "dirty" : "clear"),
      changes: () => ["contact"],
      suspend: () => this.hide(false),
      deny: () => this.hide(true),
      lock: (locked) => this.publish({ locked }),
      canSave: () => Boolean(this.draftCommand()),
      save: () => this.save(),
      review: () => this.publish({ issue: this.state.pending ? "unconfirmed" : "review" }),
    });
    sync();
    return () => {
      this.epoch++;
      this.boundScope = "";
      stop();
      remove();
    };
  }
  private async request(
    c: NonNullable<ReturnType<ContactController["context"]>>,
    path: string,
    command?: Pending,
  ) {
    return readWithTimeout(async (signal) => {
      const response = await this.transport("/api/contacts" + path, {
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
      const data = (await response.json()) as ContactReply;
      if (c.scope === this.context()?.scope && c.scope === this.boundScope) {
        if (response.status === 401) this.navigation.invalidate("expired");
        if ([403, 404].includes(response.status) && data?.code !== "caseAccess")
          this.navigation.invalidate("denied");
      }
      return { response, data };
    });
  }
  async refresh() {
    const c = this.context();
    if (!c || this.state.saving) return;
    const ticket = ++this.epoch;
    const current = () => ticket === this.epoch && c.scope === this.context()?.scope;
    this.publish({ loading: true });
    try {
      const entries: Contact[] = [],
        seen = new Set<string>();
      let after = "",
        batches: ImportBatch[] = [],
        canWrite = false;
      do {
        const { response, data } = await this.request(c, after ? "?after=" + encodeURIComponent(after) : "");
        if (!current()) return;
        if (
          !response.ok ||
          data.scope !== c.selection ||
          !Array.isArray(data.contacts) ||
          !Array.isArray(data.batches)
        )
          throw Error();
        if (!after) {
          batches = data.batches;
          canWrite = data.canWrite === true;
        }
        for (const item of data.contacts) {
          if (
            typeof item.id !== "string" ||
            seen.has(item.id) ||
            !Array.isArray(item.caseIds) ||
            !Number.isSafeInteger(item.revision)
          )
            throw Error();
          seen.add(item.id);
          entries.push(item);
        }
        if (
          data.next !== null &&
          (typeof data.next !== "string" ||
            !data.contacts.length ||
            data.next !== data.contacts.at(-1)?.id ||
            data.next === after)
        )
          throw Error();
        after = data.next ?? "";
      } while (after);
      this.publish({
        entries,
        batches,
        canWrite,
        loaded: true,
        loading: false,
        issue: this.state.issue === "load" ? "" : this.state.issue,
      });
    } catch {
      if (current())
        this.publish({
          entries: [],
          batches: [],
          canWrite: false,
          loading: false,
          loaded: false,
          issue: "load",
        });
    }
  }
  private editable() {
    return (
      this.state.canWrite &&
      this.state.loaded &&
      !this.state.saving &&
      !this.state.pending &&
      !this.state.locked
    );
  }
  select(id: string) {
    if (!this.state.draft && !this.state.pending) this.publish({ savedId: id, notice: "", issue: "" });
  }
  open(kind: ContactKind, contact?: Contact) {
    if (!this.editable() || contact?.status === "archived" || this.state.draft) return;
    const profile = contact ? profileOf(contact) : blankContact(kind);
    this.publish({
      draft: {
        type: "profile",
        id: contact?.id ?? "",
        revision: contact?.revision ?? 0,
        initial: profile,
        profile,
        reviewed: [],
      },
      issue: "",
      notice: "",
      savedId: "",
    });
  }
  setProfile(field: keyof ContactProfile, value: string) {
    const d = this.state.draft;
    if (!this.editable() || d?.type !== "profile" || field === "kind") return;
    this.publish({
      draft: {
        ...d,
        profile: {
          ...d.profile,
          [field]: value,
          ...(field === "relationship" && value !== "prospect" ? { leadStage: "" } : {}),
        },
        reviewed: [],
      },
      issue: "",
    });
  }
  duplicates() {
    const d = this.state.draft;
    return d?.type === "profile"
      ? this.state.entries.filter((c) => c.id !== d.id && matchesContact(c, d.profile))
      : [];
  }
  reviewMatches(checked: boolean) {
    const d = this.state.draft;
    if (d?.type === "profile" && this.editable())
      this.publish({ draft: { ...d, reviewed: checked ? this.duplicates().map((c) => c.id) : [] } });
  }
  importCsv() {
    if (this.editable() && !this.state.draft)
      this.publish({ draft: { type: "csv", text: "", reviewed: false }, issue: "", notice: "", savedId: "" });
  }
  setCsv(text: string) {
    if (this.editable() && this.state.draft?.type === "csv")
      this.publish({ draft: { type: "csv", text, reviewed: false }, issue: "" });
  }
  previewCsv() {
    const d = this.state.draft;
    if (!this.editable() || d?.type !== "csv") return;
    try {
      reviewContactCsv(d.text, this.state.entries);
      this.publish({ draft: { ...d, reviewed: true }, issue: "" });
    } catch (e) {
      this.publish({ issue: e instanceof Error ? e.message : "invalid" });
    }
  }
  close() {
    if (!this.state.saving && !this.state.pending && !this.state.locked)
      this.publish({ draft: null, issue: "" });
  }
  useSaved() {
    const d = this.state.draft;
    if (d?.type !== "profile" || !this.editable()) return;
    const current = this.state.entries.find((c) => c.id === d.id);
    if (current) {
      this.close();
      this.open(current.kind, current);
    }
  }
  draftCommand(): ContactCommand | null {
    const d = this.state.draft;
    if (
      !this.state.canWrite ||
      !this.state.loaded ||
      this.state.loading ||
      this.state.pending ||
      this.state.saving ||
      !this.dirty() ||
      !d
    )
      return null;
    try {
      if (d.type === "csv") {
        if (!d.reviewed) return null;
        const profiles = reviewContactCsv(d.text, this.state.entries).flatMap((row) =>
          row.profile ? [row.profile] : [],
        );
        return profiles.length ? { action: "import", profiles } : null;
      }
      if (
        d.id &&
        !this.state.entries.some((c) => c.id === d.id && c.revision === d.revision && c.status === "active")
      )
        return null;
      if (this.duplicates().some((c) => !d.reviewed.includes(c.id))) return null;
      return {
        action: d.id ? "edit" : "create",
        id: d.id,
        revision: d.revision,
        profile: contactProfile(d.profile),
        reviewed: d.reviewed,
      };
    } catch {
      return null;
    }
  }
  async save(command?: ContactCommand): Promise<boolean> {
    const c = this.context();
    if (
      !c ||
      this.state.saving ||
      this.state.loading ||
      !this.state.loaded ||
      !this.state.canWrite ||
      this.state.locked
    )
      return false;
    const original = this.state.pending;
    const chosen = command ?? this.draftCommand();
    if (!original && !chosen) return false;
    const pending: Pending = original ?? { ...chosen!, operationKey: crypto.randomUUID() };
    const ticket = ++this.epoch,
      current = () => ticket === this.epoch && c.scope === this.context()?.scope;
    this.publish({ saving: true, pending, issue: "", notice: "" });
    try {
      let result = original
        ? await this.request(c, "?operation=" + encodeURIComponent(original.operationKey))
        : null;
      if (!current()) return false;
      if (
        result &&
        (!result.response.ok ||
          result.data.scope !== c.selection ||
          result.data.operationKey !== pending.operationKey)
      )
        throw Error();
      if (!result || result.data.ids === null) result = await this.request(c, "", pending);
      if (!current()) return false;
      const { response, data } = result;
      if (!response.ok) {
        if ([400, 403, 404, 409].includes(response.status)) {
          const draft = this.state.draft;
          this.publish({
            pending: null,
            saving: false,
            issue: data.code ?? "changed",
            draft: draft?.type === "csv" ? { ...draft, reviewed: false } : draft,
          });
          if (response.status === 409 || data.code === "caseAccess") await this.refresh();
          return false;
        }
        throw Error();
      }
      if (
        data.scope !== c.selection ||
        data.operationKey !== pending.operationKey ||
        !Array.isArray(data.ids) ||
        !data.ids.length
      )
        throw Error();
      this.publish({
        pending: null,
        saving: false,
        draft: null,
        notice: pending.action,
        savedId: data.ids.length === 1 ? data.ids[0] : "",
      });
      await this.refresh();
      return current() || c.scope === this.context()?.scope;
    } catch {
      if (current()) this.publish({ saving: false, issue: "unconfirmed" });
      return false;
    }
  }
}
