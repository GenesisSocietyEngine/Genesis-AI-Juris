import test from "node:test";
import assert from "node:assert/strict";
import { organizationWorkspaceUrl, scopedOrganizationHeaders, setOrganizationSelection } from "../app/organization-client";

test("private workspace navigation retains the selected organization without scoping external links",()=>{
 setOrganizationSelection("org-A.exact-selection");
 try {
  assert.equal(organizationWorkspaceUrl("/canopy"),"/canopy?organization=org-A.exact-selection");
  assert.equal(organizationWorkspaceUrl("/matters?dossier=copy-A&organization=org-B#reports"),"/matters?dossier=copy-A&organization=org-A.exact-selection#reports");
  assert.equal(scopedOrganizationHeaders()["x-genesis-organization"],"org-A.exact-selection");
  assert.equal(organizationWorkspaceUrl("https://unrelated.example/matters"),"https://unrelated.example/matters");
 }finally{setOrganizationSelection("");}
});
