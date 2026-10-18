"use client";
import { useState } from "react";
import StudioDeferredPanel from "./StudioDeferredPanel";
import type { StudioDraft } from "./types";

const load = () => import("./StudioRecordNavigator");

/** Reuse the complete authored-record index; search and focus never write a case. */
export default function StudioMapRecordSearch({ draft, locale, onNode }: {
  draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return <details className="map-record-search" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{locale === "en" ? "Find a step" : "Найти этап"}</summary>
    {open && <div className="map-record-search-results"><StudioDeferredPanel load={load} panelProps={{ draft, locale, onNode }}/></div>}
  </details>;
}
