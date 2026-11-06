"use client";
import { useEffect, useState } from "react";
/** Display-only clock. It neither sends notifications nor changes saved work. */
export function useWorkClock() {
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,30_000);window.addEventListener("focus",tick);return()=>{clearInterval(timer);window.removeEventListener("focus",tick);};},[]);
  return now;
}
