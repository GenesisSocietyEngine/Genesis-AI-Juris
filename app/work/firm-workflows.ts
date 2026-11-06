import {practiceWorkflowLabel,type PracticeItem} from "../matters/practice-plan";
import {validDate} from "../matters/practice-scheduling";
import type {FirmCase} from "./work-controller";
export type AppliedWorkflow={key:string;source:string;title:string;caseId:string;caseTitle:string;anchor:string|null;version:string|null;items:PracticeItem[];completed:number};
/** Group recorded generated work, never infer an application from equal titles. */
export function firmWorkflows(cases:FirmCase[],locale:"en"|"ru"="en"):AppliedWorkflow[]{
 const groups=new Map<string,AppliedWorkflow>();
 for(const matter of cases)for(const item of matter.plan.items){
  if(!item.workflow)continue;
  const key=JSON.stringify([matter.id,item.workflow]),separator=item.workflow.lastIndexOf(":"),source=separator<0?item.workflow:item.workflow.slice(0,separator),date=item.workflow.slice(separator+1);
  const group=groups.get(key)??{key,source,title:item.workflowTitle??practiceWorkflowLabel(item.workflow,locale),caseId:matter.id,caseTitle:matter.title,anchor:separator>=0&&validDate(date)?date:null,version:source.match(/(?:@|-v)(\d+)$/)?.[1]??null,items:[],completed:0};
  group.items.push(item);if(item.status==="completed")group.completed++;groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>a.caseTitle.localeCompare(b.caseTitle)||a.title.localeCompare(b.title)||a.key.localeCompare(b.key));
}
