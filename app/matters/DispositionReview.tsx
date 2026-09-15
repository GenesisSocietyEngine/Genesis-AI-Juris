"use client";
import { useEffect, useRef, useState } from "react";
import { organizationScopedUrl } from "../organization-client";
import { savedOutcomeReceipt, type SavedOutcome } from "./saved-outcome";
import styles from "./matters.module.css";

type ReviewRecord={kind:"deadline"|"citation";revision:number;can_review:boolean;readiness_effect:string;unavailable_reason?:string|null;disposition:unknown;record:{id:string;title?:string;dueAt?:string;timezone?:string;excerpt?:string};dependent_assertions:Array<{id:string;statement:string;status:string}>;current_output_ids:string[]};
type Props={caseId:string;recordId:string;kind:"deadline"|"citation";onSaved?:(receipt:SavedOutcome)=>void;citations?:Array<{id:string;label:string}>};
export default function DispositionReview(props:Props){return <DispositionReviewForm key={`${props.caseId}:${props.kind}:${props.recordId}`} {...props}/>;}
function DispositionReviewForm({caseId,recordId,kind,onSaved,citations=[]}:Props){
 const [record,setRecord]=useState<ReviewRecord|null>(null),[open,setOpen]=useState(false),[reason,setReason]=useState(""),[status,setStatus]=useState("completed"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const mounted=useRef(true); useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [support,setSupport]=useState("");
 const request=useRef<{body:string;key:string}|null>(null);
 const [receipt,setReceipt]=useState<SavedOutcome|null>(null);
 const endpoint=organizationScopedUrl(`/api/dossiers/${encodeURIComponent(caseId)}/dispositions`);
 async function load(){setOpen(true);setBusy(true);setError("");try{const r=await fetch(endpoint+`${endpoint.includes('?')?'&':'?'}kind=${kind}&id=${encodeURIComponent(recordId)}`,{cache:"no-store"});const body=await r.json() as ReviewRecord & {error?:string};if(!mounted.current)return;if(!r.ok)throw new Error(body.error??"This record could not be opened.");if(body.kind!==kind||body.record?.id!==recordId||!Number.isSafeInteger(body.revision)||!Array.isArray(body.dependent_assertions)||!Array.isArray(body.current_output_ids))throw new Error("The exact review record could not be verified. Refresh before continuing.");setRecord(body);request.current=null;}catch(e){setError(e instanceof Error?e.message:"Could not open the review. Retry when connected.");}finally{setBusy(false);}}
 async function submit(){if(!record||busy)return;setBusy(true);setError("");
 const fields={kind,recordId,reason,expectedRevision:record.revision,...(kind==="deadline"?{status,supportingSourceAnchorId:support||null}:{replacementSourceAnchorId:support||null})};const serialized=JSON.stringify(fields);
 if(request.current?.body!==serialized){const bytes=crypto.getRandomValues(new Uint8Array(16));request.current={body:serialized,key:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};}
 try{const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...fields,idempotencyKey:request.current.key})});const body=await r.json() as {error?:string;audit_event_id?:string;disposition?:{dossierId:string;reason:string;deadlineReferenceId?:string;sourceAnchorId?:string;auditEventId?:string}};if(!mounted.current)return;if(!r.ok)throw new Error(body.error??"The outcome was not saved. Your reason is retained.");
 const confirmed=savedOutcomeReceipt(body,{caseId,recordId,kind,reason,revision:record.revision,status,support});
 if(!confirmed)throw new Error("The save receipt could not be verified. Retry the same request before changing the reason.");
 setReceipt(confirmed);onSaved?.(confirmed);
 }catch(e){setError(e instanceof Error?e.message:"The save was not confirmed. Keep this form open and retry.");}finally{setBusy(false);}}
 const title=kind==="deadline"?"Record historical deadline outcome":"Review citation retirement";
 return <section className={styles.metadataEditor}>
 {!open?<button type="button" className={styles.secondaryButton} onClick={()=>void load()}>{title} →</button>:<div>
 <h4>{title}</h4>{busy&&!record&&<p role="status">Opening the exact record…</p>}
 {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>void load()} disabled={busy}>Refresh record; keep my reason</button></div>}
 {record&&(receipt||record.disposition)?<div><p role="status">Outcome recorded. Original dates, acceptance and audit history are preserved.</p>{onSaved&&receipt&&<button type="button" className={styles.primaryButton} onClick={()=>onSaved(receipt)}>Update case actions</button>}</div>:record&&<form className={styles.actionForm} onSubmit={e=>{e.preventDefault();void submit();}}>
 <p>{record.record.title??record.record.excerpt??"Accepted historical citation"}{record.record.dueAt&&` · ${record.record.dueAt} (${record.record.timezone})`}</p>
 <div className={styles.consequenceBox}><strong>Effect on case readiness</strong><p>{record.readiness_effect}</p><p>{record.current_output_ids.length} current report(s) will become outdated.</p></div>
 {record.dependent_assertions.length>0&&<div><strong>Assertions requiring separate review</strong><ul>{record.dependent_assertions.map(a=><li key={a.id}><a href={"#assertion-"+a.id}>{a.statement}</a> · {a.status}</li>)}</ul></div>}
 <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
 {kind==="deadline"&&<label className={styles.field}><span>Outcome</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="completed">Fulfilled</option><option value="waived">Waived</option><option value="cancelled">No longer applicable</option></select></label>}
 {citations.length>0&&<label className={styles.field}><span>{kind==="citation"?"Proposed replacement citation (optional)":"Supporting citation (optional)"}</span><select value={support} onChange={e=>setSupport(e.target.value)}><option value="">No citation selected</option>{citations.filter(c=>c.id!==recordId).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><small>Selection does not automatically update dependent assertions.</small></label>}
 <label className={styles.field}><span>Reason and supporting reference</span><textarea required minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the outcome and cite the supporting record. Historical acceptance is retained."/></label>
 </fieldset>
 <button className={styles.primaryButton} type="submit" disabled={busy||!record.can_review}>{busy?"Confirming save…":"Confirm and save outcome"}</button>
 {!record.can_review&&<p>{record.unavailable_reason??"Your role can inspect this record. Ask a case owner, contributor or reviewer to record the outcome."}</p>}
 </form>}
 <button type="button" className={styles.linkButton} disabled={busy} onClick={()=>setOpen(false)}>Close review; keep entered reason</button>
 </div>}
 </section>;
}
