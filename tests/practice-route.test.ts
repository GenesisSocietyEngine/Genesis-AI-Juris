import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
type Handler=(request:Request,context:{params:Promise<{dossierId:string}>})=>Promise<Response>;
let mf:Miniflare, db:D1Database;
let routes:Record<string,{GET:Handler;POST:Handler}>;
const storage=new AsyncLocalStorage<Request>();
const runtime=globalThis as unknown as {__practiceEnv:{DB:D1Database};__practiceHeaders:()=>Headers};
let organization:string, foreignOrganization:string, caseId:string;
async function call(route:string,method="GET",body?:unknown,email="practice-owner@example.test",org=organization,extraHeaders?:Record<string,string>) {
  const request=new Request("https://practice.test/api/work",{method,headers:{origin:"https://practice.test","sec-fetch-site":"same-origin","oai-authenticated-user-email":email,"x-genesis-organization":org??"","content-type":"application/json",...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
  return storage.run(request,()=>routes[route][method as "GET"|"POST"](request,{params:Promise.resolve({dossierId:caseId})}));
}
before(async()=>{
  mf=new Miniflare({workers:[{config:{name:"practice-test",type:"worker",compatibilityDate:"2026-09-01",manifest:{mainModule:"index.mjs",modules:{"index.mjs":{type:"esm",contents:"export default {fetch(){return new Response('test')}}"}}},env:{DB:{type:"d1",name:"practice-test"}}},dev:{}}]});
  db=await mf.getD1Database("DB","practice-test") as unknown as D1Database;
  const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
  for(const entry of journal.entries)for(const sql of readFileSync(`drizzle/${entry.tag}.sql`,"utf8").split("--> statement-breakpoint"))await db.prepare(sql).run();
  runtime.__practiceEnv={DB:db};runtime.__practiceHeaders=()=>storage.getStore()!.headers;
  const paths={organizations:"app/api/organizations/route.ts",dossiers:"app/api/dossiers/route.ts",detail:"app/api/dossiers/[dossierId]/route.ts",practice:"app/api/dossiers/[dossierId]/practice/route.ts"};
  const result=await build({stdin:{contents:Object.entries(paths).map(([name,path])=>`export * as ${name} from './${path}';`).join("\n"),resolveDir:process.cwd(),loader:"ts"},bundle:true,write:false,platform:"node",format:"esm",packages:"external",plugins:[{name:"synthetic-runtime",setup(b){
    b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},args=>({path:args.path,namespace:"runtime"}));
    b.onLoad({filter:/.*/,namespace:"runtime"},args=>({contents:args.path==="cloudflare:workers"?"export const env=globalThis.__practiceEnv; export function waitUntil(){}":args.path==="next/headers"?"export async function headers(){return globalThis.__practiceHeaders()}":"export function redirect(){throw Error('Unexpected redirect')}"}));
  }}]});
  mkdirSync(".artifacts/practice-route",{recursive:true});const target=resolve(".artifacts/practice-route/routes.mjs");writeFileSync(target,result.outputFiles[0].text);routes=await import(pathToFileURL(target).href);
  for(const email of ["practice-owner@example.test","practice-outsider@example.test"])await db.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email,"Synthetic practice user").run();
  let response=await call("organizations","POST",{action:"create",name:"Synthetic practice"});assert.equal(response.status,201,await response.clone().text());organization=(await response.json() as {organization:{id:string}}).organization.id;
  response=await call("organizations","POST",{action:"create",name:"Foreign practice"},"practice-outsider@example.test","");assert.equal(response.status,201,await response.clone().text());foreignOrganization=(await response.json() as {organization:{id:string}}).organization.id;
  response=await call("dossiers","POST",{title:"Synthetic operational case",jurisdictions:["Test"],classification:"internal"});assert.equal(response.status,201,await response.clone().text());const created=await response.json() as {dossier:{dossier_id:string}};caseId=created.dossier.dossier_id;
}, {timeout:120000});
after(async()=>{await mf?.dispose();},{timeout:15000});
test("practice handlers persist exact work, replay original results, reject conflicts and isolate organizations",async()=>{
  const before=await (await call("detail")).json();
  const command={action:"create",expectedRevision:0,operationKey:"practice-original",item:{kind:"task",title:"Review evidence",description:"Synthetic only",dueDate:"2026-11-10",assignee:null,priority:"high",status:"open",checklist:[{title:"Inspect cited version",done:false}]}};
  let response=await call("practice","POST",command);assert.equal(response.status,200,await response.clone().text());const first=await response.json();
  response=await call("practice");assert.equal(response.status,200);assert.deepEqual((await response.json() as {plan:unknown}).plan,(first as {plan:unknown}).plan);
  response=await call("practice","POST",command);assert.equal(response.status,200);assert.deepEqual(await response.json(),first);
  assert.equal((await call("practice","POST",{...command,item:{...command.item,title:"Changed"}})).status,409);
  assert.equal((await call("practice","POST",{...command,operationKey:"practice-stale"})).status,409);
  assert.equal((await call("practice","GET",undefined,"practice-outsider@example.test",foreignOrganization)).status,404);
  assert.equal((await call("practice","POST",command,"practice-outsider@example.test",foreignOrganization)).status,404);
  assert.equal((await call("practice","POST",command,"practice-owner@example.test",organization,{origin:"https://foreign.test","sec-fetch-site":"cross-site"})).status,403);
  const apply={action:"apply_workflow",templateId:"intake-v1",anchor:"2026-11-05",assignee:null,expectedRevision:1,operationKey:"practice-workflow"};
  response=await call("practice","POST",apply);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json() as {plan:{items:unknown[]}}).plan.items.length,5);
  assert.equal((await call("practice","POST",{...apply,expectedRevision:2,operationKey:"practice-duplicate"})).status,400);
  const after=await (await call("detail")).json();
  const stable=(value:unknown)=>JSON.parse(JSON.stringify(value,(key,v)=>key==="evaluated_at"?undefined:v));
  assert.deepEqual(stable(after),stable(before),"Operational work must not rewrite decision evidence or revision");
});
