"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigationController } from "./NavigationSession";
import { useActiveOrganization } from "./organizations/organization-context";
import type { DepartureRisk } from "./navigation-controller";

export function useScopedNavigation(risk:()=>DepartureRisk, dossierId?:string) {
  const navigation=useNavigationController(),organization=useActiveOrganization();
  const [denied,setDenied]=useState(false);
  const active=useRef(true),currentRisk=useRef(risk);
  useLayoutEffect(()=>{currentRisk.current=risk;});
  useEffect(()=>{active.current=true;const stop=navigation.register(active,{risk:()=>currentRisk.current(),suspend:()=>{active.current=false;},deny:()=>{active.current=false;}});return()=>{active.current=false;stop();};},[navigation]);
  const current=useCallback(()=>active.current && navigation.getSnapshot().phase==="ready" && navigation.getSnapshot().selected?.selection===organization?.selection,[navigation,organization?.selection]);
  const transport=useCallback(async(path:string,init:RequestInit={})=>{
    if(!current())throw new DOMException("Obsolete organization visit","AbortError");
    const ticket=navigation.authorityVersion;
    const response=await fetch(path,{...init,credentials:"same-origin",cache:"no-store",headers:{...Object.fromEntries(new Headers(init.headers)),...(organization?{"x-genesis-organization":organization.selection}:{})}});
    if(!current()||navigation.authorityVersion!==ticket)throw new DOMException("Obsolete organization response","AbortError");
    if(response.status===401)navigation.invalidate("expired");
    if([403,404].includes(response.status)&&dossierId&&path.split("?")[0]===`/api/dossiers/${dossierId}`){active.current=false;setDenied(true);throw new DOMException("Case access denied","AbortError");}
    return response;
  },[current,navigation,organization,dossierId]);
  return {transport,current,denied};
}
