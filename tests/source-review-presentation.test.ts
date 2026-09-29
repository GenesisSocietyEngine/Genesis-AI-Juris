import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeActivity, normalizeDocuments } from "../app/matters/matter-view-model";
import { focusSourceCitation, recordedDocumentAcceptance } from "../app/matters/source-review-presentation";

const document = normalizeDocuments({ documents: [{document_id:"doc_a",title:"Synthetic source",status:"accepted_source",current_version_id:"version_2"}],
  document_versions:[{document_id:"doc_a",document_version_id:"version_1",ordinal:1},{document_id:"doc_a",document_version_id:"version_2",ordinal:2}] })[0];
const event = { audit_event_id:"audit_a",event_type:"dossier_updated",object_ref_type:"document",object_ref_id:"doc_a",summary_code:"DOCUMENT_ACCEPTED_SOURCE",
  actor_id:"reviewer_a",occurred_at:"2026-09-28T00:00:00Z",detail:{action:"review",status:"accepted_source",current_version_id:"version_1"} };

test("logical document acceptance does not confer review on replacement bytes", () => {
  const old = recordedDocumentAcceptance(document,normalizeActivity({events:[event]}).items)!;
  assert.equal(old.current,false); assert.equal(old.version?.ordinal,1); assert.equal(old.event.id,"audit_a");
  const current = recordedDocumentAcceptance(document,normalizeActivity({events:[{...event,detail:{...event.detail,current_version_id:"version_2"}}]}).items)!;
  assert.equal(current.current,true); assert.equal(current.version?.ordinal,2);
  for (const row of [{...event,object_ref_id:"doc_other"},{...event,event_type:"source_anchor_accepted"},{...event,summary_code:"DOCUMENT_UPDATED"},
    {...event,detail:{action:"review",status:"accepted_source"}},{...event,detail:"not a record"},{...event,actor_id:null}]) {
    assert.equal(recordedDocumentAcceptance(document,normalizeActivity({events:[row],next_cursor:"more"}).items),null);
  }
  assert.equal(recordedDocumentAcceptance(document,[]),null,"missing or failed history stays unknown");
});

test("source focus selects the exact container, including repeated activation, and never its review control", () => {
  const focused:string[]=[];
  const root = {getElementById(id:string) {return ["source_pending","source_retired"].map(x=>"source-"+x).includes(id) ? {focus(){focused.push(id);},querySelector(){throw Error("must not focus a review action");}} as unknown as HTMLElement : null;}};
  const click={button:0,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,defaultPrevented:false};
  assert.equal(focusSourceCitation(click,"source_pending",root),true);
  assert.equal(focusSourceCitation(click,"source_pending",root),true);
  assert.equal(focusSourceCitation(click,"source_retired",root),true);
  assert.equal(focusSourceCitation(click,"missing",root),false);
  for(const change of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}]) assert.equal(focusSourceCitation({...click,...change},"source_pending",root),false);
  assert.deepEqual(focused,["source-source_pending","source-source_pending","source-source_retired"]);
});
