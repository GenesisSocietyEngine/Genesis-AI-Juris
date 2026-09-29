"use client";

import { useEffect, useSyncExternalStore } from "react";

export type InterfaceLocale = "en" | "ru";
const KEY = "genesis-interface-language";
const EVENT = "genesis-interface-change";

function subscribe(update: () => void) {
  window.addEventListener(EVENT, update);
  window.addEventListener("popstate", update);
  window.addEventListener("storage", update);
  return () => { window.removeEventListener(EVENT, update); window.removeEventListener("popstate", update); window.removeEventListener("storage", update); };
}

function localeSnapshot(): InterfaceLocale {
  const query = new URLSearchParams(window.location.search).get("lang");
  if (query === "en" || query === "ru") return query;
  try { return window.localStorage.getItem(KEY) === "ru" ? "ru" : "en"; } catch { return "en"; }
}

export function useInterfaceLocale(): [InterfaceLocale, (locale: InterfaceLocale) => void] {
  const locale = useSyncExternalStore(subscribe, localeSnapshot, () => "en" as const);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return [locale, (next) => {
    try { window.localStorage.setItem(KEY, next); } catch { /* The URL remains available. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(window.history.state, "", url);
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(EVENT));
  }];
}

export function useWorkspaceLocation() {
  return useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search + window.location.hash, () => "/");
}
