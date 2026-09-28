import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceController } from "../app/matters/workspace-controller";

// Render the actual integrated parent. Data transport is simulated here; real
// handler persistence is covered separately by p1-organization-erp.test.ts.
const built = await build({ entryPoints: ["app/matters/MattersClient.tsx"], bundle: true, write: false, format: "esm", platform: "node", packages: "external", loader: { ".css": "empty", ".module.css": "empty" }, jsx: "automatic", plugins: [{name:"render-router", setup(build) {
  build.onResolve({filter:/^next\/navigation$/}, () => ({path:"router",namespace:"test"}));
  build.onLoad({filter:/.*/,namespace:"test"}, () => ({contents:"export function useRouter(){return {push(){}}}"}));
  // SSR normally does not run effects. The navigation regressions capture the
  // real parent callbacks and run only URL/focus effects against a small DOM
  // adapter. This is a component-flow contract, not browser acceptance.
  build.onResolve({filter:/^react$/}, args => args.namespace === "effect-react" ? {path:"react",external:true} : {path:"react",namespace:"effect-react"});
  build.onLoad({filter:/.*/,namespace:"effect-react"}, () => ({contents:'export * from "react"; import { useRef as realUseRef } from "react"; export function useEffect(callback, dependencies) { globalThis.__b1Effects?.push({callback, dependencies}); } export function useLayoutEffect(callback, dependencies) { globalThis.__b1LayoutEffects?.push({callback, dependencies}); } export function useRef(value) { const ref=realUseRef(value); if (value===null && globalThis.__b1DraftRoot) ref.current=globalThis.__b1DraftRoot; return ref; }'}));
  build.onResolve({filter:/^react\/jsx-runtime$/}, args => args.namespace === "capture-jsx" ? {path:"react/jsx-runtime",external:true} : {path:"jsx",namespace:"capture-jsx"});
  build.onLoad({filter:/.*/,namespace:"capture-jsx"}, () => ({contents:'export * from "react/jsx-runtime"; import { jsx as realJsx, jsxs as realJsxs } from "react/jsx-runtime"; function capture(props) { if (props?.onChangeCapture) globalThis.__b1DraftRoots?.push(props); if (props?.href?.startsWith("#source-")) globalThis.__b1Citations?.push(props); } export function jsx(type,props,key) { capture(props); return realJsx(type,props,key); } export function jsxs(type,props,key) { capture(props); return realJsxs(type,props,key); }'}));
}}] });
mkdirSync(".artifacts/b1-render", { recursive: true }); const file = resolve(".artifacts/b1-render/component.mjs"); writeFileSync(file, built.outputFiles[0].text);
const Parent = (await import(pathToFileURL(file).href)).AuthorizedMattersClient;
const identity = { actorId: "actor_test", organizationId: "signed_org" };
const dossier = { dossier_id: "case_a", title: "Confidential parent case title", permissions:{role:"owner"}, revision: 7, readiness: { dossier_id:"case_a", ready:false, computed_from_revision:7, evaluated_at:"2026-09-15T10:00:00Z", dimensions:[{dimension:"information",state:"blocked",reasons:[{code:"CRITICAL_DEADLINE_OVERDUE",explanation:"Private deadline attention",related_object_type:"deadline_reference",related_object_id:"deadline_a"}]}] } };
function harness() {
  let status = 200, orgStatus = 200, requestStatus = 200, malformedAnchors = false;
  const owner = new WorkspaceController({ identity, transport: async path => {
    const url = new URL(path,"https://test.invalid");
    if (status !== 200) return Response.json({}, {status});
    if (url.pathname === "/api/organizations") return Response.json({selected:{...identity,selection:identity.organizationId,status:"active"}}, {status:orgStatus});
    if (url.pathname === "/api/dossiers/case_a") return Response.json({dossier});
    if (url.pathname.endsWith("/dispositions")) return Response.json({actor_id:identity.actorId,kind:"deadline",revision:7,can_review:true,disposition:null,readiness_effect:"Private readiness effect",record:{id:"deadline_a",title:"Private historical title"},dependent_assertions:[],current_output_ids:[]});
    if (malformedAnchors && url.pathname.endsWith("/evidence/anchors")) return Response.json({});
    if (url.pathname.endsWith("/requests")) return Response.json({requests:[],deadlines:[]}, {status:requestStatus});
    return Response.json({documents:[],source_anchors:[],assertions:[],proposals:[],decision_packages:[],snapshots:[],outputs:[],events:[]});
  }});
  const render = () => renderToStaticMarkup(createElement(Parent,{...identity,controller:owner}));
  return {owner,render,setStatus:(value:number)=>{status=value;},setOrgStatus:(value:number)=>{orgStatus=value;},setRequestStatus:(value:number)=>{requestStatus=value;},setMalformedAnchors:()=>{malformedAnchors=true;}};
}

test("source review parent distinguishes exact audit version and focuses citation containers", async () => {
  const h=harness(),read=h.owner.options.transport;
  let pointer="version_2";
  const anchor={source_anchor_id:"anchor_a",document_id:"doc_a",document_version_id:"version_1",document_title:"Synthetic long source title",version_ordinal:1,heading:"Capacity",excerpt:"300 confirmed slots",review_state:"pending"};
  h.owner.options.transport=async(path,init)=>{
    const url=new URL(path,"https://test.invalid");
    if(url.pathname.endsWith("/documents")) return Response.json({documents:[{document_id:"doc_a",title:"Synthetic long source title",status:"accepted_source",current_version_id:pointer}],document_versions:[{document_id:"doc_a",document_version_id:"version_1",ordinal:1},{document_id:"doc_a",document_version_id:"version_2",ordinal:2}]});
    if(url.pathname.endsWith("/activity")) return Response.json({events:[{audit_event_id:"audit_accept",event_type:"dossier_updated",object_ref_type:"document",object_ref_id:"doc_a",summary_code:"DOCUMENT_ACCEPTED_SOURCE",actor_id:"reviewer",occurred_at:"2026-09-28T00:00:00Z",detail:{action:"review",status:"accepted_source",current_version_id:"version_1"}}],next_cursor:"unloaded_history"});
    if(url.pathname.endsWith("/evidence/anchors")) return Response.json({source_anchors:[anchor]});
    if(url.pathname.endsWith("/evidence/assertions")) return Response.json({assertions:[{assertion_id:"assertion_a",assertion_type:"fact",statement:"Synthetic assertion",status:"needs_review",source_anchor_ids:["anchor_a","missing"]}]});
    if(url.pathname.endsWith("/proposals")) return Response.json({proposals:[{proposal_id:"proposal_a",proposal_type:"fact",proposed_value:"Synthetic proposal",source_anchor_ids:["anchor_a"],review_state:"pending"}]});
    return read(path,init);
  };
  const globals=globalThis as unknown as Record<string,unknown>,previousDocument=Object.getOwnPropertyDescriptor(globalThis,"document");
  try {
    h.owner.enter("case_a");await h.owner.load();h.owner.navigate("documents");
    const html=h.render();
    assert.match(html,/Document status: Accepted source/);assert.match(html,/Version 2<\/strong><span>Current file/);
    assert.match(html,/Version 1 accepted as source/);assert.match(html,/Review of the current file is not established from loaded audit records/);
    assert.match(html,/Open acceptance record/);
    pointer="unavailable_version";await h.owner.load();assert.match(h.render(),/Current version unavailable/);assert.doesNotMatch(h.render(),/Version [12]<\/strong><span>Current file/);
    h.owner.navigate("evidence");const links:Array<{href:string;onClick:(event:unknown)=>void}>=[];globals.__b1Citations=links;
    const evidence=h.render();
    assert.match(evidence,/id="source-anchor_a"[^>]*tabindex="-1"[^>]*aria-label="Source citation: Synthetic long source title, version 1, Capacity"[^>]*aria-describedby="source-excerpt-anchor_a source-status-anchor_a"/);
    assert.match(evidence,/id="source-excerpt-anchor_a">300 confirmed slots/);assert.match(evidence,/Source citation unavailable/);assert.doesNotMatch(evidence,/href="#source-missing"/);
    const focused:string[]=[];
    Object.defineProperty(globalThis,"document",{configurable:true,value:{getElementById(id:string){return {focus(){focused.push(id);},querySelector(){throw Error("review button must not get focus");}};}}});
    assert.equal(links.length,2,"assertion and AI-proposal links use exact sources");
    for(const link of links) { assert.equal(link.href,"#source-anchor_a");link.onClick({button:0,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,defaultPrevented:false}); }
    assert.deepEqual(focused,["source-anchor_a","source-anchor_a"]);
  } finally {delete globals.__b1Citations;if(previousDocument)Object.defineProperty(globalThis,"document",previousDocument);else delete globals.document;h.owner.dispose();}
});

type CapturedEffect = { callback: () => unknown; dependencies?: unknown[] };
function navigationDom() {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originals = new Map(["window", "document", "requestAnimationFrame", "cancelAnimationFrame", "__b1Effects"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames: Array<() => void> = [];
  let href = "https://test.invalid/matters?organization=signed_org&dossier=case_a&lang=en&section=overview";
  Object.assign(globals, {
    window: { location: { get href() { return href; } }, history: { state: null, replaceState(_state: unknown, _title: string, url: string) { href = url; } }, dispatchEvent() {} },
    document: { getElementById() { return null; }, querySelectorAll() { return []; } },
    requestAnimationFrame(callback: () => void) { frames.push(callback); return frames.length; }, cancelAnimationFrame() {},
  });
  return {
    url: () => new URL(href),
    run(h: ReturnType<typeof harness>, flush = true) {
      const effects: CapturedEffect[] = []; globals.__b1Effects = effects;
      try { h.render(); } finally { delete globals.__b1Effects; }
      const state = h.owner.getSnapshot();
      for (const effect of effects) {
        if (effect.dependencies?.includes(state.destination) && (effect.dependencies.includes(h.owner) || effect.dependencies.includes(state.visit?.caseId))) effect.callback();
      }
      if (flush) this.flush();
    },
    flush() { for (const frame of frames.splice(0)) frame(); },
    restore() { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globals[key]; } },
  };
}

for (const destination of ["documents", "overview"] as const) test(`B1 audit target and focus notice end on manual ${destination} navigation without losing the queue or drafts`, async () => {
  const h = harness(), dom = navigationDom();
  try {
    const read = h.owner.options.transport;
    h.owner.options.transport = (path, init) => path.includes("/activity?event_id=") ? Promise.resolve(Response.json({ events: [{ audit_event_id: "audit_a", event_type: "source_anchor_retired", summary_code: "SOURCE_ANCHOR_RETIRED" }] })) : read(path, init);
    h.owner.enter("case_a"); await h.owner.load();
    h.owner.setQueue({ filter: "blocking", showAll: true, scrollAnchor: "action-a" });
    h.owner.rememberDraft("metadata-title", "Keep this unrelated draft");
    await h.owner.open({ destination: "activity", id: "audit-audit_a", originActionKey: "action-a" });
    const queue = h.owner.getSnapshot().queue;
    dom.run(h);
    assert.equal(dom.url().searchParams.get("target"), "audit-audit_a");
    assert.match(h.render(), /This exact record or control is unavailable/);
    // A previously queued focus callback is intentionally delivered after the
    // navigation as well; it must not reinstate the obsolete target notice.
    dom.run(h, false);
    if (destination === "documents") h.owner.navigate(destination); else h.owner.returnToActions();
    dom.run(h);
    assert.equal(h.owner.getSnapshot().targetActive, false);
    assert.equal(h.owner.getSnapshot().target?.id, "audit-audit_a", "Form and origin context remains available without driving focus or URL");
    assert.equal(dom.url().searchParams.get("section"), destination);
    assert.equal(dom.url().searchParams.get("target"), null);
    assert.equal(dom.url().searchParams.get("request"), null);
    assert.equal(dom.url().searchParams.get("organization"), identity.organizationId);
    assert.equal(dom.url().searchParams.get("lang"), "en");
    assert.doesNotMatch(h.render(), /This exact record or control is unavailable/);
    assert.equal(h.owner.getSnapshot().queue, queue);
    assert.equal(h.owner.draft("metadata-title"), "Keep this unrelated draft");
    assert.equal(h.owner.departureRisk(), "dirty");
    assert.equal(h.owner.getSnapshot().bundle?.activity[0].id, "audit_a");
    // Explicitly reopening the original receipt still selects its exact target.
    await h.owner.open({ destination: "activity", id: "audit-audit_a" }); dom.run(h);
    assert.equal(dom.url().searchParams.get("section"), "activity");
    assert.equal(dom.url().searchParams.get("target"), "audit-audit_a");
  } finally { h.owner.dispose(); dom.restore(); }
});

test("B1 actual uncontrolled evidence draft restores after manual tab return while exact target is inactive", async () => {
  const h = harness();
  const globals = globalThis as unknown as Record<string, unknown>;
  const names = ["__b1DraftRoot", "__b1DraftRoots", "__b1LayoutEffects", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"];
  const originals = new Map(names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class Input {}
  class Select {}
  const form = { id: "", closest: () => ({ id: "anchor-create" }) };
  class TextArea { name = "paragraph"; form = form; value = ""; defaultValue = ""; closest() { return null; } }
  const field = new TextArea();
  const root = { querySelectorAll: (selector: string) => selector === "form" ? [form] : [field] };
  Object.assign(globals, { HTMLInputElement: Input, HTMLTextAreaElement: TextArea, HTMLSelectElement: Select, __b1DraftRoot: root });
  function mountDrafts() {
    const roots: Array<{ onChangeCapture: (event: {target: unknown}) => void }> = [];
    const effects: CapturedEffect[] = [];
    globals.__b1DraftRoots = roots; globals.__b1LayoutEffects = effects;
    try { h.render(); } finally { delete globals.__b1DraftRoots; delete globals.__b1LayoutEffects; }
    assert.equal(roots.length, 1, "Actual WorkspaceDrafts capture handler");
    const restorations = effects.filter(effect => effect.dependencies?.[0] === h.owner && typeof effect.dependencies[1] === "string");
    assert.equal(restorations.length, 1, "Actual WorkspaceDrafts restore effect");
    restorations[0].callback();
    return { change: roots[0].onChangeCapture, scope: restorations[0].dependencies![1] };
  }
  try {
    h.owner.enter("case_a"); await h.owner.load();
    await h.owner.open({ destination: "evidence", id: "anchor-create" });
    const initial = mountDrafts(); field.value = "Retain this exact paragraph locator"; initial.change({ target: field });
    assert.equal(h.owner.departureRisk(), "dirty");
    h.owner.navigate("documents"); h.owner.navigate("evidence");
    field.value = ""; const returned = mountDrafts();
    assert.equal(returned.scope, initial.scope);
    assert.equal(field.value, "Retain this exact paragraph locator");
    assert.equal(h.owner.getSnapshot().targetActive, false);
    // A genuinely different exact form context must not receive this draft.
    await h.owner.open({ destination: "evidence", id: "assertion-create" });
    field.value = ""; const other = mountDrafts();
    assert.notEqual(other.scope, initial.scope); assert.equal(field.value, "");
    await h.owner.open({ destination: "evidence", id: "anchor-create" });
    mountDrafts(); assert.equal(field.value, "Retain this exact paragraph locator");
  } finally {
    h.owner.dispose();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globals[key]; }
  }
});

test("B1 manual navigation preserves an unrelated save notice and request error", async () => {
  const h = harness(); h.owner.enter("case_a"); await h.owner.load();
  try {
    h.owner.setNotice("Existing confirmed save receipt");
    h.owner.setIssue({ kind: "error", title: "Existing request failure", message: "Preserve this error", detail: null });
    const issue = h.owner.getSnapshot().issue;
    for (const navigate of [() => h.owner.navigate("documents"), () => h.owner.returnToActions()]) {
      navigate(); assert.equal(h.owner.getSnapshot().notice, "Existing confirmed save receipt");
      assert.equal(h.owner.getSnapshot().issue, issue);
      assert.match(h.render(), /Existing confirmed save receipt/); assert.match(h.render(), /Preserve this error/);
    }
  } finally { h.owner.dispose(); }
});
test("B1 actual parent hides header, record, draft and retained review through 401→500", async () => {
  const h=harness(); h.owner.enter("case_a"); await h.owner.load();
  assert.match(h.render(),/Confidential parent case title/);
  await h.owner.openReview("deadline","deadline_a");
  const review=h.owner.getSnapshot().panel!;
  review.setDraft({reason:"Private recovery proposal",status:"completed",support:""});
  h.owner.rememberDraft("metadata-title","Private ordinary form draft");
  assert.match(h.render(),/Private historical title/); assert.match(h.render(),/Private recovery proposal/);
  for (const status of [401,500]) {
    h.setStatus(status); await h.owner.load();
    assert.equal(h.owner.getSnapshot().authority,"session_expired");
    assert.doesNotMatch(h.render(),/Confidential parent case title|Private historical title|Private recovery proposal|Private ordinary form draft|<textarea|<iframe|Saved revision/);
    assert.match(h.render(),/Private case content is hidden/);
  }
  h.setStatus(200); await h.owner.load();
  assert.equal(h.owner.draft("metadata-title"),"Private ordinary form draft");
  assert.doesNotMatch(h.render(),/Private historical title|Private recovery proposal/);
  await review.open(); assert.match(h.render(),/Private recovery proposal/);
  h.setOrgStatus(403); await h.owner.load();
  assert.equal(h.owner.getSnapshot().authority,"account_changed"); assert.equal(h.owner.getSnapshot().bundle,null);
  assert.equal(h.owner.draft("metadata-title"),undefined); assert.equal(review.getSnapshot().draft,null);
  assert.doesNotMatch(h.render(),/Confidential parent case title|Private historical title|Private recovery proposal/);
  h.owner.dispose();
});
test("B1 partial source retrieval cannot advertise an authoritative total or successful queue refresh", async () => {
  const h=harness(); h.owner.enter("case_a"); await h.owner.load();
  h.setRequestStatus(500);
  await assert.rejects(h.owner.load(undefined,true));
  assert.equal(h.owner.getSnapshot().collection.availability,"unavailable");
  assert.match(h.render(),/Current total unavailable/); assert.doesNotMatch(h.render(),/No remaining actions/);
  h.owner.dispose();
});
test("document upload controls emit the server acknowledgement and enforce its title bounds", async () => {
  const h = harness(); h.owner.enter("case_a"); await h.owner.load(); h.owner.navigate("documents");
  const html = h.render();
  const checkbox = html.match(/<input[^>]*name="privacyAcknowledged"[^>]*>/u)?.[0];
  assert.ok(checkbox); assert.match(checkbox, /type="checkbox"/u);
  assert.match(checkbox, /value="true"/u); assert.match(checkbox, /required=""/u);
  assert.doesNotMatch(checkbox, /checked=""/u);
  const title = html.match(/<input[^>]*name="title"[^>]*>/u)?.[0];
  assert.ok(title); assert.match(title, /minLength="2"/u); assert.match(title, /maxLength="240"/u);
  h.owner.dispose();
});
test("version upload restores an exact eligible target with locked public metadata and excludes other origins", async () => {
  const h = harness(); const read = h.owner.options.transport;
  h.owner.options.transport = async (path, init) => new URL(path, "https://test.invalid").pathname.endsWith("/documents") ? Response.json({ documents: [
    { document_id: "upload_a", title: "Exact public source", document_type: "analytical report", classification: "public", source_origin: "internal_upload" },
    { document_id: "external_b", title: "External source", source_origin: "external_reference" },
    { document_id: "missing_c", title: "Unknown source" },
  ] }) : read(path, init);
  h.owner.enter("case_a"); await h.owner.load(); h.owner.navigate("documents");
  h.owner.rememberDraft("case_a:upload:documentId", "upload_a", "");
  const html = h.render(); const form = html.match(/<form id="document-upload-form"[\s\S]*?<\/form>/u)?.[0];
  assert.ok(form);
  assert.match(form, /value="upload_a" selected=""/u);
  assert.doesNotMatch(form, /value="external_b"|value="missing_c"/u);
  assert.match(form.match(/<input[^>]*name="title"[^>]*>/u)?.[0] ?? "", /readOnly=""[^>]*value="Exact public source"/u);
  assert.match(form.match(/<input[^>]*name="documentType"[^>]*>/u)?.[0] ?? "", /readOnly=""[^>]*value="analytical report"/u);
  assert.equal((form.match(/name="classification"/gu) ?? []).length, 1);
  assert.match(form, /type="hidden" name="classification" value="public"/u);
  assert.match(form, /value="public" selected=""/u);
  h.owner.rememberDraft("case_a:upload:documentId", "external_b", "");
  const missing = h.render().match(/<form id="document-upload-form"[\s\S]*?<\/form>/u)?.[0] ?? "";
  assert.match(missing, /Previously selected document is unavailable/u);
  assert.match(missing, /role="alert"/u); assert.match(missing, /<button[^>]*disabled=""/u);
  h.owner.dispose();
});
test("B1 owner attach replay is safe and final detachment rejects late callbacks", async () => {
  const h=harness(); const release=h.owner.attach(); release(); const finalRelease=h.owner.attach();
  await Promise.resolve(); h.owner.enter("case_a"); await h.owner.load(); assert.equal(h.owner.getSnapshot().authority,"granted");
  const ticket=h.owner.capture(); finalRelease(); await Promise.resolve(); assert.equal(h.owner.current(ticket),false);
});

test("B1 malformed200 cannot silently delete citation reviews from a complete queue", async () => {
  const h=harness(); h.owner.enter("case_a"); h.setMalformedAnchors(); await h.owner.load();
  assert.equal(h.owner.getSnapshot().collection.availability,"unavailable");
  assert.ok(h.owner.getSnapshot().bundle?.issues.anchors); h.owner.dispose();
});
test("B1 reopening an earlier uncertain review restores its own filter and exact origin", async () => {
  const h=harness(); h.owner.enter("case_a"); await h.owner.load();
  h.owner.setQueue({filter:"blocking",showAll:true});
  await h.owner.open({destination:"requests",id:"deadline-deadline_a",originActionKey:"action-a"});
  const review=h.owner.getSnapshot().panel!; review.setDraft({reason:"Synthetic unknown operation",status:"completed",support:""});
  await review.save(); assert.equal(review.getSnapshot().phase,"unknown");
  h.owner.returnToActions(); h.owner.setQueue({filter:"review",showAll:false});
  await h.owner.open({destination:"documents",id:"document-upload",originActionKey:"action-b"});
  h.owner.returnToActions(); await h.owner.openReview("deadline","deadline_a");
  assert.equal(h.owner.getSnapshot().panel,review); assert.equal(h.owner.getSnapshot().target?.originActionKey,"action-a");
  assert.equal(h.owner.getSnapshot().queue?.selectedKey,"action-a"); assert.equal(h.owner.getSnapshot().queue?.filter,"blocking"); assert.equal(h.owner.getSnapshot().queue?.showAll,true);
  h.owner.dispose();
});
test("B1 case denial clears pending parent content and drafts until a new verified visit", async () => {
  const h=harness(); h.owner.enter("case_a"); await h.owner.load();
  await h.owner.openReview("deadline","deadline_a"); const review=h.owner.getSnapshot().panel!;
  h.owner.rememberDraft("private","private input"); h.setStatus(403);
  await assert.rejects(h.owner.request("/api/dossiers/case_a"));
  assert.equal(h.owner.getSnapshot().authority,"case_denied"); assert.equal(h.owner.getSnapshot().bundle,null);
  assert.equal(review.getSnapshot().draft,null); assert.equal(h.owner.draft("private"),undefined);
  assert.doesNotMatch(h.render(),/Confidential parent case title|Private historical title|<textarea/);
  h.setStatus(200); await h.owner.load(); assert.equal(h.owner.getSnapshot().authority,"case_denied");
  h.owner.enter("case_a"); await h.owner.load(); assert.equal(h.owner.getSnapshot().authority,"granted"); h.owner.dispose();
});
test("B1 delayed write and finally from old A cannot alter or unlock the new A operation", async () => {
  const h=harness(); const read=h.owner.options.transport;
  const writes: Array<(response:Response)=>void> = [];
  h.owner.options.transport = (path,init) => init?.method === "POST" ? new Promise(resolve => { writes.push(resolve); }) : read(path,init);
  h.owner.enter("case_a"); await h.owner.load();
  const obsolete=h.owner.mutate("/api/dossiers/case_a/requests","old-write",{method:"POST",body:"{}"},"Old save");
  h.owner.enter("case_b"); h.owner.enter("case_a"); await h.owner.load();
  const current=h.owner.mutate("/api/dossiers/case_a/requests","current-write",{method:"POST",body:"{}"},"Current save");
  assert.equal(writes.length,2); writes[0](Response.json({ok:true})); await obsolete;
  assert.equal(h.owner.getSnapshot().mutationKey,"current-write"); assert.doesNotMatch(h.owner.getSnapshot().notice,/Old save/);
  writes[1](Response.json({ok:true})); await current;
  assert.equal(h.owner.getSnapshot().mutationKey,null); assert.equal(h.owner.getSnapshot().notice,"Current save"); h.owner.dispose();
});
test("B1 parent create lock prevents concurrent independently keyed case creation", async () => {
  const h=harness(); let resolveWrite!: (response:Response)=>void, posts=0;
  const read=h.owner.options.transport;
  h.owner.options.transport=(path,init)=>init?.method==="POST" ? (posts++,new Promise(resolve=>{resolveWrite=resolve;})) : read(path,init);
  const first=h.owner.createCase({title:"Synthetic case",idempotencyKey:"first"});
  assert.equal(await h.owner.createCase({title:"Synthetic case",idempotencyKey:"second"}),null);
  assert.equal(posts,1); resolveWrite(Response.json({dossier})); await first; assert.equal(h.owner.busy,false); h.owner.dispose();
});

test("C1 actual parent retains note drafts across section changes and generic draft clearing",async()=>{
  const h=harness();h.owner.enter("case_a");await h.owner.load();h.owner.openNotes();const notebook=h.owner.workingNotes()!;notebook.start("blank");const key=notebook.getSnapshot().selected!;notebook.edit(key,{title:"Confidential notebook",body:"Private notebook body"});
  assert.match(h.render(),/Private notebook body/);h.owner.clearDrafts();h.owner.returnToActions();assert.doesNotMatch(h.render(),/Private notebook body/);h.owner.navigate("documents");assert.match(h.render(),/Private notebook body/);
  assert.equal(await h.owner.createCase({title:"Another case"}),null);assert.equal(h.owner.getSnapshot().visit?.caseId,"case_a");assert.equal(notebook.getSnapshot().editors[key].draft.body,"Private notebook body");
  h.setStatus(401);await h.owner.load();assert.doesNotMatch(h.render(),/Confidential notebook|Private notebook body|Confidential parent case/);h.setStatus(500);await h.owner.load();assert.doesNotMatch(h.render(),/Private notebook body/);
  h.setStatus(200);await h.owner.load();assert.match(h.render(),/Private notebook body/);h.setOrgStatus(403);await h.owner.load();assert.deepEqual(notebook.getSnapshot().editors,{});assert.doesNotMatch(h.render(),/Private notebook body/);h.owner.dispose();
});
test("C1 pending note does not hijack exact document actions; recovery stays available",async()=>{
  const h=harness();h.owner.enter("case_a");await h.owner.load();h.owner.openNotes();const notebook=h.owner.workingNotes()!;notebook.start("blank");const key=notebook.getSnapshot().selected!;notebook.edit(key,{title:"Pending notebook",body:"Private notebook body"});await notebook.save(key);assert.equal(notebook.pending,true);
  await h.owner.open({destination:"documents",id:"document-upload"});assert.equal(h.owner.getSnapshot().notebookOpen,false);assert.doesNotMatch(h.render(),/Private notebook body/);assert.match(h.render(),/document-upload/);
  assert.equal(await h.owner.createCase({title:"Cannot switch"}),null);assert.equal(h.owner.getSnapshot().visit?.caseId,"case_a");h.owner.reviewBeforeLeaving();assert.match(h.render(),/Recover this exact save/);h.owner.enter("case_b");assert.deepEqual(notebook.getSnapshot().editors,{});h.owner.dispose();
});

test("C1 catalogue delivery cannot switch after a draft appears during an asynchronous operation",async()=>{
  const h=harness();h.owner.enter("case_a");await h.owner.load();const notes=h.owner.workingNotes()!;
  notes.start("blank");const key=notes.getSnapshot().selected!;notes.edit(key,{title:"Late draft",body:"Keep this"});
  assert.equal(h.owner.enterFromCatalogue("case_newly_created"),false);assert.equal(h.owner.getSnapshot().visit?.caseId,"case_a");assert.equal(notes.getSnapshot().editors[key].draft.body,"Keep this");
  notes.discard(key);assert.equal(h.owner.enterFromCatalogue("case_newly_created"),true);h.owner.dispose();
});
