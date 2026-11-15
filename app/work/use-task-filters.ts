import { useSyncExternalStore } from "react";
import type { DueScope } from "./work-date-views";

const defaults = {scope:"", lifecycle:"all", status:"open", person:"", query:"", due:"all" as DueScope, sort:"date"};
type Filters = typeof defaults;
const event = "casevant-task-filters";
function subscribe(update:()=>void) {
  window.addEventListener(event,update);
  window.addEventListener("popstate",update);
  return () => { window.removeEventListener(event,update); window.removeEventListener("popstate",update); };
}

// Keep the queue on this browser history entry and bind it to the signed-in workspace.
export function useTaskFilters(selection:string,actor:string) {
  const owner = JSON.stringify([selection,actor]);
  const snapshot = () => {
    const entry = window.history.state?.casevantTaskFilters;
    return entry?.owner===owner && typeof entry.values==="string" ? entry.values : "";
  };
  const saved = useSyncExternalStore(subscribe,snapshot,()=>"");
  const read = (raw:string):Filters => {
    if (!raw) return defaults;
    try {
      const values = JSON.parse(raw);
      if (!values || Object.keys(defaults).some(key=>typeof values[key]!=="string")) return defaults;
      return values as Filters;
    } catch { return defaults; }
  };
  const save = (values:Filters) => {
    window.history.replaceState({...window.history.state,casevantTaskFilters:{owner,values:JSON.stringify(values)}}, "");
    window.dispatchEvent(new Event(event));
  };
  return {values:read(saved), change:(patch:Partial<Filters>)=>save({...read(snapshot()),...patch}), reset:()=>save(defaults)};
}
