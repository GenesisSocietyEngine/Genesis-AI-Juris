import { WorkspaceController } from "../../app/matters/workspace-controller";

/** In-memory synthetic server. No production data, credentials or storage. */
export function caseEditorHarness() {
  const identity = { actorId: "synthetic-owner", organizationId: "synthetic-org" };
  let dossier = { dossier_id: "synthetic-case", reference: "CASE-2026-014", title: "Supplier agreement review", revision: 4, status: "active", jurisdictions: ["Belgium"], priority: "normal", classification: "confidential", owner_actor_id: identity.actorId, permissions: { role: "owner", can_write: true }, participants: [{ participant_id: "person-a", actor_id: identity.actorId, display_name: "Alex Morgan", role: "owner", status: "active" }] };
  let lose: "before" | "after" | null = null, denied = false, expired = false, changedAccount = false, failReads = false, conflict = false;
  let delayed: (() => Promise<void>) | null = null;
  const writes: Record<string, unknown>[] = [], reads: string[] = [];
  const owner = new WorkspaceController({ identity, transport: async (path, init) => {
    const url = new URL(path, "https://synthetic.test");
    if (expired) return Response.json({}, { status: 401 });
    if (denied) return Response.json({}, { status: 404 });
    if (url.pathname === "/api/organizations") return Response.json({ selected: { ...identity, actorId: changedAccount ? "other-actor" : identity.actorId, selection: identity.organizationId, status: "active" } });
    if (url.pathname === "/api/dossiers") return Response.json({ dossiers: [dossier] });
    if (url.pathname === "/api/dossiers/synthetic-case" && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)); writes.push(body);
      if (delayed) await delayed();
      if (lose === "before") { lose = null; throw new Error("Synthetic offline"); }
      if (conflict) { conflict = false; dossier = { ...dossier, revision: dossier.revision + 1, title: "Colleague's saved case name" }; }
      if (body.expectedRevision !== dossier.revision) return Response.json({ code: "revision_conflict" }, { status: 409 });
      const fields = { ...body }; delete fields.expectedRevision;
      dossier = { ...dossier, ...fields, revision: dossier.revision + 1 };
      if (lose === "after") { lose = null; throw new Error("Synthetic lost receipt"); }
      return Response.json({ dossier });
    }
    reads.push(url.pathname);
    if (failReads) throw new Error("Synthetic read unavailable");
    if (url.pathname === "/api/dossiers/synthetic-case") return Response.json({ dossier });
    return Response.json({ documents: [], source_anchors: [], assertions: [], requests: [], deadlines: [], proposals: [], decision_packages: [], snapshots: [], outputs: [], events: [] });
  } });
  return {
    owner, writes, reads, read: () => dossier,
    change: (fields: Partial<typeof dossier> = { title: "Colleague's saved case name" }) => { dossier = { ...dossier, ...fields, revision: dossier.revision + 1 }; },
    readonly: () => { dossier = { ...dossier, permissions: { role: "observer", can_write: false } }; },
    lose: (when: "before" | "after") => { lose = when; }, conflict: () => { conflict = true; },
    deny: () => { denied = true; }, expire: (value = true) => { expired = value; }, changeAccount: () => { changedAccount = true; },
    failReads: (value = true) => { failReads = value; }, delay: (fn: () => Promise<void>) => { delayed = fn; },
    start: async () => { owner.enter("synthetic-case"); await owner.load(); },
  };
}
