import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import ts from "typescript";
import { StudioTaxWriteBaseline } from "../app/studio-tax-write-baseline";
import { StudioSessionAuthority } from "../app/studio-session-authority";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";

// Run the actual existing JSON-export handler, extracted as syntax to avoid
// mocking the whole Studio component. Real normalization and Case Core remain.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler: ts.FunctionDeclaration | undefined;
let playHandler: ts.FunctionDeclaration | undefined;
let boundaryEffect: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "exportDraft") handler = node;
  if (ts.isFunctionDeclaration(node) && node.name?.text === "exportPlayedCase") playHandler = node;
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useEffectEvent"
    && node.arguments[0]?.getText(source).includes("studioSession.discardVersion !== studioDiscardVersion.current")) boundaryEffect = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(handler); assert.ok(playHandler); assert.ok(boundaryEffect);
const bundle = await build({
  stdin: { contents: `import {normalizeStudioDraft,caseFingerprint,casePublicationFingerprint} from './case-integrity'; import {readStudioAggregate} from './studio-aggregate'; import {caseTypeReference} from './case-type-reference'; export default async function(context){const {studioCanDuplicate,draft,locale,showSessionNotice,studioServerFingerprint,studioServerPublicationFingerprint,studioReportAuthority,studioPrivate}=context; ${handler.getText(source)}; return await exportDraft();}`, loader: "ts", resolveDir: resolve("app") },
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
});
mkdirSync(".artifacts/studio-private-exports", { recursive: true });
const file = resolve(".artifacts/studio-private-exports/json-handler.mjs"); writeFileSync(file, bundle.outputFiles[0].text);
const exportJson = (await import(pathToFileURL(file).href)).default;
const playBundle = await build({
  stdin: { contents: `export default async function(context){const {activeScenario,privatePlayOrigin,privatePlayAuthority,showSessionNotice,locale,decisionLog,serverPlaySession,localCanonicalRuntimeRef,localCanonicalState,canonicalPlayState,outcome,stageIndex,caseMinute,metrics,PLAYED_CASE_SCHEMA_REVISION}=context; ${playHandler.getText(source)}; return await exportPlayedCase();}`, loader: "ts", resolveDir: resolve("app") },
  bundle: true, write: false, platform: "node", format: "esm",
});
const playFile = resolve(".artifacts/studio-private-exports/play-handler.mjs"); writeFileSync(playFile, playBundle.outputFiles[0].text);
const exportPlay = (await import(pathToFileURL(playFile).href)).default;
const boundaryBundle = await build({
  stdin: { contents: `import {shouldDiscardStudioDraft} from './studio-session-authority'; export default function(context){const {studioSession,studioDiscardVersion,privatePlayOrigin,playSessionBusy,playSessionSync,playSessionStartRef,setPrivatePlayOrigin,setActiveScenario,setSelectedOption,setResultOption,setDecisionLog,setOutcome,setDossierRef,setServerPlaySession,setLocalCanonicalState,localCanonicalRuntimeRef,setPlaySessionBusy,setPlaySessionSync,setFeedbackTarget,studioCustomCaseId,studioPrivate,savedCaseRequestRef,purgeLocalStudioState,setStudioOpenRevision,restoredSavedCaseRef,setPrompt,setSessionNotice,currentStudioScopeRef,setStudioStorageScope,setStudioAIEntitlement,setStudioRecovery,studioTaxWriteBaseline}=context; return (${boundaryEffect.getText(source)})(studioSession);}`, loader: "ts", resolveDir: resolve("app") },
  bundle: true, write: false, platform: "node", format: "esm",
});
const boundaryFile = resolve(".artifacts/studio-private-exports/boundary-effect.mjs"); writeFileSync(boundaryFile, boundaryBundle.outputFiles[0].text);
const applyBoundary = (await import(pathToFileURL(boundaryFile).href)).default;

test("actual parent boundary preserves local drafts, stops interrupted private runs and clears revoked protected work", () => {
  const writes = new Map<string, unknown>(); let purges = 0;
  const setters = Object.fromEntries(["PrivatePlayOrigin", "ActiveScenario", "SelectedOption", "ResultOption", "DecisionLog", "Outcome", "DossierRef", "ServerPlaySession", "LocalCanonicalState", "PlaySessionBusy", "PlaySessionSync", "FeedbackTarget", "Prompt", "SessionNotice", "StudioStorageScope", "StudioAIEntitlement", "StudioOpenRevision", "StudioRecovery"].map(name => ["set" + name, (value: unknown) => writes.set(name, value)]));
  const base = { ...setters, studioTaxWriteBaseline: {current: new StudioTaxWriteBaseline()}, studioSession: { phase: "revoked", scope: null, discardVersion: 1, discardLocal: false }, studioDiscardVersion: { current: 0 }, privatePlayOrigin: null, playSessionBusy: false, playSessionSync: "local", playSessionStartRef: { current: 4 }, localCanonicalRuntimeRef: { current: null }, studioCustomCaseId: null, studioPrivate: false, savedCaseRequestRef: { current: 2 }, restoredSavedCaseRef: { current: null }, currentStudioScopeRef: { current: "owner-scope" }, purgeLocalStudioState: () => purges++ };
  applyBoundary(base);
  assert.equal(purges, 0, "another tab's logout must not erase an unrelated local draft");
  assert.equal(writes.get("StudioRecovery"), null, "opaque recovery content is cleared when account scope changes");
  assert.equal(writes.has("ActiveScenario"), false, "a public/local playable case remains unchanged");
  writes.clear();
  const pending = { ...base, studioSession: { ...base.studioSession, phase: "suspended", discardVersion: 1 }, privatePlayOrigin: { scope: "owner-scope", customCaseId: 1 }, studioCustomCaseId: 1, playSessionBusy: true, playSessionSync: "opening" };
  applyBoundary(pending);
  assert.equal(base.playSessionStartRef.current, 5, "old private run callbacks lose their generation");
  assert.equal(writes.get("PlaySessionBusy"), false);
  assert.equal(writes.get("PlaySessionSync"), "error", "same-account recovery cannot leave an interrupted run permanently opening");
  assert.equal(writes.has("ActiveScenario"), false); assert.equal(writes.has("DecisionLog"), false);
  assert.equal(purges, 0, "unconfirmed access conceals but does not discard saved-work edits");
  writes.clear();
  applyBoundary({ ...pending, studioSession: { ...base.studioSession, discardVersion: 2 }, playSessionBusy: false, playSessionSync: "error" });
  assert.equal(purges, 1); assert.equal(writes.get("ActiveScenario"), null);
  assert.equal((writes.get("StudioOpenRevision") as (value: number) => number)(7), 8, "confirmed protected revoke unmounts child dialogs and their private form fields");
  assert.deepEqual(writes.get("DecisionLog"), []); assert.equal(writes.get("PrivatePlayOrigin"), null);
});

test("actual private JSON handler denies stale cached duplication permission and retains local input", async () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document"), oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const files: Blob[] = [], blobs = new Map<string, Blob>(); let signedIn = true, sequence = 0;
  const authority = new StudioSessionAuthority(async path => !signedIn ? Response.json({}, { status: 401 }) : Response.json(path === "/api/me"
    ? { authenticated: true, registered: true, profile: { email: "owner@example.test" }, capabilities: { studioAI: false } }
    : { customCase: { id: 1, access: "owner", copyProtected: false, isPrivate: true } }));
  await authority.refresh(false, 1); const scope = authority.getSnapshot().scope;
  URL.createObjectURL = value => { const url = "blob:json-" + ++sequence; blobs.set(url, value as Blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement() { return { href: "", click(this: { href: string }) { files.push(blobs.get(this.href)!); } }; } } });
  const draft = { ...buildCanopyPackage("base").draft, protection: { kind: "case-protection-v1" as const, copyProtected: false, copyPolicy: "fork_allowed" as const, parentCode: null, currentCode: "sha256-" + "a".repeat(64), seal: "hmac-sha256-" + "b".repeat(64) } };
  const before = JSON.stringify(draft), notices: string[] = [];
  const context = () => ({ studioCanDuplicate: true, draft, locale: "en", showSessionNotice: (notice: string) => notices.push(notice), studioServerFingerprint: caseFingerprint(draft), studioServerPublicationFingerprint: casePublicationFingerprint(draft), studioReportAuthority: authority.reportAuthority(true, scope, 1), studioPrivate: true });
  try {
    const stale = context(); signedIn = false; await exportJson(stale);
    assert.equal(files.length, 0); assert.equal(JSON.stringify(draft), before); assert.match(notices.at(-1)!, /verified access/);
    signedIn = true; await authority.refresh(true, 1); await exportJson(context());
    assert.equal(files.length, 1); assert.equal(JSON.parse(await files[0].text()).case.visibility, "private");
    const old = context(); authority.sessionBoundary("revoke"); await authority.refresh(true, 1); await exportJson(old);
    assert.equal(files.length, 1, "same-account recovery cannot renew a captured old export callback");
    assert.equal(JSON.stringify(draft), before);
    const playContext = {
      activeScenario: { id: "synthetic-private-compiled", caseId: "synthetic-private-compiled", version: "1.0.0", fingerprint: "sha256-" + "c".repeat(64), stages: [{ id: "start", options: [] }] },
      privatePlayOrigin: { scope, customCaseId: 1 }, privatePlayAuthority: authority.reportAuthority(true, scope, 1),
      showSessionNotice: (notice: string) => notices.push(notice), locale: "en", decisionLog: [], outcome: null, stageIndex: 0, caseMinute: 0, metrics: { position: 0, evidence: 0, trust: 0, exposure: 0 },
    };
    signedIn = false; await exportPlay(playContext);
    assert.equal(files.length, 1, "the actual private-derived played-case export cannot bypass the same server boundary");
    await exportPlay({ ...playContext, privatePlayOrigin: null });
    assert.equal(files.length, 2, "unrelated public/local played-case export keeps its existing local behavior");
  } finally {
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
