import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { NavigationController } from "../app/navigation-controller";
import { publishSessionBoundary } from "../app/session-boundary";
import { myCasesHref, myCasesView, StudioCaseCatalogue, type SavedStudioCase } from "../app/matters/studio-case-catalogue";
import { selectStudioCases, studioUpdatedLabel } from "../app/matters/studio-case-list";
import { readStudioSearchReturn, readStudioTabSearch, writeStudioTabSearch, withStudioSearchReturn, studioSearchBoundary } from "../app/matters/studio-search-return";
import { studioCaseQuery } from "../app/studio-case-search";

const owner: SavedStudioCase = { id: 7, caseId: "synthetic_owner", title: "Same title", currentVersion: "1.2.3", access: "owner", isPrivate: true, updatedAt: "2026-09-27T10:00:00Z", ownerDisplayName: "Synthetic owner" };
const shared: SavedStudioCase = { ...owner, id: 8, caseId: "synthetic_shared", access: "shared", isPrivate: false, ownerDisplayName: "Other author" };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
test("search input normalization is bounded, literal and safe for cursor encoding", () => {
  assert.equal(studioCaseQuery(" АУДИТ %_[]?* "),"аудит %_[]?*");
  assert.equal(studioCaseQuery("😀"),"😀");
  for(const value of ["x".repeat(121),"line\nbreak","\u0000","\ud800","\udfff"]) assert.equal(studioCaseQuery(value),null);
});
async function session() {
  const actorId = "actor_synthetic_catalogue_owner";
  const selected = { id: "org_synthetic_catalogue", name: "Personal workspace", kind: "personal", status: "active", role: "org_owner", revision: 1, membershipRevision: 1, actorId, selection: `org_synthetic_catalogue.1.1.${actorId}` };
  const navigation = new NavigationController({ transport: async () => Response.json({ authenticated: true, identity: { displayName: "Synthetic owner", email: "catalogue@example.test", authSource: "chatgpt" }, actorId, organizations: [selected], selected, profileRequired: false }), leave: () => {}, clear: () => {} });
  await navigation.refresh(); assert.equal(navigation.getSnapshot().phase, "ready"); return navigation;
}

test("My cases preserves exact Matter deep links and collection links clear obsolete case targeting", () => {
  const deep = "/matters?organization=receipt&lang=ru&dossier=dossier_synthetic&section=evidence&target=source_1&request=request_1&collection=personal";
  assert.equal(myCasesView(deep), "team");
  assert.equal(myCasesView("/matters"), "team");
  assert.equal(myCasesView("/matters?collection=team"), "team");
  assert.equal(myCasesView("/matters?organization=receipt"), "team", "existing organization picker must continue opening its Matter workspace");
  assert.equal(myCasesView("/matters?organization=receipt&collection=personal"), "personal");
  for (const view of ["personal", "team"] as const) {
    const next = new URL(myCasesHref(view, deep), "https://synthetic.invalid");
    assert.equal(next.pathname, "/matters"); assert.equal(next.searchParams.get("collection"), view);
    assert.equal(next.searchParams.get("organization"), "receipt"); assert.equal(next.searchParams.get("lang"), "ru");
    for (const field of ["dossier", "section", "target", "request"]) assert.equal(next.searchParams.has(field), false);
  }
});

test("authorized catalogue paginates by server ID, never by title, and sends only no-store authenticated reads", async () => {
  const navigation = await session(), calls: Array<{path:string;init?:RequestInit}> = [];
  const catalogue = new StudioCaseCatalogue(navigation, async (path, init) => { calls.push({path,init}); return Response.json(calls.length === 1 ? { customCases: [owner], nextCursor: "page_two" } : { customCases: [shared], nextCursor: null }); });
  const stop = catalogue.attach(); await tick();
  assert.equal(catalogue.getSnapshot().phase, "ready"); await catalogue.load(true);
  assert.deepEqual(catalogue.getSnapshot().cases, [owner, shared]);
  assert.equal(calls[1].path, "/api/custom-cases?limit=25&cursor=page_two");
  for (const call of calls) { assert.equal(call.init?.cache, "no-store"); assert.equal(call.init?.credentials, "same-origin"); assert.equal(call.init?.method, undefined); assert.equal(call.init?.body, undefined); }
  stop(); assert.deepEqual(catalogue.getSnapshot().cases, []);
});

test("server search replaces results/cursors, cancels old reads and rejects late responses", async () => {
  const navigation = await session();
  const calls: Array<{path:string;signal?:AbortSignal|null}> = [];
  let late!: (response:Response)=>void;
  const catalogue = new StudioCaseCatalogue(navigation, async (path, init) => {
    calls.push({path,signal:init?.signal});
    if (path.includes("q=old")) return new Promise<Response>(resolve => { late=resolve; });
    return Response.json({customCases:[path.includes("q=") ? shared : owner],nextCursor:path.includes("q=") ? "filtered_page" : "unfiltered_page"});
  });
  const stop=catalogue.attach(); await tick();
  const pending=catalogue.search("old"); await tick();
  assert.deepEqual(catalogue.getSnapshot().cases,[]);
  await catalogue.search(" АУДИТ ");
  assert.equal(calls[1].signal?.aborted,true);
  assert.equal(catalogue.getSnapshot().query,"аудит");
  assert.deepEqual(catalogue.getSnapshot().cases,[shared]);
  late(Response.json({customCases:[owner],nextCursor:"stale"})); await pending;
  assert.deepEqual(catalogue.getSnapshot().cases,[shared]);
  await catalogue.load(true);
  assert.equal(calls.at(-1)?.path,"/api/custom-cases?limit=25&q="+encodeURIComponent("аудит")+"&cursor=filtered_page");
  await catalogue.search(""); assert.equal(calls.at(-1)?.path,"/api/custom-cases?limit=25");
  assert.equal(catalogue.getSnapshot().nextCursor,"unfiltered_page");
  const count=calls.length; await catalogue.search("x".repeat(121));
  assert.equal(calls.length,count); assert.equal(catalogue.getSnapshot().issue,"invalid-search"); assert.deepEqual(catalogue.getSnapshot().cases,[]);
  stop();
});

test("search does not read without current account authority and expiry cancels the active query", async () => {
  const navigation=await session(); let signal:AbortSignal|null|undefined; let count=0;
  const catalogue=new StudioCaseCatalogue(navigation,async (_path,init)=> {count++; signal=init?.signal; return new Promise<Response>(()=>{});});
  const stop=catalogue.attach(); await tick(); navigation.invalidate("expired");
  assert.equal(signal?.aborted,true); assert.deepEqual(catalogue.getSnapshot().cases,[]);
  await catalogue.search("private title"); assert.equal(count,1); assert.deepEqual(catalogue.getSnapshot().cases,[]);
  stop();
});

test("expiry clears existing private metadata and a late response cannot restore it across renewed authority", async () => {
  const navigation = await session(); let respond!: (response: Response) => void, calls = 0;
  const catalogue = new StudioCaseCatalogue(navigation, async () => { calls++; return calls === 2 ? await new Promise<Response>(resolve => { respond = resolve; }) : Response.json({ customCases: calls === 1 ? [owner] : [shared], nextCursor: null }); });
  const stop = catalogue.attach(); await tick(); assert.equal(catalogue.getSnapshot().cases[0].id, 7);
  const pending = catalogue.load(); await tick(); navigation.invalidate("expired");
  assert.deepEqual(catalogue.getSnapshot().cases, []); assert.equal(catalogue.getSnapshot().phase, "idle");
  await navigation.refresh(); await tick(); assert.deepEqual(catalogue.getSnapshot().cases, [shared]);
  respond(Response.json({customCases: [owner], nextCursor:null})); await pending;
  assert.deepEqual(catalogue.getSnapshot().cases, [shared]); stop();
});

test("denied/failed and malformed reads remove private results and retry returns only a current valid page", async () => {
  const navigation = await session(); let mode = "ready";
  const catalogue = new StudioCaseCatalogue(navigation, async () => mode === "denied" ? new Response(null, {status:401}) : Response.json(mode === "malformed" ? {customCases:[{...owner, access:"invented_role"}],nextCursor:null} : {customCases:[owner],nextCursor:null}));
  const stop = catalogue.attach(); await tick();
  for (const failure of ["denied", "malformed"]) { mode = failure; await catalogue.load(); assert.equal(catalogue.getSnapshot().phase, "error"); assert.deepEqual(catalogue.getSnapshot().cases, []); mode = "ready"; await catalogue.load(); assert.equal(catalogue.getSnapshot().phase, "ready"); assert.deepEqual(catalogue.getSnapshot().cases, [owner]); }
  navigation.invalidate("denied"); assert.deepEqual(catalogue.getSnapshot().cases, []); stop();
});

test("existing same-origin logout signal immediately purges private metadata without waiting for focus", async () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {configurable:true,value:Object.assign(new EventTarget(),{localStorage:{setItem:()=>{}}})});
  try {
    const navigation = await session(), catalogue = new StudioCaseCatalogue(navigation, async () => Response.json({customCases:[owner],nextCursor:null}));
    const stop = catalogue.attach(); await tick(); assert.deepEqual(catalogue.getSnapshot().cases,[owner]);
    publishSessionBoundary("suspend"); assert.equal(navigation.getSnapshot().phase,"expired"); assert.deepEqual(catalogue.getSnapshot().cases,[]);
    await navigation.refresh(); await tick(); assert.deepEqual(catalogue.getSnapshot().cases,[owner]);
    publishSessionBoundary("revoke"); assert.equal(navigation.getSnapshot().phase,"denied"); assert.deepEqual(catalogue.getSnapshot().cases,[]);
    stop();
  } finally { if(before)Object.defineProperty(globalThis,"window",before);else Reflect.deleteProperty(globalThis,"window"); }
});

test("successful focus verification refreshes the server-authorized list even when identity and organization are unchanged", async () => {
  const navigation = await session(); let current = [owner,shared];
  const catalogue = new StudioCaseCatalogue(navigation, async () => Response.json({customCases:current,nextCursor:null}));
  const stop = catalogue.attach(); await tick(); assert.equal(catalogue.getSnapshot().cases.length,2);
  current=[owner]; await navigation.refresh(); await tick(); assert.deepEqual(catalogue.getSnapshot().cases,[owner]); stop();
});

const output = resolve(".artifacts/my-cases/components.mjs"); mkdirSync(resolve(".artifacts/my-cases"), {recursive:true});
const compiled = await build({
  stdin: { contents: "export {default as MyCasesClient, StudioCaseGroup} from './app/matters/MyCasesClient'; export {default as NavigationSession} from './app/NavigationSession'; export {default as StudioEntryScreen} from './app/StudioEntryScreen';", resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
  plugins: [{ name: "render-boundaries", setup(build) {
    build.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: "css-fixture" }));
    build.onLoad({ filter: /.*/, namespace: "css-fixture" }, () => ({ contents: "export default new Proxy({}, {get: (_, key) => key});", loader: "js" }));
    build.onResolve({ filter: /^\.\/MattersClient$/ }, () => ({ path: "existing-matter-owner", namespace: "matter-fixture" }));
    build.onLoad({ filter: /.*/, namespace: "matter-fixture" }, () => ({ contents: "import {createElement} from 'react'; export default function MattersClient(){return createElement('div', {'data-existing-matter-owner':'retained'});}", loader: "js", resolveDir: process.cwd() }));
  } }],
});
writeFileSync(output,compiled.outputFiles[0].text);
const components = await import(pathToFileURL(output).href);

test("rendered cards retain separate source IDs, role/version/privacy and exact Studio continuation", () => {
  const html = renderToStaticMarkup(createElement(components.StudioCaseGroup,{title:"Available",cases:[owner,shared],locale:"en",location:"/matters?collection=personal&lang=ru&organization=receipt"}));
  assert.equal((html.match(/<h4>/g)??[]).length,2);
  for (const text of ["Owner", "Shared access", "v1.2.3", "Private", "Restricted sharing", "2026-09-27T10:00:00Z"]) assert.ok(html.includes(text),text);
  assert.match(html,/custom_case=7&amp;studio_step=case_map&amp;organization=receipt&amp;lang=ru/); assert.match(html,/custom_case=8/);
  assert.doesNotMatch(html,/Approved|Merged|dossier_synthetic/);
});

test("loaded-list search and sorting preserve duplicate identities, immutable input and invalid dates", () => {
  const cases = [owner, {...shared, updatedAt:"2026-10-19T12:30:00Z"}, {...owner,id:9,title:"Аудит договора",updatedAt:"invalid"}];
  const before=JSON.stringify(cases);
  assert.deepEqual(selectStudioCases(cases," Same TITLE ","updated","en").map(item=>item.id),[8,7]);
  assert.deepEqual(selectStudioCases(cases,"","oldest","en").map(item=>item.id),[7,8,9]);
  assert.deepEqual(selectStudioCases(cases,"АУДИТ","title","ru").map(item=>item.id),[9]);
  assert.deepEqual(selectStudioCases(cases,"8","updated","en").map(item=>item.id),[8]);
  assert.equal(selectStudioCases(cases,"absent","updated","en").length,0);
  assert.equal(JSON.stringify(cases),before);
  assert.match(studioUpdatedLabel(owner.updatedAt,"en"),/27 Sept 2026.*10:00/);
  assert.match(studioUpdatedLabel(owner.updatedAt,"ru"),/27 сент.*2026.*10:00/);
  assert.equal(studioUpdatedLabel("invalid","en"),"");
});

test("list rows expose readable UTC dates, full long titles, named edit/open links and Russian fallback", () => {
  const title="Long synthetic case title — ".repeat(12);
  const html=renderToStaticMarkup(createElement(components.StudioCaseGroup,{title:"Owned",cases:[{...owner,title},shared],locale:"en",location:"/matters?collection=personal&organization=receipt&lang=en"}));
  assert.match(html,/<ul class="rows">/);assert.ok(html.includes(title));
  assert.match(html,/Edit in Studio/);assert.match(html,/Open in Studio/);
  assert.match(html,/27 Sept 2026/);assert.match(html,/Updated · UTC/);
  assert.match(html,/dateTime="2026-09-27T10:00:00Z"/i);
  const ru=renderToStaticMarkup(createElement(components.StudioCaseGroup,{title:"Мои",cases:[{...owner,updatedAt:"invalid"}],locale:"ru",location:"/matters?collection=personal&lang=ru"}));
  assert.match(ru,/Редактировать в Studio/);assert.match(ru,/Дата недоступна/);assert.doesNotMatch(ru,/<time/);
});

test("wrapper retains the existing Matter owner for deep links, exposes normal guarded links, and hides Personal private metadata before verification", async () => {
  const navigation = await session();
  const render = (path:string, verified=true) => renderToStaticMarkup(verified ? createElement(components.NavigationSession,{controller:navigation},createElement(components.MyCasesClient,{initialLocation:path})) : createElement(components.MyCasesClient,{initialLocation:path}));
  const matter = render("/matters?dossier=dossier_synthetic&section=documents&target=document_1");
  assert.match(matter,/data-existing-matter-owner="retained"/); assert.match(matter,/Personal workspace/); assert.match(matter,/Each case has its own role/);
  assert.match(matter,/href="\/matters\?collection=personal"/); assert.doesNotMatch(matter,/role="tab"/);
  const personal = render("/matters?collection=personal"); assert.doesNotMatch(personal,/data-existing-matter-owner/); assert.match(personal,/Search all authorized drafts/); assert.match(personal,/role="search"/); assert.match(personal,/type="submit"/); assert.match(personal,/maxLength="120"/i);
  assert.match(render("/matters?collection=personal",false),/Verify your access/); assert.doesNotMatch(render("/matters?collection=personal",false),/Same title|Synthetic owner/);
});

test("Studio recent work opens Personal drafts, clears governed-case targeting and preserves language/organization", () => {
  const noop=()=>{};
  const html = renderToStaticMarkup(createElement(components.StudioEntryScreen,{locale:"en",recentTitle:"Local draft",savedCasesHref:"/matters?lang=en&organization=receipt&dossier=old&section=evidence&target=source_1",onCreate:noop,onImport:noop,onBrowseDemos:noop,onContinue:noop}));
  assert.match(html,/href="\/matters\?collection=personal&amp;organization=receipt&amp;lang=en"/); assert.match(html,/Open saved Studio cases/); assert.match(html,/Local draft/); assert.match(html,/Current working draft/);
  assert.doesNotMatch(html,/dossier=old|target=source_1/);
  assert.match(html, /Overview<\/li>/); assert.match(html, /Sources &amp; evidence<\/li>/); assert.match(html, /Reports<\/li>/);
  assert.equal((html.match(/<li>/g) ?? []).length, 5);
  assert.doesNotMatch(html,/href="\/studio\?view=community"/);
});


test("history return controls are account/organization/boundary bound and preserves unrelated router state", () => {
 const value={version:1 as const,scope:'actor/org',boundary:'nonce',query:'erp',input:'ERP',sort:'title' as const,pages:3};
 const state=withStudioSearchReturn({router:'retained'},value);
 assert.deepEqual(readStudioSearchReturn(state,'actor/org','nonce'),value);
 for(const [scope,boundary] of [['other/org','nonce'],['actor/other','nonce'],['actor/org','changed'],['actor/org',null]]) assert.equal(readStudioSearchReturn(state,scope!,boundary),null);
 for(const patch of [{version:2},{pages:0},{pages:41},{query:'ERP'},{input:'x'.repeat(121)},{sort:'random'}]) assert.equal(readStudioSearchReturn(withStudioSearchReturn({}, {...value,...patch} as typeof value),'actor/org','nonce'),null);
 assert.deepEqual(withStudioSearchReturn(state,null),{router:'retained'});
 assert.equal(studioSearchBoundary({getItem:()=>{throw Error('blocked')}}),null);
 assert.ok(!JSON.stringify(state).includes('customCases'));
});

test("return restores query/page depth through fresh no-store server reads, stopping at current authorization", async () => {
 const navigation=await session(), calls:string[]=[];
 const catalogue=new StudioCaseCatalogue(navigation,async path=>{calls.push(path); const url=new URL(path,'https://test.invalid');return Response.json({customCases:[{...owner,id:url.searchParams.has('cursor')?8:7}],nextCursor:url.searchParams.has('cursor')?null:'next'});});
 const stop=catalogue.attach(); await tick();
 await catalogue.restore('ERP',3);
 assert.equal(catalogue.getSnapshot().query,'erp');assert.equal(catalogue.getSnapshot().pages,2);
 assert.deepEqual(catalogue.getSnapshot().cases.map(row=>row.id),[7,8]);
 assert.equal(calls.at(-1),'/api/custom-cases?limit=25&q=erp&cursor=next');
 navigation.invalidate('expired'); await catalogue.restore('erp',3);
 assert.equal(catalogue.getSnapshot().cases.length,0); stop();
});

test("blocked localStorage access disables history restoration without crashing", () => {
 assert.equal(studioSearchBoundary(() => {throw new Error('blocked property');}),null);
});


test("return through workspace navigation restores controls from tab storage, never case rows or authority", () => {
 const data=new Map<string,string>(), store={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 const value={version:1 as const,scope:'actor/org',boundary:'nonce',query:'erp',input:'ERP',sort:'title' as const,pages:2};
 writeStudioTabSearch(()=>store,value);
 assert.deepEqual(readStudioTabSearch(()=>store,'actor/org','nonce'),value);
 assert.equal(readStudioSearchReturn(null,'actor/org','nonce'),null,'fresh navigation has no prior history state');
 assert.ok(![...data.values()].join('').includes('customCases'));
 for(const [scope,boundary] of [['other/org','nonce'],['actor/other','nonce'],['actor/org','changed']]){
  writeStudioTabSearch(()=>store,value);assert.equal(readStudioTabSearch(()=>store,scope,boundary),null);assert.equal(data.size,0);
 }
 writeStudioTabSearch(()=>store,value);writeStudioTabSearch(()=>store,null);assert.equal(data.size,0);
 assert.equal(readStudioTabSearch(()=>{throw Error('blocked');},'actor/org','nonce'),null);
 assert.doesNotThrow(()=>writeStudioTabSearch(()=>{throw Error('blocked');},value));
});
