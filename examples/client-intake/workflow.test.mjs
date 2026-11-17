import test from "node:test";
import assert from "node:assert/strict";
import {createWorkflow,client,staff} from "./workflow.mjs";

test("intake, authorization and explicit signature bind one version and recipient", () => {
  const f=createWorkflow();
  assert.throws(()=>f.authorize(staff,1));
  assert.throws(()=>f.submit("other",1,"answer"));
  assert.throws(()=>f.submit(client,1," "));
  const intake=f.submit(client,1,"Synthetic answer");
  assert.equal(f.submit(client,1,"Synthetic answer"),intake);
  assert.throws(()=>f.submit(client,1,"Replacement"));
  assert.throws(()=>f.sign(client,1,true));
  assert.throws(()=>f.authorize(client,1));
  const permission=f.authorize(staff,1);
  assert.throws(()=>f.sign(client,1,false));
  assert.throws(()=>f.sign("other",1,true));
  const signature=f.sign(client,1,true);
  assert.equal(signature.authorizationSequence,permission.sequence);
  assert.equal(signature.intakeSequence,intake.sequence);
  assert.equal(signature.documentText,f.view(client).text);
  assert.equal(f.sign(client,1,true),signature);
  assert.equal(f.view(staff).history.length,3);
});
test("revision invalidates outstanding authorization and revocation preserves staff evidence",()=>{
  const f=createWorkflow(); f.submit(client,1,"QA"); f.authorize(staff,1);
  f.revise(staff);
  assert.throws(()=>f.sign(client,1,true)); assert.throws(()=>f.sign(client,2,true));
  assert.equal(f.view(client).intake,undefined);
  f.submit(client,2,"QA 2"); f.authorize(staff,2); f.revoke(staff);
  assert.equal(f.view(client),null); assert.equal(f.view("other"),null);
  assert.throws(()=>f.sign(client,2,true)); assert.throws(()=>f.submit(client,2,"QA 2"));
  assert.equal(f.view(staff).history.at(-1).action,"revoke");
});
