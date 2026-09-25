"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useNavigationController } from "./NavigationSession";
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const value = (field:Field) => field instanceof HTMLInputElement && field.type === "file" ? Boolean(field.files?.length) : field instanceof HTMLInputElement && ["radio","checkbox"].includes(field.type) ? field.checked : field instanceof HTMLSelectElement && field.multiple ? JSON.stringify(Array.from(field.selectedOptions,o=>o.value)) : field.value;

/** Retain recoverable input in this mounted page only. No storage or network
 * serialization; authority denial clears it. Files must be selected again. */
export function useNavigationFormGuard(busy:boolean) {
  const navigation=useNavigationController(),root=useRef<HTMLElement>(null);
  const initial=useRef(new Map<Field,string|boolean>()),working=useRef(busy);
  useLayoutEffect(()=>{working.current=busy;},[busy]);
  const retained=useRef(new Map<string,{baseline:string|boolean;value:string|boolean}>());
  const key=(field:Field)=>`${field.form?.id||Array.from(root.current?.querySelectorAll("form")??[]).indexOf(field.form!)}:${field.name}:${field instanceof HTMLInputElement?field.type:"text"}`;
  useLayoutEffect(()=>{root.current?.querySelectorAll("input,select,textarea").forEach(element=>{
    const field=element as unknown as Field;if(!field.form||initial.current.has(field))return;
    const saved=retained.current.get(key(field));
    if(saved&&!(field instanceof HTMLInputElement&&field.type==="file")) {
      if(typeof saved.value==="boolean"&&field instanceof HTMLInputElement)field.checked=saved.value;
      else if(field instanceof HTMLSelectElement&&field.multiple){const selected=JSON.parse(String(saved.value)) as string[];Array.from(field.options).forEach(o=>{o.selected=selected.includes(o.value);});}
      else field.value=String(saved.value);
    }
    initial.current.set(field,saved?.baseline??value(field));
  });});
  useEffect(()=>navigation.register(root,{risk:()=>{
    if(working.current)return "pending";
    for(const [field,baseline] of initial.current){if(!field.isConnected){initial.current.delete(field);continue;}if(value(field)!==baseline)return "dirty";}
    for(const saved of retained.current.values())if(saved.value!==saved.baseline)return "dirty";
    return "clear";
  },suspend:()=>{initial.current.forEach((baseline,field)=>{if(field.isConnected&&field.name)retained.current.set(key(field),{baseline,value:value(field)});});},deny:()=>{initial.current.clear();retained.current.clear();}}),[navigation]);
  function committed(form?:HTMLFormElement) {if(form)initial.current.forEach((_,field)=>{if(field.form===form){initial.current.set(field,value(field));retained.current.delete(key(field));}});}
  return {root,committed};
}
