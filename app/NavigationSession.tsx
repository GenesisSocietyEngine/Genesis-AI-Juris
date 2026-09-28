"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { NavigationController } from "./navigation-controller";
import { clearOrganizationSelection } from "./organization-client";
import { LEGACY_STUDIO_DRAFT_KEY, LEGACY_STUDIO_PRIVATE_KEY, studioDeviceDraftKey, studioDeviceScope } from "./studio-device-storage";
import { useWorkspaceLocation } from "./use-interface-locale";
import { isWorkspaceDepartureClick } from "./departure-click";
import { installDepartureHistory } from "./departure-history";
import { subscribeSessionBoundary } from "./session-boundary";

const NavigationSessionContext = createContext<NavigationController | null>(null);
// Unmounted component tests and SSR never resolve or share a user's identity.
const emptyNavigation = new NavigationController({ transport: async () => Response.json({}, {status:401}), leave: () => {}, clear: () => {} });
export function useNavigationController() { return useContext(NavigationSessionContext) ?? emptyNavigation; }
export function useNavigationSession() { const controller = useNavigationController(); return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot); }
export async function clearNavigationStorage(email?: string) {
  clearOrganizationSelection();
  try { for (const key of ["genesis-invitation-continuation-v1", "genesis-studio-auth-continuation-v1", "genesis.juris.pending-workspace-save.v2", "genesis-juris-pending-case-prompt-v1"]) window.sessionStorage.removeItem(key); } catch { /* Navigation and privacy must not depend on storage availability. */ }
  if (email) {
    try { window.localStorage.removeItem(LEGACY_STUDIO_DRAFT_KEY); window.localStorage.removeItem(LEGACY_STUDIO_PRIVATE_KEY); const scope = await studioDeviceScope(email); if (scope) window.localStorage.removeItem(studioDeviceDraftKey(scope)); } catch { /* Server sign-out remains authoritative. */ }
  }
}
export default function NavigationSession({ children, controller: supplied }: {children:ReactNode; controller?:NavigationController}) {
  const [controller] = useState(() => supplied ?? new NavigationController({ transport: (path, init) => fetch(path, init), clear: clearNavigationStorage, leave: url => { window.location.assign(url); } }));
  const location = useWorkspaceLocation();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const selection = new URL(location, "https://workspace.invalid").searchParams.get("organization") ?? undefined;
  const en=new URL(location,"https://workspace.invalid").searchParams.get("lang")!=="ru";
  useEffect(() => subscribeSessionBoundary(controller.sessionBoundary), [controller]);
  useEffect(() => {
    const refresh = () => { void controller.refresh(selection); };
    refresh(); window.addEventListener("focus",refresh);
    const restored = (event:PageTransitionEvent) => { if(event.persisted) { controller.invalidate("expired"); refresh(); } };
    window.addEventListener("pageshow",restored);
    return () => { window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",restored); };
  }, [controller, selection]);
  useEffect(() => {
    const removeHistory=installDepartureHistory(window,controller);
    const warn = (event: BeforeUnloadEvent) => { if (controller.warnBeforeUnload()) { event.preventDefault(); event.returnValue = ""; } };
    // Capture ordinary page links before React/Next routing. This covers the
    // catalogue, issue panels and sidebar through the same departure dialog.
    // Native document navigation also retains the browser's unload protection
    // when returning through page history. In-case controls remain local.
    const follow = (event: MouseEvent) => {
      // Any later local action (tabs, exact records, another import) supersedes a file read.
      if(event.target instanceof Element && !event.target.closest(".genesis-navigation-confirm") && event.target.closest("button,input[type=file],select"))controller.beginIntent();
      const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>("a[href]"):null;
      if(!link||!isWorkspaceDepartureClick(event,link,window.location.href))return;
      controller.beginIntent();
      if(controller.risk()==="clear")return;
      event.preventDefault();event.stopImmediatePropagation();
      const intent=controller.beginIntent(),authority=controller.authorityVersion;
      controller.requestDeparture("link",link.href,{target:link.target,current:()=>controller.intentCurrent(intent)&&authority===controller.authorityVersion,commit:()=>true});
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click",follow,true);
    return () => {removeHistory();window.removeEventListener("beforeunload", warn);document.removeEventListener("click",follow,true);};
  }, [controller]);
  return <NavigationSessionContext.Provider value={controller}>
    <div inert={state.busy || state.endingSession || state.phase === "leaving" ? true : undefined} hidden={state.endingSession}>{children}</div>
    {state.endingSession?<main className="studio-entry"><h1>{en?"Signing out":"Выход"}</h1><p role="status">{state.busy?(en?"Ending your session…":"Завершение сеанса…"):(en?"Sign-out could not be confirmed. Retry.":"Не удалось подтвердить выход. Повторите.")}</p>{!state.busy&&<button type="button" onClick={()=>void controller.signOut(en?"en":"ru")}>{en?"Retry sign out":"Повторить выход"}</button>}</main>:state.busy&&<div className="genesis-navigation-progress"><p role="status">{en?"Checking the selected organization…":"Проверка выбранной организации…"}</p>{controller.canSignOut&&<button type="button" onClick={()=>void controller.signOut(en?"en":"ru")}>{en?"Sign out now":"Выйти сейчас"}</button>}</div>}
  </NavigationSessionContext.Provider>;
}
