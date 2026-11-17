"use client";
import { useEffect, useState } from "react";
import { readWithTimeout } from "./read-with-timeout";

export function useAuthorizedCaseName(id: string, selection: string) {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active: AbortController | undefined;
    const suspend = () => { active?.abort(); setName(undefined); };
    const read = () => {
      active?.abort();
      if (document.hidden) { setName(undefined); return; }
      const visit = new AbortController();
      active = visit;
      void readWithTimeout(async signal => {
        const response = await fetch("/api/dossiers/" + encodeURIComponent(id) + "?view=identity", {
          credentials: "same-origin", cache: "no-store", headers: { "x-genesis-organization": selection }, signal,
        });
        if (!response.ok) return null;
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("id" in result) || !("title" in result)) return null;
        return result.id === id && typeof result.title === "string" && result.title.trim() ? result.title : null;
      }, { signal: visit.signal }).then(
        title => { if (!visit.signal.aborted) setName(title); },
        () => { if (!visit.signal.aborted) setName(null); },
      );
    };
    read();
    window.addEventListener("focus", read);
    window.addEventListener("pageshow", read);
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", read);
    return () => {
      active?.abort();
      window.removeEventListener("focus", read);
      window.removeEventListener("pageshow", read);
      window.removeEventListener("pagehide", suspend);
      document.removeEventListener("visibilitychange", read);
    };
  }, [id, selection]);
  return name;
}
