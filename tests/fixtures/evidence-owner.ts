import { practiceHarness } from "./practice-owner";

/** Local synthetic transport; no provider, production writes or recipient data. */
export async function evidenceHarness() {
  const h = practiceHarness(), read = h.owner.options.transport;
  const statement = 'The source identifies itself as “Synthetic version two / Вторая версия.”';
  const note = 'Synthetic QA review / Проверка: preserve this original note verbatim, including its wording and punctuation.';
  const raw = JSON.stringify({ schema_version: 1, statement }, null, 2);
  let writes = 0;
  h.owner.options.transport = async (path, init) => {
    if (init?.method === "POST") { writes++; return Response.json({ error: "Synthetic validation failure" }, { status: 422 }); }
    const route = new URL(path, "https://synthetic.test").pathname;
    if (route.endsWith("/evidence/anchors")) return Response.json({ source_anchors: [{ source_anchor_id: "qa-anchor", document_id: "qa-doc", document_version_id: "qa-version-2", document_title: "Synthetic long source / Синтетический источник", version_ordinal: 2, review_state: "accepted", excerpt: "Synthetic version two / Вторая версия." }] });
    if (route.endsWith("/evidence/assertions")) return Response.json({ assertions: [{ assertion_id: "qa-assertion", assertion_type: "fact", statement, status: "accepted", source_anchor_ids: ["qa-anchor"] }] });
    if (route.endsWith("/documents")) return Response.json({ documents: [{ document_id: "qa-doc", title: "Synthetic long source / Синтетический источник", current_version_id: "qa-version-2", status: "accepted_source" }], document_versions: [{ document_id: "qa-doc", document_version_id: "qa-version-2", ordinal: 2, extraction_status: "ready" }] });
    if (route.endsWith("/proposals")) return Response.json({ proposals: [
      { proposal_id: "qa-accepted", proposal_type: "fact", proposed_value: raw, source_anchor_ids: ["qa-anchor"], review_state: "accepted", review_note: note, destination_type: "professional_assertion", model_provenance: { provider: "synthetic-provider", model: "synthetic-model" } },
      { proposal_id: "qa-pending", proposal_type: "fact", proposed_value: raw, source_anchor_ids: ["qa-anchor"], review_state: "pending" },
    ] });
    if (route.endsWith("/activity")) return Response.json({ events: [{ audit_event_id: "qa-event", event_type: "proposal_reviewed", summary_code: "AI_PROPOSAL_ACCEPTED", actor_role: "owner", occurred_at: "2026-11-18T14:18:45Z" }] });
    return read(path, init);
  };
  await h.start(); h.owner.navigate("evidence");
  return { ...h, statement, note, raw, writeCount: () => writes };
}
