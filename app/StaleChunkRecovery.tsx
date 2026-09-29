"use client";

import { useEffect } from "react";
import { clearStaleChunkRecovery, hasLocalChunkRecovery, recoverFromStaleChunk } from "./stale-chunk-recovery";

export default function StaleChunkRecovery() {
  useEffect(() => {
    const reload = () => window.location.reload();
    const preloadError = (event: Event) => {
      // Leave the event uncancelled so Vite rejects the awaited import and the
      // report dialog can explain the failure without replacing this page.
      if (hasLocalChunkRecovery()) return;
      event.preventDefault();
      recoverFromStaleChunk(window.sessionStorage, reload, "vite:preloadError");
    };
    const rejected = (event: PromiseRejectionEvent) => {
      if (hasLocalChunkRecovery()) return;
      if (recoverFromStaleChunk(window.sessionStorage, reload, event.reason)) event.preventDefault();
    };
    window.addEventListener("vite:preloadError", preloadError);
    window.addEventListener("unhandledrejection", rejected);
    const ready = window.setTimeout(() => clearStaleChunkRecovery(window.sessionStorage), 15_000);
    return () => {
      window.clearTimeout(ready);
      window.removeEventListener("vite:preloadError", preloadError);
      window.removeEventListener("unhandledrejection", rejected);
    };
  }, []);
  return null;
}
