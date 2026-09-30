import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import ts from "typescript";
import { normalizeStudioDraft, caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { StudioTaxWriteBaseline } from "../app/studio-tax-write-baseline";
import { buildStudioCustomCaseExport } from "../app/studio-tax-export";
import { taxAttachmentDigest, type TaxAttachmentV1 } from "../app/tax-authoring";
import type { StudioDraft } from "../app/types";

// Execute the real UI handlers with real carrier/fingerprint/receipt validation.
// React, file selection and transport are observed boundaries, not browser QA.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && ["shareDraft", "importDraft", "analysePromptWithAI"].includes(node.name.text)) handlers.set(node.name.text, node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source); assert.equal(handlers.size, 3);
const bundle = await build({ stdin: { loader: "ts", resolveDir: resolve("app"), contents: `
import {freezeStudioDraftSnapshot,readStudioAggregate} from './studio-aggregate';
import {studioJsonBytes,STUDIO_DRAFT_SERIALIZED_LIMIT} from './studio-envelope';
import {readStudioSaveResponse,verifiedStudioSaveReceipt,savedStudioPath} from './studio-save-receipt';
import {studioAIBaseFingerprint} from './studio-ai-plan';
import {isRecord,normalizeStudioDraft,caseFingerprint,casePublicationFingerprint,legacyCaseFingerprintV15,canonicalFingerprint} from './case-integrity';
import {caseTypeReference} from './case-type-reference';
import {mayChooseImportedPrivacy} from './studio-import-privacy';
export function save(context) {
 const {draft,serverFingerprint,serverPublicationFingerprint,prepareTaxWrite,fetch,onWorkspaceSaved}=context;
 const state={workspace:'idle',error:'',draft};
 const isPrivate=false,canDuplicate=true,derivationsSettled=true,workspaceState='idle',aiEntitlement='not_configured',locale='en';
 const saveOperationRef={current:0},saveMountedRef={current:true},pendingAuthActionRef={current:'save'},saveContextRef={current:{caseId:draft.caseId,version:draft.version,scope:'account'}};
 const setWorkspaceState=value=>state.workspace=value,setWorkspaceError=value=>state.error=value;
 const setCustomCaseId=()=>{},setPrivate=()=>{},setCanManagePrivacy=()=>{},setServerFingerprint=()=>{},setServerPublicationFingerprint=()=>{},setCopyProtectionLocked=()=>{},setWorkspaceSavedFingerprint=()=>{},setWorkspaceSavedAt=()=>{};
 const setDraft=fn=>state.draft=fn(state.draft),openWorkspaceAuthorization=()=>{throw Error('unexpected auth');};
 const window={location:{search:''},history:{state:null,replaceState(){}}};
 ${handlers.get("shareDraft")}
 return {state,run:()=>shareDraft('save'),saveContextRef};
}
export function importer(context) {
 const state={draft:context.draft,recovery:null,notices:[],fetches:0,loaded:0};
 const locale='en',savedCaseRequestRef={current:0},draftRef={current:context.draft},currentStudioScopeRef={current:'account'},restoredSavedCaseRef={current:null};
 const studioTaxWriteBaseline={current:context.baseline};
 let reader;
 class FileReader {constructor(){reader=this;} readAsArrayBuffer(file){this.result=file.bytes;}}
 const mayLeaveStudio=()=>true,replaceStudioDraft=next=>{state.draft=next;draftRef.current=next;studioTaxWriteBaseline.current.clear();return true;};
 const setStudioRecovery=value=>state.recovery=value,setView=()=>{},setSessionNotice=value=>state.notices.push(value),showSessionNotice=setSessionNotice;
 const setStudioPrivate=()=>{},setStudioCustomCaseId=()=>{},setStudioCanManagePrivacy=()=>{},setStudioServerFingerprint=()=>{},setStudioServerPublicationFingerprint=()=>{},setStudioCanDuplicate=()=>{},setStudioCopyProtectionLocked=()=>{},setPrompt=()=>{},setSelectedNodeId=()=>{},navigate=()=>{};
 const window=context.window??{location:{href:'https://workspace.invalid/studio'},history:{state:null,replaceState(){}}};
 const fetch=async(...args)=>{state.fetches++;return context.fetch(...args);},readJsonResponse=response=>response.json();
 ${handlers.get("importDraft")}
 return {state,async run(text){const bytes=typeof text==='string'?new TextEncoder().encode(text):text;importDraft({size:bytes.length,bytes:bytes.buffer},()=>state.loaded++);await reader.onload();}};
}
export function canonical(prompt) {
 const state={ai:'idle',pending:false,recovery:null,flushes:0};
 const canDuplicate=true,derivationsSettled=true,draftWithinEnvelope=true,canonicalPrompt=true,locale='en',aiInputKey='original',reportReceiptStorageScope='account';
 const saveMountedRef={current:true},aiInputKeyRef={current:aiInputKey},saveContextRef={current:{scope:'account'}};
 const setAIState=value=>{state.ai=value;state.pending=value==='analysing';},setAIError=()=>{},setCanonicalCandidate=()=>{};
 const flushSync=callback=>{callback();state.flushes++;};
 const onDocumentRecovery=(reason,rawText,filename)=>{state.recovery={reason,rawText,filename,pending:state.pending};};
 ${handlers.get("analysePromptWithAI")}
 return {state,run:analysePromptWithAI,leave:()=>{saveMountedRef.current=false;}};
}` }, bundle: true, platform: "node", format: "esm", write: false });
mkdirSync(".artifacts/studio-tax-handlers", { recursive: true });
const output = resolve(".artifacts/studio-tax-handlers/handlers.mjs"); writeFileSync(output, bundle.outputFiles[0].text);
const actual = await import(pathToFileURL(output).href);
const fixture = JSON.parse(readFileSync("tests/fixtures/fiveflats-rent-146000.studio-draft.json", "utf8"));
const corpus = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-corpus.json", "utf8"));
const descriptor = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-source.json", "utf8")).descriptor;
const request = JSON.parse(corpus.cases.find((entry: { name: string }) => entry.name === "prepare").response).request;
const fields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const attachment: TaxAttachmentV1 = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({schema:"web-tax-authoring-artifact-v1",source:descriptor,request,edit:Object.fromEntries(fields.map(key=>[key,"12."])),bindings:[],benefits:[],required_component_ids:[],rates_confirmed:false,legacy_documents:[' {"large":18446744073709551617} '],previous_source_documents:[]},null,2)+"\n" };
const draft = () => normalizeStudioDraft({ ...fixture, parent: null, taxAnalysis: attachment });
const protection = {kind:"case-protection-v1" as const,copyProtected:false,copyPolicy:"fork_allowed" as const,parentCode:null,currentCode:`sha256-${"a".repeat(64)}`,seal:`hmac-sha256-${"b".repeat(64)}`};

test("actual save sends the verified prior carrier and frozen exact input, then adopts only its confirmed seal", async () => {
  const baseline = new StudioTaxWriteBaseline(), before = draft(), fingerprint = caseFingerprint(before);
  baseline.capture(before,"account",fingerprint);
  const edited = {...before,taxAnalysis:{...attachment,document:attachment.document+" "}};
  const expected = structuredClone(edited), persisted: unknown[] = [];
  const h = actual.save({draft:edited,serverFingerprint:fingerprint,serverPublicationFingerprint:casePublicationFingerprint(before),
    prepareTaxWrite:async(...args: Parameters<typeof baseline.prepare>)=>{const pending=baseline.prepare(...args);assert.equal(Object.isFrozen(args[0]),true);h.state.draft={...edited,title:"Later unsaved input"};return pending;},
    onWorkspaceSaved:(saved:StudioDraft)=>persisted.push(saved),fetch:async(_path:string,init:RequestInit)=>{
      const sent=JSON.parse(String(init.body));assert.deepEqual(sent.draft,JSON.parse(JSON.stringify(expected)));assert.equal(sent.taxAttachmentMutation.expected,await taxAttachmentDigest(before.taxAnalysis));
      const fp=caseFingerprint(sent.draft),pub=casePublicationFingerprint(sent.draft);
      return Response.json({customCase:{id:7,caseId:sent.draft.caseId,currentVersion:sent.draft.version,fingerprint:fp,publicationFingerprint:pub,isPrivate:false,protection},submission:{id:9,customCaseId:7,caseId:sent.draft.caseId,version:sent.draft.version,fingerprint:fp,publicationFingerprint:pub,status:"draft",updatedAt:"2026-09-30T16:00:00.000Z"}});
    }});
  await h.run();assert.equal(h.state.workspace,"saved",h.state.error);assert.equal(persisted.length,1);assert.deepEqual((persisted[0] as StudioDraft).taxAnalysis,expected.taxAnalysis);
  assert.equal(h.state.draft.title,"Later unsaved input");assert.equal(h.state.draft.protection,undefined);
});

test("actual save refuses unverified retained lineage or changed authority before any request without losing input", async () => {
  const input=draft(), exact=JSON.stringify(input), baseline=new StudioTaxWriteBaseline();let requests=0;
  const context={draft:input,serverFingerprint:caseFingerprint(input),serverPublicationFingerprint:casePublicationFingerprint(input),prepareTaxWrite:baseline.prepare,fetch:()=>{requests++;throw Error("unexpected request");}};
  const h=actual.save(context);await h.run();assert.equal(h.state.workspace,"error");assert.match(h.state.error,/Keep these edits/);assert.equal(requests,0);assert.equal(JSON.stringify(input),exact);
  baseline.capture(input,"account");
  const changed=actual.save({...context,prepareTaxWrite:async(...args:Parameters<typeof baseline.prepare>)=>{const result=await baseline.prepare(...args);baseline.clear();return result;}});
  await changed.run();assert.equal(changed.state.workspace,"error");assert.match(changed.state.error,/authority changed/);assert.equal(requests,0);
});

test("actual v5 import verifies the server seal before retaining its exact carrier and prior baseline", async () => {
  const input={...draft(),protection}, built=buildStudioCustomCaseExport(input,{exportedAt:"2026-09-30T16:00:00.000Z",visibility:"private"});
  const old={...draft(),title:"Current edits"}, baseline=new StudioTaxWriteBaseline();
  const h=actual.importer({draft:old,baseline,fetch:async()=>Response.json({valid:true,canDuplicate:true,customCaseId:7,fingerprint:caseFingerprint(input),publicationFingerprint:casePublicationFingerprint(input)})});
  await h.run(built.rawText);assert.equal(h.state.fetches,1,h.state.recovery?.reason??JSON.stringify(h.state.notices));assert.equal(h.state.loaded,1);assert.equal(h.state.recovery,null);assert.deepEqual(h.state.draft.taxAnalysis,attachment);
  assert.equal((await baseline.prepare(h.state.draft,"account",caseFingerprint(input))).mutation?.expected,await taxAttachmentDigest(attachment));
  const denied=actual.importer({draft:old,baseline:new StudioTaxWriteBaseline(),fetch:async()=>Response.json({valid:false},{status:403})});
  await denied.run(built.rawText);assert.equal(denied.state.loaded,0);assert.equal(denied.state.draft,old);assert.match(denied.state.notices.at(-1),/could not be imported/);
});

test("actual import retains opaque and ambiguous original text without downgrade, export grant or changed current work", async () => {
  const old=draft();
  for(const raw of [' {"format":"genesis-juris-custom-case","schemaVersion":99,"large":18446744073709551617} \n','{"caseId":"a","caseId":"b"}',JSON.stringify({...old,nodes:[{...old.nodes[0],future:{large:"18446744073709551617"}}]})]) {
    const h=actual.importer({draft:old,baseline:new StudioTaxWriteBaseline(),fetch:()=>assert.fail("No verification for unsupported data")});
    await h.run(raw);assert.equal(h.state.draft,old);assert.equal(h.state.loaded,0);assert.equal(h.state.fetches,0);assert.equal(h.state.recovery.rawText,raw);assert.equal(h.state.recovery.canExport,false);
  }
  const malformed=actual.importer({draft:old,baseline:new StudioTaxWriteBaseline(),fetch:()=>assert.fail("No request")});
  await malformed.run(new Uint8Array([123,34,255,34,58,49,125]));assert.equal(malformed.state.loaded,0);assert.equal(malformed.state.draft,old);assert.equal(malformed.state.recovery,null);assert.match(malformed.state.notices.at(-1),/could not be imported/);
});

test("late verified import must not replace editor after navigation", async () => {
  const input={...draft(),protection}, built=buildStudioCustomCaseExport(input,{exportedAt:"2026-09-30T16:00:00.000Z",visibility:"private"});
  const old={...draft(),title:"Current edits"}, baseline=new StudioTaxWriteBaseline();
  const window={location:{href:"https://workspace.invalid/studio?view=studio"},history:{state:null,replaceState(){}}};
  const h=actual.importer({draft:old,baseline,window,fetch:async()=>{
    // navigate('library') changes the URL/view; it does not change draft, account,
    // or savedCaseRequestRef, and no Studio save/AI operation is active here.
    window.location.href="https://workspace.invalid/studio?view=library";
    return Response.json({valid:true,canDuplicate:true,customCaseId:7,fingerprint:caseFingerprint(input),publicationFingerprint:casePublicationFingerprint(input)});
  }});
  await h.run(built.rawText);
  assert.equal(h.state.loaded,0,"A stale imported file must not return the user to Studio");
  assert.equal(h.state.draft,old,"Current work must remain unchanged after navigation");
});

test("actual canonical refusal finishes local verification before recovery unmount and ignores a departed editor", async () => {
  const raw="  # Future canonical\n<!-- GENESIS-JURIS-CANONICAL-V99\noriginal:18446744073709551617\n-->\n";
  const h=actual.canonical(raw);await h.run();
  assert.equal(h.state.recovery.rawText,raw);assert.equal(h.state.recovery.pending,false);assert.equal(h.state.ai,"idle");assert.equal(h.state.flushes,1);
  const departed=actual.canonical(raw),pending=departed.run();departed.leave();await pending;
  assert.equal(departed.state.recovery,null);
});
