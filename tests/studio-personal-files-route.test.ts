import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {AsyncLocalStorage} from "node:async_hooks";
import {build} from "esbuild";
import {Miniflare} from "miniflare";
import {createPasswordCredential,type PasswordCredential} from "../app/auth-crypto";
import {caseFingerprint,casePublicationFingerprint,normalizeStudioDraft} from "../app/case-integrity";
import {studioDeviceScope} from "../app/studio-device-storage";
import {parsePersonalFiles,type PersonalFileRegistry} from "../app/studio-personal-files";
type Route={GET(r:Request):Promise<Response>;POST(r:Request):Promise<Response>;PATCH(r:Request):Promise<Response>;DELETE(r:Request):Promise<Response>};
const storage=new AsyncLocalStorage<Request>();
const globals=globalThis as unknown as {__history_env:{DB:D1Database;DOSSIER_DOCUMENTS:R2Bucket};__history_headers():Headers};
let mf:Miniflare,d1:D1Database,bucket:R2Bucket,routes:{files:Route;login:Route;me:Route},credential:PasswordCredential;
let beforeWrite:(()=>Promise<void>)|undefined,beforeHistoryRead:(()=>Promise<void>)|undefined,beforeBatch:(()=>Promise<void>)|undefined;
const password='Synthetic-personal-files-QA-05!';const emails={owner:'files-owner@example.test',shared:'files-shared@example.test',foreign:'files-foreign@example.test'};
const cookies:Record<string,string>={},scopes:Record<string,string>={};
const draft=normalizeStudioDraft({...JSON.parse(readFileSync('tests/fixtures/fiveflats-rent-146000.studio-draft.json','utf8')),caseId:'qa_personal_files',title:'QA synthetic personal files',version:'1.0.0'});
let currentDraft=draft;const fp=caseFingerprint(draft);
async function read(r:Response,status=200){const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));assert.match(r.headers.get('cache-control')??'',/no-store/);return value;}
async function provision(actor:keyof typeof emails){
 const email=emails[actor];await d1.prepare('insert into users(email,display_name) values(?,?)').bind(email,'QA synthetic '+actor).run();
 await d1.prepare('insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)').bind(email,credential.hash,credential.salt,credential.iterations,'2026-01-01T00:00:00.000Z').run();await login(actor);scopes[actor]=(await studioDeviceScope(email))!;
}
async function login(actor:keyof typeof emails){const request=new Request('https://history.test/api/auth/login',{method:'POST',headers:{origin:'https://history.test','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({email:emails[actor],password})});const response=await storage.run(request,()=>routes.login.POST(request));await read(response);cookies[actor]=response.headers.get('set-cookie')!.split(';')[0];}
async function call(actor:keyof typeof emails|null,method:'GET'|'POST'|'PATCH'='GET',body?:FormData|Record<string,unknown>,fileId?:string,headersPatch:Record<string,string>={}){
 const q=new URLSearchParams({customCaseId:'1',expectedScope:scopes[actor??'owner']});if(fileId)q.set('fileId',fileId);
 const headers=new Headers({origin:'https://history.test','sec-fetch-site':'same-origin',...headersPatch});if(actor)headers.set('cookie',cookies[actor]);if(body&&!(body instanceof FormData))headers.set('content-type','application/json');
 const request=new Request('https://history.test/api/custom-cases/files?'+q,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return storage.run(request,()=>routes.files[method](request));
}
async function registry(){const value=parsePersonalFiles(await read(await call('owner')));assert.ok(value);return value;}
function form(revision:number,nodeId=currentDraft.nodes[0].id,id=crypto.randomUUID(),text='QA synthetic original — café\n'){
 const f=new FormData();for(const [k,v]of Object.entries({customCaseId:'1',expectedScope:scopes.owner,expectedFingerprint:caseFingerprint(currentDraft),expectedPublicationFingerprint:casePublicationFingerprint(currentDraft),fileId:id,nodeId,revision:String(revision),privacy:'true'}))f.set(k,v);f.set('file',new File([text],'QA-original.txt',{type:'text/plain'}));return f;
}
async function upload(nodeId=currentDraft.nodes[0].id){const r=await registry();const f=form(r.revision,nodeId);const result=parsePersonalFiles(await read(await call('owner','POST',f),201));assert.ok(result);return {value:result,id:String(f.get('fileId')),form:f};}
async function bytes(id:string){const r=await call('owner','GET',undefined,id);assert.equal(r.status,200,await r.clone().text());return new Uint8Array(await r.arrayBuffer());}
async function updateCase(next:typeof draft){currentDraft=next;const hash=caseFingerprint(next);await d1.prepare('insert into case_drafts(custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(1,?,?,?,?,?,?)').bind(emails.owner,next.caseId,next.version,hash,next.title,JSON.stringify(next)).run();await d1.prepare('update custom_cases set current_version=?,fingerprint=? where id=1').bind(next.version,hash).run();}
function change(r:PersonalFileRegistry,fileIds:string[],nodeId:string,mode='attach',fromNodeId?:string){return {customCaseId:1,expectedScope:scopes.owner,expectedFingerprint:caseFingerprint(currentDraft),expectedPublicationFingerprint:casePublicationFingerprint(currentDraft),revision:r.revision,fileIds,nodeId,mode,...(fromNodeId?{fromNodeId}:{})};}
before(async () => {
  mf = new Miniflare({ workers: [{ config: { name: "receipt-history", type: "worker", compatibilityDate: "2026-09-01", manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } }, env: { DB: { type: "d1", name: "receipt-history" }, DOSSIER_DOCUMENTS: { type: "r2", name: "personal-files" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "receipt-history") as unknown as D1Database;
  bucket = await mf.getR2Bucket("DOSSIER_DOCUMENTS", "receipt-history") as unknown as R2Bucket;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) await d1.batch(readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean).map(s => d1.prepare(s)));
  globals.__history_env = { DB: new Proxy(d1, { get(target, key) {
    if (key === "batch") return async (statements:D1PreparedStatement[])=>{const hook=beforeBatch;beforeBatch=undefined;await hook?.();return target.batch(statements);};
    if (key === "prepare") return (query: string) => {
      const wrap = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, { get(s, k) {
        if (k === "bind") return (...args: unknown[]) => wrap(s.bind(...args));
        const value = Reflect.get(s, k, s);
        if (typeof value === "function" && ["run", "all", "raw"].includes(String(k))) return async (...args: unknown[]) => {
          if (/insert into audit_events\(/i.test(query)) { const hook = beforeWrite; beforeWrite = undefined; await hook?.(); }
          if (/^select .* from "audit_events"/i.test(query)) { const hook = beforeHistoryRead; beforeHistoryRead = undefined; await hook?.(); }
          return value.apply(s, args);
        };
        return typeof value === "function" ? value.bind(s) : value;
      } });
      return wrap(target.prepare(query));
    };
    const value = Reflect.get(target, key, target); return typeof value === "function" ? value.bind(target) : value;
  } }), DOSSIER_DOCUMENTS: bucket };
  globals.__history_headers = () => storage.getStore()!.headers;

  const built = await build({ stdin: { contents: "export * as files from './app/api/custom-cases/files/route.ts'; export * as login from './app/api/auth/login/route.ts'; export * as me from './app/api/me/route.ts';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022", plugins: [{ name: "history-runtime", setup(b) {
    b.onResolve({ filter: /tax-runtime\/worker$/ }, () => ({ path: "tax-worker", namespace: "history-tax-runtime" }));
    b.onLoad({ filter: /.*/, namespace: "history-tax-runtime" }, () => ({ contents: "export const loadWorkerTaxRuntime=()=>{throw new Error('Unexpected tax execution')}" }));
    b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "history-runtime" }));
    b.onLoad({ filter: /.*/, namespace: "history-runtime" }, args => ({ contents: args.path === "cloudflare:workers" ? "export const env=globalThis.__history_env" : args.path === "next/headers" ? "export async function headers(){return globalThis.__history_headers()}" : "export function redirect(){throw new Error('unexpected redirect')}" }));
  } }] });
  mkdirSync(".artifacts/personal-files-tests", { recursive: true });
  const path = resolve(".artifacts/personal-files-tests/routes.mjs"); writeFileSync(path, built.outputFiles[0].text); routes = await import(pathToFileURL(path).href);
  credential = await createPasswordCredential(password);
  for (const actor of Object.keys(emails) as Array<keyof typeof emails>) await provision(actor);
  await d1.prepare("insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint) values(1,?,?,?,?,?)").bind(emails.owner, draft.caseId, draft.title, draft.version, fp).run();
  await d1.prepare("insert into case_drafts(custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(1,?,?,?,?,?,?)").bind(emails.owner, draft.caseId, draft.version, fp, draft.title, JSON.stringify(draft)).run();
  await d1.prepare("insert into custom_case_grants(custom_case_id,recipient_email,granted_by_email) values(1,?,?)").bind(emails.shared,emails.owner).run();
});
after(async () => { await mf?.dispose(); });

test('owner-only personal registry rejects foreign users, shared grants and cross-site writes',async()=>{
 assert.deepEqual((await registry()).files,[]);await read(await call(null),401);await read(await call('shared'),404);await read(await call('foreign'),404);
 await read(await call('owner','POST',form(0),undefined,{'sec-fetch-site':'cross-site'}),403);
});
test('real D1/R2 upload retains exact original bytes, stable identity and saved case payload',async()=>{
 const before=(await d1.prepare('select cast(payload as text) as payload from case_drafts where custom_case_id=1').all()).results;
 const u=await upload();const f=u.value.files.find(x=>x.id===u.id)!;assert.equal(f.status,'ready');assert.equal(f.filename,'QA-original.txt');assert.deepEqual(f.nodeIds,[draft.nodes[0].id]);assert.equal(new TextDecoder().decode(await bytes(f.id)),'QA synthetic original — café\n');
 assert.deepEqual((await registry()).files,u.value.files);assert.deepEqual((await d1.prepare('select cast(payload as text) as payload from case_drafts where custom_case_id=1').all()).results,before);
 const retry=parsePersonalFiles(await read(await call('owner','POST',u.form),201))!;assert.equal(retry.revision,u.value.revision);assert.equal(retry.files.length,1);
 u.form.set('file',new File(['changed'],'QA-original.txt',{type:'text/plain'}));await read(await call('owner','POST',u.form),409);assert.equal(new TextDecoder().decode(await bytes(f.id)),'QA synthetic original — café\n');
});
test('bulk relinking is atomic, refuses stale CAS and preserves every original',async()=>{
 const two=await upload(),r=await registry(),ids=r.files.map(f=>f.id),originals=await Promise.all(ids.map(bytes)),target=draft.nodes[1].id;
 await read(await call('owner','PATCH',change(r,[...ids,'not-a-file'],target)),409);assert.equal((await registry()).revision,r.revision);
 const moved=parsePersonalFiles(await read(await call('owner','PATCH',change(r,ids,target,'move',draft.nodes[0].id))))!;for(const f of moved.files)assert.deepEqual(f.nodeIds,[target]);
 await read(await call('owner','PATCH',change(r,ids,draft.nodes[2].id)),409);assert.deepEqual(await Promise.all(ids.map(bytes)),originals);assert.ok(two.id);
});
test('case edit or session revocation at the actual SQL boundary refuses upload before R2 writes',async()=>{
 const r=await registry(),objects=await bucket.list();beforeWrite=async()=>{await d1.prepare("update case_drafts set payload=json_set(payload,'$.premisePublication','unreviewed') where custom_case_id=1").run();};await read(await call('owner','POST',form(r.revision)),409);assert.equal((await bucket.list()).objects.length,objects.objects.length);
 await d1.prepare('update case_drafts set payload=? where custom_case_id=1').bind(JSON.stringify(currentDraft)).run();
 beforeWrite=async()=>{await d1.prepare('update auth_sessions set revoked_at=? where account_id in(select id from local_accounts where user_email=?)').bind(new Date().toISOString(),emails.owner).run();};await read(await call('owner','POST',form(r.revision)),409);await login('owner');assert.equal((await registry()).revision,r.revision);
});
test('source change after object storage retains pending original for owner recovery and exact retry',async()=>{
 const r=await registry(),f=form(r.revision);beforeWrite=async()=>{beforeWrite=async()=>{await d1.prepare("update case_drafts set payload=json_set(payload,'$.premisePublication','unreviewed') where custom_case_id=1").run();};};await read(await call('owner','POST',f),409);
 const id=String(f.get('fileId')),pending=(await registry()).files.find(x=>x.id===id)!;assert.equal(pending.status,'pending');assert.equal(new TextDecoder().decode(await bytes(id)),'QA synthetic original — café\n');
 await d1.prepare('update case_drafts set payload=? where custom_case_id=1').bind(JSON.stringify(currentDraft)).run();const recovered=parsePersonalFiles(await read(await call('owner','POST',f),201))!;assert.equal(recovered.files.find(x=>x.id===id)!.status,'ready');
});
test('deleted-node files remain recoverable and can be reattached in bulk to a saved node',async()=>{
 const u=await upload(draft.nodes[0].id),old=await bytes(u.id),oldPayload=JSON.stringify(draft);await updateCase({...draft,version:'1.0.1',nodes:draft.nodes.filter(n=>n.id!==draft.nodes[0].id),links:draft.links.filter(l=>l.from!==draft.nodes[0].id&&l.to!==draft.nodes[0].id)});
 const r=await registry();assert.ok(r.files.some(f=>f.nodeIds.includes(draft.nodes[0].id)));const moved=parsePersonalFiles(await read(await call('owner','PATCH',change(r,[u.id],currentDraft.nodes[0].id,'move',draft.nodes[0].id))))!;assert.deepEqual(moved.files.find(f=>f.id===u.id)!.nodeIds,[currentDraft.nodes[0].id]);assert.deepEqual(await bytes(u.id),old);
 assert.equal((await d1.prepare("select cast(payload as text) as payload from case_drafts where version='1.0.0'").first<{payload:string}>())!.payload,oldPayload);
});
test('unsupported saved versions retain owner raw-original recovery with no template substitution',async()=>{
 const r=await registry(),id=r.files[0].id,original=await bytes(id);const unknown=JSON.stringify({...currentDraft,futureCarrier:{exact:'preserve-me'}});await d1.prepare('update case_drafts set payload=? where version=?').bind(unknown,currentDraft.version).run();assert.deepEqual(await bytes(id),original);assert.equal((await registry()).files.length,r.files.length);await read(await call('owner','POST',form(r.revision)),409);await read(await call('foreign','GET',undefined,id),404);
 assert.equal((await d1.prepare('select cast(payload as text) as payload from case_drafts where version=?').bind(currentDraft.version).first<{payload:string}>())!.payload,unknown);
});

test('account deletion preserves personal originals, metadata and saved cases; ordinary cleanup still works',async()=>{
 const originals=await bucket.list(),files=await registry();
 const req=(actor:keyof typeof emails)=>new Request('https://history.test/api/me',{method:'DELETE',headers:{origin:'https://history.test','sec-fetch-site':'same-origin',cookie:cookies[actor]}});
 const owner=req('owner');const result=await read(await storage.run(owner,()=>routes.me.DELETE(owner)),409);
 assert.ok(result && typeof result==='object' && 'code' in result);assert.equal(result.code,'personal_document_retention_required');
 assert.equal((await registry()).revision,files.revision);assert.equal((await bucket.list()).objects.length,originals.objects.length);
 assert.ok(await d1.prepare('select id from custom_cases where id=1').first());
 const foreign=req('foreign');await read(await storage.run(foreign,()=>routes.me.DELETE(foreign)));
 assert.equal(await d1.prepare('select id from users where email=?').bind(emails.foreign).first(),null);
});

test('concurrent first-file ledger insertion fences every account-cleanup mutation atomically',async()=>{
 const actor='shared';const email=emails[actor];
 await d1.prepare('insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint) values(77,?,?,?,?,?)').bind(email,'qa_race','QA synthetic account retention race','1.0.0',fp).run();
 beforeBatch=async()=>{await d1.prepare("insert into audit_events(actor_email,event_type,object_type,object_id,detail) values(?,'studio_file_requested','studio_personal_files','77','{}')").bind(email).run();};
 const request=new Request('https://history.test/api/me',{method:'DELETE',headers:{origin:'https://history.test','sec-fetch-site':'same-origin',cookie:cookies[actor]}});
 await read(await storage.run(request,()=>routes.me.DELETE(request)),409);
 assert.ok(await d1.prepare('select id from users where email=?').bind(email).first());
 assert.ok(await d1.prepare('select id from custom_cases where id=77').first());
 assert.ok(await d1.prepare('select id from custom_case_grants where recipient_email=?').bind(email).first());
 assert.ok(await d1.prepare("select id from audit_events where object_type='studio_personal_files' and object_id='77'").first());
});

test('link overflow is refused before appending metadata; originals and registry stay recoverable',async()=>{
 await d1.prepare('update case_drafts set payload=? where version=?').bind(JSON.stringify(currentDraft),currentDraft.version).run();
 const original=await registry(),file=original.files[0];
 const actor=await d1.prepare('select actor_id as id from users where email=?').bind(emails.owner).first<{id:string}>();
 await d1.prepare("insert into audit_events(actor_email,event_type,object_type,object_id,detail) values(?,'studio_file_links','studio_personal_files','1',?)").bind(emails.owner,JSON.stringify({actorId:actor!.id,changes:[{fileId:file.id,nodeIds:Array.from({length:200},(_,i)=>'qa_retained_'+i)}]})).run();
 const before=await registry(),oldBytes=await bytes(file.id);
 await read(await call('owner','PATCH',change(before,[file.id],currentDraft.nodes[0].id)),409);
 assert.equal((await registry()).revision,before.revision);assert.deepEqual(await bytes(file.id),oldBytes);
});
test('bounded ledger reserves finalization space and refuses new mutations without losing recovery',async()=>{
 const initial=await registry(),file=initial.files[0],oldBytes=await bytes(file.id);
 const actor=await d1.prepare('select actor_id as id from users where email=?').bind(emails.owner).first<{id:string}>();
 const count=await d1.prepare("select count(*) as n from audit_events where object_type='studio_personal_files' and object_id='1'").first<{n:number}>();
 await d1.prepare("with recursive n(x) as (select 1 union all select x+1 from n where x<?) insert into audit_events(actor_email,event_type,object_type,object_id,detail) select ?,'studio_file_ready','studio_personal_files','1',? from n").bind(900-count!.n,emails.owner,JSON.stringify({actorId:actor!.id,fileId:file.id})).run();
 const before=await registry(),objects=await bucket.list();
 await read(await call('owner','PATCH',change(before,[file.id],currentDraft.nodes[0].id)),409);
 await read(await call('owner','POST',form(before.revision)),409);
 assert.equal((await registry()).revision,before.revision);assert.equal((await bucket.list()).objects.length,objects.objects.length);assert.deepEqual(await bytes(file.id),oldBytes);
});
