import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint } from "../app/case-integrity";
import { createStudioAuthContinuation, readStudioAuthContinuation } from "../app/studio-auth-continuation";
import { safeWorkspaceReturn, workspaceDestination, workspacePagePath, workspaceSignInPath } from "../app/workspace-navigation";
import { createCaseReportPreview } from "../app/case-report";

test("same-tab sign-in retains exact imported coordinates, prompt and selected node", () => {
  const draft = buildCanopyPackage("base").draft;
  const saved = createStudioAuthContinuation({ draft, prompt: "Compare a conditional pilot with immediate expansion.", selectedNodeId: draft.nodes[1].id, scope: null, customCaseId: null, isPrivate: false, canDuplicate: true }, 1000);
  const restored = readStudioAuthContinuation(JSON.stringify(saved), saved.id, "new-signed-in-scope", 2000)!;
  assert.equal(caseFingerprint(restored.draft), "sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702");
  assert.equal(restored.prompt, saved.prompt);
  assert.equal(restored.selectedNodeId, draft.nodes[1].id);
  assert.deepEqual(restored.draft.nodes.map(({ x, y }) => [x, y]), draft.nodes.map(({ x, y }) => [x, y]));
});

test("expired, mismatched and cross-account continuations cannot be restored", () => {
  const saved = createStudioAuthContinuation({ draft: buildCanopyPackage("base").draft, prompt: "", selectedNodeId: null, scope: "account-A", customCaseId: null, isPrivate: false, canDuplicate: true }, 1000);
  const raw = JSON.stringify(saved);
  assert.equal(readStudioAuthContinuation(raw, saved.id, "account-B", 2000), null);
  assert.equal(readStudioAuthContinuation(raw, "wrong-id", "account-A", 2000), null);
  assert.equal(readStudioAuthContinuation(raw, saved.id, "account-A", 901001), null);
  assert.equal(readStudioAuthContinuation(raw, saved.id, "account-A", 999), null);
  assert.equal(readStudioAuthContinuation("invalid", saved.id, "account-A", 2000), null);
});

test("private, server-owned, inspection-only and protected drafts cannot use the temporary sign-in store", () => {
  const input = { draft: buildCanopyPackage("base").draft, prompt: "", selectedNodeId: null, scope: null, customCaseId: null, isPrivate: false, canDuplicate: true };
  assert.throws(() => createStudioAuthContinuation({ ...input, isPrivate: true }));
  assert.throws(() => createStudioAuthContinuation({ ...input, customCaseId: 9 }));
  assert.throws(() => createStudioAuthContinuation({ ...input, canDuplicate: false }));
  assert.throws(() => createStudioAuthContinuation({ ...input, draft: { ...input.draft, protection: { kind: "case-protection-v1", copyProtected: true, copyPolicy: "lineage_locked", parentCode: null, currentCode: "test-protected", seal: "test-seal" } } }));
});

test("authentication preserves deep case context and rejects external, API and recursive auth redirects", () => {
  const path = workspacePagePath("/canopy", { organization: "org-a", dossier: "case-a", scenario: "base", run: "run-a", lang: "ru", injected: "discard" });
  const signIn = new URL(workspaceSignInPath(path), "https://example.test");
  assert.equal(signIn.searchParams.get("return_to"), path);
  assert.ok(!path.includes("discard"));
  for (const unsafe of ["https://evil.test/", "//evil.test/", "/\\evil.test/", "/api/me", "/signin-with-chatgpt", "/callback", "/%2f%2fevil.test", "/account\n"]) assert.equal(safeWorkspaceReturn(unsafe), "/studio");
});

test("Studio and account navigation retain the originating organization and case", () => {
  const source = "/canopy?organization=org-a&dossier=case-a&scenario=base&lang=ru";
  const studio = workspaceDestination("/studio?example=canopy", source);
  const target = new URL(studio, "https://example.test");
  assert.equal(target.searchParams.get("organization"), "org-a");
  assert.equal(target.searchParams.get("return_to"), source);
  assert.equal(target.searchParams.get("example"), "canopy");
  assert.equal(workspaceDestination("/matters", studio), "/matters?organization=org-a&lang=ru&dossier=case-a");
  assert.equal(workspaceDestination("/canopy", studio), "/canopy?organization=org-a&lang=ru&dossier=case-a&scenario=base");
  assert.equal(workspaceDestination("https://external.test/matters", source), "https://external.test/matters");
});

test("PDF preview rejects inspection-only access before loading or generating a PDF", async () => {
  await assert.rejects(createCaseReportPreview(buildCanopyPackage("base").draft, {} as never, { canGenerate: false }), /inspection-only/);
});
