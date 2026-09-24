import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DispositionRecoveryController } from "../app/matters/disposition-recovery-controller";

// Node SSR of the actual component, with CSS omitted. This is not browser acceptance.
const built = await build({ entryPoints: ["app/matters/DispositionRecovery.tsx"], bundle: true, write: false, format: "esm", platform: "node", packages: "external", loader: { ".css": "empty", ".module.css": "empty" }, jsx: "automatic" });
mkdirSync(".artifacts/recovery-render", { recursive: true });
const file = resolve(".artifacts/recovery-render/component.mjs");
writeFileSync(file, built.outputFiles[0].text);
const Component = (await import(pathToFileURL(file).href)).default;
const scope = { actorId: "actor_alice", organizationId: "signed_selection", caseId: "dossier_case", recordId: "deadline_private", generation: 1 };
const review = { actor_id: scope.actorId, kind: "deadline", revision: 7, can_review: true, disposition: null, readiness_effect: "Only historical deadline resolved", record: { id: scope.recordId, title: "Private title" }, dependent_assertions: [], current_output_ids: [] };
function harness() {
  const responses: Response[] = [];
  const controller = new DispositionRecoveryController({ scope, kind: "deadline", newKey: () => "original-key", read: async () => { const r = responses.shift(); assert.ok(r); return r; } });
  return { controller, enqueue: (body: unknown, status = 200) => responses.push(new Response(JSON.stringify(body), { status })), render: () => renderToStaticMarkup(createElement(Component, { controller, onReturn() {}, signInHref: "/signin-with-chatgpt?return_to=%2Fmatters" })) };
}
test("R1 actual markup omits private record and reason throughout 401 then500", async () => {
  const h = harness(); assert.match(h.render(), /Open review/); h.enqueue(review); await h.controller.open();
  h.controller.setDraft({ reason: "Private proposal", status: "completed", support: "" }); assert.match(h.render(), /Private title/);
  for (const status of [401, 500]) {
    h.enqueue({}, status); await h.controller.open(); const html = h.render();
    assert.doesNotMatch(html, /Private title|Private proposal|<textarea|Saved revision/);
    assert.match(html, /target="_top"/); assert.match(html, /Check access again/);
  }
});
test("R1 confirmed save after session recovery exposes a read-only queue update action", async () => {
  const h = harness(); h.enqueue(review); await h.controller.open(); h.controller.setDraft({ reason: "Valid reason", status: "completed", support: "" });
  h.enqueue(review); h.enqueue({ disposition: { dossierId: scope.caseId, deadlineReferenceId: scope.recordId, reason: "Valid reason", newStatus: "completed", supportingSourceAnchorId: null, revisionBefore: 7, revisionAfter: 8, auditEventId: "audit_original", idempotencyKey: "original-key", actorRef: scope.actorId }, audit_event_id: "audit_original", dossier: { dossier_id: scope.caseId, revision: 8 } });
  h.enqueue({}, 401); await h.controller.save(); assert.doesNotMatch(h.render(), /Saved revision/);
  h.enqueue(review); await h.controller.open(); const html = h.render(); assert.match(html, /Saved revision 8/); assert.match(html, /Update case actions/); assert.doesNotMatch(html, /Confirm and save outcome/);
});
test("R1 recorded outcome renders its reason without offering an overwrite", async () => {
  const h = harness(); h.enqueue({ ...review, disposition: { newStatus: "waived", reason: "Recorded competing outcome", occurredAt: "2026-09-15T10:00:00Z" } }); await h.controller.open();
  const html = h.render(); assert.match(html, /Recorded competing outcome/); assert.match(html, /cannot be overwritten/); assert.doesNotMatch(html, /<textarea|Confirm and save outcome/);
});
