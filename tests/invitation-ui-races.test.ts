import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { invitationFromFragment, parseInvitationContinuation, INVITATION_CONTINUATION_KEY } from "../app/invitation-client";

// Execute the real component handlers with deferred transport. This proves
// response fencing, not browser focus/layout or actual mailbox delivery.
const file = ts.createSourceFile("InvitationClient.tsx", readFileSync("app/invitations/InvitationClient.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let installer = "", action = "";
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(file) === "install") installer = node.initializer!.getText(file);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "act") action = node.getText(file);
  ts.forEachChild(node, visit);
}
visit(file); assert.ok(installer && action);
const compiled = ts.transpileModule(`return function({window,postInvitation,invitationFromFragment,parseInvitationContinuation,INVITATION_CONTINUATION_KEY}) {
  let continuation=null, preview=null, previewEpoch=1, consent=true, accepted=null, issue='', notice='';
  const active={current:true},pending={current:false},continuationGeneration={current:0},title={current:null};
  const navigation={authorityVersion:1,invalidate(){}},session={actorId:'actor_synthetic'},locale='en';
  const t=(en)=>en,invitationDeliveryText=()=> 'provider result',validOrganizationReceipt=()=>true;
  const setContinuation=value=>{continuation=value;},setPreview=value=>{preview=value;},setConsent=value=>{consent=value;};
  const setAccepted=value=>{accepted=value;},setIssue=value=>{issue=value;},setNotice=value=>{notice=value;};
  const setBusy=()=>{},setReady=()=>{},setStorageUnavailable=()=>{};
  const install=${installer}; ${action}
  return {install,act,ready(){preview={organizationId:'org_synthetic_A'};consent=true;},state(){return {continuation,accepted,issue,notice};}};
}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const create = new Function(compiled)();

for (const action of ["verify", "accept"] as const) for (const outcome of ["success", "failure"] as const) {
  test(`late ${action} ${outcome} for A cannot change B or erase B's continuation`, async () => {
    const tokenA = "a".repeat(43), tokenB = "b".repeat(43), proof = "c".repeat(43);
    const stored = new Map<string,string>();
    const window = { location: {hash:`#invite=${tokenA}&proof=${proof}`,pathname:"/invitations",search:""}, history: {state:null, replaceState(){window.location.hash="";}},
      sessionStorage:{getItem:(key:string)=>stored.get(key),setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)} };
    let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
    const h = create({window,postInvitation:()=>new Promise((yes,no)=>{resolve=yes;reject=no;}),invitationFromFragment,parseInvitationContinuation,INVITATION_CONTINUATION_KEY});
    h.install(); h.ready(); const pending = h.act(action);
    window.location.hash=`#invite=${tokenB}`; h.install();
    if(outcome==="success") resolve({response:{ok:true},data:{organization:{selection:"org_A"},delivery:"provider_accepted"}}); else reject(new Error("old error"));
    await pending;
    assert.equal(h.state().continuation.token,tokenB);
    assert.equal(h.state().accepted,null); assert.equal(h.state().notice,""); assert.equal(h.state().issue,"");
    assert.equal(JSON.parse(stored.get(INVITATION_CONTINUATION_KEY)!).token,tokenB);
  });
}
