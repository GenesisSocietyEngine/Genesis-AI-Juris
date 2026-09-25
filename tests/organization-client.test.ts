import test from "node:test";
import assert from "node:assert/strict";
import { organizationWorkspaceUrl, scopedOrganizationHeaders, setOrganizationSelection } from "../app/organization-client";
import { organizationDisplayLabel } from "../app/organization-label";
import type { ClientOrganization } from "../app/organization-client";

test("same-name personal workspaces show relationship and actual role, with stable duplicate references",()=>{
 const actorId="actor_synthetic_viewer";
 const organization=(id:string,role:string):ClientOrganization=>({id,actorId,role,name:"Personal workspace",kind:"personal",status:"active",revision:1,membershipRevision:1,selection:`${id}.1.1.${actorId}`});
 const own=organization(`org_personal_${actorId}`,"org_owner"), shared=organization("org_personal_actor_other123456","member"), another=organization("org_personal_actor_different123456","member");
 const peers=[own,shared,another];
 assert.equal(organizationDisplayLabel(own,peers,"en"),"Personal workspace · Your workspace · Owner");
 assert.match(organizationDisplayLabel(shared,peers,"en"),/Shared workspace · Member/);
 assert.notEqual(organizationDisplayLabel(shared,peers,"en"),organizationDisplayLabel(another,peers,"en"));
 assert.equal(organizationDisplayLabel(shared,[...peers].reverse(),"en"),organizationDisplayLabel(shared,peers,"en"));
 assert.match(organizationDisplayLabel(own,peers,"ru"),/Ваше пространство · Владелец/);
 const team={...shared,kind:"team",name:"Team",role:"auditor"};
 assert.equal(organizationDisplayLabel(team,[team],"en"),"Team · Auditor");
});

test("private workspace navigation retains the selected organization without scoping external links",()=>{
 setOrganizationSelection("org-A.exact-selection");
 try {
  assert.equal(organizationWorkspaceUrl("/canopy"),"/canopy?organization=org-A.exact-selection");
  assert.equal(organizationWorkspaceUrl("/matters?dossier=copy-A&organization=org-B#reports"),"/matters?dossier=copy-A&organization=org-A.exact-selection#reports");
  assert.equal(scopedOrganizationHeaders()["x-genesis-organization"],"org-A.exact-selection");
  assert.equal(organizationWorkspaceUrl("https://unrelated.example/matters"),"https://unrelated.example/matters");
 }finally{setOrganizationSelection("");}
});
