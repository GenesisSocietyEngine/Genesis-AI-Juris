import { WorkspaceController } from "../../app/matters/workspace-controller";
import { changePracticePlan, EMPTY_PLAN, type PracticePlan } from "../../app/matters/practice-plan";
/** Synthetic transport only. The real controller and component are exercised. */
export function practiceHarness() {
  let plan:PracticePlan=EMPTY_PLAN, loseNext=false, forbidden=false, count=0;
  const receipts=new Map<string,{plan:PracticePlan;operation:string}>();
  const posts:string[]=[];
  const identity={actorId:"synthetic-owner",organizationId:"synthetic-org"};
  const dossier={dossier_id:"synthetic-case",title:"Synthetic case · supplier review",revision:1,permissions:{role:"owner"},participants:[{participant_id:"person-a",actor_id:identity.actorId,display_name:"Alex Morgan",role:"owner",status:"active"},{participant_id:"person-b",actor_id:"synthetic-colleague",display_name:"Sam Rivera",role:"contributor",status:"active"}]};
  const configured={id:"wf_synthetic_review",version:1,title:"Synthetic hearing preparation",archived:false,steps:[{title:"Review evidence and AI alternatives",kind:"task" as const,days:-3},{title:"Team hearing review",kind:"event" as const,days:0}]};
  const owner=new WorkspaceController({identity,transport:async(path,init)=>{
    const url=new URL(path,"https://synthetic.test");
    if(forbidden)return Response.json({}, {status:404});
    if(url.pathname==="/api/work/templates")return Response.json({library:{revision:1,templates:[configured]},canManage:true});
    if(url.pathname==="/api/organizations")return Response.json({selected:{...identity,selection:identity.organizationId,status:"active"}});
    if(url.pathname==="/api/dossiers")return Response.json({dossiers:[dossier]});
    if(url.pathname==="/api/dossiers/synthetic-case")return Response.json({dossier});
    if(url.pathname.endsWith("/practice")) {
      if(init?.method==="POST"){
        posts.push(String(init.body)); const command=JSON.parse(String(init.body));
        let receipt=receipts.get(command.operationKey);
        if(!receipt){if(command.expectedRevision!==plan.revision)return Response.json({error:"Changed plan"},{status:409});plan=changePracticePlan(plan,command,()=>`work-${++count}`,command.templateId===configured.id?configured:undefined);receipt={plan,operation:command.operationKey};receipts.set(command.operationKey,receipt);}
        if(loseNext){loseNext=false;throw new Error("Synthetic lost response");}return Response.json(receipt);
      }
      return Response.json({plan});
    }
    return Response.json({documents:[],source_anchors:[],assertions:[],requests:[],deadlines:[],proposals:[],decision_packages:[],snapshots:[],outputs:[],events:[]});
  }});
  return {owner,posts,read:()=>plan,loseNext:()=>{loseNext=true;},deny:()=>{forbidden=true;},start:async()=>{owner.enter("synthetic-case");await owner.load();await owner.loadPractice();}};
}
