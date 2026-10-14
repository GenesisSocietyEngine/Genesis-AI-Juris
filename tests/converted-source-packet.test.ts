import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import bundle from "../app/canonical-case-bundle.json";
import { buildConvertedExample } from "../app/converted-examples";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { readStudioAggregate } from "../app/studio-aggregate";
import { buildConvertedSourcePacket, prepareConvertedSourcePacketDownload, openConvertedMessageFragment } from "../app/converted-source-packet";

const counts:Record<string,[number,number]>={be_commercial_failed_erp_001:[31,5],be_commercial_logistics_001:[0,5],greenfire_first_72_hours:[7,7],nl_food_safety_goldenshell_001:[10,13],us_environmental_desert_water_001:[10,13]};
for(const [id,[messageCount,gapCount]] of Object.entries(counts)) for(const locale of ["en","ru"] as const) test(`${id} ${locale}: exact original fictional messages, explicit missing documents and lossless packet export`,async()=>{
  const original=JSON.stringify(bundle), draft=createExampleWorkingCopy(buildConvertedExample(id,locale)), before=JSON.stringify(draft);
  const packet=await buildConvertedSourcePacket(draft);assert.ok(packet);
  assert.equal(packet.messages.length,messageCount);assert.equal(packet.missingDocuments.length,gapCount);
  assert.equal(packet.professionalReview,"not_recorded");assert.equal(packet.template.version,"2.4.0");
  const source=bundle.cases.find(item=>item.case_id===id)!;
  assert.equal(packet.originalSource.scenarioFingerprint,source.scenario_fingerprint);
  const fragments=new Set<string>();
  for(const message of packet.messages){
    const raw=source.scenario.inbox_items.find(item=>item.id===message.originalId)!;
    assert.equal(message.text,raw.body);assert.equal(message.contentSha256,"sha256:"+createHash("sha256").update(raw.body,"utf8").digest("hex"));
    assert.equal(message.status,raw.initially_visible?"fictional_opening_correspondence":"hypothetical_later_correspondence_not_received");
    assert.equal(message.workingRecordState,"body_and_reference_present");assert.ok(!fragments.has(message.fragmentId));fragments.add(message.fragmentId);
    assert.ok(draft.nodes.find(node=>node.id===message.recordId)?.detail.includes(message.citation));
  }
  assert.ok(packet.missingDocuments.every(document=>document.originalBodySupplied===false));
  if(id==="be_commercial_failed_erp_001")assert.deepEqual(packet.excludedTrainingMessageIds,["client_inactivity_warning","client_final_inactivity_warning","client_terminated_engagement"]);
  const json=await prepareConvertedSourcePacketDownload(draft,"json",()=>true);assert.ok(json);assert.deepEqual(JSON.parse(json.content),packet);
  assert.notEqual(readStudioAggregate(json.content,{kind:"draft"}).status,"supported","reference packets cannot be normalized into editable Studio cases");
  const markdown=await prepareConvertedSourcePacketDownload(draft,"md",()=>true);assert.ok(markdown);
  for(const message of packet.messages){assert.ok(markdown.content.includes(message.text));assert.ok(markdown.content.includes(message.contentSha256));}
  assert.deepEqual(await buildConvertedSourcePacket(JSON.parse(before)),packet);
  assert.equal(JSON.stringify(draft),before);assert.equal(JSON.stringify(bundle),original);
});

test("historic, future and forged references receive no replacement packet; stale export is suppressed",async()=>{
  for(const version of ["2.2.0","2.3.0"]){const old=createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours","en",undefined,version));assert.equal(await buildConvertedSourcePacket(old),null);}
  const draft=createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours","en"));
  for(const update of [{version:"99.0.0"},{caseId:"unknown"},{fingerprint:"sha256-"+"0".repeat(64)}]){const changed=structuredClone(draft);Object.assign(changed.exampleSource!,update);assert.equal(await buildConvertedSourcePacket(changed),null);}
  assert.equal(await prepareConvertedSourcePacketDownload(draft,"json",()=>false),null);
  let calls=0;assert.equal(await prepareConvertedSourcePacketDownload(draft,"json",()=>++calls===1),null);
});

test("working amendments never replace original message bytes or imply acceptance",async()=>{
  const draft=createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours","en"));
  const original=await buildConvertedSourcePacket(draft);assert.ok(original);
  const target=original.messages[0];draft.nodes.find(node=>node.id===target.recordId)!.detail="A user amendment, not original source text.";
  const changed=await buildConvertedSourcePacket(draft);assert.ok(changed);
  assert.equal(changed.messages[0].text,target.text);assert.equal(changed.messages[0].contentSha256,target.contentSha256);
  assert.equal(changed.messages[0].workingRecordState,"body_or_reference_changed");assert.equal(changed.workingContentChanged,true);
  assert.equal(changed.professionalReview,"not_recorded");
  const document=original.missingDocuments.find(item=>item.premiseRecordIds.length)!;
  const removed=document.premiseRecordIds[0];draft.nodes=draft.nodes.filter(node=>node.id!==removed);
  const missing=await buildConvertedSourcePacket(draft);assert.ok(missing);
  const retained=missing.missingDocuments.find(item=>item.id===document.id)!;
  assert.deepEqual(retained.premiseRecordIds,document.premiseRecordIds,"original premise IDs must survive working deletion");
  assert.ok(retained.workingPremises.some(item=>item.id===removed&&item.state==="missing"));
});

test("exact message jump opens/focuses only the retained section; missing or unsafe fragment fails",()=>{
  const id="studio-message-"+"a".repeat(64),events:string[]=[],details={open:false};
  const fragment={closest:()=>details,focus:()=>events.push("focus"),scrollIntoView:()=>events.push("scroll")};
  const root={querySelector:(selector:string)=>{assert.equal(selector,`[id="${id}"]`);return fragment;}};
  assert.equal(openConvertedMessageFragment(root as unknown as HTMLElement,id),true);assert.equal(details.open,true);assert.deepEqual(events,["focus","scroll"]);
  assert.equal(openConvertedMessageFragment({querySelector:()=>null},id),false);assert.equal(openConvertedMessageFragment(root as unknown as HTMLElement,'unsafe"]'),false);
});
