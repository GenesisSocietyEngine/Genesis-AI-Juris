import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanopyPackage } from '../app/canopy-fixture';
import { createStudioEvidenceDrag } from '../app/studio-evidence-attachment';
import { fixture, elements, text, click, button } from './helpers/materials-workflow';

const drain = () => new Promise(done=>setTimeout(done,20));
test('internal drag is one-shot, refuses external/stale/denied/self targets and never mutates its source',()=>{
 const draft=buildCanopyPackage('base').draft,before=JSON.stringify(draft);
 const evidence=draft.nodes.find(n=>n.type==='evidence')!,target=draft.nodes.find(n=>n.type==='outcome')!;
 const owner=createStudioEvidenceDrag(draft,true), token=owner.begin([evidence.id,evidence.id])!;
 assert.ok(owner.canDrop(target.id));assert.equal(owner.canDrop(evidence.id),false);
 assert.equal(owner.drop('foreign-payload',target.id),null);
 assert.equal(owner.drop(token,target.id),null,'a forged completion consumes the old gesture');
 const next=owner.begin([evidence.id])!;const plan=owner.drop(next,target.id);assert.deepEqual(plan,{evidenceIds:[evidence.id],targetNodeId:target.id});
 assert.equal(owner.drop(next,target.id),null);
 assert.equal(createStudioEvidenceDrag(draft,false).begin([evidence.id]),null);
 assert.equal(createStudioEvidenceDrag({...draft},true).drop(owner.begin([evidence.id])!,target.id),null,'new context does not accept old token');
 const last=owner.begin([evidence.id])!;owner.clear();assert.equal(owner.drop(last,target.id),null);
 assert.equal(owner.begin(['not-evidence']),null);assert.equal(JSON.stringify(draft),before);
});
test('drag proposes only new connections and retains all existing connection carriers',()=>{
 const draft=buildCanopyPackage('base').draft,evidence=draft.nodes.find(n=>n.type==='evidence')!,target=draft.nodes.find(n=>n.type==='outcome')!;
 draft.links.push({id:'retained',from:evidence.id,to:target.id,rule:{detail:'Synthetic retained link',cost:42}});
 const before=JSON.stringify(draft),owner=createStudioEvidenceDrag(draft,true),token=owner.begin([evidence.id])!;
 assert.equal(owner.drop(token,target.id),null);assert.equal(JSON.stringify(draft),before);
});
for(const locale of ['en','ru'] as const)test(`${locale}: empty node exposes case evidence and keyboard attach preview without accepting it`,async()=>{
 const f=fixture(locale);
 try{
  const target=f.draft.nodes.find(n=>n.type==='outcome')!.id;f.node(target);let tree=await f.settle();
  assert.ok(text(tree).includes(locale==='en'?'No materials attached to this node yet.':'К этому узлу пока не прикреплены материалы.'));
  click(button(tree,locale==='en'?'Available in case':'Доступно в кейсе'));tree=f.render();
  assert.ok(text(tree).includes('QA synthetic evidence A'));assert.ok(text(tree).includes('QA synthetic evidence B'));
  const attach=elements(tree).find(e=>e.type==='button'&&text(e)===(locale==='en'?'Attach here…':'Прикрепить сюда…'));assert.ok(attach);click(attach);tree=f.render();
  assert.ok(text(tree).includes(locale==='en'?'Attach 1 record':'Прикрепить 1 записей'));assert.equal(f.writes.length,0);
  const before=structuredClone(f.draft);click(button(tree,locale==='en'?'Apply change':'Применить изменение'));await drain();assert.equal(f.writes.length,1);
  assert.deepEqual(f.draft.nodes,before.nodes);for(const link of before.links)assert.deepEqual(f.draft.links.find(x=>x.id===link.id),link);
  assert.ok(f.draft.links.some(link=>link.from===f.evidenceIds[0]&&link.to===target));
  assert.deepEqual({...f.draft,links:before.links},before,'all non-link carriers remain exact');
 }finally{f.close();}
});
test('dropped plan uses actual guarded preview/apply path; cancellation writes nothing',async()=>{
 for(const cancel of [true,false]){
  let cancelled=0;
  const plan={evidenceIds:[] as string[],targetNodeId:'decision-report'};
  const f=fixture('en',{plan,onPlanCancel:()=>cancelled++});f.node(undefined);plan.evidenceIds=[...f.evidenceIds];plan.targetNodeId=f.draft.nodes.find(n=>n.type==='outcome')!.id;
  try{const tree=await f.settle();assert.equal(f.writes.length,0);assert.equal(elements(tree).filter(e=>e.type==='li'&&e.props['data-material-id']).length,2);
   if(cancel){click(button(tree,'Clear selection'));assert.equal(cancelled,1);assert.equal(f.writes.length,0);assert.equal(f.verificationCalls,0);}
   else {click(button(tree,'Apply change'));await drain();assert.equal(f.writes.length,1);assert.ok(f.draft.links.some(l=>l.from===f.evidenceIds[0]&&l.to===plan.targetNodeId));}
  }finally{f.close();}
 }
});
test('read-only available evidence remains inspectable without an attachment write',async()=>{
 const f=fixture();try{f.node(f.draft.nodes.find(n=>n.type==='outcome')!.id);f.permission(false);let tree=await f.settle();click(button(tree,'Available in case'));tree=f.render();
 const attach=elements(tree).find(e=>e.type==='button'&&text(e)==='Attach here…');assert.ok(attach);assert.equal(attach.props.disabled,true);assert.equal(f.verificationCalls,0);assert.equal(f.writes.length,0);
 }finally{f.close();}
});


test('pointer gestures require movement, the same pointer and owner, and valid current evidence',()=>{
 const draft=buildCanopyPackage('base').draft,id=draft.nodes.find(n=>n.type==='evidence')!.id,target=draft.nodes.find(n=>n.type==='outcome')!.id;
 const owner=createStudioEvidenceDrag(draft,true);assert.equal(owner.startPointer([id],1,10,10),true);assert.equal(owner.pointerTarget(1,12,12,target),null);assert.equal(owner.endPointer(1,12,12,target),null,'tap is not an attachment');
 owner.startPointer([id],2,10,10);assert.equal(owner.endPointer(3,50,50,target),null,'foreign pointer cannot complete');assert.equal(owner.cancelPointer(3),false);assert.equal(owner.cancelPointer(2),true);assert.equal(owner.endPointer(2,50,50,target),null);
 owner.startPointer([id],4,10,10);assert.equal(owner.pointerTarget(4,50,50,target),target);assert.deepEqual(owner.endPointer(4,50,50,target),{evidenceIds:[id],targetNodeId:target});assert.equal(owner.endPointer(4,50,50,target),null);
 assert.equal(createStudioEvidenceDrag(draft,false).startPointer([id],5,0,0),false);
});
