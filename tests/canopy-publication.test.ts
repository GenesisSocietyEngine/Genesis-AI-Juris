import test from "node:test";
import assert from "node:assert/strict";
import { CanopyWorkingCopy, type CanopyTransport } from "../app/canopy-workflow";

test("Canopy reports missing publication and discovers the matching version after publication without writing",async()=>{
 const calls:Array<{path:string;init?:RequestInit}>=[];
 let published:Record<string,unknown>|null=null;
 const transport:CanopyTransport=async(path,init)=>{
  calls.push({path,init});
  return published?Response.json(published):Response.json({error:"Case not found."},{status:404});
 };
 const copy=new CanopyWorkingCopy(transport,"synthetic-copy");
 const {draft,scenario}=copy.package("base");
 assert.deepEqual(await copy.publicationStatus("base"),{state:"missing",caseId:draft.caseId,version:draft.version});
 published={caseId:draft.caseId,currentVersion:draft.version,fingerprint:scenario.fingerprint};
 assert.equal((await copy.publicationStatus("base")).state,"ready");
 assert.equal(calls.length,2);
 for(const call of calls){
  assert.equal(call.path,"/api/catalog/"+draft.caseId+"?version="+draft.version);
  assert.equal(call.init?.method??"GET","GET");
  assert.equal(call.init?.body,undefined);
  assert.equal(call.init?.cache,"no-store");
  assert.equal(new Headers(call.init?.headers).get("X-GENESIS-Expected-Fingerprint"),scenario.fingerprint);
 }
});

test("Canopy does not mistake another case, version or fingerprint for the pinned package",async()=>{
 let wire:Record<string,unknown>={};
 const copy=new CanopyWorkingCopy(async()=>Response.json(wire),"synthetic-copy");
 const {draft,scenario}=copy.package("upside");
 const expected={caseId:draft.caseId,currentVersion:draft.version,fingerprint:scenario.fingerprint};
 for(const mismatch of [{caseId:"another_case"},{currentVersion:"999.0.0"},{fingerprint:"sha256-"+"0".repeat(64)}]){
  wire={...expected,...mismatch};
  assert.equal((await copy.publicationStatus("upside")).state,"mismatch");
 }
});

test("Canopy reports authorization and service errors without treating them as missing publication",async()=>{
 for(const status of [401,403,500]){
  const copy=new CanopyWorkingCopy(async()=>Response.json({error:"Unavailable"},{status}),"synthetic-copy");
  await assert.rejects(copy.publicationStatus(),new RegExp("Canopy API "+status));
 }
});

test("Canopy checks the independent scenario package rather than its linear ancestor",async()=>{
 let requested="";
 const copy=new CanopyWorkingCopy(async(path)=>{requested=path;return Response.json({},{status:404});},"synthetic-copy");
 copy.independent=true;
 copy.currentScenario="downside";
 const prepared=copy.package();
 const status=await copy.publicationStatus();
 assert.equal(status.caseId,prepared.draft.caseId);
 assert.equal(status.version,prepared.draft.version);
 assert.equal(requested,"/api/catalog/"+prepared.draft.caseId+"?version="+prepared.draft.version);
});
