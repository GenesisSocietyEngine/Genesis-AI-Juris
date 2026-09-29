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

const owner: SavedStudioCase = { id: 7, caseId: "synthetic_owner", title: "Same title", currentVersion: "1.2.3", access: "owner", isPrivate: true, updatedAt: "2026-09-27T10:00:00Z", ownerDisplayName: "Synthetic owner" };
const shared: SavedStudioCase = { ...owner, id: 8, caseId: "synthetic_shared", access: "shared", isPrivate: false, ownerDisplayName: "Other author" };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
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
  assert.equal((html.match(/Same title/g)??[]).length,2);
  for (const text of ["Owner", "Shared access", "v1.2.3", "Private", "Restricted sharing", "2026-09-27T10:00:00Z"]) assert.ok(html.includes(text),text);
  assert.match(html,/custom_case=7&amp;studio_step=case_map&amp;organization=receipt&amp;lang=ru/); assert.match(html,/custom_case=8/);
  assert.doesNotMatch(html,/Approved|Merged|dossier_synthetic/);
});

test("wrapper retains the existing Matter owner for deep links, exposes normal guarded links, and hides Personal private metadata before verification", async () => {
  const navigation = await session();
  const render = (path:string, verified=true) => renderToStaticMarkup(verified ? createElement(components.NavigationSession,{controller:navigation},createElement(components.MyCasesClient,{initialLocation:path})) : createElement(components.MyCasesClient,{initialLocation:path}));
  const matter = render("/matters?dossier=dossier_synthetic&section=documents&target=document_1");
  assert.match(matter,/data-existing-matter-owner="retained"/); assert.match(matter,/Personal workspace/); assert.match(matter,/Each case has its own role/);
  assert.match(matter,/href="\/matters\?collection=personal"/); assert.doesNotMatch(matter,/role="tab"/);
  const personal = render("/matters?collection=personal"); assert.doesNotMatch(personal,/data-existing-matter-owner/); assert.match(personal,/Search loaded drafts/);
  assert.match(render("/matters?collection=personal",false),/Verify your access/); assert.doesNotMatch(render("/matters?collection=personal",false),/Same title|Synthetic owner/);
});

test("Studio recent work uses unified My cases and preserves current-draft continuation", () => {
  const noop=()=>{};
  const html = renderToStaticMarkup(createElement(components.StudioEntryScreen,{locale:"en",recentTitle:"Local draft",savedCasesHref:"/matters?lang=en&organization=receipt",onCreate:noop,onImport:noop,onDemo:noop,onContinue:noop}));
  assert.match(html,/href="\/matters\?lang=en&amp;organization=receipt"/); assert.match(html,/My cases — Personal \/ Team/); assert.match(html,/Local draft/); assert.match(html,/Current working draft/);
  assert.doesNotMatch(html,/href="\/studio\?view=community"/);
});
