import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
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
const runtime=globalThis as unknown as {__practiceEnv:{DB:D1Database;DOSSIER_DOCUMENTS?:R2Bucket};__practiceHeaders:()=>Headers};
let organization:string, foreignOrganization:string, caseId:string;
const legacyId="firm_doc_"+"d".repeat(64),legacyBytes="Synthetic v193 original";
async function call(route:string,method="GET",body?:unknown,email="practice-owner@example.test",org=organization,extraHeaders?:Record<string,string>, query="") {
  const request=new Request("https://practice.test/api/work"+query,{method,headers:{origin:"https://practice.test","sec-fetch-site":"same-origin","oai-authenticated-user-email":email,"x-genesis-organization":org??"","content-type":"application/json",...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
  return storage.run(request,()=>routes[route][method as "GET"|"POST"](request,{params:Promise.resolve({dossierId:caseId})}));
}
before(async()=>{
  mf=new Miniflare({workers:[{config:{name:"practice-test",type:"worker",compatibilityDate:"2026-09-01",manifest:{mainModule:"index.mjs",modules:{"index.mjs":{type:"esm",contents:"export default {fetch(){return new Response('test')}}"}}},env:{DB:{type:"d1",name:"practice-test"},DOSSIER_DOCUMENTS:{type:"r2",name:"practice-documents"}}},dev:{}}]});
  db=await mf.getD1Database("DB","practice-test") as unknown as D1Database;
  const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
  const migrate=async(entry:{tag:string})=>{for(const sql of readFileSync(`drizzle/${entry.tag}.sql`,"utf8").split("--> statement-breakpoint"))await db.prepare(sql).run();};
  for(const entry of journal.entries.filter((v:{idx:number})=>v.idx<29))await migrate(entry);
  runtime.__practiceEnv={DB:db,DOSSIER_DOCUMENTS:await mf.getR2Bucket("DOSSIER_DOCUMENTS","practice-test") as unknown as R2Bucket};runtime.__practiceHeaders=()=>storage.getStore()!.headers;
  const paths={intake:'app/api/library/intake/route.ts',contacts:"app/api/contacts/route.ts",firmWork:"app/api/work/firm/route.ts",firmDocuments:"app/api/library/firm/route.ts",participants:"app/api/dossiers/[dossierId]/participants/route.ts",firm:"app/api/work/route.ts",templates:"app/api/work/templates/route.ts",organizations:"app/api/organizations/route.ts",dossiers:"app/api/dossiers/route.ts",detail:"app/api/dossiers/[dossierId]/route.ts",practice:"app/api/dossiers/[dossierId]/practice/route.ts"};
  const result=await build({stdin:{contents:Object.entries(paths).map(([name,path])=>`export * as ${name} from './${path}';`).join("\n"),resolveDir:process.cwd(),loader:"ts"},bundle:true,write:false,platform:"node",format:"esm",packages:"external",plugins:[{name:"synthetic-runtime",setup(b){
    b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},args=>({path:args.path,namespace:"runtime"}));
    b.onLoad({filter:/.*/,namespace:"runtime"},args=>({contents:args.path==="cloudflare:workers"?"export const env=globalThis.__practiceEnv; export function waitUntil(){}":args.path==="next/headers"?"export async function headers(){return globalThis.__practiceHeaders()}":"export function redirect(){throw Error('Unexpected redirect')}"}));
  }}]});
  mkdirSync(".artifacts/practice-route",{recursive:true});const target=resolve(".artifacts/practice-route/routes.mjs");writeFileSync(target,result.outputFiles[0].text);routes=await import(pathToFileURL(target).href);
  for(const email of ["practice-owner@example.test","practice-outsider@example.test"])await db.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email,"Synthetic practice user").run();
  let response=await call("organizations","POST",{action:"create",name:"Synthetic practice"});assert.equal(response.status,201,await response.clone().text());organization=(await response.json() as {organization:{id:string}}).organization.id;
  response=await call("organizations","POST",{action:"create",name:"Foreign practice"},"practice-outsider@example.test","");assert.equal(response.status,201,await response.clone().text());foreignOrganization=(await response.json() as {organization:{id:string}}).organization.id;
  response=await call("dossiers","POST",{title:"Synthetic operational case",jurisdictions:["Test"],classification:"internal"});assert.equal(response.status,201,await response.clone().text());const created=await response.json() as {dossier:{dossier_id:string}};caseId=created.dossier.dossier_id;
  const actor=await db.prepare("SELECT actor_id FROM users WHERE email=?").bind("practice-owner@example.test").first<string>("actor_id");
  const hex=createHash("sha256").update(legacyBytes).digest("hex"),digest="sha256-"+hex,objectKey=`firm/${organization}/${legacyId}/1/${hex}`;
  await runtime.__practiceEnv.DOSSIER_DOCUMENTS!.put(objectKey,legacyBytes,{sha256:hex,httpMetadata:{contentType:"text/plain"},customMetadata:{contentSha256:digest}});
  await db.prepare("INSERT INTO firm_document_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(organization,legacyId,1,"Legacy guide","Policies","legacy.txt","text/plain",legacyBytes.length,digest,objectKey,actor,"legacy-save-v193",digest,"2026-11-07T00:01:00.000Z").run();
  const schema=(await db.prepare("SELECT name,sql,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all<{name:string;sql:string;type:string}>()).results;
  const tables=schema.filter(s=>s.type==="table"&&!s.name.startsWith("_cf_"));
  const rows=()=>db.batch(tables.map(t=>db.prepare('SELECT * FROM "'+t.name.replaceAll('"','""')+'"')));
  const beforeRows=(await rows()).map(v=>v.results);
  for(const entry of journal.entries.filter((v:{idx:number})=>v.idx>=29)){
    if(entry.idx===31){
      const contact="contact_"+"f".repeat(32);
      await db.prepare("INSERT INTO firm_contacts (id,organization_id,kind,profile,name_key,email_key,status,revision) VALUES(?,?,'company',?,'migration witness','','active',1)").bind(contact,organization,JSON.stringify({kind:"company",name:"Migration witness"})).run();
      await db.prepare("INSERT INTO firm_contact_cases VALUES(?,?,?)").bind(organization,contact,caseId).run();
      const v196=async()=>Promise.all(["firm_contacts","firm_contact_cases","firm_contact_operations","firm_document_versions"].map(table=>db.prepare("SELECT * FROM "+table).all().then(r=>r.results)));
      const snapshot=await v196();await migrate(entry);assert.deepEqual(await v196(),snapshot,"v196 address book, existing case links, receipts and document versions survive intake migration");
    }else await migrate(entry);
  }
  assert.deepEqual((await rows()).map(v=>v.results),beforeRows,"upgrading a populated v193 database must preserve every pre-existing row");
  const afterSchema=(await db.prepare("SELECT name,sql,type FROM sqlite_master ORDER BY name").all<{name:string;sql:string;type:string}>()).results;
  assert.deepEqual(afterSchema.filter(v=>schema.some(old=>old.name===v.name)),schema,"old database objects must be unchanged");
}, {timeout:120000});
after(async()=>{await mf?.dispose();},{timeout:15000});

test("case intake retains its original questions, validates completion and preserves every revision",async()=>{
 const post=(command:Record<string,unknown>)=>call("intake","POST",command), list=async()=>await (await call("intake")).json() as {records:import("../app/intake/intake-model").IntakeRecord[]};
 const id="intake_"+"1".repeat(32),formId="intake_"+"2".repeat(32);
 const design={action:"design",revision:0,id,title:"Initial review",questions:[{label:"Purpose",required:true},{label:"Next steps",required:false}],operationKey:"intake-design-1"};
 const first=await post(design);assert.equal(first.status,200,await first.clone().text());
 const draft={action:"answer",id:formId,revision:0,caseId,templateId:id,templateRevision:1,status:"draft",answers:["",""],deidentified:true,operationKey:"intake-save-1"};
 assert.equal((await post({...draft,deidentified:false})).status,400);
 assert.equal((await post({...draft,status:"complete"})).status,400);
 const created=await post(draft);assert.equal(created.status,200,await created.clone().text());const receipt=await created.json();
 assert.deepEqual(await (await post(draft)).json(),receipt);
 assert.deepEqual(await (await call("intake","GET",undefined,undefined,organization,undefined,"?operation=intake-save-1")).json(),receipt);
 assert.equal((await post({...draft,answers:["another",""]})).status,409);
 assert.equal((await post({...design,revision:1,title:"Updated intake",questions:[{label:"Different question",required:true}],operationKey:"intake-design-2"})).status,200);
 assert.equal((await post({...draft,id:"intake_"+"3".repeat(32),operationKey:"intake-stale-template"})).status,409);
 const archive={action:"archive",id,revision:2,operationKey:"intake-archive-3"};assert.equal((await post(archive)).status,200);
 assert.equal((await post({...draft,id:"intake_"+"3".repeat(32),templateRevision:3,operationKey:"intake-archived-src"})).status,409);
 const complete={...draft,revision:1,status:"complete",answers:["Synthetic purpose",""],operationKey:"intake-save-2"};
 assert.equal((await post(complete)).status,200);assert.equal((await post({...complete,operationKey:"intake-stale-form"})).status,409);
 const r=(await list()).records.find(v=>v.id===formId)!;assert.equal(r.title,design.title);assert.deepEqual(r.questions,design.questions);assert.equal(r.templateRevision,1);assert.equal(r.status,"complete");assert.equal(r.canEdit,true);
 assert.equal((await post({...complete,revision:2,status:"draft",operationKey:"intake-edit-complete"})).status,409);
 assert.equal((await post({action:"reopen",id:formId,revision:2,operationKey:"intake-reopen-3"})).status,200);
 assert.equal((await post({...archive,action:"restore",revision:3,operationKey:"intake-restore-4"})).status,200);
 const history=(await db.prepare("SELECT status,answers FROM intake_revisions WHERE id=? ORDER BY revision").bind(formId).all()).results;
 assert.deepEqual(history.map(h=>h.status),["draft","complete","draft"]);assert.equal(history[2].answers,history[1].answers);
 await assert.rejects(db.prepare("UPDATE intake_revisions SET title='replaced' WHERE id=?").bind(id).run(),/immutable_intake_revision/);
 await assert.rejects(db.prepare("DELETE FROM intake_revisions WHERE id=?").bind(formId).run(),/immutable_intake_revision/);
});
test("firm membership does not reveal intake answers or grant access to a case",async()=>{
 const email="intake-reviewer@example.test";await db.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email,"Synthetic intake reviewer").run();
 const u=await db.prepare("SELECT id,actor_id FROM users WHERE email=?").bind(email).first<{id:number;actor_id:string}>();
 await db.prepare("INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,status,revision,created_at) VALUES(?,?,?,'member','active',1,?)").bind(organization,u!.id,u!.actor_id,new Date().toISOString()).run();
 const list=await (await call("intake","GET",undefined,email)).json() as {records:{caseId:string|null}[];cases:unknown[]};
 assert.deepEqual(list.cases,[]);assert.ok(list.records.length);assert.ok(list.records.every(r=>r.caseId===null));
 const cmd={action:"answer",id:"intake_"+"4".repeat(32),revision:0,caseId,templateId:"intake_"+"1".repeat(32),templateRevision:4,status:"draft",answers:["Synthetic"],deidentified:true,operationKey:"intake-denied-case"};
 assert.equal((await call("intake","POST",cmd,email)).status,403);
 assert.equal((await call("intake","POST",{...cmd,caseId:"51"})).status,403);
 assert.equal((await call("intake","POST",cmd,undefined,organization,{origin:"https://foreign.test","sec-fetch-site":"cross-site"})).status,403);
 const other=await (await call("intake","GET",undefined,"practice-outsider@example.test",foreignOrganization)).json() as {records:unknown[]};assert.deepEqual(other.records,[]);
 await db.prepare("UPDATE organization_memberships SET role='auditor',revision=revision+1 WHERE actor_id=? AND organization_id=?").bind(u!.actor_id,organization).run();
 assert.equal((await call("intake","POST",{action:"archive",id:cmd.templateId,revision:4,operationKey:"intake-denied-audit"},email)).status,403);
});

test("firm contacts preserve participants, enforce case visibility and recover the original save", async () => {
  const post = (command: Record<string,unknown>) => call("contacts","POST",command);
  const directory = async (email?:string, org=organization) => (await (await call("contacts","GET",undefined,email,org)).json()) as {
    contacts: {id:string; name:string; revision:number; caseIds:string[]; status:string; companyId:string}[];
    batches: {key:string; count:number}[];
  };
  const create = {action:"create", id:"", revision:0, reviewed:[], operationKey:"crm-first-company", profile:{kind:"company",name:"Synthetic Works",email:"team@example.test"}};
  const participants = () => db.prepare("SELECT * FROM dossier_participants WHERE dossier_id=? ORDER BY id").bind(caseId).all();
  const before = (await participants()).results;
  const first = await post(create);
  assert.equal(first.status,200,await first.clone().text());
  const receipt = await first.json() as {ids:string[]};
  const id = receipt.ids[0];
  assert.deepEqual(await (await post(create)).json(),receipt);
  assert.deepEqual(await (await call("contacts","GET",undefined,undefined,organization,undefined,"?operation=crm-first-company")).json(),receipt);
  assert.equal((await post({...create,profile:{...create.profile,name:"Other"}})).status,409);
  assert.equal((await post({...create,operationKey:"crm-duplicate"})).status,409);
  assert.equal((await post({...create,operationKey:"crm-reviewed-duplicate",reviewed:[id]})).status,200);
  const person = {...create,operationKey:"crm-affiliation",profile:{kind:"person",name:"Synthetic colleague",companyId:id}};
  assert.equal((await post(person)).status,200);
  assert.equal((await directory()).contacts.find(c=>c.name==="Synthetic colleague")!.companyId,id);
  const link = {action:"link",id,caseId,revision:1,operationKey:"crm-case-link"};
  assert.equal((await post(link)).status,200);
  assert.deepEqual((await directory()).contacts.find(c=>c.id===id)!.caseIds,[caseId]);
  assert.deepEqual((await participants()).results,before);
  const email="crm-auditor@example.test";
  await db.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email,"Synthetic directory reader").run();
  const user=await db.prepare("SELECT id,actor_id FROM users WHERE email=?").bind(email).first<{id:number;actor_id:string}>();
  await db.prepare("INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,status,revision,created_at) VALUES(?,?,?,'auditor','active',1,?)").bind(organization,user!.id,user!.actor_id,new Date().toISOString()).run();
  assert.deepEqual((await directory(email)).contacts.find(c=>c.id===id)!.caseIds,[]);
  assert.equal((await call("contacts","POST",person,email)).status,403);
  await db.prepare("UPDATE organization_memberships SET role='member',revision=revision+1 WHERE actor_id=? AND organization_id=?").bind(user!.actor_id,organization).run();
  assert.equal((await call("contacts","POST",{...link,action:"unlink",revision:2,operationKey:"crm-unauthorized-unlink"},email)).status,403);
  assert.deepEqual((await directory("practice-outsider@example.test",foreignOrganization)).contacts,[]);
  assert.equal((await call("contacts","POST",person,undefined,organization,{origin:"https://foreign.test","sec-fetch-site":"cross-site"})).status,403);
  assert.equal((await post({...link,action:"unlink",revision:2,operationKey:"crm-unlink"})).status,200);
  const edit={...create,action:"edit",id,revision:3,operationKey:"crm-email-change",profile:{kind:"company",name:"Renamed synthetic firm",email:"new@example.test"}};
  assert.equal((await post(edit)).status,200);
  assert.equal((await post({...edit,operationKey:"crm-stale-edit"})).status,409);
  assert.equal((await post({action:"archive",id,revision:4,operationKey:"crm-archive"})).status,200);
  assert.equal((await directory()).contacts.find(c=>c.id===id)!.status,"archived");
  assert.equal((await post({action:"restore",id,revision:5,operationKey:"crm-restore"})).status,200);
  assert.deepEqual((await participants()).results,before);
});

test("reviewed CRM import is atomic, replayable and reversible until a contact changes",async()=>{
  const post=(command:Record<string,unknown>)=>call("contacts","POST",command);
  const profile=(name:string)=>({kind:"person",name});
  const cmd={action:"import",operationKey:"crm-import-first",profiles:[profile("Example A"),profile("Example B")]};
  const first=await post(cmd);assert.equal(first.status,200,await first.clone().text());
  const receipt=await first.json() as {ids:string[]};assert.equal(receipt.ids.length,2);
  assert.deepEqual(await (await post(cmd)).json(),receipt);
  assert.equal((await post({...cmd,operationKey:"crm-import-stale",profiles:[profile("Rolled back"),profile("Example A")]})).status,409);
  assert.equal(await db.prepare("SELECT count(*) AS n FROM firm_contacts WHERE name_key='rolled back'").first("n"),0);
  const undo={action:"undo",batchKey:cmd.operationKey,operationKey:"crm-import-undo"};
  const undone=await post(undo);assert.equal(undone.status,200);
  assert.deepEqual(await (await post(undo)).json(),await undone.json());
  assert.equal((await post({...undo,operationKey:"crm-undo-twice"})).status,409);
  const second={...cmd,operationKey:"crm-import-second",profiles:[profile("Example C"),profile("Example D")]};
  const ids=(await (await post(second)).json() as {ids:string[]}).ids;
  assert.equal((await post({action:"link",id:ids[1],caseId,revision:1,operationKey:"crm-after-import"})).status,200);
  assert.equal((await post({...undo,operationKey:"crm-late-undo",batchKey:second.operationKey})).status,409);
  const directory=await (await call("contacts")).json() as {contacts:{id:string;status:string}[];batches:{key:string}[]};
  assert.ok(directory.contacts.filter(c=>ids.includes(c.id)).every(c=>c.status==="active"));
  assert.ok(directory.contacts.filter(c=>receipt.ids.includes(c.id)).every(c=>c.status==="archived"));
  assert.deepEqual(directory.batches.map(b=>b.key),[second.operationKey]);
  const employer={action:"import",operationKey:"crm-import-employer",profiles:[{kind:"company",name:"Example employer",relationship:"client"}]};
  const [companyId]=(await (await post(employer)).json() as {ids:string[]}).ids;
  const employee={action:"create",profile:{kind:"person",name:"New employee",companyId},id:"",revision:0,reviewed:[],operationKey:"crm-dependent-person"};
  assert.equal((await post(employee)).status,200);
  assert.equal((await post({...undo,batchKey:employer.operationKey,operationKey:"crm-employer-used"})).status,409);
});
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


test("standalone firm work is revisioned, replayable, private to the organization and immutable",async()=>{
 const item={kind:"task",title:"Firm review",description:"Synthetic",dueDate:"2026-11-10",assignee:null,priority:"normal",status:"open",checklist:[]};
 const command={action:"create",item,expectedRevision:0,operationKey:"firm-task-original"};
 const response=await call("firmWork","POST",command);assert.equal(response.status,200,await response.clone().text());const original=await response.json();
 assert.deepEqual(await (await call("firmWork","POST",command)).json(),original);
 assert.equal((await call("firmWork","POST",{...command,item:{...item,title:"Replacement"}})).status,409);
 assert.equal((await call("firmWork","POST",{...command,operationKey:"firm-task-stale"})).status,409);
 assert.equal((await call("firmWork","POST",{...command,expectedRevision:1,operationKey:"firm-task-invalid-owner",item:{...item,assignee:"unknown_actor"}})).status,409);
 assert.equal((await call("firmWork","POST",command,"practice-owner@example.test",organization,{origin:"https://foreign.test","sec-fetch-site":"cross-site"})).status,403);
 const foreign=await (await call("firmWork","GET",undefined,"practice-outsider@example.test",foreignOrganization)).json() as {plan:{revision:number}};assert.equal(foreign.plan.revision,0);
 await assert.rejects(db.prepare("DELETE FROM organization_work_revisions WHERE organization_id=?").bind(organization).run(),/immutable/);
});

async function firmUpload(title:string,key:string,id?:string,expectedVersion=0,email="practice-owner@example.test",org=organization){
 const form=new FormData();form.set("title",title);form.set("folder","Policies/Team");form.set("operationKey",key);form.set("expectedVersion",String(expectedVersion));form.set("mediaType","text/plain");form.set("privacyAcknowledgement","synthetic_or_deidentified");form.set("file",new File(["Synthetic document only"],"example.txt",{type:"text/plain"}));if(id)form.set("id",id);
 const request=new Request("https://practice.test/api/library/firm",{method:"POST",headers:{origin:"https://practice.test","sec-fetch-site":"same-origin","oai-authenticated-user-email":email,"x-genesis-organization":org},body:form});
 return storage.run(request,()=>routes.firmDocuments.POST(request,{params:Promise.resolve({dossierId:caseId})}));
}
const firmGet=(query="",email="practice-owner@example.test",org=organization)=>call("firmDocuments","GET",undefined,email,org,undefined,query);
async function firmAction(action:string,key:string,path?:string){
 const form=new FormData();form.set("action",action);form.set("operationKey",key);if(path!==undefined)form.set("folder",path);
 const request=new Request("https://practice.test/api/library/firm",{method:"POST",headers:{origin:"https://practice.test","sec-fetch-site":"same-origin","oai-authenticated-user-email":"practice-owner@example.test","x-genesis-organization":organization},body:form});
 return storage.run(request,()=>routes.firmDocuments.POST(request,{params:Promise.resolve({dossierId:caseId})}));
}
test("upgraded v193 original still downloads, and a legacy writer can append without a reservation",async()=>{
 const response=await firmGet(`?id=${legacyId}&version=1&download=1`);assert.equal(response.status,200);assert.equal(await response.text(),legacyBytes);
 const insert=db.prepare("INSERT INTO firm_document_versions SELECT organization_id,document_id,?,title,folder,filename,media_type,byte_length,content_sha256,replace(object_key,'/1/','/'||?||'/'),actor_ref,?,request_digest,occurred_at FROM firm_document_versions WHERE organization_id=? AND document_id=? AND version=1");
 await db.batch(Array.from({length:100},(_,i)=>insert.bind(i+2,i+2,"legacy-history-"+(i+2),organization,legacyId)));
 const first=await (await firmGet("?id="+legacyId)).json() as {documents:{version:number}[];nextVersion:number};
 assert.equal(first.documents.length,100);assert.equal(first.documents[0].version,101);assert.equal(first.nextVersion,2);
 const last=await (await firmGet(`?id=${legacyId}&before=${first.nextVersion}`)).json() as {documents:{version:number}[];nextVersion:null};
 assert.deepEqual(last.documents.map(v=>v.version),[1]);assert.equal(last.nextVersion,null);
});
test("folder saves have private receipts, survive retries and cannot reuse upload keys",async()=>{
 assert.equal((await firmAction("folder","create-folder-key","Policies / Forms")).status,200);
 assert.equal((await firmAction("folder","create-folder-key","Policies/Forms")).status,200);
 assert.equal((await firmAction("folder","create-folder-key","Other")).status,409);
 assert.equal((await firmAction("folder","other-folder-key","../Other")).status,400);
 assert.equal((await firmUpload("Collision","create-folder-key")).status,409);
 const receipt=await (await firmGet("?operation=create-folder-key")).json() as {state:string;folder:string};assert.equal(receipt.state,"committed");assert.equal(receipt.folder,"Policies/Forms");
 assert.equal((await (await firmGet("?operation=create-folder-key","practice-outsider@example.test",foreignOrganization)).json() as {state:string}).state,"not_started");
 const list=await (await firmGet()).json() as {folders:string[]};assert.ok(list.folders.includes("Policies/Forms"));
});
test("interrupted storage resumes after reload, checks exact bytes and cancellation cannot publish a version",async()=>{
 const bucket=runtime.__practiceEnv.DOSSIER_DOCUMENTS!,key="incomplete-original",abandon="cancel-original-upload";let attempts=0;
 runtime.__practiceEnv.DOSSIER_DOCUMENTS=new Proxy(bucket,{get(target,name){if(name==="put")return async(...args:Parameters<R2Bucket["put"]>)=>{attempts++;await target.put(...args);throw Error("Simulated loss after persisting the original");};const v=Reflect.get(target,name);return typeof v==="function"?v.bind(target):v;}});
 try{assert.equal((await firmUpload("Interrupted",key)).status,503);assert.equal((await firmUpload("Cancelled",abandon)).status,503);}finally{runtime.__practiceEnv.DOSSIER_DOCUMENTS=bucket;}
 assert.equal(attempts,2);
 const partial=await (await firmGet()).json() as {documents:{title:string}[];incomplete:{key:string}[]};assert.ok(partial.incomplete.some(v=>v.key===key));assert.ok(!partial.documents.some(v=>v.title==="Interrupted"));
 assert.equal((await (await firmGet("?operation="+key)).json() as {state:string}).state,"pending");
 assert.equal((await firmUpload("Mismatched",key)).status,409);
 assert.equal((await (await firmAction("cancel",abandon)).json() as {state:string}).state,"cancelled");assert.equal((await firmUpload("Cancelled",abandon)).status,409);
 const original=await firmUpload("Interrupted",key);assert.equal(original.status,200,await original.clone().text());const saved=await original.json() as {document:{id:string;version:number}};
 const receipt=await (await firmGet("?operation="+key)).json() as {state:string;document:unknown};assert.equal(receipt.state,"committed");assert.deepEqual(receipt.document,saved.document);
 assert.equal(await (await firmGet(`?id=${saved.document.id}&version=1&download=1`)).text(),"Synthetic document only");
 assert.equal((await (await firmAction("cancel",key)).json() as {state:string}).state,"committed");
 const race=await Promise.all([firmUpload("A","contending-save-A",saved.document.id,1),firmUpload("B","contending-save-B",saved.document.id,1)]);assert.deepEqual(race.map(v=>v.status).sort(),[200,409]);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM firm_document_versions WHERE document_id=?").bind(saved.document.id).first<{n:number}>())!.n,2);
});
test("firm documents retain exact versions and protected downloads, with no case evidence mutation",async()=>{
 const before=await (await call("detail")).json();
 let response=await firmUpload("Firm policy","firm-upload-original");assert.equal(response.status,200,await response.clone().text());const original=await response.json() as {document:{id:string;version:number}};
 assert.deepEqual(await (await firmUpload("Firm policy","firm-upload-original")).json(),original);
 assert.equal((await firmUpload("Different title","firm-upload-original")).status,409);
 response=await firmUpload("Firm policy revised","firm-upload-version2",original.document.id,1);assert.equal(response.status,200,await response.clone().text());
 response=await call("firmDocuments","GET",undefined,"practice-owner@example.test",organization,undefined,`?id=${original.document.id}`);assert.equal(response.status,200);assert.equal((await response.json() as {documents:unknown[]}).documents.length,2);
 response=await call("firmDocuments","GET",undefined,"practice-owner@example.test",organization,undefined,`?id=${original.document.id}&version=1&download=1`);assert.equal(response.status,200,await response.clone().text());assert.equal(await response.text(),"Synthetic document only");assert.match(response.headers.get("cache-control")!,/no-store/);assert.match(response.headers.get("content-disposition")!,/attachment/);
 assert.equal((await call("firmDocuments","GET",undefined,"practice-outsider@example.test",foreignOrganization,undefined,`?id=${original.document.id}&version=1&download=1`)).status,404);
 await assert.rejects(db.prepare("DELETE FROM firm_document_versions WHERE organization_id=?").bind(organization).run(),/immutable/);
 const stable=(v:unknown)=>JSON.parse(JSON.stringify(v,(k,x)=>k==="evaluated_at"?undefined:x));assert.deepEqual(stable(await (await call("detail")).json()),stable(before));
});

test("auditor reads firm work but cannot change it and suspended members cannot read firm documents",async()=>{
 const outsider=await db.prepare("SELECT actor_id FROM users WHERE email=?").bind("practice-outsider@example.test").first<{actor_id:string}>();
 await db.prepare("UPDATE organization_memberships SET role='auditor',status='active',revision=revision+1 WHERE organization_id=? AND actor_id=?").bind(organization,outsider!.actor_id).run();
 assert.equal((await call("firmWork","GET",undefined,"practice-outsider@example.test",organization)).status,200);
 assert.equal((await call("firmWork","POST",{action:"create"},"practice-outsider@example.test",organization)).status,403);
 assert.equal((await call("firmDocuments","POST",{},"practice-outsider@example.test",organization)).status,403);
 await db.prepare("UPDATE organization_memberships SET status='suspended',revision=revision+1 WHERE organization_id=? AND actor_id=?").bind(organization,outsider!.actor_id).run();
 assert.equal((await call("firmDocuments","GET",undefined,"practice-outsider@example.test",organization)).status,404);
});

test("authority is checked again after private object I/O; changed identity gets neither bytes nor a committed version",async()=>{
 const bucket=runtime.__practiceEnv.DOSSIER_DOCUMENTS!,headers=runtime.__practiceHeaders;
 for(const mode of ["get","put"] as const){
  runtime.__practiceEnv.DOSSIER_DOCUMENTS=new Proxy(bucket,{get(target,name){if(name===mode)return async(...args:unknown[])=>{const value=await Reflect.apply(Reflect.get(target,name),target,args);runtime.__practiceHeaders=()=>new Headers();return value;};const v=Reflect.get(target,name);return typeof v==="function"?v.bind(target):v;}});
  try{const result=mode==="get"?await firmGet(`?id=${legacyId}&version=1&download=1`):await firmUpload("Revoked mid-save","identity-change-key");assert.ok([401,403,404].includes(result.status),String(result.status));assert.doesNotMatch(await result.text(),/Synthetic v193 original|firm_doc_/);}
  finally{runtime.__practiceEnv.DOSSIER_DOCUMENTS=bucket;runtime.__practiceHeaders=headers;}
 }
 assert.equal((await (await firmGet("?operation=identity-change-key")).json() as {state:string}).state,"pending");await firmAction("cancel","identity-change-key");
});
test("an existing private object with inconsistent metadata is never overwritten or published",async()=>{
 const bucket=runtime.__practiceEnv.DOSSIER_DOCUMENTS!;let path="";
 runtime.__practiceEnv.DOSSIER_DOCUMENTS=new Proxy(bucket,{get(target,name){if(name==="put")return async(key:string,...args:unknown[])=>{path=key;await target.put(key,"Other synthetic bytes",{httpMetadata:{contentType:"text/plain"}});return Reflect.apply(target.put,target,[key,...args]);};const v=Reflect.get(target,name);return typeof v==="function"?v.bind(target):v;}});
 try{assert.equal((await firmUpload("Integrity test","corrupt-existing-key")).status,503);}finally{runtime.__practiceEnv.DOSSIER_DOCUMENTS=bucket;}
 assert.equal((await firmUpload("Integrity test","corrupt-existing-key")).status,503);assert.equal(await (await bucket.get(path))!.text(),"Other synthetic bytes");
 assert.equal((await (await firmGet("?operation=corrupt-existing-key")).json() as {state:string}).state,"pending");await firmAction("cancel","corrupt-existing-key");
});

test("unfinished bytes are bounded per organization without counting or deleting its saved originals",async()=>{
 const actor=await db.prepare("SELECT actor_id FROM users WHERE email=?").bind("practice-outsider@example.test").first<string>("actor_id");
 const stage=db.prepare("INSERT INTO firm_upload_intents(organization_id,actor_ref,operation_key,request_digest,document_id,expected_version,title,folder,filename,byte_length,created_at) VALUES(?,?,?,?,?,0,'Synthetic quota test','','test.pdf',?,?)");
 const sizes=[...Array(40).fill(25*1024*1024),24*1024*1024];
 await db.batch(sizes.map((size,i)=>stage.bind(foreignOrganization,actor,"quota-test-"+i,"sha256-"+"c".repeat(64),"firm_doc_"+i.toString(16).padStart(64,"0"),size,"2026-11-07T08:00:00.000Z")));
 const blocked=await firmUpload("No capacity","quota-save-full",undefined,0,"practice-outsider@example.test",foreignOrganization);
 assert.equal(blocked.status,507);assert.match(await blocked.text(),/Incomplete upload storage is full/);
 const own=await firmUpload("Other organization","unrelated-capacity");assert.equal(own.status,200);
 const other=await (await firmGet("?operation=quota-test-0")).json() as {state:string};assert.equal(other.state,"not_started");
});
