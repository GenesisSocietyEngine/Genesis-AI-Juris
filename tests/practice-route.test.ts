import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { zonedMoment } from "../app/matters/practice-scheduling";
import { Miniflare } from "miniflare";
type Handler=(request:Request,context:{params:Promise<{dossierId:string}>})=>Promise<Response>;
let mf:Miniflare, db:D1Database;
let routes:Record<string,{GET:Handler;POST:Handler}>;
const storage=new AsyncLocalStorage<Request>();
const runtime=globalThis as unknown as {__practiceEnv:{DB:D1Database};__practiceHeaders:()=>Headers};
let organization:string, foreignOrganization:string, caseId:string;
async function call(route:string,method="GET",body?:unknown,email="practice-owner@example.test",org=organization,extraHeaders?:Record<string,string>, query="") {
  const request=new Request("https://practice.test/api/work"+query,{method,headers:{origin:"https://practice.test","sec-fetch-site":"same-origin","oai-authenticated-user-email":email,"x-genesis-organization":org??"","content-type":"application/json",...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
  return storage.run(request,()=>routes[route][method as "GET"|"POST"](request,{params:Promise.resolve({dossierId:caseId})}));
}
before(async()=>{
  mf=new Miniflare({workers:[{config:{name:"practice-test",type:"worker",compatibilityDate:"2026-09-01",manifest:{mainModule:"index.mjs",modules:{"index.mjs":{type:"esm",contents:"export default {fetch(){return new Response('test')}}"}}},env:{DB:{type:"d1",name:"practice-test"}}},dev:{}}]});
  db=await mf.getD1Database("DB","practice-test") as unknown as D1Database;
  const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
  for(const entry of journal.entries)for(const sql of readFileSync(`drizzle/${entry.tag}.sql`,"utf8").split("--> statement-breakpoint"))await db.prepare(sql).run();
  runtime.__practiceEnv={DB:db};runtime.__practiceHeaders=()=>storage.getStore()!.headers;
  const paths={participants:"app/api/dossiers/[dossierId]/participants/route.ts",firm:"app/api/work/route.ts",templates:"app/api/work/templates/route.ts",organizations:"app/api/organizations/route.ts",dossiers:"app/api/dossiers/route.ts",detail:"app/api/dossiers/[dossierId]/route.ts",practice:"app/api/dossiers/[dossierId]/practice/route.ts"};
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


test("firm feed paginates authorized cases and template versions are scoped, immutable and replayable", {timeout:120000}, async()=>{
  const fields={title:"Synthetic hearing",archived:false,steps:[{title:"Prepare sources",kind:"task",days:-3},{title:"Review hearing",kind:"event",days:0}]};
  const command={action:"create",template:fields,expectedRevision:0,operationKey:"template-original"};
  let response=await call("templates","POST",command);assert.equal(response.status,200,await response.clone().text());
  const first=await response.json() as {library:{revision:number;templates:Array<{id:string;version:number}>}};
  response=await call("templates","POST",command);assert.deepEqual(await response.json(),first);
  assert.equal((await call("templates","POST",{...command,template:{...fields,title:"Different"}})).status,409);
  assert.equal((await call("templates","POST",{...command,operationKey:"template-stale"})).status,409);
  assert.equal((await call("templates","POST",command,"practice-owner@example.test",organization,{origin:"https://foreign.test","sec-fetch-site":"cross-site"})).status,403);
  const template=first.library.templates[0];
  const apply={action:"apply_workflow",templateId:template.id,templateVersion:1,anchor:"2026-11-20",assignee:null,expectedRevision:2,operationKey:"custom-apply-original"};
  response=await call("practice","POST",apply);assert.equal(response.status,200,await response.clone().text());const applied=await response.json() as {plan:{items:Array<{workflowTitle?:string;dueDate:string}>}};
  assert.equal(applied.plan.items.at(-2)!.dueDate,"2026-11-17");
  response=await call("templates","POST",{action:"update",id:template.id,template:{...fields,title:"New title",archived:true},expectedRevision:1,operationKey:"template-archive"});assert.equal(response.status,200,await response.clone().text());
  response=await call("practice","POST",apply);assert.deepEqual(await response.json(),applied,"Retry returns original receipt even after archival");
  assert.equal((await call("practice","POST",{...apply,expectedRevision:3,operationKey:"custom-archived"})).status,409);
  response=await call("practice");const current=await response.json() as typeof applied;assert.equal(current.plan.items.at(-1)!.workflowTitle,fields.title);
  await assert.rejects(db.prepare("UPDATE organization_workflow_revisions SET library='{}' WHERE organization_id=?").bind(organization).run(),/immutable/);
  const outsider=await db.prepare("SELECT id,actor_id FROM users WHERE email=?").bind("practice-outsider@example.test").first<{id:number;actor_id:string}>();
  await db.prepare("INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,status,revision,created_at) VALUES(?,?,?,'member','active',1,?)").bind(organization,outsider!.id,outsider!.actor_id,new Date().toISOString()).run();
  response=await call("firm","GET",undefined,"practice-outsider@example.test",organization);assert.equal(response.status,200);assert.equal((await response.json() as {cases:unknown[]}).cases.length,0,"Org membership does not grant case access");
  assert.equal((await call("templates","POST",command,"practice-outsider@example.test",organization)).status,403);
  response=await call("templates","GET",undefined,"practice-outsider@example.test",foreignOrganization);assert.equal((await response.json() as {library:{revision:number}}).library.revision,0);
  assert.equal((await call("practice","POST",{...apply,expectedRevision:0,operationKey:"foreign-template"},"practice-outsider@example.test",foreignOrganization)).status,404);
  for(let index=0;index<26;index++) {response=await call("dossiers","POST",{title:`Synthetic paging ${index}`,jurisdictions:["Test"],classification:"internal"});assert.equal(response.status,201,await response.clone().text());}
  response=await call("firm");assert.equal(response.status,200,await response.clone().text());const page=await response.json() as {scope:string;cases:Array<{id:string}>;nextCursor:string};assert.equal(page.cases.length,25);assert.ok(page.nextCursor);
  response=await call("firm","GET",undefined,"practice-owner@example.test",organization,undefined,"?cursor="+encodeURIComponent(page.nextCursor));assert.equal(response.status,200);const last=await response.json() as {cases:Array<{id:string}>;nextCursor:null};assert.equal(last.cases.length,2);assert.equal(last.nextCursor,null);assert.equal(new Set([...page.cases,...last.cases].map(c=>c.id)).size,27);
  assert.equal((await call("firm","GET",undefined,"practice-outsider@example.test",foreignOrganization,undefined,"?cursor="+encodeURIComponent(page.nextCursor))).status,400);
  response=await call("participants","POST",{actorId:outsider!.actor_id,role:"viewer",expectedRevision:1});assert.equal(response.status,201,await response.clone().text());
  response=await call("firm","GET",undefined,"practice-outsider@example.test",organization);assert.equal((await response.json() as {cases:unknown[]}).cases.length,1);
  await db.prepare("UPDATE organization_memberships SET status='suspended',revision=revision+1 WHERE organization_id=? AND actor_id=?").bind(organization,outsider!.actor_id).run();
  assert.equal((await call("firm","GET",undefined,"practice-outsider@example.test",organization)).status,404);
});


test("timed events, recurrence and reminder receipts persist without changing case outcomes",async()=>{
  const before=await (await call("detail")).json();
  let plan=(await (await call("practice")).json() as {plan:{revision:number;items:Array<{id:string;reminder?:{state:string;at:string}}>;schedulingVersion?:number}}).plan;
  const timing={start:zonedMoment("2026-11-30T23:30","America/New_York"),end:zonedMoment("2026-12-01T01:00","America/New_York")};
  const item={kind:"event",title:"Synthetic timed review",description:"",dueDate:"2026-11-30",assignee:null,priority:"normal",status:"open",checklist:[],timing,reminder:{...zonedMoment("2026-11-30T23:15","America/New_York"),state:"active"}};
  const command={action:"create",expectedRevision:plan.revision,operationKey:"timed-event-original",item};
  let response=await call("practice","POST",command);assert.equal(response.status,200,await response.clone().text());const original=await response.json() as {plan:typeof plan};plan=original.plan;assert.equal(plan.schedulingVersion,1);
  assert.deepEqual(await (await call("practice","POST",command)).json(),original);
  assert.equal((await call("practice","POST",{...command,operationKey:"timed-stale"})).status,409);
  const bad={...item,timing:{...timing,start:{...timing.start,at:"2026-11-30T23:30:00.000Z"}}};assert.equal((await call("practice","POST",{...command,item:bad,expectedRevision:plan.revision,operationKey:"timed-forgery"})).status,400);
  const recurring={kind:"task",title:"Synthetic recurring review",description:"",dueDate:"2026-01-31",assignee:null,priority:"normal",status:"open",checklist:[],reminder:{...zonedMoment("2026-01-31T09:00","Europe/Paris"),state:"active"}};
  response=await call("practice","POST",{action:"create_series",expectedRevision:plan.revision,operationKey:"recurrence-original",item:recurring,recurrence:{frequency:"monthly",interval:1,count:3}});assert.equal(response.status,200,await response.clone().text());plan=(await response.json() as {plan:typeof plan}).plan;
  const id=plan.items.at(-3)!.id;
  const dismiss={action:"reminder",id,reminderAction:"dismiss",expectedRevision:plan.revision,operationKey:"reminder-dismiss-original"};
  response=await call("practice","POST",dismiss);assert.equal(response.status,200,await response.clone().text());const dismissed=await response.json() as {plan:typeof plan};assert.equal(dismissed.plan.items.find(i=>i.id===id)!.reminder!.state,"dismissed");
  assert.deepEqual(await (await call("practice","POST",dismiss)).json(),dismissed);plan=dismissed.plan;
  response=await call("practice","POST",{...dismiss,reminderAction:"snooze",expectedRevision:plan.revision,operationKey:"reminder-snooze-original"});assert.equal(response.status,200,await response.clone().text());plan=(await response.json() as {plan:typeof plan}).plan;
  const reminder=plan.items.find(i=>i.id===id)!.reminder!;assert.equal(reminder.state,"active");assert.ok(Date.parse(reminder.at)>Date.now()+3500000);
  const {reminder:ignored,...legacyItem}=recurring;void ignored;
  assert.equal((await call("practice","POST",{action:"update",id,item:legacyItem,expectedRevision:plan.revision,operationKey:"old-client-update"})).status,400);
  const owner=await db.prepare("SELECT actor_id FROM users WHERE email=?").bind("practice-owner@example.test").first<{actor_id:string}>();
  await assert.rejects(db.prepare("INSERT INTO dossier_practice_revisions(dossier_id,revision,actor_ref,operation_key,request_digest,plan,occurred_at) VALUES(?,?,?,?,?,?,?)").bind(caseId,plan.revision+1,owner!.actor_id,"old-handler-downgrade","synthetic",JSON.stringify({revision:plan.revision+1,items:[]}),new Date().toISOString()).run(),/upgrade_required/);
  response=await call("firm");assert.equal(response.status,200,await response.clone().text());
  const stable=(value:unknown)=>JSON.parse(JSON.stringify(value,(key,v)=>key==="evaluated_at"?undefined:v));
  assert.deepEqual(stable(await (await call("detail")).json()),stable(before));
});
