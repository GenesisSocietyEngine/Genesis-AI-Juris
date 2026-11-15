import {test} from "node:test";
import assert from "node:assert/strict";
import {matchesTaskScope} from "../app/work/TaskScopeFilter";

test("task scope intersects a named case or lead with its lifecycle",()=>{
  const rows=[
    {caseId:"case-open",caseStatus:"active"},
    {caseId:"case-closed",caseStatus:"declined"},
    {caseId:"",leadId:"lead-open",leadActive:true},
    {caseId:"",leadId:"lead-former",leadActive:false},
    {caseId:""},
  ];
  const select=(scope:string,lifecycle:string)=>rows.filter(row=>matchesTaskScope(row,scope,lifecycle));
  assert.deepEqual(select("","all"),rows);
  assert.deepEqual(select("","open"),[rows[0],rows[2]]);
  assert.deepEqual(select("","closed"),[rows[1],rows[3]]);
  assert.deepEqual(select("lead-open","open"),[rows[2]]);
  assert.deepEqual(select("case-closed","open"),[]);
  assert.deepEqual(select("lead-former","closed"),[rows[3]]);
  assert.deepEqual(select("firm","all"),[rows[4]]);
  assert.deepEqual(select("firm","closed"),[]);
});
