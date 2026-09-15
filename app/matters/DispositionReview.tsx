"use client";
import { useEffect, useRef, useState } from "react";
import { organizationScopedUrl } from "../organization-client";
import { savedOutcomeReceipt, type SavedOutcome } from "./saved-outcome";
import styles from "./matters.module.css";

type ReviewRecord={actor_id:string;kind:"deadline"|"citation";revision:number;can_review:boolean;readiness_effect:string;unavailable_reason?:string|null;disposition:unknown;record:{id:string;title?:string;dueAt?:string;timezone?:string;excerpt?:string};dependent_assertions:Array<{id:string;statement:string;status:string}>;current_output_ids:string[]};
type Props={caseId:string;recordId:string;kind:"deadline"|"citation";onSaved?:(receipt:SavedOutcome)=>void;citations?:Array<{id:string;label:string}>};
export default function DispositionReview(props:Props){return <DispositionReviewForm key={`${props.caseId}:${props.kind}:${props.recordId}`} {...props}/>;}
function DispositionReviewForm({caseId,recordId,kind,onSaved,citations=[]}:Props){
 const [record,setRecord]=useState<ReviewRecord|null>(null),[open,setOpen]=useState(false),[reason,setReason]=useState(""),[status,setStatus]=useState("completed"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const mounted=useRef(true); useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [support,setSupport]=useState("");
 const request=useRef<{body:string;key:string;actorId:string}|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const [errorField,setErrorField]=useState<string|null>(null);
 useEffect(()=>{if(errorField&&!busy&&!uncertain)document.getElementById(`disposition-${errorField}-${recordId}`)?.focus();},[errorField,busy,uncertain,recordId]);
 const [receipt,setReceipt]=useState<SavedOutcome|null>(null);
 function clearPrivateForm(){setRecord(null);setReason("");setSupport("");setReceipt(null);request.current=null;setUncertain(false);}
 const endpoint=organizationScopedUrl(`/api/dossiers/${encodeURIComponent(caseId)}/dispositions`);
 async function load(){setOpen(true);setBusy(true);setError("");try{const r=await fetch(endpoint+`${endpoint.includes('?')?'&':'?'}kind=${kind}&id=${encodeURIComponent(recordId)}`,{cache:"no-store"});const body=await r.json() as ReviewRecord & {error?:string};if(!mounted.current)return;if(!r.ok){if(r.status===403||r.status===404)clearPrivateForm();if(r.status===401)setRecord(null);throw new Error(body.error??"This record could not be opened.");}if(body.kind!==kind||body.record?.id!==recordId||!Number.isSafeInteger(body.revision)||!Array.isArray(body.dependent_assertions)||!Array.isArray(body.current_output_ids))throw new Error("The exact review record could not be verified. Refresh before continuing.");if(request.current&&request.current.actorId!==body.actor_id){request.current=null;setReason("");setSupport("");setReceipt(null);setUncertain(false);setError("The signed-in account changed. Review this record with the current account before entering a new proposal.");}setRecord(body);}catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Could not open the review. Retry when connected.");}finally{if(mounted.current)setBusy(false);}}
 async function submit(){if(!record||busy)return;setBusy(true);setError("");
 const fields={kind,recordId,reason,expectedRevision:record.revision,...(kind==="deadline"?{status,supportingSourceAnchorId:support||null}:{replacementSourceAnchorId:support||null})};const serialized=JSON.stringify(fields);
 if(!request.current||(!uncertain&&request.current.body!==serialized)){const bytes=crypto.getRandomValues(new Uint8Array(16));request.current={body:serialized,key:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join(""),actorId:record.actor_id};}
 const operation=request.current;setUncertain(true);
 try{
 if(uncertain){
   const check=await fetch(endpoint+`${endpoint.includes('?')?'&':'?'}kind=${kind}&id=${encodeURIComponent(recordId)}`,{cache:"no-store"});
   if(!mounted.current)return;
   if(!check.ok){if(check.status===403||check.status===404)clearPrivateForm();if(check.status===401)setRecord(null);throw new Error(check.status===401?"Sign in with the original account and reopen this record. Keep this tab open to retain your input.":"This record is no longer available to your account. Private draft details were cleared.");}
   const identity=await check.json() as ReviewRecord;
   if(!mounted.current)return;
   if(identity.actor_id!==operation.actorId){request.current=null;setReason("");setSupport("");setRecord(null);setUncertain(false);throw new Error("The account changed. Private draft details were cleared; reopen the record with the intended account.");}
   const recovered=await fetch(endpoint+`${endpoint.includes('?')?'&':'?'}kind=${kind}&id=${encodeURIComponent(recordId)}&operation_key=${encodeURIComponent(operation.key)}`,{cache:"no-store"});
   if(!mounted.current)return;
   if(recovered.ok){
     const fields=JSON.parse(operation.body) as {reason:string;expectedRevision:number;status?:string;supportingSourceAnchorId?:string;replacementSourceAnchorId?:string};
     const recoveredBody=await recovered.json();if(!mounted.current)return;
     const confirmed=savedOutcomeReceipt(recoveredBody,{caseId,recordId,kind,reason:fields.reason,revision:fields.expectedRevision,status:fields.status??"completed",support:fields.supportingSourceAnchorId??fields.replacementSourceAnchorId??"",operationKey:operation.key});
     if(!confirmed)throw new Error("The original operation receipt could not be verified. Keep this proposal and retry checking it.");
     setUncertain(false);setReceipt(confirmed);onSaved?.(confirmed);return;
   }
   if(recovered.status!==404)throw new Error("The original operation could not be checked. Keep this proposal and retry when signed in and connected.");

 }
 const original=JSON.parse(operation.body) as {reason:string;expectedRevision:number;status?:string;supportingSourceAnchorId?:string;replacementSourceAnchorId?:string};
 const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...original,idempotencyKey:operation.key})});
 const body=await r.json() as {error?:string;code?:string;field?:string};if(!mounted.current)return;
 if(!r.ok){
   if(r.status===403||r.status===404)clearPrivateForm();
   if(r.status===401)setRecord(null);
   if(r.status===400||(r.status===409&&body.code==="revision_conflict")){setUncertain(false);request.current=null;}
   setErrorField(body.field??null);
   throw new Error(body.error??"The outcome was not confirmed. Your reason is retained.");
 }
 const confirmed=savedOutcomeReceipt(body,{caseId,recordId,kind,reason:original.reason,revision:original.expectedRevision,status:original.status??"completed",support:original.supportingSourceAnchorId??original.replacementSourceAnchorId??"",operationKey:operation.key});
 if(!confirmed)throw new Error("The original save receipt could not be verified. Check the same operation before submitting another proposal.");
 setUncertain(false);setReceipt(confirmed);onSaved?.(confirmed);
 }catch(e){if(mounted.current)setError(e instanceof Error?e.message:"The save was not confirmed. Keep this form open and check the original operation.");}finally{if(mounted.current)setBusy(false);}}

 const title=kind==="deadline"?"Record historical deadline outcome":"Review citation retirement";
 return <section className={styles.metadataEditor}>
 {!open?<button type="button" className={styles.secondaryButton} onClick={()=>void load()}>{title} →</button>:<div>
 <h4>{title}</h4>{busy&&!record&&<p role="status">Opening the exact record…</p>}
 {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>void load()} disabled={busy}>Refresh record; keep my reason</button></div>}
 {record&&(receipt||(!uncertain&&record.disposition))?<div><p role="status">Outcome recorded. Original dates, acceptance and audit history are preserved.</p>{onSaved&&receipt&&<button type="button" className={styles.primaryButton} onClick={()=>onSaved(receipt)}>Update case actions</button>}</div>:record&&<form className={styles.actionForm} onSubmit={e=>{e.preventDefault();void submit();}}>
 <p>{record.record.title??record.record.excerpt??"Accepted historical citation"}{record.record.dueAt&&` · ${record.record.dueAt} (${record.record.timezone})`}</p>
 <div className={styles.consequenceBox}><strong>Effect on case readiness</strong><p>{record.readiness_effect}</p><p>{record.current_output_ids.length} current report(s) will become outdated.</p></div>
 {record.dependent_assertions.length>0&&<div><strong>Assertions requiring separate review</strong><ul>{record.dependent_assertions.map(a=><li key={a.id}><a href={"#assertion-"+a.id}>{a.statement}</a> · {a.status}</li>)}</ul></div>}
 {uncertain&&<p role="status">The original save is not yet confirmed. Check it before changing this proposal. Keep this tab open to retain your input.</p>}
 <fieldset disabled={busy||uncertain} style={{border:0,padding:0,margin:0,minWidth:0}}>
 {kind==="deadline"&&<label className={styles.field}><span>Outcome</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="completed">Fulfilled</option><option value="waived">Waived</option><option value="cancelled">No longer applicable</option></select></label>}
 {citations.length>0&&<label className={styles.field}><span>{kind==="citation"?"Proposed replacement citation (optional)":"Supporting citation (optional)"}</span><select value={support} onChange={e=>setSupport(e.target.value)}><option value="">No citation selected</option>{citations.filter(c=>c.id!==recordId).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><small>Selection does not automatically update dependent assertions.</small></label>}
 <label className={styles.field}><span>Reason and supporting reference</span><textarea id={`disposition-reason-${recordId}`} required minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the outcome and cite the supporting record. Historical acceptance is retained."/></label>
 </fieldset>
 <button className={styles.primaryButton} type="submit" disabled={busy||(!record.can_review&&!uncertain)}>{busy?"Confirming save…":uncertain?"Check original save":"Confirm and save outcome"}</button>
 {!record.can_review&&<p>{record.unavailable_reason??"Your role can inspect this record. Ask a case owner, contributor or reviewer to record the outcome."}</p>}
 </form>}
 <button type="button" className={styles.linkButton} disabled={busy} onClick={()=>setOpen(false)}>Close review; keep entered reason</button>
 </div>}
 </section>;
}
