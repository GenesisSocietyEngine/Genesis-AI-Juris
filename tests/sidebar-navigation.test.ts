import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NavigationController } from '../app/navigation-controller';
import { WorkspaceController } from '../app/matters/workspace-controller';
import type { ClientOrganization } from '../app/organization-client';
const actor='actor_synthetic_sidebar_owner';
const org=(suffix:string,role='org_owner'):ClientOrganization=>({id:'org_synthetic_sidebar_'+suffix,name:'Synthetic '+suffix,kind:'team',status:'active',role,revision:1,membershipRevision:1,actorId:actor,selection:'org_synthetic_sidebar_'+suffix+'.1.1.'+actor});
const a=org('a'),b=org('b');
const payload=()=>({authenticated:true,identity:{displayName:'Synthetic owner',email:'sidebar@example.test',authSource:'chatgpt'},actorId:actor,organizations:[a,b],selected:a,profileRequired:false});
function harness() {
 const calls:Array<{path:string;init?:RequestInit}>=[],leaves:string[]=[];
 let respond:(path:string,init?:RequestInit)=>Promise<Response>=async(path)=>Response.json(path==='/api/organizations'?{organization:b}:payload());
 let cleanup=0;
 const nav=new NavigationController({transport:(path,init)=>{calls.push({path,init});return respond(path,init);},leave:url=>leaves.push(url),clear:()=>{cleanup++;}});
 return {nav,calls,leaves,setResponse:(next:typeof respond)=>{respond=next;},cleanup:()=>cleanup};
}
const deferred=()=>{let resolve!:(value:Response)=>void;return {promise:new Promise<Response>(r=>{resolve=r;}),resolve:(r:Response)=>resolve(r)};};
test('sidebar switch blocks dirty and uncertain work, validates receipt and clears case context',async()=>{
 const h=harness();await h.nav.refresh(a.selection);let risk:'clear'|'dirty'|'pending'='dirty',denied=0;
 h.nav.register({}, {risk:()=>risk,suspend:()=>{},deny:()=>{denied++;}});
 assert.equal(await h.nav.select(b.id,'en'),'dirty');assert.equal(h.calls.length,1);
 risk='pending';assert.equal(await h.nav.select(b.id,'en',true),'pending');assert.equal(h.calls.length,1);
 risk='dirty';await h.nav.select(b.id,'en',true);
 assert.deepEqual(h.leaves,['/matters?organization='+encodeURIComponent(b.selection)+'&lang=en']);
 assert.equal(denied,1);assert.equal(h.cleanup(),1);assert.equal(h.nav.getSnapshot().identity,null);
 assert.deepEqual(JSON.parse(h.calls[1].init!.body as string),{action:'select',organizationId:b.id});
});
test('sidebar expired switch releases the actual B1 departure lock before recovery',async()=>{
 const h=harness();await h.nav.refresh();
 const owner=new WorkspaceController({identity:{actorId:actor,organizationId:a.selection},transport:async()=>Response.json({})});
 const stop=h.nav.registerWorkspace(owner);
 const post=deferred();h.setResponse(()=>post.promise);const switching=h.nav.select(b.id,'en');
 assert.equal(owner.busy,true);assert.equal(await owner.createCase({title:'Synthetic',idempotencyKey:'no-post'}),null);
 post.resolve(Response.json({}, {status:401}));await switching;
 assert.equal(h.nav.getSnapshot().phase,'expired');assert.equal(owner.busy,false);assert.equal(h.nav.risk(),'clear');
 h.setResponse(async()=>Response.json(payload()));await h.nav.refresh();
 assert.equal(h.nav.getSnapshot().phase,'ready');assert.equal(owner.busy,false);stop();owner.dispose();
});
test('sidebar 401 then 500 hides identity and late success cannot resurrect it',async()=>{
 const h=harness();await h.nav.refresh();const old=deferred();h.setResponse(()=>old.promise);const pending=h.nav.refresh();
 h.nav.invalidate('expired');old.resolve(Response.json(payload()));await pending;
 assert.equal(h.nav.getSnapshot().phase,'expired');assert.equal(h.nav.getSnapshot().identity,null);
 h.setResponse(async()=>Response.json({}, {status:500}));await h.nav.refresh();
 assert.equal(h.nav.getSnapshot().phase,'expired');assert.deepEqual(h.nav.getSnapshot().organizations,[]);
});
test('sidebar authority generation is stable for focus refresh but rejects account and membership loss',async()=>{
 const h=harness();await h.nav.refresh();const generation=h.nav.authorityVersion;
 await h.nav.refresh();assert.equal(h.nav.authorityVersion,generation);
 h.setResponse(async()=>Response.json({...payload(),selected:null,selectionIssue:'organization_unavailable'}));await h.nav.refresh();
 assert.equal(h.nav.getSnapshot().phase,'denied');assert.ok(h.nav.authorityVersion>generation);
 const other=harness();await other.nav.refresh();other.setResponse(async()=>Response.json({...payload(),actorId:'actor_different_synthetic'}));await other.nav.refresh();
 assert.equal(other.nav.getSnapshot().phase,'denied');assert.equal(other.nav.getSnapshot().identity,null);
});
test('sidebar failed or wrong-actor switch preserves the old workspace without navigation',async()=>{
 for(const response of [()=>Response.json({}, {status:403}),()=>Response.json({organization:{...b,actorId:'wrong'}})]){
  const h=harness();await h.nav.refresh();h.setResponse(async()=>response());await h.nav.select(b.id,'en');
  assert.equal(h.nav.getSnapshot().selected?.id,a.id);assert.equal(h.nav.getSnapshot().busy,false);assert.deepEqual(h.leaves,[]);assert.match(h.nav.getSnapshot().issue,/not be confirmed/);
 }
});
test('sidebar sign-out tolerates unavailable device storage and hides private data on failure',async()=>{
 const leaves:string[]=[];const nav=new NavigationController({transport:async(path)=>path==='/api/auth/logout'?new Response(null,{status:204}):Response.json(payload()),clear:()=>{throw Error('storage');},leave:url=>leaves.push(url)});
 await nav.refresh();await nav.signOut('en');assert.deepEqual(leaves,['/signout-with-chatgpt?return_to=%2Fstudio%3Flang%3Den']);
 const h=harness();await h.nav.refresh();h.setResponse(async()=>Response.json({}, {status:500}));await h.nav.signOut('en');
 assert.equal(h.nav.getSnapshot().phase,'expired');assert.equal(h.nav.getSnapshot().identity,null);assert.deepEqual(h.leaves,[]);assert.equal(h.nav.canRetrySignOut,true);
});
test('sidebar operation ownership survives cancel, close, and revisit with its original recovery key',async()=>{
 const h=harness();await h.nav.refresh();
 const owner=new WorkspaceController({identity:{actorId:actor,organizationId:a.selection},transport:async(raw)=>{
  const path=new URL(raw,"https://test.invalid").pathname;
  if(path.endsWith('/dispositions'))return Response.json({actor_id:actor,kind:'deadline',revision:7,can_review:true,disposition:null,readiness_effect:'Synthetic',record:{id:'deadline_a',title:'Synthetic deadline'},dependent_assertions:[],current_output_ids:[]});
  if(path==='/api/organizations')return Response.json({selected:{actorId:actor,selection:a.selection,status:'active'}});
  if(path==='/api/dossiers/case_a')return Response.json({dossier:{dossier_id:'case_a',title:'Synthetic',revision:7,readiness:{dimensions:[]}}});
  return Response.json({documents:[],source_anchors:[],assertions:[],proposals:[],requests:[],deadlines:[],snapshots:[],outputs:[],events:[],decision_packages:[]});
 }});
 const stop=h.nav.registerWorkspace(owner);owner.enter('case_a');await owner.load();await owner.openReview('deadline','deadline_a');
 const review=owner.getSnapshot().panel!;review.setDraft({reason:'Synthetic reason',support:'',status:'completed'});await review.save();
 assert.equal(review.getSnapshot().phase,'unknown');const operation=review.getSnapshot().operation;
 owner.returnToActions();assert.equal(await h.nav.select(b.id,'en',true),'pending');assert.equal(h.calls.length,1);
 h.nav.reviewPending();await new Promise(r=>setImmediate(r));assert.equal(owner.getSnapshot().panel,review);assert.equal(review.getSnapshot().operation,operation);assert.deepEqual(h.leaves,[]);stop();owner.dispose();
});
test('sidebar dirty comparison clears when the actual B1 input returns to its baseline',()=>{
 const owner=new WorkspaceController({identity:{actorId:actor,organizationId:a.selection},transport:async()=>Response.json({})});
 owner.rememberDraft('title','Changed','Original');assert.equal(owner.departureRisk(),'dirty');
 owner.rememberDraft('title','Original','Original');assert.equal(owner.departureRisk(),'clear');owner.dispose();
});

test('sidebar selected authorization loss also hides non-B1 scoped consumers',async()=>{
 const h=harness();await h.nav.refresh();let denied=0;
 h.nav.register({}, {risk:()=> 'clear',suspend:()=>{},deny:()=>{denied++;}});
 h.setResponse(async()=>Response.json({...payload(),selected:null,selectionIssue:'organization_unavailable'}));await h.nav.refresh();
 assert.equal(denied,1);assert.equal(h.nav.getSnapshot().selected,null);assert.equal(h.nav.getSnapshot().phase,'denied');
});

test('logout bypasses pending work, hides immediately, rejects late switch and permits retry',async()=>{
 const h=harness();await h.nav.refresh();let suspended=0,denied=0,risk:'clear'|'pending'='clear';
 h.nav.register({}, {risk:()=>risk,suspend:()=>{suspended++;},deny:()=>{denied++;}});
 const switching=deferred(),logout=deferred();h.setResponse(path=>path==='/api/auth/logout'?logout.promise:switching.promise);
 const switchPromise=h.nav.select(b.id,'en');risk='pending';const oldAuthority=h.nav.authorityVersion;
 const ending=h.nav.signOut('en');
 assert.equal(h.nav.getSnapshot().endingSession,true);assert.equal(h.nav.getSnapshot().identity,null);assert.ok(h.nav.authorityVersion>oldAuthority);assert.equal(suspended,1);
 switching.resolve(Response.json({organization:b}));await switchPromise;assert.deepEqual(h.leaves,[]);
 logout.resolve(Response.json({}, {status:503}));await ending;
 const callCount=h.calls.length;await h.nav.refresh();assert.equal(h.calls.length,callCount);assert.equal(h.nav.getSnapshot().endingSession,true);assert.equal(h.nav.canRetrySignOut,true);
 h.setResponse(async()=>new Response(null,{status:204}));await h.nav.signOut('en');assert.equal(denied,1);assert.equal(h.leaves.length,1);
});
test('local form failure cannot trap session termination',async()=>{
 const h=harness();await h.nav.refresh();h.nav.register({}, {risk:()=> 'pending',suspend:()=>{throw Error('local form failed');},deny:()=>{throw Error('local cleanup failed');}});
 h.setResponse(async()=>new Response(null,{status:204}));await h.nav.signOut('en');assert.equal(h.leaves.length,1);assert.equal(h.calls.filter(c=>c.path==='/api/auth/logout').length,1);
});
test('failed authority check invalidates old private response tickets before recovery',async()=>{
 const h=harness();await h.nav.refresh();const authority=h.nav.authorityVersion;
 h.setResponse(async()=>Response.json({}, {status:500}));await h.nav.refresh();assert.ok(h.nav.authorityVersion>authority);
 h.setResponse(async()=>Response.json(payload()));await h.nav.refresh();assert.equal(h.nav.getSnapshot().phase,'ready');assert.notEqual(h.nav.authorityVersion,authority);
});

test("reload warning protects drafts while explicit departure and sign-out remain available",async()=>{
  const navigation=new NavigationController({transport:async()=>Response.json({},{status:500}),leave:()=>{},clear:()=>{}});
  navigation.register({}, {risk:()=>"pending",suspend:()=>{},deny:()=>{}});assert.equal(navigation.warnBeforeUnload(),true);await navigation.signOut("en");assert.equal(navigation.warnBeforeUnload(),false);
  const next=new NavigationController({transport:async()=>Response.json({}),leave:()=>{},clear:()=>{}});next.register({}, {risk:()=>"dirty",suspend:()=>{},deny:()=>{}});assert.equal(next.warnBeforeUnload(),true);next.approvePageDeparture();assert.equal(next.warnBeforeUnload(),false);
});
