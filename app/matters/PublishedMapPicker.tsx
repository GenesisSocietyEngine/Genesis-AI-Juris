"use client";

import { useEffect, useState } from "react";
import styles from "./matters.module.css";

export type PublishedMap = { id: string; title: string; currentVersion: string; fingerprint: string };

/** Keep the exact published tuple together; never infer an identity from a title. */
export function publishedMaps(value: unknown): PublishedMap[] {
  if (!Array.isArray(value)) throw new Error("The decision map list could not be read.");
  return value.filter((item): item is PublishedMap => Boolean(item && typeof item === "object"
    && typeof item.id === "string" && item.id.length > 0
    && typeof item.title === "string" && item.title.length > 0
    && typeof item.currentVersion === "string" && item.currentVersion.length > 0
    && typeof item.fingerprint === "string" && /^sha256-[a-f0-9]{64}$/.test(item.fingerprint)));
}

export default function PublishedMapPicker({ busy, onLink }: { busy: boolean; onLink: (fields: Record<string, unknown>) => void }) {
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState({ query: "", cursor: "", attempt: 0 });
  const [page, setPage] = useState<{ items: PublishedMap[]; next: string | null } | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({ limit: "24" });
    if (request.query.trim()) params.set("q", request.query.trim());
    if (request.cursor) params.set("cursor", request.cursor);
    void fetch("/api/catalog?" + params, { signal: abort.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Published decision maps could not be loaded. Try again.");
      const data = await response.json();
      if (!data || typeof data !== "object" || !("items" in data) || !("nextCursor" in data)) throw new Error("The decision map list could not be read.");
      const items = publishedMaps(data.items);
      if (!abort.signal.aborted) setPage({ items, next: typeof data.nextCursor === "string" ? data.nextCursor : null });
    }).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Decision maps could not be loaded."); });
    return () => abort.abort();
  }, [request]);
  const load = (cursor = "") => {
    setPage(null); setSelected(""); setError("");
    setRequest(previous => ({ query: cursor ? previous.query : query, cursor, attempt: previous.attempt + 1 }));
  };
  const choice = page?.items.find(item => item.id === selected);
  return <section aria-label="Choose a published decision map" className={styles.actionForm}>
    <h4>Choose a published decision map</h4>
    <p>Search the shared published library. Private Studio drafts are not listed here. Linking records the selected version; it does not approve its conclusions.</p>
    <form onSubmit={event => { event.preventDefault(); load(); }}>
      <label className={styles.field}><span>Search by title or subject</span><input value={query} maxLength={120} onChange={event => setQuery(event.target.value)}/></label>
      <button className={styles.secondaryButton} disabled={busy}>Search maps</button>
    </form>
    {error ? <div role="alert"><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={() => load(request.cursor)}>Retry</button></div>
      : !page ? <p role="status">Loading published maps…</p>
      : <>
        {page.items.length === 0 ? <p>No matching published maps on this page. Try another search or open your draft in AI Case Studio.</p>
          : <label className={styles.field}><span>Published map and version</span><select value={selected} onChange={event => setSelected(event.target.value)} disabled={busy}><option value="">Choose a decision map…</option>{page.items.map(item => <option key={item.id} value={item.id}>{item.title} · version {item.currentVersion}</option>)}</select></label>}
        {page.next && <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => load(page.next!)}>Next page</button>}
        {request.cursor && <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => load()}>Back to first page</button>}
        {choice && <p>Link “{choice.title}”, version {choice.currentVersion}, to this case? CaseVant checks the saved version before linking.</p>}
        <button type="button" className={styles.primaryButton} disabled={!choice || busy} onClick={() => { if (choice && !busy) onLink({ packageId: choice.id, packageVersion: choice.currentVersion, packageFingerprint: choice.fingerprint, simulationReceiptIds: [] }); }}>{busy ? "Saving…" : "Link selected map"}</button>
      </>}
  </section>;
}
