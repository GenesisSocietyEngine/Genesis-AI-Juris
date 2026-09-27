import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
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

test("an untitled prompt-only case survives guest cancellation and ordinary sign-in without inventing graph content", () => {
  const draft = { ...buildCanopyPackage("base").draft, caseId: "untitled_case", title: "", parent: null, premise: "", nodes: [], links: [], editHistory: [] };
  const prompt = "Should the synthetic business renew its maintenance agreement?\nCheck the costs before deciding.";
  const saved = createStudioAuthContinuation({ draft, prompt, selectedNodeId: null, scope: null, customCaseId: null, isPrivate: false, canDuplicate: true, action: "save" }, 1000);
  for (const scope of [null, "new-signed-in-scope"]) {
    const restored = readStudioAuthContinuation(JSON.stringify(saved), saved.id, scope, 21_000);
    assert.ok(restored, "incomplete authoring work is a valid temporary continuation");
    assert.equal(restored.prompt, prompt);
    assert.equal(restored.action, "save");
    assert.equal(restored.draft.caseId, "untitled_case");
    assert.equal(restored.draft.title, "");
    assert.equal(restored.draft.premise, "");
    assert.deepEqual(restored.draft.nodes, []);
    assert.deepEqual(restored.draft.links, []);
    assert.equal(restored.selectedNodeId, null);
    assert.throws(() => normalizeStudioDraft(restored.draft), "continuation support must not relax the save/import model");
  }
  assert.equal(readStudioAuthContinuation(JSON.stringify(saved), saved.id, null, 901001), null);
});

test("incomplete continuations retain field validation, account scope and protected-data exclusions", () => {
  const base = buildCanopyPackage("base").draft;
  const draft = { ...base, title: "", nodes: [], links: [] };
  const saved = createStudioAuthContinuation({ draft, prompt: "Unfinished authoring", selectedNodeId: null, scope: "account-A", customCaseId: null, isPrivate: false, canDuplicate: true }, 1000);
  const restore = (changedDraft: unknown, scope: string | null = "account-A") => readStudioAuthContinuation(JSON.stringify({ ...saved, draft: changedDraft }), saved.id, scope, 2000);
  assert.equal(restore(draft, "account-B"), null);
  assert.equal(restore(draft, null), null);
  assert.equal(restore({ ...draft, links: [base.links[0]] }), null, "an empty graph cannot carry dangling links");
  assert.equal(restore({ ...draft, caseId: "invalid case ID" }), null);
  assert.equal(restore({ ...draft, title: " ".repeat(201) }), null);
  assert.equal(restore({ ...draft, nodes: [{ ...base.nodes[0], x: -1 }] }), null);
  assert.equal(restore({ ...draft, protection: { kind: "case-protection-v1", copyProtected: true, copyPolicy: "lineage_locked", parentCode: null, currentCode: "protected-case", seal: "protected-seal" } }), null);
  const untitledGraph = restore({ ...base, title: "" });
  assert.ok(untitledGraph);
  assert.equal(untitledGraph.draft.title, "");
  assert.deepEqual(untitledGraph.draft.nodes.map(node => node.id), base.nodes.map(node => node.id));
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

test("administration account completion returns to the exact organization and language", () => {
  const source="/organizations?organization=org-admin&lang=ru#members";
  const target=new URL(workspaceDestination("/account",source),"https://example.test");
  assert.equal(target.searchParams.get("organization"),"org-admin");
  assert.equal(target.searchParams.get("lang"),"ru");
  assert.equal(safeWorkspaceReturn(target.searchParams.get("return_to")),source);
});
