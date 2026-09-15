import assert from "node:assert/strict";
import test from "node:test";
import { invitationRecipientIssue, organizationIssue, validOrganizationReceipt } from "../app/organizations/organization-admin-model";

const actor="actor_00000000000000000001", recipient="actor_00000000000000000002";
test("invitation validation directs self and existing members to their supported action",()=>{
  assert.equal(invitationRecipientIssue(` ${actor} `,actor,[]),"invitation_self");
  assert.equal(invitationRecipientIssue("email@example.test",actor,[]),"invitation_fields_invalid");
  for(const [status,code] of [["active","invitation_member_exists"],["suspended","invitation_member_suspended"],["removed","invitation_member_removed"]]){
    assert.equal(invitationRecipientIssue(recipient,actor,[{actorId:recipient,status}]),code);
    assert.equal(organizationIssue({code,status:409,scope:"invite"},"en").recovery,"edit");
  }
  assert.equal(invitationRecipientIssue(recipient,actor,[]),null);
});
test("organization feedback separates sign-in, profile, validation, concurrency and confirmed persistence",()=>{
  for(const locale of ["en","ru"] as const){
    assert.equal(organizationIssue({code:"signin_required",status:401,scope:"invite"},locale).recovery,"signin");
    assert.equal(organizationIssue({code:"profile_required",status:403,scope:"page"},locale).recovery,"profile");
    assert.equal(organizationIssue({code:"invitation_fields_invalid",status:400,scope:"invite"},locale).recovery,"edit");
    assert.equal(organizationIssue({code:"membership_changed",status:409,scope:"member"},locale).recovery,"refresh");
    assert.equal(organizationIssue({code:"network",status:0,scope:"page",refreshOnly:true},locale).recovery,"refresh");
  }
  for(const status of [0,401]){
    const en=organizationIssue({code:"network",status,scope:"page",refreshOnly:true},"en").message;
    assert.match(en,/saved/);assert.match(en,/not submit/);
  }
  assert.doesNotMatch(organizationIssue({code:"arbitrary-private-error",status:500,scope:"page"},"en").message,/arbitrary-private-error/);
});
test("organization success receipts must match the actor, selection, active state and revisions",()=>{
  const value={id:"org_00000000000000000001",actorId:actor,name:"Example",status:"active",revision:2,membershipRevision:1,selection:`org_00000000000000000001.2.1.${actor}`};
  assert.equal(validOrganizationReceipt(value,actor,value.id),true);
  assert.equal(validOrganizationReceipt(value,recipient),false);
  assert.equal(validOrganizationReceipt(value,actor,"org_00000000000000000002"),false);
  for(const patch of [{status:"suspended"},{revision:3},{selection:"forged"},{membershipRevision:0},{actorId:recipient}])assert.equal(validOrganizationReceipt({...value,...patch},actor),false);
});
