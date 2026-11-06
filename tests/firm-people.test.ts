import test from "node:test";
import assert from "node:assert/strict";
import {firmPeople} from "../app/work/firm-people";
import type {FirmCase} from "../app/work/work-controller";
const matter=(id:string,actorId:string|null,name="Alex",active=true):FirmCase=>({id,title:id,plan:{revision:0,items:[]},participants:[{id:"same-local-id",actorId,name,active}]});
test("people group only exact accounts and preserve case-local identities despite equal names and participant IDs",()=>{
 const rows=firmPeople([matter("a","actor-a"),matter("b","actor-a","Alexander"),matter("c",null),matter("d",null),matter("e","actor-b")]);
 assert.equal(rows.length,4);const linked=rows.find(row=>row.actorId==="actor-a")!;assert.deepEqual(linked.names,["Alex","Alexander"]);assert.deepEqual(linked.memberships.map(m=>m.caseId),["a","b"]);
});
test("participant status filters membership rather than globally declaring an account inactive",()=>{
 const cases=[matter("active","actor-a"),matter("former","actor-a","Alex",false)];
 assert.deepEqual(firmPeople(cases).flatMap(p=>p.memberships.map(m=>m.caseId)),["active"]);
 assert.deepEqual(firmPeople(cases,"inactive").flatMap(p=>p.memberships.map(m=>m.caseId)),["former"]);
 assert.equal(firmPeople(cases,"all")[0].memberships.length,2);assert.deepEqual(firmPeople([],"all"),[]);
});
