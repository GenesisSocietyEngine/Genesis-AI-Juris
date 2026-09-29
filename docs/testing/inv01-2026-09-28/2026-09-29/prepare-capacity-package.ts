import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {normalizeStudioDraft,studioStructuralIssues} from '../../../../app/case-integrity';
import {compileStudioDraft} from '../../../../app/studio-compiler';
import {compilePublicationPlayable} from '../../../../app/publication-integrity';
import {caseTypeReference} from '../../../../app/case-type-reference';
import type {StudioNode,StudioLink} from '../../../../app/types';
const root='docs/testing/inv01-2026-09-28/2026-09-29/';
const facts=readFileSync('docs/testing/inv01-2026-09-28/fixtures/fixture-c-valid-capacity-and-reconciliation-v1.txt','utf8');
const entries:Array<[string,StudioNode['type'],string,string]>=[
 ['start','trigger','Open the synthetic baseline review','Unpublished software-test draft. No source acceptance, professional approval or completed simulation is asserted.'],
 ['reviewer','actor','Synthetic operations reviewer','Fictional exercise role. This node identifies no real account and grants no permissions.'],
 ['original','evidence','Retain original source and contradiction','Original source v1 SHA-256 f2d072fa17fd69a13399e0f4a3019a0eca55cfdbad53783cf48f862334f5a84e. Preserve 300 signed versus 600 summary as historical content. No source anchor or review event is supplied.'],
 ['schedule','evidence','Prepared fictional reconciliation and capacity schedule',facts],
 ['forecast','fact','Exclude forecast and sensitivity','The historical 150 additional commitments and 120 sensitivity are unverified assumptions, excluded from supported demand/capacity. The graph cannot automatically parse replacement source quantities or calculate arbitrary capacity.'],
 ['choose','decision','Choose a supported test conclusion','Use the stated 300/300 baseline only with its limitations. Pause when sources or currentness are unresolved. Treating extra forecast demand as supported is an intentionally unsupported exercise choice.'],
 ['cutoff','deadline','Synthetic administrative review cutoff','2026-10-05 18:00 Europe/Paris / 16:00 UTC; no legal deadline. Relative runtime day1 is September29 and day7 October5. No calendar/timezone calculation is claimed.'],
 ['supported','outcome','Stated baseline matches stated capacity','The fictional schedule allocates300 slots to300 signed commitments, with no spare capacity. Authored comparison only, not an inspection, professional approval or operating permission.'],
 ['pause','outcome','Pause for source verification or reassessment','Source identity/currentness, cutoff or capacity evidence is unresolved. Obtain actual evidence through authorized workflows; no request or review is fabricated.'],
 ['unsupported','outcome','Additional demand lacks supporting capacity evidence','Only300 slots are evidenced. Extra forecast/sensitivity demand is unsupported. Require new capacity evidence and explicit reassessment.'],
];
const nodes:StudioNode[]=entries.map(([id,type,title,detail],i)=>({id,type,title,detail,x:100+Math.min(i,7)*250,y:i<7?240:100+(i-7)*240,runtime:{day:1,time:`09:${String(Math.min(i,7)).padStart(2,'0')}`,...(id==='cutoff'?{deadlineDay:7,deadlineTime:'18:00',missedOutcomeNodeId:'pause'}:{}),...(type==='outcome'?{terminalOutcome:id==='supported'?'strong':id==='pause'?'mixed':'weak'}:{})}}));
const connections=[['start','reviewer','Read the fictional reviewer role'],['reviewer','original','Inspect original source lineage'],['original','schedule','Read the prepared fictional correction'],['schedule','forecast','Inspect excluded forecasts'],['forecast','choose','Compare the baseline and limitations'],['choose','cutoff','Use only reconciled signed demand'],['choose','pause','Pause for unresolved evidence'],['choose','unsupported','Treat unverified additional demand as supported'],['cutoff','supported','Finish before the synthetic cutoff']];
const links:StudioLink[]=connections.map(([from,to,label],i)=>({id:`transition_${i+1}`,from,to,rule:{label,result:'Fictional exercise transition only; no source review or permission is recorded.',cost:0,minutes:1,effects:{position:0,evidence:0,trust:0,exposure:0},repeatability:'once'}}));
const draft=normalizeStudioDraft({caseId:'synthetic_commitment_capacity_review',version:'1.0.0',caseType:caseTypeReference('general_advisory'),parent:null,title:'Synthetic commitment reconciliation and delivery-capacity review',jurisdiction:'Fictional test administration; no legal jurisdiction asserted',role:'Synthetic operations reviewer',premise:`UNPUBLISHED, UNREVIEWED SOFTWARE-TEST DRAFT.\n${facts}\nTransitions use fictional one-minute durations, zero monetary costs and zero score effects solely for this test. No automatic capacity arithmetic or actual governed simulation is claimed.`,premisePublication:'prompt-derived',classification:{domain:'general',practiceArea:'Synthetic operational evidence review',difficulty:'Intermediate',tags:['synthetic','capacity','reconciliation'],taxTopics:[],complianceOnly:true,purpose:'compliance_review',legalAsOf:'',sourceUrls:[]},nodes,links,editHistory:[],updatedAt:'2026-09-29T02:30:58.000Z'});
const structural=studioStructuralIssues(draft), compilation=compileStudioDraft(draft), publication=compilePublicationPlayable(draft);
assert.deepEqual(structural,[]);assert.deepEqual(compilation.issues,[]);assert.ok(compilation.scenario);assert.equal(publication.ok,false);
writeFileSync(root+'capacity-package.UNPUBLISHED.json',JSON.stringify(draft,null,2)+'\n');
writeFileSync(root+'capacity-package-validation.json',JSON.stringify({structural,compileIssues:compilation.issues,compileWarnings:compilation.warnings,nodes:draft.nodes.length,links:draft.links.length,publication,actuallyPublished:false,actualSimulationCompleted:false,actualSourceReviewRecorded:false},null,2)+'\n');
console.log(JSON.stringify({nodes:draft.nodes.length,links:draft.links.length,compiles:true,publication}));
