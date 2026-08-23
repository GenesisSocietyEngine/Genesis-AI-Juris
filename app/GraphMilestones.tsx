"use client";

import type { StudioNode } from "./types";

export default function GraphMilestones({locale,nodes,select}:{locale:"en"|"ru";nodes:StudioNode[];select:(id:string)=>void}){
  const milestones=nodes.flatMap((node,index)=>{
    const deadline=node.runtime?.deadlineDay!==undefined||Boolean(node.runtime?.deadlineTime);
    const day=deadline?node.runtime?.deadlineDay:node.runtime?.day;
    const time=deadline?node.runtime?.deadlineTime:node.runtime?.time;
    return day===undefined&&!time?[]:[{node,index,deadline,day:day??0,time:time??""}];
  }).sort((left,right)=>left.day-right.day||left.time.localeCompare(right.time)||left.index-right.index);
  if(!milestones.length)return null;
  return <nav className="graph-milestones" aria-label={locale==="en"?"Temporal milestones":"Временные майлстоуны"}>
    <span>{locale==="en"?"TIMELINE":"ВРЕМЕННАЯ ШКАЛА"}</span>
    <ol>{milestones.map(({node,index,deadline,day,time})=><li key={node.id} className={deadline?"deadline":""}><button type="button" onClick={()=>select(node.id)} title={node.title}><i aria-hidden="true"/><b>{day?`D${String(day).padStart(2,"0")}`:"TIME"}{time?` · ${time}`:""}</b><small>N{String(index+1).padStart(2,"0")} · {node.title}</small></button></li>)}</ol>
  </nav>;
}
