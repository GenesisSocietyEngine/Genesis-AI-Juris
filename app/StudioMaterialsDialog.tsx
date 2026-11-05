"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** One task-sized material window; opening/closing never changes case content. */
export default function StudioMaterialsDialog({title,onClose,locale,children,busy}:{title:string;onClose:()=>void;locale:"en"|"ru";children:ReactNode;busy?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=ref.current,trigger=document.activeElement;element?.showModal();return()=>{element?.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
 return <dialog ref={ref} className="studio-materials-dialog" aria-labelledby="studio-materials-dialog-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><h2 id="studio-materials-dialog-title">{title}</h2><button type="button" onClick={onClose} disabled={busy}>{locale==="en"?"Close":"Закрыть"}</button></header>{children}
 </dialog>;
}
